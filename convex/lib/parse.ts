/**
 * Upload parsing: detect column roles and aggregate rows into per-day points.
 * Pure (no I/O) so it is unit-testable; the caller supplies the decoded table.
 */

export interface RawTable {
  header: string[];
  rows: (string | number)[][];
}

export type ColumnKind = "date" | "number" | "text";

export interface DetectedColumn {
  name: string;
  kind: ColumnKind;
  samples: string[];
}

export interface AggregateResult {
  points: {
    dim: string;
    value: string;
    date: number;
    metric: number;
    drivers: Record<string, number>;
  }[];
  dateMin: number | null;
  dateMax: number | null;
}

export const MAX_ROWS = 200_000;
export const MAX_DISTINCT = 40;
export const MAX_POINTS = 60_000;
export const MAX_BYTES = 25 * 1024 * 1024;
const SAMPLE = 200;

const DATE_HINT = /(date|day|period|week|month|timestamp|time)/i;
const METRIC_HINT = /(sales|revenue|units|qty|quantity|amount|value|net|gross|total|turnover|metric|demand)/i;

export function toNumber(v: string | number): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim();
  if (s === "" || /^(na|n\/a|null|-|nan)$/i.test(s)) return null;
  s = s.replace(/[$,€£%\s]/g, "");
  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toDate(value: string | number): number | null {
  if (typeof value === "number") return null;
  const s = String(value).trim();
  if (s === "") return null;

  // ISO / yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  // yyyy/mm/dd
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  // yyyy-mm or yyyy/mm (month precision)
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, 1);
  // mm/dd/yyyy or dd/mm/yyyy
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (a > 12) return Date.UTC(y, b - 1, a);
    return Date.UTC(y, a - 1, b);
  }
  // "Sep 2024" / "September 2024"
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  m = s.toLowerCase().match(/^([a-z]{3,})\.?\s+(\d{4})$/);
  if (m) {
    const mi = months.indexOf(m[1].slice(0, 3));
    if (mi >= 0) return Date.UTC(+m[2], mi, 1);
  }
  // "1 Sep 2024"
  m = s.toLowerCase().match(/^(\d{1,2})\s+([a-z]{3,})\.?\s+(\d{2,4})$/);
  if (m) {
    const mi = months.indexOf(m[2].slice(0, 3));
    let y = +m[3];
    if (y < 100) y += 2000;
    if (mi >= 0) return Date.UTC(y, mi, +m[1]);
  }
  return null;
}

export function detectColumns(table: RawTable): {
  columns: DetectedColumn[];
  dateColumn: string | null;
  numericColumns: string[];
  categoricalColumns: string[];
  metricColumn: string | null;
} {
  const { header, rows } = table;
  const columns: DetectedColumn[] = [];
  const dateCandidates: { name: string; score: number; hinted: boolean }[] = [];

  header.forEach((name, idx) => {
    const vals = rows
      .slice(0, SAMPLE)
      .map((r) => r[idx])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    const dateScore =
      vals.length > 0 ? vals.filter((v) => toDate(v) !== null).length / vals.length : 0;
    const numScore =
      vals.length > 0 ? vals.filter((v) => toNumber(v) !== null).length / vals.length : 0;
    const hinted = DATE_HINT.test(name);

    let kind: ColumnKind;
    if (hinted && dateScore > 0.5) kind = "date";
    else if (dateScore > 0.85 && numScore < 0.5) kind = "date";
    else if (numScore > 0.9 && !hinted) kind = "number";
    else if (numScore > 0.9 && dateScore < 0.5) kind = "number";
    else kind = "text";

    if (kind === "date" || hinted) {
      dateCandidates.push({ name, score: dateScore, hinted });
    }
    columns.push({ name, kind, samples: vals.slice(0, 4).map((v) => String(v)) });
  });

  let dateColumn: string | null = null;
  if (dateCandidates.length > 0) {
    dateCandidates.sort((a, b) => b.score - a.score || Number(b.hinted) - Number(a.hinted));
    dateColumn = dateCandidates[0].name;
  }
  // Normalise: the chosen date column is "date", everything else reclassifies.
  for (const c of columns) {
    if (c.name === dateColumn) c.kind = "date";
    else if (c.kind === "date") c.kind = "number";
  }

  const numericColumns = columns.filter((c) => c.kind === "number").map((c) => c.name);
  const categoricalColumns = columns.filter((c) => c.kind === "text").map((c) => c.name);

  let metricColumn: string | null = null;
  const hintedMetric = numericColumns.find((n) => METRIC_HINT.test(n));
  metricColumn = hintedMetric ?? numericColumns[0] ?? null;

  return { columns, dateColumn, numericColumns, categoricalColumns, metricColumn };
}

