import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Database, Calculator, ShieldCheck, Cpu } from "lucide-react";
import { useQuery } from "convex/react";
import { useEvidence } from "@/store/evidence";
import { useInvestigation } from "@/store/investigation";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Chip } from "./StatusPill";

function formatValue(value: number, unit: string) {
  if (unit === "USD") return formatCurrency(value);
  if (unit === "pct") return `${value}%`;
  if (unit === "count") return formatNumber(value);
  return formatNumber(value, 2);
}

export function EvidencePanel() {
  const { claimId, close } = useEvidence();
  const { id } = useInvestigation();

  const claims = useQuery(
    api.investigations.claimsFor,
    id ? { investigationId: id } : "skip",
  );

  const claim = useMemo(
    () => (claims ?? []).find((c) => c.claimId === claimId) ?? null,
    [claims, claimId],
  );

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (claimId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [claimId, close]);

  useEffect(() => {
    if (claimId) panelRef.current?.focus();
  }, [claimId]);

  const open = Boolean(claimId);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-hidden
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Evidence for claim ${claim?.claimId ?? ""}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line bg-base-900 shadow-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <Chip tone="accent">{claim?.claimId ?? claimId ?? "—"}</Chip>
                  <span className="text-xs text-ink-faint">{claim?.kind ?? "—"}</span>
                </div>
                <h2 className="mt-2 text-lg font-medium text-ink">
                  {claim?.label ?? "Evidence unavailable"}
                </h2>
                <p className="mt-1 tabular text-3xl font-light text-ink">
                  {claim ? formatValue(claim.value, claim.unit) : ""}
                  {claim?.interval && (
                    <span className="ml-3 align-middle text-sm text-ink-muted">
                      [{formatValue(claim.interval[0], claim.unit)},{" "}
                      {formatValue(claim.interval[1], claim.unit)}]
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close evidence panel"
                className="rounded-lg border border-line p-2 text-ink-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {claim ? (
                <div className="flex flex-col gap-6">
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Database className="size-4 text-accent-soft" /> Analysis query
                    </h3>
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-base-950 p-4 font-mono text-[11px] leading-relaxed text-ink-muted">
                      {claim.query}
                    </pre>
                  </section>

                  {claim.rowSample.rows.length > 0 && (
                    <section>
                      <h3 className="text-sm font-medium text-ink">Row sample</h3>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-line bg-white/[0.02]">
                              {claim.rowSample.columns.map((c) => (
                                <th key={c} className="px-3 py-2 font-medium text-ink-muted">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="tabular">
                            {claim.rowSample.rows.map((row, i) => (
                              <tr key={i} className="border-b border-line/60 last:border-0">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 text-ink-muted">
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-ink-faint">
                        Sample rows from your uploaded dataset, truncated for the panel.
                      </p>
                    </section>
                  )}

                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Calculator className="size-4 text-accent-soft" /> Calculation steps
                    </h3>
                    <ol className="mt-3 flex flex-col gap-2">
                      {claim.calculation.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-ink-muted">
                          <span className="tabular mt-0.5 text-xs text-ink-faint">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className="rounded-xl border border-line bg-base-950/60 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Cpu className="size-4 text-accent-soft" /> Provenance
                    </h3>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="text-ink-faint">Model</dt>
                        <dd className="mt-0.5 text-ink-muted">{claim.model}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Data version</dt>
                        <dd className="mt-0.5 font-mono text-ink-muted">{claim.dataVersion}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Code version</dt>
                        <dd className="mt-0.5 font-mono text-ink-muted">{claim.codeVersion}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Runtime verifier</dt>
                        <dd className="mt-0.5">
                          <span className="inline-flex items-center gap-1.5 text-positive">
                            <ShieldCheck className="size-3.5" /> {claim.verifier}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm text-ink-muted">
                    {id ? "No evidence recorded for this claim." : "Run an investigation to see evidence."}
                  </p>
                  <p className="mt-2 max-w-sm text-xs text-ink-faint">
                    Every number Kausa reports is stored with its query, the rows it read and the steps it
                    took. Open a figure in a verdict to inspect it here.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
