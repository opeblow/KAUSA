import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ArrowRight, Upload } from "lucide-react";
import { useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { BorderBeam } from "@/components/ui/border-beam";
import { Chip } from "@/components/StatusPill";
import { useInvestigation } from "@/store/investigation";
import { suggestedQuestions } from "@/data/kausa";
import { api, type Id } from "@/lib/api";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function fromIso(s: string): number {
  return new Date(`${s}T00:00:00.000Z`).getTime();
}

export function Ask() {
  const navigate = useNavigate();
  const { start } = useInvestigation();
  const datasets = useQuery(api.datasets.list);

  const ready = useMemo(
    () => (datasets ?? []).filter((d) => d.status === "ready"),
    [datasets],
  );

  const [datasetId, setDatasetId] = useState<Id<"datasets"> | null>(null);
  const [question, setQuestion] = useState("");
  const [dim, setDim] = useState("");
  const [value, setValue] = useState("");
  const [windowStart, setWindowStart] = useState(0);
  const [windowEnd, setWindowEnd] = useState(0);
  const [comparisonStart, setComparisonStart] = useState(0);
  const [comparisonEnd, setComparisonEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = ready.find((d) => d._id === datasetId) ?? ready[0] ?? null;
  const dimensions = useQuery(
    api.datasets.dimensions,
    selected ? { id: selected._id } : "skip",
  );

  useEffect(() => {
    if (!selected) return;
    setDatasetId(selected._id);
    const end = selected.dateMax ?? Date.now();
    const startW = end - 27 * DAY;
    const compEnd = startW - DAY;
    const compStart = compEnd - 27 * DAY;
    setWindowEnd(end);
    setWindowStart(startW);
    setComparisonEnd(compEnd);
    setComparisonStart(compStart);
    setDim("");
    setValue("");
  }, [selected?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimensionOptions = dimensions ?? [];

  const run = async () => {
    if (!selected || busy) return;
    if (dim && !value) {
      setError(`Pick a ${dim} value, or set Segment back to "All rows".`);
      return;
    }
    if ([windowStart, windowEnd, comparisonStart, comparisonEnd].some((n) => !Number.isFinite(n) || n <= 0)) {
      setError("Please fill in all four dates.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await start({
        question: question.trim() || "Why did the metric change?",
        datasetId: selected._id,
        dim: dim || undefined,
        value: dim ? value : undefined,
        windowStart,
        windowEnd,
        comparisonStart,
        comparisonEnd,
      });
      navigate("/app/investigation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the investigation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Ask"
        title="What do you want to understand?"
        description="Ask in plain language. Kausa confirms the scope and the window, then computes the answer from your uploaded data."
      />

      {datasets !== undefined && ready.length === 0 && (
        <div className="panel-hero mt-8 flex flex-col items-center justify-center p-12 text-center">
          <BorderBeam size={220} duration={18} />
          <Upload className="size-7 text-accent-soft" />
          <h2 className="mt-4 text-lg font-medium text-ink">No dataset ready yet</h2>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            Upload a CSV or Excel file with a date column and a numeric metric to ask your first question.
          </p>
          <Link
            to="/app/workspace"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Go to Workspace <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      {ready.length > 0 && (
        <>
          {ready.length > 1 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-faint">Dataset:</span>
              {ready.map((d) => (
                <button
                  key={d._id}
                  onClick={() => setDatasetId(d._id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    selected?._id === d._id
                      ? "border-accent/40 bg-accent/10 text-ink"
                      : "border-line bg-white/[0.02] text-ink-muted hover:text-ink",
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6">
            <PlaceholdersAndVanishInput
              placeholders={suggestedQuestions.slice(0, 3)}
              value={question}
              onChange={setQuestion}
              onSubmit={() => void run()}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="text-xs text-ink-faint">Try:</span>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
              >
                {q}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel-hero mt-8 p-6"
          >
            <BorderBeam size={240} duration={18} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-positive">
                <Sparkles className="size-4" />
                <span className="text-sm font-medium">Scope ready · computed from your data</span>
              </div>
              <Chip tone="accent">Editable</Chip>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Metric</span>
                <input
                  readOnly
                  value={selected?.metricColumn ?? "—"}
                  className="rounded-xl border border-line bg-base-950/40 px-3.5 py-2.5 text-sm text-ink-muted outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Segment</span>
                <select
                  value={dim}
                  onChange={(e) => {
                    setDim(e.target.value);
                    setValue("");
                  }}
                  className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                >
                  <option value="">All rows</option>
                  {dimensionOptions.map((d) => (
                    <option key={d.dim} value={d.dim}>
                      {d.dim}
                    </option>
                  ))}
                </select>
              </label>

              {dim && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-faint">Value</span>
                  <select
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                  >
                    <option value="">Select a value</option>
                    {(dimensionOptions.find((d) => d.dim === dim)?.values ?? []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Analysis window — from</span>
                <input
                  type="date"
                  value={windowStart ? iso(windowStart) : ""}
                  onChange={(e) => setWindowStart(fromIso(e.target.value))}
                  className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Analysis window — to</span>
                <input
                  type="date"
                  value={windowEnd ? iso(windowEnd) : ""}
                  onChange={(e) => setWindowEnd(fromIso(e.target.value))}
                  className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Comparison — from</span>
                <input
                  type="date"
                  value={comparisonStart ? iso(comparisonStart) : ""}
                  onChange={(e) => setComparisonStart(fromIso(e.target.value))}
                  className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-faint">Comparison — to</span>
                <input
                  type="date"
                  value={comparisonEnd ? iso(comparisonEnd) : ""}
                  onChange={(e) => setComparisonEnd(fromIso(e.target.value))}
                  className="rounded-xl border border-line bg-base-950/60 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/50"
                />
              </label>
            </div>

            <p className="mt-4 text-xs text-ink-faint">
              Dataset: {selected?.name} · {selected?.rowCount.toLocaleString("en-US")} rows ·{" "}
              {selected?.numericColumns.length ?? 0} numeric column(s) will be used as drivers.
            </p>

            {error && (
              <p className="mt-4 rounded-xl border border-negative/30 bg-negative/[0.06] px-3.5 py-2.5 text-xs text-negative">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-ink-faint">
                {question.trim() ? `“${question.trim()}”` : "Enter a question above"}
              </span>
              <button
                onClick={() => void run()}
                disabled={busy || !selected}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep",
                  (busy || !selected) && "opacity-70",
                )}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirm &amp; run investigation <ArrowRight className="size-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