function dayFloor(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function aggregate(
  table: RawTable,
  dateColumn: string,
  metricColumn: string,
  numericColumns: string[],
  categoricalColumns: string[],
): AggregateResult {
  const { header, rows } = table;
  const di = header.indexOf(dateColumn);
  const mi = header.indexOf(metricColumn);
  if (di < 0 || mi < 0) return { points: [], dateMin: null, dateMax: null };

  const driverCols = numericColumns.filter((c) => c !== metricColumn);
  const driverIdx = new Map<string, number>();
  for (const c of driverCols) driverIdx.set(c, header.indexOf(c));

  // Decide which categorical columns are usable (bounded cardinality).
  const usableCats: { name: string; idx: number; values: Set<string> }[] = [];
  for (const c of categoricalColumns) {
    const idx = header.indexOf(c);
    const seen = new Set<string>();
    for (let r = 0; r < Math.min(rows.length, 5000); r++) {
      const v = rows[r][idx];
      if (v !== undefined && v !== null && String(v).trim() !== "") seen.add(String(v));
      if (seen.size > MAX_DISTINCT) break;
    }
    if (seen.size > 0 && seen.size <= MAX_DISTINCT) {
      usableCats.push({ name: c, idx, values: seen });
    }
  }

  interface Acc {
    metric: number;
    count: number;
    drivers: Map<string, number>;
  }
  const buckets = new Map<string, Map<number, Acc>>(); // bucketKey -> day -> Acc

  const keyFor = (dim: string, value: string) => `${dim}\u0000${value}`;

  const add = (dim: string, value: string, day: number, metric: number, drivers: Map<string, number | null>) => {
    const bk = keyFor(dim, value);
    let byDay = buckets.get(bk);
    if (!byDay) {
      byDay = new Map();
      buckets.set(bk, byDay);
    }
    let acc = byDay.get(day);
    if (!acc) {
      acc = { metric: 0, count: 0, drivers: new Map() };
      byDay.set(day, acc);
    }
    acc.metric += metric;
    acc.count += 1;
    for (const [k, v] of drivers) {
      if (v === null) continue;
      acc.drivers.set(k, (acc.drivers.get(k) ?? 0) + v);
    }
  };

  let dateMin = Infinity;
  let dateMax = -Infinity;
  const limit = Math.min(rows.length, MAX_ROWS);

  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    const date = toDate(row[di]);
    const metric = toNumber(row[mi]);
    if (date === null || metric === null) continue;
    const day = dayFloor(date);
    if (day < dateMin) dateMin = day;
    if (day > dateMax) dateMax = day;

    const drivers = new Map<string, number | null>();
    for (const [name, idx] of driverIdx) drivers.set(name, toNumber(row[idx]));

    add("", "", day, metric, drivers);
    for (const cat of usableCats) {
      const v = String(row[cat.idx] ?? "").trim();
      if (v === "") continue;
      add(cat.name, v, day, metric, drivers);
    }
  }

  const points: AggregateResult["points"] = [];
  for (const [bk, byDay] of buckets) {
    const [dim, value] = bk.split("\u0000");
    for (const [day, acc] of byDay) {
      if (points.length >= MAX_POINTS) break;
      const driversOut: Record<string, number> = {};
      for (const [k, sum] of acc.drivers) {
        driversOut[k] = acc.count > 0 ? sum / acc.count : 0;
      }
      points.push({ dim, value, date: day, metric: acc.metric, drivers: driversOut });
    }
  }

  return {
    points,
    dateMin: dateMin === Infinity ? null : dateMin,
    dateMax: dateMax === -Infinity ? null : dateMax,
  };
}
