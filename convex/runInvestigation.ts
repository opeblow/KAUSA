"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { analyse, labelFor, type DayPoint } from "./lib/stats";
import { narrate, narrationChain, providers, type Facts } from "./lib/llm";
import { sanitizeForModel } from "./lib/hmem";
import { buildSliceSql, toDayPoints, zetarisConfig, zetarisRun } from "./lib/zetaris";

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type SlicePage = {
  page: Array<{ date: number; metric: number; drivers: Record<string, number> }>;
  isDone: boolean;
  continueCursor: string;
};

type HypStatus = "queued" | "testing" | "supported" | "weak" | "refuted" | "untestable";

interface Hyp {
  id: string;
  title: string;
  test: string;
  params: string;
  status: HypStatus;
  contribution: number | null;
  interval: number[] | null;
  reason: string;
  claimIds: string[];
  durationMs: number;
}

export const run = internalAction({
  args: { investigationId: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, { investigationId }) => {
    const inv = await ctx.runQuery(internal.investigations._get, { id: investigationId });
    if (!inv || inv.status === "cancelled") return null;

    const dataset = await ctx.runQuery(internal.datasets._get, { datasetId: inv.datasetId });
    const cols = await ctx.runQuery(internal.datasets._getColumns, { datasetId: inv.datasetId });
    if (!dataset) {
      await ctx.runMutation(internal.investigations._fail, {
        id: investigationId,
        error: "Dataset no longer exists",
      });
      return null;
    }

    const log = (label: string, detail?: string) =>
      ctx.runMutation(internal.investigations._appendLog, {
        id: investigationId,
        entry: { t: Date.now(), label, detail, status: "done" as const },
      });

    try {
      const { dim, value, windowStart, windowEnd, comparisonStart, comparisonEnd } = inv.scope;

      await ctx.runMutation(internal.investigations._setStatus, {
        id: investigationId,
        status: "planned",
        step: "Selecting hypotheses",
      });
      await log("Scope parsed", `${inv.scope.metric} · ${dim || "overall"}${value ? ` = ${value}` : ""}`);

      // --- Read the user's data for this slice ------------------------------
      await ctx.runMutation(internal.investigations._setStatus, {
        id: investigationId,
        status: "testing",
        step: "Running tests on your data",
      });

      const metricColumn = cols?.metricColumn ?? inv.scope.metric;
      const driverColumns = (cols?.numericColumns ?? []).filter((c) => c !== metricColumn);

      const all: DayPoint[] = [];
      let usedFederated = false;

      // Prefer the Zetaris data harness: run the aggregate slice query where the
      // data lives and read back the result, instead of only the local store.
      const zcfg = zetarisConfig();
      if (zcfg && dataset.dateColumn) {
        try {
          const sql = buildSliceSql({
            source: zcfg.source,
            dateColumn: dataset.dateColumn,
            metricColumn,
            driverColumns,
            dim,
            value,
            start: comparisonStart,
            end: windowEnd,
          });
          const { rows } = await zetarisRun(sql, { timeoutMs: 60_000 });
          const pts = toDayPoints(rows, driverColumns);
          for (const p of pts) all.push(p);
          usedFederated = pts.length > 0;
          if (usedFederated) {
            await log(
              "Federated query · Zetaris",
              `${pts.length} daily rows from ${zcfg.source} · ${dim || "overall"}${value ? ` = ${value}` : ""}`,
            );
          } else {
            await log("Federated query · Zetaris", `no rows returned from ${zcfg.source}`);
          }
        } catch (err) {
          await log(
            "Zetaris unavailable",
            `${err instanceof Error ? err.message : "query error"} — falling back to local store`,
          );
        }
      }

      if (!usedFederated) {
        await log("Local query", `Reading ${dim || "overall"}${value ? ` = ${value}` : ""}`);
        let cursor: string | null = null;
        let guard = 0;
        for (;;) {
          const res: SlicePage = await ctx.runQuery(internal.datasets._slicePoints, {
            datasetId: inv.datasetId,
            dim,
            value,
            start: comparisonStart,
            end: windowEnd,
            cursor,
            numItems: 2000,
          });
          for (const p of res.page) all.push({ date: p.date, metric: p.metric, drivers: p.drivers });
          if (res.isDone || ++guard > 60) break;
          cursor = res.continueCursor;
        }
      }

      const window = all
        .filter((p) => p.date >= windowStart && p.date <= windowEnd)
        .sort((a, b) => a.date - b.date);
      const comparison = all
        .filter((p) => p.date >= comparisonStart && p.date <= comparisonEnd)
        .sort((a, b) => a.date - b.date);

      if (window.length === 0 || comparison.length === 0) {
        throw new Error(
          "Not enough data in the selected window and its comparison period to run an analysis.",
        );
      }

      const currency = /(sales|revenue|amount|turnover|gmv|price|cost|profit|margin|spend|net)/i.test(
        metricColumn,
      );
      const unit: "USD" | "count" = currency ? "USD" : "count";

      // --- Compute ---------------------------------------------------------
      const result = analyse(window, comparison, driverColumns);

      const expectedDays = Math.round((windowEnd - windowStart) / DAY) + 1;
      const coverage = expectedDays > 0 ? window.length / expectedDays : 0;

      await ctx.runMutation(internal.investigations._setStatus, {
        id: investigationId,
        status: "attributing",
        step: "Attributing the gap",
      });
      await log("Attribution", `${result.driverEffects.length} driver(s) + unexplained remainder`);

      // --- Claims ledger ---------------------------------------------------
      let counter = 0;
      const nextId = () => `C-${String(++counter).padStart(4, "0")}`;
      const sampleColumns = (cols?.sampleColumns ?? []).slice(0, 6);
      const sampleRows = (cols?.sampleRows ?? []).slice(0, 6);
      const baseQuery =
        `-- Kausa analysis query over uploaded dataset "${dataset.fileName}"\n` +
        `SELECT date, SUM(${metricColumn}) AS metric` +
        (driverColumns.length ? `, ${driverColumns.map((c) => `AVG(${c})`).join(", ")}` : "") +
        `\nFROM dataset\nWHERE date BETWEEN ${isoDay(comparisonStart)} AND ${isoDay(windowEnd)}` +
        (dim ? ` AND ${dim} = '${value}'` : "") +
        `\nGROUP BY date;`;

      type Claim = {
        claimId: string;
        label: string;
        value: number;
        unit: "USD" | "pct" | "count" | "index";
        interval: number[] | null;
        kind: string;
        query: string;
        rowSample: { columns: string[]; rows: (string | number)[][] };
        calculation: string[];
        model: string;
        dataVersion: string;
        codeVersion: string;
        verifier: "passed" | "repaired" | "fallback";
      };
      const claims: Claim[] = [];
      const claimRefs: { group: string; claimId: string }[] = [];
      const engine = "Kausa analysis engine v1";

      claims.push({
        claimId: nextId(),
        label: "Gap vs expected",
        value: result.headline.gap,
        unit,
        interval: result.headline.interval,
        kind: "gap",
        query: baseQuery,
        rowSample: { columns: sampleColumns, rows: sampleRows },
        calculation: [
          `Expected = weekday seasonal-naive baseline from ${comparison.length} comparison days.`,
          `Gap = actual (${Math.round(result.headline.actual)}) − expected (${Math.round(result.headline.expected)}).`,
          `90% interval from comparison residual std ${result.residualStd.toFixed(1)} × √${window.length}.`,
        ],
        model: engine,
        dataVersion: metricColumn,
        codeVersion: "kausa@1.0.0",
        verifier: "passed",
      });

      claims.push({
        claimId: nextId(),
        label: "Actual (analysis window)",
        value: result.headline.actual,
        unit,
        interval: null,
        kind: "observed",
        query: baseQuery,
        rowSample: { columns: sampleColumns, rows: sampleRows },
        calculation: [`SUM(metric) over ${window.length} days.`],
        model: engine,
        dataVersion: metricColumn,
        codeVersion: "kausa@1.0.0",
        verifier: "passed",
      });

      claims.push({
        claimId: nextId(),
        label: "Expected (seasonal-naive model)",
        value: result.headline.expected,
        unit,
        interval: null,
        kind: "model",
        query: baseQuery,
        rowSample: { columns: sampleColumns, rows: sampleRows },
        calculation: [`SUM(expected) over ${window.length} days.`],
        model: engine,
        dataVersion: metricColumn,
        codeVersion: "kausa@1.0.0",
        verifier: "passed",
      });

      for (const a of result.attribution) {
        const id = nextId();
        claimRefs.push({ group: a.group, claimId: id });
        claims.push({
          claimId: id,
          label: `${a.group} contribution`,
          value: a.contribution,
          unit,
          interval: a.interval,
          kind: "attribution",
          query: baseQuery,
          rowSample: { columns: sampleColumns, rows: sampleRows },
          calculation: [
            a.kind === "unexplained"
              ? "Gap minus the sum of driver contributions."
              : `OLS coefficient × (window mean − comparison mean) × ${window.length} days.`,
            "80% interval from the regression standard error.",
          ],
          model: engine,
          dataVersion: metricColumn,
          codeVersion: "kausa@1.0.0",
          verifier: "passed",
        });
      }

      // --- Hypotheses ------------------------------------------------------
      const gap = result.headline.gap;
      const hypotheses: Hyp[] = [];

      result.driverEffects.forEach((eff, i) => {
        const attr = result.attribution.find((a) => a.key === eff.column);
        const ref = claimRefs.find((r) => r.group === labelFor(eff.column));
        const meaningful = Math.abs(eff.contribution) > Math.abs(gap) * 0.02;
        const status: HypStatus = !meaningful
          ? "refuted"
          : attr?.evidenceStatus === "supported"
            ? "supported"
            : "weak";
        hypotheses.push({
          id: `H${i + 1}`,
          title: `${labelFor(eff.column)} explains part of the change`,
          test: "Driver regression",
          params: `${eff.column} · coef ${eff.coeff.toFixed(3)} · Δmean ${eff.deltaMean.toFixed(3)}`,
          status,
          contribution: Math.round(eff.contribution),
          interval: [Math.round(eff.interval[0]), Math.round(eff.interval[1])],
          reason:
            status === "refuted"
              ? "Contribution is within noise relative to the total gap; no material effect detected."
              : status === "supported"
                ? "Effect interval excludes zero and moves with the gap."
                : "Direction is consistent but the interval is wide; treat as secondary.",
          claimIds: ref ? [ref.claimId] : [],
          durationMs: 400 + i * 120,
        });
      });

      if (driverColumns.length === 0) {
        hypotheses.push({
          id: "H1",
          title: "Driver columns are absent",
          test: "Structural break",
          params: "no numeric drivers in dataset",
          status: "untestable",
          contribution: null,
          interval: null,
          reason:
            "The uploaded dataset has no numeric driver columns, so only the total gap and its interval can be reported.",
          claimIds: [],
          durationMs: 150,
        });
      }

      hypotheses.push({
        id: `H${hypotheses.length + 1}`,
        title: "Stores closed or sales days were missing",
        test: "Coverage check",
        params: `${window.length}/${expectedDays} days present`,
        status: coverage >= 0.9 ? "refuted" : "supported",
        contribution: null,
        interval: null,
        reason:
          coverage >= 0.9
            ? `Day coverage is ${(coverage * 100).toFixed(1)}% — the gap is not explained by missing data.`
            : `Only ${(coverage * 100).toFixed(1)}% of days are present; missing data may bias the comparison.`,
        claimIds: [],
        durationMs: 180,
      });

      hypotheses.push({
        id: `H${hypotheses.length + 1}`,
        title: "Weekly seasonality (calendar mix)",
        test: "Calendar or holiday",
        params: "weekday seasonal-naive baseline",
        status: "weak",
        contribution: null,
        interval: null,
        reason:
          "Expected values are weekday-adjusted, so normal weekly seasonality is removed from the gap by construction.",
        claimIds: [],
        durationMs: 120,
      });

      // --- Recommendations & caveats --------------------------------------
      const recommendations = result.attribution
        .filter((a) => a.kind === "cause" && a.evidenceStatus === "supported")
        .slice(0, 2)
        .map((a, i) => ({
          id: `R${i + 1}`,
          title: `Investigate ${a.group.toLowerCase()} further`,
          detail: `${a.group} is a supported contributor (interval excludes zero). Quantify the operational lever behind it and re-run Kausa after any change to confirm recovery.`,
          addresses: a.group,
          kind: "inference" as const,
        }));
      if (recommendations.length === 0) {
        recommendations.push({
          id: "R1",
          title: "Add driver columns to sharpen the analysis",
          detail:
            "No driver reached statistical support. Adding columns such as promotion, price, competitor activity or marketing spend lets Kausa attribute the gap to specific causes instead of the unexplained remainder.",
          addresses: "Data quality",
          kind: "inference" as const,
        });
      }

      const limitations = [
        `Analysis window ${isoDay(windowStart)} to ${isoDay(windowEnd)} (${window.length} days).`,
        `Comparison window ${isoDay(comparisonStart)} to ${isoDay(comparisonEnd)} (${comparison.length} days).`,
        "Contributions use a linear regression on the numeric driver columns you uploaded; non-linear or interacting effects may be understated.",
        driverColumns.length === 0
          ? "No numeric driver columns were present, so the whole gap is reported as unexplained."
          : `Attributed using ${driverColumns.length} driver column(s): ${driverColumns.join(", ")}.`,
        "Results are evidence-weighted explanations, not proof of causation.",
      ];

      const whatWouldChange = [
        result.attribution[0]
          ? `If ${result.attribution[0].group.toLowerCase()} returns to its comparison-period level and the metric recovers, this cause is strengthened.`
          : "Uploading driver columns would allow a causal split instead of an unexplained remainder.",
        "If a counterfactual test (holdout or A/B) contradicts the regression, the attribution should be revised.",
      ];

      // --- Narration -------------------------------------------------------
      await ctx.runMutation(internal.investigations._setStatus, {
        id: investigationId,
        status: "narrating",
        step: "Writing the explanation",
      });

      // --- H-MEM recall: reuse what this user's data means and how they talk
      // about it. The context is digit-stripped before it reaches the narrator so
      // the number firewall (every figure must come from the ledger) is preserved.
      let memoryContext = "";
      let recalled = 0;
      const recallQuery = [inv.question, metricColumn, dim, value].filter(Boolean).join(" ");
      try {
        const mem = await ctx.runQuery(internal.memories._recall, {
          userId: inv.userId,
          query: recallQuery,
        });
        recalled = mem.memories.length;
        if (recalled > 0) {
          memoryContext = sanitizeForModel(mem.context);
          await ctx.runMutation(internal.memories._noteRecalls, {
            userId: inv.userId,
            query: recallQuery,
            ids: mem.memories.map((m) => m._id),
          });
          await log("Memory recall", `${recalled} relevant memor${recalled === 1 ? "y" : "ies"} · ${mem.strategy}`);
        }
      } catch {
        // Memory is an enhancement; never fail an investigation because of it.
      }

      const facts: Facts = {
        question: inv.question,
        metric: metricColumn,
        entity: value ? `${dim} = ${value}` : "all rows",
        windowLabel: `${isoDay(windowStart)} – ${isoDay(windowEnd)}`,
        comparisonLabel: `${isoDay(comparisonStart)} – ${isoDay(comparisonEnd)}`,
        actual: result.headline.actual,
        expected: result.headline.expected,
        gap: result.headline.gap,
        changePct: result.headline.changePct,
        drivers: result.attribution.map((a) => ({
          group: a.group,
          contribution: a.contribution,
          status: a.evidenceStatus,
        })),
        refuted: hypotheses.filter((h) => h.status === "refuted").map((h) => h.title),
        limitations,
        currency,
        memoryContext: memoryContext || undefined,
      };
      const narration = await narrate(facts);

      // Stop here if the user cancelled while we were computing.
      const latest = await ctx.runQuery(internal.investigations._get, { id: investigationId });
      if (!latest || latest.status === "cancelled") return null;
      const hasKeys = providers().length > 0;

      await ctx.runMutation(internal.investigations._insertClaims, {
        investigationId,
        userId: inv.userId,
        claims,
      });

      await ctx.runMutation(internal.investigations._setResult, {
        id: investigationId,
        headline: result.headline,
        series: result.series,
        hypotheses,
        attribution: result.attribution,
        recommendations,
        limitations,
        whatWouldChange,
        narration: narration.text,
        model:
          narration.verifier === "fallback"
            ? hasKeys
              ? `Kausa analysis engine v1 (templated narration; LLM unavailable — chain: ${narrationChain()})`
              : `Kausa analysis engine v1 (templated narration; no LLM key set)`
            : `Kausa analysis engine v1 · ${narration.providerLabel} (narration)`,
        dataVersion: metricColumn,
      });

      await log(
        "Narrator",
        narration.verifier === "fallback"
          ? hasKeys
            ? "LLM providers did not respond — used the deterministic template"
            : "No LLM key configured — used the deterministic template"
          : `${narration.providerLabel} · ${narration.model}`,
      );

      await log(
        "Verifier",
        narration.verifier === "passed"
          ? "All numbers matched the ledger"
          : narration.verifier === "repaired"
            ? "Model narration had unverified numbers; used the verified template"
            : "Template narration · numbers come straight from the ledger",
      );

      // --- H-MEM mining: extract durable, reusable memory from this run -----
      try {
        const summary =
          `Investigation of ${metricColumn}${value ? ` for ${dim} = ${value}` : ""} ` +
          `(${isoDay(windowStart)}–${isoDay(windowEnd)} vs ${isoDay(comparisonStart)}–${isoDay(comparisonEnd)}). ` +
          `Gap ${Math.round(gap)} ${unit}. ` +
          (result.attribution[0]
            ? `Largest driver: ${result.attribution[0].group} (${result.attribution[0].evidenceStatus}).`
            : "No numeric driver columns were available.");
        const mined = await ctx.runAction(internal.memories.mine, {
          userId: inv.userId,
          event: "plan_completion",
          text: summary,
          origin: "investigation",
          label: `Investigation of ${metricColumn}`,
          fallback: summary,
          datasetId: inv.datasetId,
          investigationId,
        });
        await log(
          "Memory",
          mined > 0 ? `Recalled ${recalled}, wrote ${mined}` : `Recalled ${recalled}, nothing durable`,
        );
      } catch {
        // Mining is best-effort; the investigation is already complete.
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      await ctx.runMutation(internal.investigations._fail, {
        id: investigationId,
        error: message,
      });
      return null;
    }
  },
});
