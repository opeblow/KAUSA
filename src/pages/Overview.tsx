import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingDown, TrendingUp, CircleCheck, Database } from "lucide-react";
import { useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { SectionLabel } from "@/components/ui/section-label";
import { ActualVsExpected, ContributionRanking } from "@/components/charts";
import { Chip } from "@/components/StatusPill";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function Overview() {
  const datasets = useQuery(api.datasets.list);
  const investigations = useQuery(api.investigations.list);

  const ready = useMemo(
    () => (datasets ?? []).filter((d) => d.status === "ready"),
    [datasets],
  );
  const dataset = ready[0] ?? null;

  const latestId = useMemo(
    () => (investigations ?? []).find((i) => i.status === "done")?._id ?? null,
    [investigations],
  );
  const detail = useQuery(api.investigations.get, latestId ? { id: latestId } : "skip");

  const headline = detail?.headline ?? null;
  const isAnomaly = headline?.outsideNormalVariation ?? false;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Overview"
        title="What moved"
        description="Orient to your metric and make the anomaly impossible to miss. This is the picture Kausa explains."
        actions={
          <Link
            to="/app/ask"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Ask why <ArrowRight className="size-4" />
          </Link>
        }
      />

      {datasets && ready.length === 0 && (
        <div className="panel-hero mt-8 flex flex-col items-center justify-center p-12 text-center">
          <BorderBeam size={260} duration={20} />
          <Database className="size-7 text-accent-soft" />
          <h2 className="mt-4 text-lg font-medium text-ink">No data yet</h2>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            Upload a CSV or Excel file with a date column and a numeric metric. Kausa will parse it and chart
            what moved.
          </p>
          <Link
            to="/app/workspace"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Go to Workspace <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      {dataset && (
        <BlurFade className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="panel-hero p-6 md:p-8">
              <BorderBeam size={260} duration={20} />
              {!detail || !headline ? (
                <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                  <CircleCheck className="size-6 text-positive" />
                  <h3 className="mt-4 text-lg font-medium text-ink">Dataset ready</h3>
                  <p className="mt-2 max-w-md text-sm text-ink-muted">
                    {dataset.name} · {formatNumber(dataset.rowCount)} rows, {fmtDay(dataset.dateMin ?? 0)} to{" "}
                    {fmtDay(dataset.dateMax ?? 0)}. Ask a question to produce the first verdict.
                  </p>
                  <Link
                    to="/app/ask"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
                  >
                    Ask why <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-ink-faint">
                        {detail.scope.metric} · {detail.scope.dim ? `${detail.scope.dim} = ${detail.scope.value}` : "all rows"} ·{" "}
                        {fmtDay(detail.scope.windowStart)} – {fmtDay(detail.scope.windowEnd)}
                      </p>
                      <div className="mt-3 flex items-end gap-4">
                        <span className="tabular text-6xl font-light text-ink">
                          <NumberTicker
                            value={headline.changePct}
                            decimalPlaces={1}
                            format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                          />
                        </span>
                        <span className="mb-2 inline-flex items-center gap-1.5 text-sm">
                          {headline.gap < 0 ? (
                            <TrendingDown className="size-4 text-negative" />
                          ) : (
                            <TrendingUp className="size-4 text-positive" />
                          )}
                          <span className={`tabular ${headline.gap < 0 ? "text-negative" : "text-positive"}`}>
                            {formatCurrency(headline.gap, { compact: true })}
                          </span>
                          <span className="text-ink-faint">vs expected</span>
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {isAnomaly ? (
                          <>
                            <Chip tone="negative">Outside normal variation</Chip>
                            <Chip>
                              90% interval {formatCurrency(headline.interval[0], { compact: true })} to{" "}
                              {formatCurrency(headline.interval[1], { compact: true })}
                            </Chip>
                          </>
                        ) : (
                          <Chip tone="positive">Within normal variation</Chip>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <ActualVsExpected data={detail.series} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded bg-negative/40" /> Anomaly region
                    </span>
                    <span>
                      Comparison: {fmtDay(detail.scope.comparisonStart)} – {fmtDay(detail.scope.comparisonEnd)}
                    </span>
                    <Link to={`/app/verdict?i=${detail._id}`} className="text-accent-soft hover:underline">
                      Open verdict →
                    </Link>
                  </div>
                </>
              )}
            </div>

            <aside className="flex flex-col gap-4">
              <div className="panel p-5">
                <SectionLabel>Scope</SectionLabel>
                <dl className="mt-4 space-y-3 text-xs">
                  <Field k="Metric" v={detail?.scope.metric ?? dataset.metricColumn ?? "—"} />
                  <Field k="Dataset" v={dataset.name} />
                  <Field k="Rows" v={formatNumber(dataset.rowCount)} />
                  <Field k="Coverage" v={`${fmtDay(dataset.dateMin ?? 0)} – ${fmtDay(dataset.dateMax ?? 0)}`} />
                  <Field k="If a window" v={detail ? `${fmtDay(detail.scope.windowStart)} – ${fmtDay(detail.scope.windowEnd)}` : "—"} />
                </dl>
                <Link to="/app/ask" className="mt-4 inline-flex text-xs text-accent-soft hover:underline">
                  Edit scope in Ask →
                </Link>
              </div>

              {detail && detail.attribution.length > 0 && (
                <div className="panel p-5">
                  <SectionLabel>Contribution ranking</SectionLabel>
                  <div className="mt-4">
                    <ContributionRanking items={detail.attribution} />
                  </div>
                </div>
              )}

              <div className="panel p-5">
                <SectionLabel>What Kausa will do</SectionLabel>
                <ol className="mt-4 space-y-3 text-xs text-ink-muted">
                  <li className="flex gap-2">
                    <span className="text-ink-faint">1</span> Estimate expected value from a weekday baseline of your
                    comparison window.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-ink-faint">2</span> Measure the gap and test whether it is outside normal
                    variation.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-ink-faint">3</span> Regress the metric on your numeric drivers to attribute
                    the gap.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-ink-faint">4</span> Write the verdict and verify every number against the
                    ledger.
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        </BlurFade>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="text-right text-ink-muted">{v}</dd>
    </div>
  );
}
