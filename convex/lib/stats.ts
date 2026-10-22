/**
 * Deterministic analysis engine. No LLM, no I/O — pure functions so every
 * number Kausa reports is reproducible from the user's uploaded data.
 */

export interface DayPoint {
  date: number;
  metric: number;
  drivers: Record<string, number>;
}

export interface SeriesOut {
  date: string;
  actual: number;
  expected: number;
  lo: number;
  hi: number;
}

export interface AttributionOut {
  group: string;
  key: string;
  contribution: number;
  interval: [number, number];
  color: string;
  kind: "cause" | "unexplained";
  evidenceStatus: "supported" | "weak" | "measured";
}

export interface DriverEffect {
  column: string;
  coeff: number;
  deltaMean: number;
  contribution: number;
  interval: [number, number];
  r2: number;
}

export interface HeadlineOut {
  actual: number;
  expected: number;
  changePct: number;
  gap: number;
  interval: [number, number];
  outsideNormalVariation: boolean;
}

export interface AnalysisResult {
  headline: HeadlineOut;
  series: SeriesOut[];
  attribution: AttributionOut[];
  driverEffects: DriverEffect[];
  windowDays: number;
  comparisonDays: number;
  residualStd: number;
}

const PALETTE = [
  "#7c6cff",
  "#5b8bff",
  "#3ad6f0",
  "#3ddc97",
  "#f5c451",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#60a5fa",
];

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function weekdayOf(ms: number): number {
  return new Date(ms).getUTCDay();
}

export function dayLabel(ms: number): string {
  const d = new Date(ms);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Ordinary least squares via normal equations + Gaussian elimination. */
export function ols(X: number[][], y: number[]): number[] | null {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0 || n < p) return null;

  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  // Ridge-regularise slightly for numerical stability on collinear features.
  for (let a = 0; a < p; a++) XtX[a][a] += 1e-8;

  // Solve XtX * beta = Xty
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const div = A[col][col];
    for (let c = col; c <= p; c++) A[col][c] /= div;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      for (let c = col; c <= p; c++) A[r][c] -= factor * A[col][c];
    }
  }
  return A.map((row) => row[p]);
}

/**
 * Build per-day expected values using a weekday seasonal-naive baseline from
 * the comparison window, then report the gap and a 90% interval from the
 * comparison-window residuals.
 */
export function baseline(
  window: DayPoint[],
  comparison: DayPoint[],
): { expected: number[]; residualStd: number } {
  const byWeekday = new Map<number, number[]>();
  for (const p of comparison) {
    const w = weekdayOf(p.date);
    if (!byWeekday.has(w)) byWeekday.set(w, []);
    byWeekday.get(w)!.push(p.metric);
  }
  const overall = mean(comparison.map((p) => p.metric));
  const wdMean = new Map<number, number>();
  for (const [w, xs] of byWeekday) wdMean.set(w, mean(xs));

  const residuals = comparison.map((p) => {
    const base = wdMean.get(weekdayOf(p.date));
    return p.metric - (base ?? overall);
  });

  const expected = window.map(
    (p) => wdMean.get(weekdayOf(p.date)) ?? overall,
  );
  return { expected, residualStd: std(residuals) };
}

/**
 * Regression-based attribution: fit the metric on the available numeric drivers
 * (plus an intercept and weekday dummies) over the comparison + window days,
 * then attribute the gap as coeff * (window mean - comparison mean) * days.
 */
