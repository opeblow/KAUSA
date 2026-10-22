import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Archive,
  Play,
  CheckCircle2,
  XCircle,
  Brain,
  Loader2,
  Star,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { BorderBeam } from "@/components/ui/border-beam";
import { SectionLabel } from "@/components/ui/section-label";
import { useInvestigation } from "@/store/investigation";
import { api, type Id } from "@/lib/api";
import { formatPercent, cn } from "@/lib/utils";

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function Missions() {
  const navigate = useNavigate();
  const { start } = useInvestigation();
  const runs = useQuery(api.investigations.list);
  const setSaved = useMutation(api.investigations.setSaved);
  const remove = useMutation(api.investigations.remove);

  const [selected, setSelected] = useState<Id<"investigations"> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected && runs && runs.length > 0) setSelected(runs[0]._id);
  }, [runs, selected]);

  const detail = useQuery(api.investigations.get, selected ? { id: selected } : "skip");

  const rerun = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await start({
        question: detail.question,
        datasetId: detail.datasetId,
        dim: detail.scope.dim || undefined,
        value: detail.scope.value || undefined,
        windowStart: detail.scope.windowStart,
        windowEnd: detail.scope.windowEnd,
        comparisonStart: detail.scope.comparisonStart,
        comparisonEnd: detail.scope.comparisonEnd,
      });
      navigate("/app/investigation");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!selected) return;
    await remove({ id: selected });
    setSelected(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Missions"
        title="Saved investigations"
        description="Every investigation is persisted — plan, parameters and results — so you can replay it, rerun it on new data, and keep what was confirmed or refuted."
        actions={
          <Link
            to="/app/ask"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            New investigation <ArrowRight className="size-4" />
          </Link>
        }
      />

      {runs && runs.length === 0 && (
        <div className="panel mt-8 flex flex-col items-center justify-center p-12 text-center">
          <Archive className="size-7 text-accent-soft" />
          <p className="mt-4 text-sm text-ink-muted">No investigations yet. Ask a question to create one.</p>
          <Link
            to="/app/ask"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Ask a question <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      {runs && runs.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3">
            {runs.map((m, i) => (
              <motion.button
                key={m._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(m._id)}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-5 text-left transition-colors",
                  selected === m._id
                    ? "border-accent/40 bg-accent/[0.06]"
                    : "border-line bg-base-900/50 hover:border-line/80 hover:bg-white/[0.02]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
                      <Archive className="size-4 text-ink-muted" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm text-ink">{m.name ?? m.question}</h3>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        {m.metric} · {m.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.saved && <Star className="size-3.5 fill-warning text-warning" />}
                    {m.changePct !== null && (
                      <span className={cn("tabular text-xs", m.changePct < 0 ? "text-negative" : "text-positive")}>
                        {formatPercent(m.changePct)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pl-12 text-xs text-ink-muted">
                  <span className="truncate">{m.question}</span>
                  <span className="ml-auto shrink-0">{fmt(m.createdAt)}</span>
                </div>
              </motion.button>
            ))}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="panel-hero p-5">
              <BorderBeam size={200} duration={18} />
              <div className="flex items-center gap-2">
                <Play className="size-4 text-accent-soft" />
                <h3 className="text-sm font-medium text-ink">Run detail</h3>
              </div>
              {detail ? (
                <>
                  <p className="mt-1 truncate text-xs text-ink-faint">{detail.question}</p>

                  <dl className="mt-4 space-y-2 text-xs">
                    <Row k="Status" v={detail.status} />
                    <Row k="Metric" v={detail.scope.metric} />
                    <Row
                      k="Change"
                      v={detail.headline ? formatPercent(detail.headline.changePct) : "—"}
                    />
                    <Row k="Model" v={detail.model} />
                    <Row k="Created" v={fmt(detail.createdAt)} />
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void rerun()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-70"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      Rerun on current data
                    </button>
                    <button
                      onClick={() => void setSaved({ id: detail._id, saved: !detail.saved })}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      <Star className={cn("size-3.5", detail.saved && "fill-warning text-warning")} />
                      {detail.saved ? "Unsave" : "Save"}
                    </button>
                    <Link
                      to={`/app/verdict?i=${detail._id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      Open verdict <ArrowRight className="size-3.5" />
                    </Link>
                    <button
                      onClick={() => void onRemove()}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-faint transition-colors hover:text-negative"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
                  <Loader2 className="size-3.5 animate-spin" /> Loading…
                </div>
              )}
            </div>

            {detail && (
              <div className="panel p-5">
                <SectionLabel>
                  <Brain className="size-4 text-accent-soft" /> Memory
                </SectionLabel>
                <p className="mt-3 text-xs text-ink-faint">
                  Confirmed and refuted hypotheses from this investigation.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  {detail.hypotheses
                    .filter((h) => h.status === "supported" || h.status === "refuted")
                    .map((h) => (
                      <div key={h.id} className="flex items-start gap-3">
                        {h.status === "supported" ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
                        ) : (
                          <XCircle className="mt-0.5 size-4 shrink-0 text-negative" />
                        )}
                        <div>
                          <p className="text-sm text-ink">{h.title}</p>
                          <p className="mt-0.5 text-[11px] text-ink-faint">
                            {h.test} · {h.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  {detail.hypotheses.filter((h) => h.status === "supported" || h.status === "refuted").length ===
                    0 && <p className="text-xs text-ink-faint">No confirmed or refuted hypotheses yet.</p>}
                </div>
              </div>
            )}

            {detail && detail.hypotheses.length > 0 && (
              <div className="panel p-5">
                <SectionLabel>Hypotheses</SectionLabel>
                <div className="mt-4 flex flex-col gap-2">
                  {detail.hypotheses.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-ink-muted">{h.title}</span>
                      <StatusPill status={h.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="truncate text-ink-muted">{v}</dd>
    </div>
  );
}
