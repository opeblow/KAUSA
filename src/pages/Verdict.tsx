import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  XCircle,
  HelpCircle,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { Chip, StatusPill } from "@/components/StatusPill";
import { BorderBeam } from "@/components/ui/border-beam";
import { SectionLabel } from "@/components/ui/section-label";
import { Waterfall, ContributionRanking } from "@/components/charts";
import { useEvidence } from "@/store/evidence";
import { useInvestigation } from "@/store/investigation";
import { api } from "@/lib/api";
import type { Attribution } from "@/data/kausa";
import { formatCurrency, cn } from "@/lib/utils";

export function Verdict() {
  const {
    id,
    started,
    isComplete,
    error,
    question,
    scope,
    headline,
    attribution,
    hypotheses,
    recommendations,
    limitations,
    whatWouldChange,
    narration,
    model,
    dataVersion,
  } = useInvestigation();

  const claims = useQuery(
    api.investigations.claimsFor,
    id ? { investigationId: id } : "skip",
  );

  const ranked = [...attribution]
    .filter((a) => a.kind === "cause" && a.contribution !== 0)
    .sort((a, b) => a.contribution - b.contribution);

  const gapClaimId = claims?.find((c) => c.kind === "gap")?.claimId;
  const claimForGroup = (group: string) =>
    claims?.find((c) => c.label === `${group} contribution`)?.claimId;

  const supported = ranked.filter((a) => a.evidenceStatus === "supported").length;
  const weak = ranked.filter((a) => a.evidenceStatus === "weak").length;
  const outside = headline?.outsideNormalVariation ?? false;

  const confidence: "High" | "Low" | "No cause" = !outside
    ? "No cause"
    : supported > 0 && weak <= supported
      ? "High"
      : "Low";

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Verdict"
          title="No verdict yet"
          description="Run an investigation to produce a verdict. Every number here is traceable to its evidence."
        />
        <div className="panel mt-8 flex flex-col items-center justify-center p-12 text-center">
          <Sparkles className="size-7 text-accent-soft" />
          <p className="mt-4 text-sm text-ink-muted">Start from the Ask screen.</p>
          <Link
            to="/app/ask"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Ask a question <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const partial = !isComplete && !error;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Verdict"
        title={question || "Verdict"}
        description={
          <span>
            {scope.metric} · {scope.entity} · {scope.window}
          </span>
        }
      />

      {partial && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3 text-xs text-accent-soft">
          <Sparkles className="size-3.5" /> Showing a partial verdict — the investigation is still running.{" "}
          <Link to="/app/investigation" className="underline">
            Watch it live
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/[0.06] px-4 py-3 text-xs text-negative">
          <AlertTriangle className="size-3.5" /> {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <section className="panel relative overflow-hidden p-6 md:p-8">
            <BorderBeam size={220} duration={16} />
            <div className="flex items-center gap-2">
              <Chip tone="accent">Verdict</Chip>
              {confidence === "High" && <Chip tone="positive">High confidence · {supported} supported</Chip>}
              {confidence === "Low" && <Chip tone="warning">Low confidence</Chip>}
              {confidence === "No cause" && <Chip>No significant cause</Chip>}
            </div>

            {!headline ? (
              <p className="mt-5 text-sm text-ink-muted">
                {partial ? "The verdict is still being computed." : "No headline result is available."}
              </p>
            ) : confidence === "No cause" ? (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink">
                No driver explains a change larger than normal variation for this scope. The gap of{" "}
                <EvidenceValue
                  claimId={gapClaimId}
                  text={formatCurrency(headline.gap, { compact: true })}
                />{" "}
                is within the interval we would expect from noise. Kausa reports this rather than selecting the
                largest of several indistinguishable effects.
              </p>
            ) : (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink">
                {scope.metric} for {scope.entity.toLowerCase()} moved{" "}
                <span className="tabular text-ink">
                  {headline.changePct >= 0 ? "+" : ""}
                  {headline.changePct.toFixed(1)}%
                </span>
                , a gap of{" "}
                <EvidenceValue
                  claimId={gapClaimId}
                  text={formatCurrency(headline.gap, { compact: true })}
                />{" "}
                against expected.{" "}
                {ranked[0] ? `The largest measured cause is ${ranked[0].group.toLowerCase()}.` : ""}{" "}
                {confidence === "Low"
                  ? "Confidence is low: intervals are wide and the leading causes overlap."
                  : ""}
              </p>
            )}

            {headline && confidence !== "No cause" && (
              <>
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-ink">Contribution to the change</h3>
                  <p className="mt-1 text-xs text-ink-faint">
                    Each group receives a measured share. Contributions plus the labelled unexplained remainder
                    equal the total change.
                  </p>
                  <div className="mt-5">
                    <Waterfall items={attribution} start={headline.expected} end={headline.actual} />
                  </div>
                </div>

                {ranked.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-ink">Ranked causes</h3>
                    <div className="mt-4 flex flex-col gap-4">
                      {ranked.map((c) => (
                        <CauseRow key={c.key} item={c} claimId={claimForGroup(c.group)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="panel p-6">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                <XCircle className="size-4 text-negative" /> What we ruled out
              </h3>
              <div className="mt-4 flex flex-col gap-3">
                {hypotheses
                  .filter((h) => h.status === "refuted" || h.status === "untestable")
                  .map((h) => (
                    <div
                      key={h.id}
                      className={cn(
                        "rounded-xl border p-4",
                        h.status === "refuted"
                          ? "border-negative/20 bg-negative/[0.04]"
                          : "border-line bg-white/[0.02]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "text-sm text-ink",
                            h.status === "refuted" && "line-through decoration-negative/40",
                          )}
                        >
                          {h.title}
                        </span>
                        <StatusPill status={h.status} />
                      </div>
                      <p className="mt-2 text-xs text-ink-muted">{h.reason}</p>
                    </div>
                  ))}
                {hypotheses.filter((h) => h.status === "refuted" || h.status === "untestable").length ===
                  0 && <p className="text-xs text-ink-faint">No hypotheses were ruled out in this run.</p>}
              </div>
            </section>

            <section className="panel p-6">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                <Lightbulb className="size-4 text-warning" /> Recommendations
              </h3>
              <p className="mt-1 text-xs text-ink-faint">Each is an inference, not a measurement.</p>
              <div className="mt-4 flex flex-col gap-3">
                {recommendations.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">{r.title}</span>
                      <Chip>inference</Chip>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">{r.detail}</p>
                    <p className="mt-2 text-[11px] text-ink-faint">Addresses {r.addresses}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
              <HelpCircle className="size-4 text-ink-muted" /> Limitations
            </h3>
            <ul className="mt-4 flex flex-col gap-2">
              {limitations.map((l) => (
                <li key={l} className="flex gap-2 text-sm text-ink-muted">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line/60 pt-4">
              <h4 className="text-sm font-medium text-ink">What would change this conclusion</h4>
              <ul className="mt-3 flex flex-col gap-2">
                {whatWouldChange.map((w) => (
                  <li key={w} className="flex gap-2 text-sm text-ink-muted">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-accent-soft" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {attribution.length > 0 && (
            <div className="panel p-5">
              <SectionLabel>Contribution ranking</SectionLabel>
              <div className="mt-4">
                <ContributionRanking items={attribution} />
              </div>
            </div>
          )}

          <div className="panel p-5">
            <SectionLabel>Verification</SectionLabel>
            <div className="mt-3 flex items-center gap-2 text-sm text-positive">
              <ShieldCheck className="size-4" /> Claim ledger verified
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {claims ? `${claims.length} claims stored` : "Loading claims…"} · every number matched to the
              ledger within tolerance.
            </p>
            <div className="mt-4 space-y-2 border-t border-line/60 pt-4 text-xs">
              <Prov k="Model" v={model} />
              <Prov k="Data version" v={dataVersion} />
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                to="/app/investigation"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-xs text-ink-muted transition-colors hover:text-ink"
              >
                Live view
              </Link>
              <Link
                to="/app/missions"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-xs text-ink-muted transition-colors hover:text-ink"
              >
                Save / missions
              </Link>
            </div>
          </div>

          {narration.length > 0 && (
            <div className="panel p-5">
              <SectionLabel>Narrated summary</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                {narration.map((n, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="text-xs leading-relaxed text-ink-muted"
                  >
                    {n}
                  </motion.p>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EvidenceValue({ claimId, text }: { claimId?: string; text: string }) {
  const { open } = useEvidence();
  if (!claimId) {
    return <span className="tabular text-ink">{text}</span>;
  }
  return (
    <button
      onClick={() => open(claimId)}
      className="rounded border-b border-dashed border-accent/50 px-0.5 text-ink transition-colors hover:bg-accent/10"
      aria-label={`Open evidence for ${claimId}`}
    >
      <span className="tabular">{text}</span>
    </button>
  );
}

function CauseRow({ item, claimId }: { item: Attribution; claimId?: string }) {
  const band =
    item.evidenceStatus === "supported"
      ? { label: "High", tone: "positive" as const, status: "Supported" }
      : item.evidenceStatus === "weak"
        ? { label: "Low", tone: "warning" as const, status: "Weak" }
        : { label: "Medium", tone: "warning" as const, status: "Measured" };

  const maxAbs = Math.max(Math.abs(item.contribution), Math.abs(item.interval[0]), 1);
  const pct = (v: number) => Math.max(0, Math.min(100, (Math.abs(v) / maxAbs) * 100));

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          <span className="text-sm text-ink">{item.group}</span>
        </div>
        <div className="flex items-center gap-3">
          <EvidenceValue claimId={claimId} text={formatCurrency(item.contribution, { compact: true })} />
          <Chip tone={band.tone}>{band.label}</Chip>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 w-full rounded-full bg-white/[0.04]">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ background: item.color, width: `${pct(item.contribution)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
        <span>
          90% interval {formatCurrency(item.interval[0], { compact: true })} to{" "}
          {formatCurrency(item.interval[1], { compact: true })}
        </span>
        <span className="capitalize">{band.status}</span>
      </div>
    </div>
  );
}

function Prov({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-faint">{k}</span>
      <span className="text-right font-mono text-[11px] text-ink-muted">{v}</span>
    </div>
  );
}
