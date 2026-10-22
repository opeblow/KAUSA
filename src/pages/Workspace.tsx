import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Database,
  AlertTriangle,
  Info,
  Loader2,
  Upload,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { PageHeader } from "@/components/PageHeader";
import { Chip } from "@/components/StatusPill";
import { BorderBeam } from "@/components/ui/border-beam";
import { SectionLabel } from "@/components/ui/section-label";
import { api, type Id } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Dataset {
  _id: Id<"datasets">;
  name: string;
  fileName: string;
  status: "parsing" | "ready" | "error";
  rowCount: number;
  dateColumn: string | null;
  metricColumn: string | null;
  dateMin: number | null;
  dateMax: number | null;
  numericColumns: string[];
  categoricalColumns: string[];
  error: string | null;
  _creationTime: number;
}

type ColumnRole = { name: string; kind: "date" | "metric" | "driver" | "dimension" };

function fmtDay(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Workspace() {
  const datasets = useQuery(api.datasets.list);
  const generateUploadUrl = useMutation(api.datasets.generateUploadUrl);
  const claimUpload = useMutation(api.datasets.claimUpload);
  const create = useMutation(api.datasets.create);
  const remove = useMutation(api.datasets.remove);
  const retryParse = useMutation(api.datasets.retryParse);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(() => (datasets ?? []).filter((d) => d.status === "ready"), [datasets]);
  const primary = ready[0] ?? datasets?.[0] ?? null;

  const onFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: string };
      await claimUpload({ storageId: storageId as Id<"_storage"> });
      await create({
        storageId: storageId as Id<"_storage">,
        fileName: file.name,
        name: file.name.replace(/\.[^.]+$/, ""),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <PageHeader
        eyebrow="Workspace"
        title="Your data"
        description="Upload a CSV or Excel file with a date column and at least one numeric metric. Kausa parses it, detects the schema, and keeps it private to your account."
        actions={
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-70"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Upload a file"}
          </button>
        }
      />

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/[0.06] px-4 py-3 text-xs text-negative">
          <AlertTriangle className="size-3.5" /> {error}
        </div>
      )}

      {datasets === undefined && (
        <div className="mt-8 flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin text-accent" /> Loading your datasets…
        </div>
      )}

      {datasets && datasets.length === 0 && (
        <div className="panel-hero mt-8 flex flex-col items-center justify-center p-12 text-center">
          <BorderBeam size={220} duration={18} />
          <Upload className="size-7 text-accent-soft" />
          <h2 className="mt-4 text-lg font-medium text-ink">Upload your first dataset</h2>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            A file with a date column and numeric columns such as sales, revenue, units, traffic or
            spend. Kausa detects the metric and any driver columns automatically.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            <Upload className="size-4" /> Choose a file
          </button>
          <p className="mt-4 text-[11px] text-ink-faint">Accepts .csv, .tsv, .xlsx, .xls</p>
        </div>
      )}

      {datasets && datasets.length > 0 && (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {datasets.map((d, i) => (
              <DatasetCard
                key={d._id}
                dataset={d}
                index={i}
                onRemove={() => void remove({ id: d._id })}
                onRetry={() => void retryParse({ id: d._id })}
              />
            ))}
          </div>

          {primary && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="panel-hero p-6">
                <BorderBeam size={220} duration={18} />
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Database className="size-4 text-accent-soft" /> Detected schema
                  </h2>
                  <Chip tone="accent">{primary.name}</Chip>
                </div>
                <SchemaTable dataset={primary} />
              </div>

              <div className="panel p-6">
                <SectionLabel>Data quality</SectionLabel>
                <QualityList dataset={primary} />
              </div>
            </div>
          )}

          {ready.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/[0.06] p-6 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm text-ink">
                  {formatNumber(ready[0].rowCount)} rows ready · {ready[0].name}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Coverage {fmtDay(ready[0].dateMin)} – {fmtDay(ready[0].dateMax)}. Ready to investigate.
                </p>
              </div>
              <Link
                to="/app/ask"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
              >
                Ask a question <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function DatasetCard({
  dataset,
  index,
  onRemove,
  onRetry,
}: {
  dataset: Dataset;
  index: number;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const statusTone =
    dataset.status === "ready" ? "positive" : dataset.status === "error" ? "negative" : "warning";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="panel relative overflow-hidden p-5"
    >
      {dataset.status === "parsing" && (
        <BorderBeam size={120} duration={10} colorFrom="#7c6cff" colorTo="#3ad6f0" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
          <Database className="size-5 text-ink-muted" />
        </div>
        <Chip tone={statusTone as "positive" | "negative" | "warning"} className="capitalize">
          {dataset.status === "parsing" ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> Parsing
            </span>
          ) : dataset.status === "ready" ? (
            "Ready"
          ) : (
            "Error"
          )}
        </Chip>
      </div>
      <h3 className="mt-4 truncate font-mono text-sm text-ink">{dataset.name}</h3>
      <p className="mt-1 truncate text-xs text-ink-faint">{dataset.fileName}</p>

      {dataset.status === "error" ? (
        <p className="mt-4 rounded-lg border border-negative/20 bg-negative/[0.05] p-3 text-xs text-negative">
          {dataset.error ?? "Parsing failed."}
        </p>
      ) : (
        <dl className="mt-4 space-y-2 text-xs">
          <Row k="Rows" v={formatNumber(dataset.rowCount)} />
          <Row k="Metric" v={dataset.metricColumn ?? "—"} />
          <Row k="Date col" v={dataset.dateColumn ?? "—"} />
          <Row k="Coverage" v={`${fmtDay(dataset.dateMin ?? undefined)} – ${fmtDay(dataset.dateMax ?? undefined)}`} />
        </dl>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-line/60 pt-3">
        {dataset.status === "ready" && (
          <Link
            to="/app/ask"
            className="inline-flex items-center gap-1.5 text-xs text-accent-soft hover:underline"
          >
            Investigate <ArrowRight className="size-3" />
          </Link>
        )}
        {dataset.status === "error" && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        )}
        <button
          onClick={onRemove}
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-negative"
        >
          <Trash2 className="size-3" /> Remove
        </button>
      </div>
    </motion.div>
  );
}

function SchemaTable({ dataset }: { dataset: Dataset }) {
  const columns: ColumnRole[] = [];
  if (dataset.dateColumn) columns.push({ name: dataset.dateColumn, kind: "date" });
  if (dataset.metricColumn) columns.push({ name: dataset.metricColumn, kind: "metric" });
  for (const c of dataset.numericColumns) {
    if (c !== dataset.metricColumn) columns.push({ name: c, kind: "driver" });
  }
  for (const c of dataset.categoricalColumns) {
    columns.push({ name: c, kind: "dimension" });
  }

  if (columns.length === 0) {
    return (
      <p className="mt-4 text-xs text-ink-faint">
        No columns detected yet. Retry parsing or upload a file with a header row.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line bg-white/[0.02] text-ink-muted">
            <th className="px-3 py-2 font-medium">Column</th>
            <th className="px-3 py-2 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.name} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2 font-mono text-ink-muted">{c.name}</td>
              <td className="px-3 py-2">
                {c.kind === "date" ? (
                  <Chip tone="accent">date</Chip>
                ) : c.kind === "metric" ? (
                  <Chip tone="positive">metric</Chip>
                ) : c.kind === "driver" ? (
                  <span className="text-ink-faint">driver</span>
                ) : (
                  <span className="text-ink-faint">dimension</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityList({ dataset }: { dataset: Dataset }) {
  const items: { severity: "info" | "warning" | "error"; title: string; detail: string }[] = [];
  if (!dataset.dateColumn) {
    items.push({ severity: "error", title: "No date column detected", detail: "A date column is required." });
  } else {
    items.push({
      severity: "info",
      title: `Date column: ${dataset.dateColumn}`,
      detail: `Coverage ${fmtDay(dataset.dateMin ?? undefined)} to ${fmtDay(dataset.dateMax ?? undefined)}.`,
    });
  }
  if (!dataset.metricColumn) {
    items.push({ severity: "error", title: "No metric column detected", detail: "A numeric metric is required." });
  } else {
    items.push({
      severity: "info",
      title: `Metric column: ${dataset.metricColumn}`,
      detail: `${formatNumber(dataset.rowCount)} rows parsed across ${
        dataset.numericColumns.length + dataset.categoricalColumns.length + 1 || "several"
      } columns.`,
    });
  }
  items.push({
    severity: "info",
    title: `${dataset.numericColumns.length} numeric · ${dataset.categoricalColumns.length} categorical`,
    detail:
      dataset.numericColumns.length > 1
        ? "Extra numeric columns are used as drivers in the attribution."
        : "Only the metric was found; the gap will be reported with an unexplained remainder.",
  });

  return (
    <div className="mt-4 flex flex-col gap-3">
      {items.map((d) => (
        <div key={d.title} className="flex gap-3">
          <span className="mt-0.5">
            {d.severity === "warning" ? (
              <AlertTriangle className="size-4 text-warning" />
            ) : d.severity === "error" ? (
              <AlertTriangle className="size-4 text-negative" />
            ) : (
              <Info className="size-4 text-ink-faint" />
            )}
          </span>
          <div>
            <p className="text-sm text-ink">{d.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{d.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{k}</dt>
      <dd className={cn("tabular truncate text-ink-muted")}>{v}</dd>
    </div>
  );
}