export function attribute(
  window: DayPoint[],
  comparison: DayPoint[],
  driverColumns: string[],
): { effects: DriverEffect[]; gaps: number } {
  const all = [...comparison, ...window];
  if (all.length < 4 || driverColumns.length === 0) {
    return { effects: [], gaps: 0 };
  }

  const X: number[][] = [];
  const y: number[] = [];
  for (const p of all) {
    const row: number[] = [1];
    for (let d = 0; d < 6; d++) row.push(weekdayOf(p.date) === d + 1 ? 1 : 0);
    for (const c of driverColumns) row.push(p.drivers[c] ?? 0);
    X.push(row);
    y.push(p.metric);
  }

  const beta = ols(X, y);
  if (!beta) return { effects: [], gaps: 0 };

  const interceptIdx = 0;
  const weekdayCount = 6;
  const driverStart = interceptIdx + 1 + weekdayCount;

  // r^2 for reporting
  const yMean = mean(y);
  const ssTot = y.reduce((a, b) => a + (b - yMean) * (b - yMean), 0);
  const ssRes = X.reduce((a, row, i) => {
    const pred = row.reduce((s, xv, j) => s + xv * beta[j], 0);
    return a + (pred - y[i]) * (pred - y[i]);
  }, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const windowDays = window.length;
  const effects: DriverEffect[] = [];
  let gaps = 0;

  for (let k = 0; k < driverColumns.length; k++) {
    const coeff = beta[driverStart + k];
    const wMean = mean(window.map((p) => p.drivers[driverColumns[k]] ?? 0));
    const cMean = mean(comparison.map((p) => p.drivers[driverColumns[k]] ?? 0));
    const deltaMean = wMean - cMean;
    const contribution = coeff * deltaMean * windowDays;
    const se = Math.abs(contribution) * 0.25 + Math.abs(deltaMean) * 0.01;
    effects.push({
      column: driverColumns[k],
      coeff,
      deltaMean,
      contribution,
      interval: [contribution - 1.645 * se, contribution + 1.645 * se],
      r2,
    });
    gaps += contribution;
  }

  return { effects, gaps };
}

const LABELS: Record<string, string> = {
  promo: "Promotion",
  promotion: "Promotion",
  discount: "Discount depth",
  price: "Price / cost",
  competitor: "Competition",
  competitor_dist: "Competition",
  temperature: "Weather",
  temp: "Weather",
  precipitation: "Weather",
  rainfall: "Weather",
  holiday: "Calendar & holidays",
  marketing: "Marketing spend",
  ad_spend: "Marketing spend",
  traffic: "Traffic",
  footfall: "Footfall",
  fuel: "External economic series",
};

export function labelFor(column: string): string {
  const key = column.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(LABELS)) {
    if (key.includes(k.replace(/[^a-z]/g, ""))) return v;
  }
  return column
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusFor(contribution: number, interval: [number, number], gap: number): "supported" | "weak" | "measured" {
  const sameSign = (contribution >= 0) === (gap >= 0);
  const excludesZero = (interval[0] > 0 && interval[1] > 0) || (interval[0] < 0 && interval[1] < 0);
  if (!sameSign) return "measured";
  if (excludesZero) return "supported";
  return "weak";
}

export function analyse(
  window: DayPoint[],
  comparison: DayPoint[],
  driverColumns: string[],
): AnalysisResult {
  const actualTotal = window.reduce((a, p) => a + p.metric, 0);
  const { expected, residualStd } = baseline(window, comparison);
  const expectedTotal = expected.reduce((a, b) => a + b, 0);
  const gap = actualTotal - expectedTotal;
  const n = window.length;
  const seGap = residualStd * Math.sqrt(Math.max(n, 1));
  const interval: [number, number] = [gap - 1.645 * seGap, gap + 1.645 * seGap];

  const series: SeriesOut[] = window.map((p, i) => ({
    date: dayLabel(p.date),
    actual: round(p.metric),
    expected: round(expected[i]),
    lo: round(expected[i] - 1.645 * residualStd),
    hi: round(expected[i] + 1.645 * residualStd),
  }));

  const { effects } = attribute(window, comparison, driverColumns);

  const attribution: AttributionOut[] = [];
  let explained = 0;
  const used = effects
    .filter((e) => Number.isFinite(e.contribution) && Math.abs(e.contribution) > 1e-6)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  used.forEach((e, i) => {
    explained += e.contribution;
    attribution.push({
      group: labelFor(e.column),
      key: e.column,
      contribution: round(e.contribution),
      interval: [round(e.interval[0]), round(e.interval[1])],
      color: PALETTE[i % PALETTE.length],
      kind: "cause",
      evidenceStatus: statusFor(e.contribution, e.interval, gap),
    });
  });

  const unexplained = gap - explained;
  attribution.push({
    group: "Unexplained remainder",
    key: "unexplained",
    contribution: round(unexplained),
    interval: [round(unexplained - 1.645 * seGap), round(unexplained + 1.645 * seGap)],
    color: "#6b7080",
    kind: "unexplained",
    evidenceStatus: "measured",
  });

  const outsideNormalVariation = interval[0] > 0 || interval[1] < 0;

  return {
    headline: {
      actual: round(actualTotal),
      expected: round(expectedTotal),
      changePct: expectedTotal !== 0 ? round((gap / expectedTotal) * 100 * 10) / 10 : 0,
      gap: round(gap),
      interval: [round(interval[0]), round(interval[1])],
      outsideNormalVariation,
    },
    series,
    attribution,
    driverEffects: used,
    windowDays: n,
    comparisonDays: comparison.length,
    residualStd,
  };
}

function round(x: number): number {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? 0 : r;
}
