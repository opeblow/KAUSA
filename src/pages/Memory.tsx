import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Plus,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Trash2,
  Loader2,
  History,
  Sparkles,
  Tag,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { SectionLabel } from "@/components/ui/section-label";
import { api, type Id } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPES = ["preference", "factual", "personal", "general"] as const;

const LAYER_STYLE: Record<string, string> = {
  long_term: "border-accent/40 text-accent-soft",
  working: "border-line text-ink-muted",
  short_term: "border-line/70 text-ink-faint",
};

function ago(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function Memory() {
  const memories = useQuery(api.memories.list);
  const ledger = useQuery(api.memories.ledger);
  const remember = useMutation(api.memories.remember);
  const feedback = useMutation(api.memories.feedback);
  const forget = useMutation(api.memories.forget);

  const [draft, setDraft] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("preference");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRemember = async () => {
    const content = draft.trim();
    if (content.length < 3) return;
    setSaving(true);
    setError(null);
    try {
      await remember({ content, type });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that memory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Memory"
        title="Durable memory"
        description="Kausa carries memory across investigations using the H-MEM engine from Meterless. Memories are mined from each run and recalled into the next one, ranked by a hybrid of semantic, keyword, tag, domain, entity, layer and recency signals. Feedback moves what gets recalled."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="panel p-5">
            <SectionLabel>
              <Plus className="size-4" /> Teach Kausa something
            </SectionLabel>
            <p className="mt-3 text-xs text-ink-faint">
              Tell Kausa how your data works — what a column means, how you name things, or a known
              cause. It is stored as long-term memory and recalled in future runs.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. Sales is the daily gross revenue across all stores, excluding returns."
                className="w-full resize-none rounded-xl border border-line bg-base-900/60 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
                  className="rounded-lg border border-line bg-base-900/60 px-3 py-2 text-xs text-ink-muted focus:border-accent/50 focus:outline-none"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void onRemember()}
                  disabled={saving || draft.trim().length < 3}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Remember
                </button>
              </div>
              {error && <p className="text-xs text-negative">{error}</p>}
            </div>
          </div>

          <div>
            <SectionLabel>
              <Brain className="size-4" /> Memories
              {memories && <span className="text-ink-faint"> · {memories.length}</span>}
            </SectionLabel>

            {memories && memories.length === 0 && (
              <div className="panel mt-4 flex flex-col items-center justify-center p-10 text-center">
                <Sparkles className="size-6 text-accent-soft" />
                <p className="mt-3 text-sm text-ink-muted">
                  No memories yet. Run an investigation or teach Kausa a fact above.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3">
              {memories?.map((m, i) => (
                <motion.div
                  key={m._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="panel p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm leading-relaxed text-ink">{m.content}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                        LAYER_STYLE[m.layer] ?? "border-line text-ink-faint",
                      )}
                    >
                      {m.layer.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge>{m.type}</Badge>
                    <Badge>{m.domain}</Badge>
                    {m.entities.slice(0, 3).map((e) => (
                      <span key={e} className="inline-flex items-center gap-1 text-ink-faint">
                        <Tag className="size-3" />
                        {e}
                      </span>
                    ))}
                    <span className="ml-auto text-ink-faint">
                      confidence {Math.round(m.confidence * 100)}% · used {m.accessCount}×
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
                    <span className="text-[11px] text-ink-faint">{m.source}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <IconBtn
                        title="Helpful"
                        onClick={() => void feedback({ id: m._id as Id<"memories">, kind: "helpful" })}
                      >
                        <ThumbsUp className="size-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Not helpful"
                        onClick={() =>
                          void feedback({ id: m._id as Id<"memories">, kind: "not_helpful" })
                        }
                      >
                        <ThumbsDown className="size-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Wrong"
                        danger
                        onClick={() => void feedback({ id: m._id as Id<"memories">, kind: "wrong" })}
                      >
                        <AlertTriangle className="size-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Forget"
                        danger
                        onClick={() => void forget({ id: m._id as Id<"memories"> })}
                      >
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel p-5">
            <SectionLabel>
              <History className="size-4" /> Trust ledger
            </SectionLabel>
            <p className="mt-3 text-[11px] text-ink-faint">
              Every memory mutation is audited — reads, writes, feedback and deletions.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {ledger?.length === 0 && <p className="text-xs text-ink-faint">No activity yet.</p>}
              {ledger?.map((e) => (
                <div key={e._id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        e.action === "create"
                          ? "bg-positive"
                          : e.action === "delete"
                            ? "bg-negative"
                            : e.action === "feedback"
                              ? "bg-accent"
                              : "bg-ink-faint",
                      )}
                    />
                    <span className="text-ink-muted">{e.action}</span>
                    {e.signal && <span className="text-ink-faint">{e.signal}</span>}
                  </span>
                  <span className="shrink-0 text-ink-faint">{ago(e.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-line/70 bg-white/[0.02] px-2 py-0.5 text-ink-muted">
      {children}
    </span>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg border border-line text-ink-faint transition-colors hover:text-ink",
        danger && "hover:text-negative",
      )}
    >
      {children}
    </button>
  );
}
