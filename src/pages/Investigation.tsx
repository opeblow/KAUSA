import { createRef, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  Square,
  Database,
  ShieldCheck,
  ListChecks,
  Info,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { AnimatedList } from "@/components/ui/animated-list";
import { Waterfall } from "@/components/charts";
import { useInvestigation } from "@/store/investigation";
import { formatCurrency, cn } from "@/lib/utils";

const roles = ["Scoper", "Hypothesizer", "Executor", "Critic", "Narrator"];

const roleForPhase: Record<string, number> = {
  scoped: 0,
  planned: 1,
  testing: 2,
  attributing: 3,
  narrating: 4,
  verified: 4,
  done: 4,
};

export function Investigation() {
  const {
    id,
    started,
    phase,
    step,
    question,
    hypotheses,
    queryLog,
    events,
    attributionReady,
    elapsedMs,
    isRunning,
    isComplete,
    error,
    model,
    dataVersion,
    headline,
    attribution,
    narration,
    scope,
    cancel,
    reset,
  } = useInvestigation();

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(roles.map(() => createRef<HTMLDivElement>()));

  const activeRole = roleForPhase[phase] ?? 0;

  const doneCount = hypotheses.filter((h) =>
    ["supported", "weak", "refuted", "untestable"].includes(h.status),
  ).length;

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Investigation"
          title="No investigation running"
          description="Ask a question to start. Kausa will show its reasoning as it happens: the plan, each hypothesis tested, the queries, and the verdict."
        />
        <div className="panel mt-8 flex flex-col items-center justify-center p-12 text-center">
          <ListChecks className="size-7 text-accent-soft" />
          <p className="mt-4 text-sm text-ink-muted">
            Start from the Ask screen with one of your datasets.
          </p>
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Live investigation"
        title={question}
        description={
          <span className="font-mono text-xs text-ink-faint">
            id {id ? `${id.slice(0, 8)}…` : "—"} · {model} · {dataVersion}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <span className="tabular font-mono text-sm text-ink-muted">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
            {isRunning ? (
              <button
                onClick={cancel}
                className="inline-flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/10 px-4 py-2.5 text-sm text-negative transition-colors hover:bg-negative/20"
              >
                <Square className="size-3.5" /> Cancel
              </button>
            ) : (
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                New investigation
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/[0.06] px-4 py-3 text-xs text-negative">
          <AlertTriangle className="size-3.5" /> {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">Plan</h2>
              <span className="tabular text-xs text-ink-faint">
                {doneCount}/{hypotheses.length} tested
              </span>
            </div>

            <div className="mt-4 flex flex-col">
              {hypotheses.length === 0 && (
                <div className="flex items-center gap-3 py-6 text-sm text-ink-muted">
                  <Loader2 className="size-4 animate-spin text-accent" /> {step || "Resolving scope and planning…"}
                </div>
              )}
              {hypotheses.map((h) => (
                <motion.div key={h.id} layout className="border-b border-line/60 py-3.5 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-xs text-ink-faint">{h.id}</span>
                      <span className="truncate text-sm text-ink">{h.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {h.contribution !== null && h.status !== "refuted" && (
                        <span className="tabular text-sm text-ink-muted">
                          {formatCurrency(h.contribution, { compact: true })}
                        </span>
                      )}
                      <span className="tabular hidden font-mono text-[11px] text-ink-faint sm:inline">
                        {["supported", "weak", "refuted", "untestable"].includes(h.status)
                          ? `${(h.durationMs / 1000).toFixed(2)}s`
                          : ""}
                      </span>
                      <StatusPill status={h.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 pl-8 text-xs text-ink-faint">
                    <span className="font-mono">{h.test}</span>
                    {["supported", "weak", "refuted", "untestable"].includes(h.status) && (
                      <span className="text-ink-muted">{h.reason}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="panel-hero p-6">
            <BorderBeam size={220} duration={18} />
            <h2 className="text-sm font-medium text-ink">Verdict</h2>
            {!attributionReady || !headline ? (
              <div className="mt-4 flex min-h-40 flex-col items-center justify-center text-center">
                <Loader2 className="size-5 animate-spin text-accent" />
                <p className="mt-3 text-sm text-ink-muted">
                  Attribution runs once the tests finish. The verdict area fills in as soon as it completes.
                </p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <p className="text-sm text-ink-muted">
                  {scope.metric} for {scope.entity.toLowerCase()} moved{" "}
                  <span className="text-ink">
                    {headline.changePct >= 0 ? "+" : ""}
                    {headline.changePct.toFixed(1)}%
                  </span>{" "}
                  over the window, a gap of{" "}
                  <span className="tabular text-ink">{formatCurrency(headline.gap, { compact: true })}</span>{" "}
                  against expected.{" "}
                  {attribution[0]
                    ? `The largest measured driver is ${attribution[0].group.toLowerCase()}.`
                    : ""}
                </p>
                <div className="mt-6">
                  <Waterfall items={attribution} start={headline.expected} end={headline.actual} />
                </div>
                <Link
                  to={`/app/verdict?i=${id ?? ""}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-accent-soft hover:underline"
                >
                  Open full verdict <ArrowRight className="size-4" />
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="panel p-5">
            <h3 className="text-sm font-medium text-ink">Agent graph</h3>
            <p className="mt-1 text-xs text-ink-faint">live · inspectable</p>
            <div ref={containerRef} className="relative mt-5 h-72">
              <div className="flex h-full flex-col justify-between py-2">
                {roles.map((role, i) => (
                  <div
                    key={role}
                    ref={nodeRefs.current[i]}
                    className={cn(
                      "relative z-10 flex w-fit items-center gap-2 rounded-xl border px-3.5 py-2 text-xs transition-colors",
                      i === activeRole && isRunning
                        ? "border-accent/50 bg-accent/10 text-ink"
                        : isComplete || i < activeRole
                          ? "border-line bg-base-850 text-ink-muted"
                          : "border-line bg-base-900 text-ink-faint",
                    )}
                  >
                    {i === activeRole && isRunning ? (
                      <Loader2 className="size-3.5 animate-spin text-accent" />
                    ) : i < activeRole || isComplete ? (
                      <CheckCircle2 className="size-3.5 text-positive" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-ink-faint" />
                    )}
                    {role}
                    {i === activeRole && isRunning && (
                      <span className="absolute -right-2 -top-2 size-2 animate-ping rounded-full bg-accent" />
                    )}
                  </div>
                ))}
              </div>
              {nodeRefs.current.slice(0, -1).map((_, i) => (
                <AnimatedBeam
                  key={i}
                  containerRef={containerRef}
                  fromRef={nodeRefs.current[i]}
                  toRef={nodeRefs.current[i + 1]}
                  curvature={i % 2 === 0 ? -18 : 18}
                  duration={3 + i}
                  delay={i * 0.3}
                />
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Database className="size-4 text-accent-soft" /> Query log
            </h3>
            <p className="mt-1 text-xs text-ink-faint">read-only over your uploaded data</p>
            <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {queryLog.map((q, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-mono text-[11px] leading-relaxed text-ink-muted"
                >
                  <span className="text-accent-soft">›</span> {q}
                </motion.p>
              ))}
              {queryLog.length === 0 && <p className="text-xs text-ink-faint">Waiting for the first query…</p>}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
              <ListChecks className="size-4 text-accent-soft" /> Event stream
            </h3>
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
              <AnimatedList delay={60}>
                {events.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-[11px]">
                    <span
                      className={cn(
                        "mt-1 size-1.5 shrink-0 rounded-full",
                        e.kind === "error"
                          ? "bg-negative"
                          : e.kind === "done"
                            ? "bg-positive"
                            : "bg-accent",
                      )}
                    />
                    <div>
                      <span className="font-mono text-ink-faint">{e.label}</span>
                      <span className="ml-2 text-ink-muted">{e.text}</span>
                    </div>
                  </div>
                ))}
              </AnimatedList>
            </div>
            {isComplete && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-positive/25 bg-positive/[0.06] px-3 py-2 text-xs text-positive">
                <ShieldCheck className="size-3.5" /> Verdict written · numbers verified against the ledger
              </div>
            )}
          </div>

          {narration.length > 0 && (
            <div className="panel p-5">
              <h3 className="text-sm font-medium text-ink">Narrated summary</h3>
              <div className="mt-3 flex flex-col gap-2">
                {narration.map((n, i) => (
                  <p key={i} className="text-xs leading-relaxed text-ink-muted">
                    {n}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-line/70 bg-white/[0.02] p-3 text-xs text-ink-faint">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Every number is computed from your data and stored as a claim you can inspect. The narrative is
            written only from those verified numbers.
          </div>
        </aside>
      </div>
    </div>
  );
}
