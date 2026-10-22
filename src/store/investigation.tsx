import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api, type Id } from "@/lib/api";
import type {
  Attribution,
  Hypothesis,
  HypothesisStatus,
  InvestigationState,
  Recommendation,
  Scope,
  SeriesPoint,
} from "@/data/kausa";

export interface LiveEvent {
  id: number;
  at: number;
  kind:
    | "scope"
    | "plan"
    | "test"
    | "attribution"
    | "narration"
    | "notice"
    | "error"
    | "done";
  label: string;
  text: string;
}

export interface Headline {
  actual: number;
  expected: number;
  changePct: number;
  gap: number;
  interval: [number, number];
  outsideNormalVariation: boolean;
}

interface StartArgs {
  question: string;
  datasetId: Id<"datasets">;
  dim?: string;
  value?: string;
  windowStart?: number;
  windowEnd?: number;
  comparisonStart?: number;
  comparisonEnd?: number;
}

interface InvestigationContextValue {
  id: Id<"investigations"> | null;
  started: boolean;
  phase: InvestigationState;
  step: string;
  question: string;
  scope: Scope;
  hypotheses: Hypothesis[];
  queryLog: string[];
  events: LiveEvent[];
  narration: string[];
  attributionReady: boolean;
  elapsedMs: number;
  isRunning: boolean;
  isComplete: boolean;
  error: string | null;
  model: string;
  dataVersion: string;
  headline: Headline | null;
  series: SeriesPoint[];
  attribution: Attribution[];
  recommendations: Recommendation[];
  limitations: string[];
  whatWouldChange: string[];
  datasetId: Id<"datasets"> | null;
  start: (args: StartArgs) => Promise<Id<"investigations">>;
  reset: () => void;
  cancel: () => void;
}

const InvestigationContext = createContext<InvestigationContextValue | null>(null);

const EMPTY_SCOPE: Scope = {
  metric: "—",
  entity: "All rows",
  window: "—",
  comparison: "—",
};

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function kindFor(label: string): LiveEvent["kind"] {
  const l = label.toLowerCase();
  if (l.includes("scope")) return "scope";
  if (l.includes("plan") || l.includes("hypothes")) return "plan";
  if (l.includes("test") || l.includes("hypothesis")) return "test";
  if (l.includes("attribut") || l.includes("query")) return "attribution";
  if (l.includes("narrat") || l.includes("writ")) return "narration";
  if (l.includes("verif")) return "notice";
  if (l.includes("fail") || l.includes("error")) return "error";
  return "notice";
}

function sentenceSplit(text: string): string[] {
  // Split only where sentence punctuation is followed by whitespace, so numbers
  // like "$1.08M" or "23.6%" stay intact.
  return text
    .split(/(?<=[.!?]["']?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<Id<"investigations"> | null>(null);
  const [now, setNow] = useState(Date.now());

  const [params, setParams] = useSearchParams();
  const paramId = (params.get("i") as Id<"investigations"> | null) ?? null;

  const create = useMutation(api.investigations.create);
  const cancelMutation = useMutation(api.investigations.cancel);

  // An explicit ?i= link (e.g. "Open verdict" from Missions) wins over the
  // last investigation started in this session.
  const id = paramId ?? activeId;
  const inv = useQuery(api.investigations.get, id ? { id } : "skip");

  const phase: InvestigationState = (inv?.status ?? "scoped") as InvestigationState;
  const isRunning =
    Boolean(inv) && !["done", "cancelled", "failed"].includes(phase);
  const isComplete = phase === "done";

  useEffect(() => {
    if (!isRunning && phase !== "testing") return;
    if (!isRunning) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [isRunning, phase]);

  const elapsedMs = useMemo(() => {
    if (!inv) return 0;
    const end = inv.finishedAt ?? (isRunning ? now : inv.createdAt);
    return Math.max(0, end - inv.createdAt);
  }, [inv, isRunning, now]);

  const scope: Scope = useMemo(() => {
    if (!inv) return EMPTY_SCOPE;
    const s = inv.scope;
    const entity = s.dim
      ? s.value
        ? `${s.dim} = ${s.value}`
        : s.dim
      : "All rows";
    return {
      metric: s.metric,
      entity,
      window: `${fmtDay(s.windowStart)} – ${fmtDay(s.windowEnd)}`,
      comparison: `${fmtDay(s.comparisonStart)} – ${fmtDay(s.comparisonEnd)}`,
    };
  }, [inv]);

  const hypotheses: Hypothesis[] = useMemo(() => {
    if (!inv) return [];
    return inv.hypotheses.map((h) => ({
      id: h.id,
      title: h.title,
      test: h.test,
      params: h.params,
      status: h.status as HypothesisStatus,
      contribution: h.contribution,
      interval: h.interval ? [h.interval[0], h.interval[1]] : null,
      reason: h.reason,
      claimIds: h.claimIds,
      durationMs: h.durationMs,
    }));
  }, [inv]);

  const events: LiveEvent[] = useMemo(() => {
    if (!inv) return [];
    return inv.runLog.map((e, i) => ({
      id: i + 1,
      at: e.t - inv.createdAt,
      kind: e.status === "failed" ? "error" : kindFor(e.label),
      label: e.label,
      text: e.detail ?? "",
    }));
  }, [inv]);

  const queryLog: string[] = useMemo(() => {
    if (!inv) return [];
    return inv.runLog.map((e) => (e.detail ? `${e.label} · ${e.detail}` : e.label));
  }, [inv]);

  const narration: string[] = useMemo(() => {
    if (!inv?.narration) return [];
    return sentenceSplit(inv.narration);
  }, [inv]);

  const attribution: Attribution[] = useMemo(() => {
    if (!inv) return [];
    return inv.attribution.map((a) => ({
      group: a.group,
      key: a.key,
      contribution: a.contribution,
      interval: [a.interval[0], a.interval[1]] as [number, number],
      color: a.color,
      kind: a.kind,
      evidenceStatus: a.evidenceStatus,
    }));
  }, [inv]);

  const headline: Headline | null = useMemo(() => {
    if (!inv?.headline) return null;
    const h = inv.headline;
    return {
      actual: h.actual,
      expected: h.expected,
      changePct: h.changePct,
      gap: h.gap,
      interval: [h.interval[0], h.interval[1]] as [number, number],
      outsideNormalVariation: h.outsideNormalVariation,
    };
  }, [inv]);

  const series: SeriesPoint[] = useMemo(() => (inv?.series ?? []) as SeriesPoint[], [inv]);

  const recommendations: Recommendation[] = useMemo(
    () => (inv?.recommendations ?? []) as Recommendation[],
    [inv],
  );

  const attributionReady =
    Boolean(inv) &&
    attribution.length > 0 &&
    ["attributing", "narrating", "verified", "done"].includes(phase);

  const start = useCallback(
    async (args: StartArgs) => {
      const id = await create({
        datasetId: args.datasetId,
        question: args.question,
        dim: args.dim,
        value: args.value,
        windowStart: args.windowStart,
        windowEnd: args.windowEnd,
        comparisonStart: args.comparisonStart,
        comparisonEnd: args.comparisonEnd,
      });
      setActiveId(id);
      return id;
    },
    [create],
  );

  const reset = useCallback(() => {
    setActiveId(null);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("i");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const cancel = useCallback(() => {
    if (id) void cancelMutation({ id });
  }, [id, cancelMutation]);

  const value = useMemo<InvestigationContextValue>(
    () => ({
      id,
      started: Boolean(id),
      phase,
      step: inv?.step ?? "",
      question: inv?.question ?? "",
      scope,
      hypotheses,
      queryLog,
      events,
      narration,
      attributionReady,
      elapsedMs,
      isRunning,
      isComplete,
      error: inv?.error ?? null,
      model: inv?.model ?? "Kausa analysis engine v1",
      dataVersion: inv?.dataVersion ?? "—",
      headline,
      series,
      attribution,
      recommendations,
      limitations: inv?.limitations ?? [],
      whatWouldChange: inv?.whatWouldChange ?? [],
      datasetId: inv?.datasetId ?? null,
      start,
      reset,
      cancel,
    }),
    [
      id,
      phase,
      inv,
      scope,
      hypotheses,
      queryLog,
      events,
      narration,
      attributionReady,
      elapsedMs,
      isRunning,
      isComplete,
      headline,
      series,
      attribution,
      recommendations,
      start,
      reset,
      cancel,
    ],
  );

  return (
    <InvestigationContext.Provider value={value}>{children}</InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext);
  if (!ctx) throw new Error("useInvestigation must be used within InvestigationProvider");
  return ctx;
}

export function statusLabel(status: HypothesisStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "testing":
      return "Testing";
    case "supported":
      return "Supported";
    case "weak":
      return "Weak";
    case "refuted":
      return "Refuted";
    case "untestable":
      return "Untestable";
  }
}
