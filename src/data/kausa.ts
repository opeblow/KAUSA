export type HypothesisStatus =
  | "queued"
  | "testing"
  | "supported"
  | "weak"
  | "refuted"
  | "untestable";

export type InvestigationState =
  | "scoped"
  | "planned"
  | "testing"
  | "attributing"
  | "narrating"
  | "verified"
  | "done"
  | "failed"
  | "cancelled";

export interface Source {
  id: string;
  logical: string;
  system: string;
  engine: string;
  status: "healthy" | "degraded" | "connecting" | "failed";
  rows: number;
  dateRange: string;
  lastRefresh: string;
  contents: string;
}

export interface DataQualityWarning {
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
  impact: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  test: string;
  params: string;
  status: HypothesisStatus;
  contribution: number | null;
  interval: number[] | null;
  reason: string;
  claimIds: string[];
  durationMs: number;
}

export interface Attribution {
  group: string;
  key: string;
  contribution: number;
  interval: number[];
  color: string;
  kind: "cause" | "unexplained";
  evidenceStatus: "supported" | "weak" | "measured";
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  addresses: string;
  kind: "inference";
}

export interface Claim {
  id: string;
  label: string;
  value: number;
  unit: "USD" | "pct" | "count" | "index";
  interval: [number, number] | null;
  kind: string;
  queryRef: string;
  calcRef: string;
}

export interface Evidence {
  claimId: string;
  query: string;
  rowSample: { columns: string[]; rows: (string | number)[][] };
  calculation: string[];
  model: string;
  dataVersion: string;
  codeVersion: string;
  verifier: "passed" | "repaired" | "fallback";
}

export interface Mission {
  id: string;
  name: string;
  scope: string;
  createdAt: string;
  headlineCause: string;
  confidence: "High" | "Medium" | "Low";
  changePct: number;
  runs: number;
  status: "saved" | "running" | "failed";
}

export interface MemoryNote {
  id: string;
  scope: string;
  kind: "confirmed" | "refuted";
  hypothesis: string;
  investigationId: string;
  dataVersion: string;
  date: string;
}

export interface SeriesPoint {
  date: string;
  actual: number;
  expected: number;
  lo: number;
  hi: number;
}

export interface Scope {
  metric: string;
  entity: string;
  window: string;
  comparison: string;
}

export const scope: Scope = {
  metric: "Net sales",
  entity: "All stores (1,115)",
  window: "Sep 1 – Sep 30, 2024",
  comparison: "Aug 1 – Aug 31, 2024",
};

export const headline = {
  actual: 4_488_000,
  expected: 4_900_000,
  changePct: -8.4,
  gap: -412_000,
  interval: [-436_000, -388_000] as [number, number],
  outsideNormalVariation: true,
};

export const sources: Source[] = [
  {
    id: "src_sales",
    logical: "sales_facts",
    system: "PostgreSQL · retail-prod-01",
    engine: "Zetaris federated",
    status: "healthy",
    rows: 1_017_209,
    dateRange: "2013-01-01 – 2024-09-30",
    lastRefresh: "2024-10-01T06:12:00Z",
    contents: "store, date, sales, customers, open flag, promo flag, holiday flags",
  },
  {
    id: "src_dim",
    logical: "store_dim",
    system: "MySQL · retail-dim-02",
    engine: "Zetaris federated",
    status: "healthy",
    rows: 1_115,
    dateRange: "static · refreshed nightly",
    lastRefresh: "2024-10-01T02:00:00Z",
    contents: "store type, assortment, competitor distance, open date, promo programme",
  },
  {
    id: "src_ext",
    logical: "external_series",
    system: "Object storage · parquet (s3://kausa-ext)",
    engine: "Zetaris federated",
    status: "degraded",
    rows: 4_383,
    dateRange: "2013-01-01 – 2024-09-28",
    lastRefresh: "2024-09-28T00:00:00Z",
    contents: "fuel price, exchange rate, weather, CPI, calendar events",
  },
];

export const dataQuality: DataQualityWarning[] = [
  {
    severity: "warning",
    title: "external_series is 2 days stale",
    detail: "CPI and fuel series end 2024-09-28; the analysis window ends 2024-09-30.",
    impact: "External-shock timing for the final two days is interpolated. Effect on the conclusion is bounded and shown as added interval width.",
  },
  {
    severity: "info",
    title: "13 closed-store days excluded from modelling",
    detail: "Rows with open = false are retained for context but excluded from sales modelling.",
    impact: "No effect on the gap; closure is separately tested as a hypothesis.",
  },
  {
    severity: "info",
    title: "No duplicate (store, date) keys",
    detail: "1,017,209 rows validated against a uniqueness contract.",
    impact: "Clean join key for federation.",
  },
];

export const suggestedQuestions = [
  "Why did sales drop in September?",
  "Why did average basket size fall last month?",
  "Why did transactions decline in the North region?",
  "Was the Labor Day promotion profitable?",
];

export const series: SeriesPoint[] = [
  { date: "Sep 1", actual: 132, expected: 148, lo: 138, hi: 158 },
  { date: "Sep 3", actual: 141, expected: 150, lo: 140, hi: 160 },
  { date: "Sep 5", actual: 138, expected: 152, lo: 142, hi: 162 },
  { date: "Sep 7", actual: 167, expected: 176, lo: 164, hi: 188 },
  { date: "Sep 9", actual: 128, expected: 149, lo: 138, hi: 160 },
  { date: "Sep 11", actual: 136, expected: 153, lo: 142, hi: 164 },
  { date: "Sep 13", actual: 144, expected: 158, lo: 147, hi: 169 },
  { date: "Sep 15", actual: 153, expected: 165, lo: 153, hi: 177 },
  { date: "Sep 17", actual: 139, expected: 156, lo: 145, hi: 167 },
  { date: "Sep 19", actual: 142, expected: 158, lo: 147, hi: 169 },
  { date: "Sep 21", actual: 176, expected: 188, lo: 175, hi: 201 },
  { date: "Sep 23", actual: 134, expected: 154, lo: 143, hi: 165 },
  { date: "Sep 25", actual: 138, expected: 157, lo: 146, hi: 168 },
  { date: "Sep 27", actual: 147, expected: 162, lo: 151, hi: 173 },
  { date: "Sep 29", actual: 160, expected: 172, lo: 160, hi: 184 },
];

export const hypotheses: Hypothesis[] = [
  {
    id: "H1",
    title: "Promotion depth was reduced versus the comparison window",
    test: "Promotion effect",
    params: "promo_depth · diff-in-diff vs unchanged-promo stores",
    status: "supported",
    contribution: -186_000,
    interval: [-214_000, -158_000],
    reason: "Effect interval excludes zero; control stores with unchanged promotion did not move.",
    claimIds: ["C-0010", "C-0011", "C-0012"],
    durationMs: 1180,
  },
  {
    id: "H2",
    title: "A new competitor opened near a subset of stores",
    test: "Competitor event",
    params: "event_date=Aug 19 · matched control stores",
    status: "supported",
    contribution: -98_000,
    interval: [-126_000, -70_000],
    reason: "Post-event deviation in 34 treated stores exceeds placebo dates; matched controls flat.",
    claimIds: ["C-0020", "C-0021"],
    durationMs: 1420,
  },
  {
    id: "H3",
    title: "A market-wide external shock moved demand",
    test: "External shock",
    params: "fuel_price, cpi · lag 0–3w · detrended",
    status: "weak",
    contribution: -54_000,
    interval: [-108_000, -2_000],
    reason: "Direction consistent but interval is wide; correlation survives detrending but is borderline after multiple-testing correction.",
    claimIds: ["C-0030", "C-0031"],
    durationMs: 1610,
  },
  {
    id: "H4",
    title: "September has an unfavourable calendar mix",
    test: "Calendar or holiday",
    params: "same-period prior years · trading-day count",
    status: "supported",
    contribution: -31_000,
    interval: [-44_000, -18_000],
    reason: "September 2024 has one fewer trading Sunday than August; prior years show the same pattern.",
    claimIds: ["C-0040"],
    durationMs: 640,
  },
  {
    id: "H5",
    title: "The store or product mix shifted",
    test: "Mix shift",
    params: "mix vs rate decomposition",
    status: "weak",
    contribution: -19_000,
    interval: [-47_000, 9_000],
    reason: "Rate effect explains part of the move; interval straddles zero, so mix is secondary.",
    claimIds: ["C-0050"],
    durationMs: 720,
  },
  {
    id: "H6",
    title: "Local weather was anomalous",
    test: "External shock",
    params: "temperature, precipitation · 12 placebo windows",
    status: "refuted",
    contribution: 0,
    interval: null,
    reason: "Placebo windows reproduced a similar deviation; no effect beyond normal variation.",
    claimIds: ["C-0060"],
    durationMs: 900,
  },
  {
    id: "H7",
    title: "Stores closed or sales days were missing",
    test: "Closure or availability",
    params: "open-day accounting · coverage check",
    status: "refuted",
    contribution: 0,
    interval: null,
    reason: "Open-day coverage unchanged at 99.8% versus 99.8% in the comparison window.",
    claimIds: ["C-0070"],
    durationMs: 380,
  },
  {
    id: "H8",
    title: "Own price / cost pass-through changed",
    test: "Structural break",
    params: "supplier price list · change-point detection",
    status: "untestable",
    contribution: null,
    interval: null,
    reason: "September supplier price list has not been ingested into the source system. Testing requires the cost file.",
    claimIds: [],
    durationMs: 210,
  },
];

export const attribution: Attribution[] = [
  { group: "Promotion", key: "promotion", contribution: -186_000, interval: [-214_000, -158_000], color: "#7c6cff", kind: "cause", evidenceStatus: "supported" },
  { group: "Competition", key: "competition", contribution: -98_000, interval: [-126_000, -70_000], color: "#5b8bff", kind: "cause", evidenceStatus: "supported" },
  { group: "External economic series", key: "external", contribution: -54_000, interval: [-108_000, -2_000], color: "#3ad6f0", kind: "cause", evidenceStatus: "weak" },
  { group: "Calendar & holidays", key: "calendar", contribution: -31_000, interval: [-44_000, -18_000], color: "#3ddc97", kind: "cause", evidenceStatus: "supported" },
  { group: "Assortment mix", key: "mix", contribution: -19_000, interval: [-47_000, 9_000], color: "#f5c451", kind: "cause", evidenceStatus: "weak" },
  { group: "Store-specific factors", key: "store", contribution: -8_000, interval: [-22_000, 6_000], color: "#a78bfa", kind: "cause", evidenceStatus: "measured" },
  { group: "Unexplained remainder", key: "unexplained", contribution: -16_000, interval: [-40_000, 8_000], color: "#6b7080", kind: "unexplained", evidenceStatus: "measured" },
];

export const recommendations: Recommendation[] = [
  {
    id: "R1",
    title: "Restore promotion depth on the affected SKUs",
    detail: "The promotion effect (−$186K, high confidence) is the single largest driver. Reinstating the comparison-window depth on the affected assortment is the highest-leverage, lowest-risk action.",
    addresses: "H1 · Promotion",
    kind: "inference",
  },
  {
    id: "R2",
    title: "Run a targeted local response on the 34 competitor-adjacent stores",
    detail: "A local offer or awareness push on the treated stores tests whether the competitor effect (−$98K) is recoverable. Measure against the matched control stores.",
    addresses: "H2 · Competition",
    kind: "inference",
  },
  {
    id: "R3",
    title: "Ingest the September supplier price list",
    detail: "This converts the untestable price/cost hypothesis into a testable one and will sharpen the external-shock estimate. Until then, own-price effects remain inside the unexplained remainder potential.",
    addresses: "H8 · Untestable",
    kind: "inference",
  },
];

export const limitations = [
  "September supplier price list is not ingested, so cost pass-through / own-price is untestable this run.",
  "External series are monthly to Sep 28; timing for the last two days is interpolated and adds interval width.",
  "Two of the 34 competitor-adjacent stores lack footfall counters; store-level traffic splits are approximated from basket data.",
  "Results are evidence-weighted explanations, not proof of causation.",
];

export const whatWouldChange = [
  "If promotion depth is restored and sales recover toward the expected band, the promotion cause is strengthened.",
  "If competitor-adjacent stores keep declining after a local campaign, the competition effect is likely larger than −$98K.",
  "If the supplier price list shows a September increase, part of the external-shock interval may move to own-price.",
];

export const claims: Claim[] = [
  { id: "C-0001", label: "Gap vs expected (net sales)", value: -412_000, unit: "USD", interval: [-436_000, -388_000], kind: "gap", queryRef: "Q-gap-01", calcRef: "attribution/expected_gap" },
  { id: "C-0002", label: "Actual net sales, analysis window", value: 4_488_000, unit: "USD", interval: null, kind: "observed", queryRef: "Q-sales-02", calcRef: "aggregate/sum_net_sales" },
  { id: "C-0003", label: "Expected net sales (exogenous-only model)", value: 4_900_000, unit: "USD", interval: [4_872_000, 4_928_000], kind: "model", queryRef: "Q-features-03", calcRef: "model/expected_value" },
  { id: "C-0010", label: "Promotion contribution", value: -186_000, unit: "USD", interval: [-214_000, -158_000], kind: "attribution", queryRef: "Q-promo-11", calcRef: "shapley/group_promotion" },
  { id: "C-0011", label: "Promo depth change", value: -22.5, unit: "pct", interval: [-27.1, -18.0], kind: "driver", queryRef: "Q-promo-12", calcRef: "compare/promo_depth" },
  { id: "C-0012", label: "Control-store promo move (diff-in-diff)", value: 0.4, unit: "pct", interval: [-1.8, 2.6], kind: "control", queryRef: "Q-promo-13", calcRef: "did/control_stores" },
  { id: "C-0020", label: "Competitor-event contribution", value: -98_000, unit: "USD", interval: [-126_000, -70_000], kind: "attribution", queryRef: "Q-comp-21", calcRef: "shapley/group_competition" },
  { id: "C-0021", label: "Treated stores affected", value: 34, unit: "count", interval: null, kind: "scope", queryRef: "Q-comp-22", calcRef: "join/store_dim_competitor_dist" },
  { id: "C-0030", label: "External-shock contribution", value: -54_000, unit: "USD", interval: [-108_000, -2_000], kind: "attribution", queryRef: "Q-ext-31", calcRef: "shapley/group_external" },
  { id: "C-0031", label: "Fuel → demand lag correlation", value: -0.31, unit: "index", interval: [-0.52, -0.06], kind: "statistic", queryRef: "Q-ext-32", calcRef: "xcorr/detrended_lag3" },
  { id: "C-0040", label: "Calendar contribution", value: -31_000, unit: "USD", interval: [-44_000, -18_000], kind: "attribution", queryRef: "Q-cal-41", calcRef: "shapley/group_calendar" },
  { id: "C-0050", label: "Mix-shift contribution", value: -19_000, unit: "USD", interval: [-47_000, 9_000], kind: "attribution", queryRef: "Q-mix-51", calcRef: "shapley/group_mix" },
  { id: "C-0060", label: "Weather placebo passes", value: 11, unit: "count", interval: null, kind: "placebo", queryRef: "Q-wx-61", calcRef: "placebo/weather_windows" },
  { id: "C-0070", label: "Open-day coverage", value: 99.8, unit: "pct", interval: null, kind: "quality", queryRef: "Q-cov-71", calcRef: "quality/open_day_coverage" },
];

export const evidence: Record<string, Evidence> = {
  "C-0010": {
    claimId: "C-0010",
    query: `-- Federated query via Zetaris (join across PostgreSQL + MySQL + object storage)
SELECT
  s.store_id,
  s.date,
  SUM(s.sales)                     AS net_sales,
  AVG(p.promo_depth)               AS promo_depth,
  d.competitor_dist_km
FROM   sales_facts   AS s
JOIN   store_dim     AS d ON d.store_id = s.store_id
LEFT JOIN promo_calendar AS p ON p.store_id = s.store_id AND p.date = s.date
WHERE  s.date BETWEEN DATE '2024-08-01' AND DATE '2024-09-30'
  AND  s.open = TRUE
GROUP  BY s.store_id, s.date, d.competitor_dist_km;`,
    rowSample: {
      columns: ["store_id", "date", "net_sales", "promo_depth", "competitor_dist_km"],
      rows: [
        [1, "2024-09-02", 5423.5, 0.1, "2.4"],
        [1, "2024-09-03", 4980.0, 0.1, "2.4"],
        [2, "2024-09-02", 6110.25, 0.15, "0.8"],
        [3, "2024-09-02", 2210.75, 0.0, "5.1"],
      ],
    },
    calculation: [
      "Counterfactual: set promo_depth to the comparison-window value, hold other exogenous features actual.",
      "Predict both cases with the expected-value model (256 batched cases over 8 groups).",
      "Exact Shapley over subsets → fair share of the modelled gap = −186,000 USD.",
      "Bootstrap (1,000 resamples) → 90% interval [−214,000, −158,000].",
      "Difference-in-differences vs unchanged-promo stores: control move +0.4% (interval spans 0) → supported.",
    ],
    model: "NVIDIA Nemotron-4-340B (narration) · LightGBM 4.4.0 (expected value)",
    dataVersion: "2024.10.01-rc2",
    codeVersion: "kausa-agent@1.0.0",
    verifier: "passed",
  },
  "C-0020": {
    claimId: "C-0020",
    query: `-- Event study around competitor opening (Aug 19), matched control stores
SELECT
  CASE WHEN d.competitor_dist_km < 1.0 THEN 'treated' ELSE 'control' END AS grp,
  s.date,
  SUM(s.sales) AS net_sales
FROM   sales_facts AS s
JOIN   store_dim   AS d ON d.store_id = s.store_id
WHERE  s.date BETWEEN DATE '2024-07-22' AND DATE '2024-09-30'
GROUP  BY grp, s.date;`,
    rowSample: {
      columns: ["grp", "date", "net_sales"],
      rows: [
        ["treated", "2024-08-12", 88_120],
        ["treated", "2024-08-26", 79_400],
        ["control", "2024-08-12", 121_050],
        ["control", "2024-08-26", 120_310],
      ],
    },
    calculation: [
      "Post-event deviation in treated stores vs matched controls from Aug 19.",
      "12 placebo event dates reproduce a mean deviation of −0.3%; observed is −6.9%.",
      "Shapley group share = −98,000 USD [−126,000, −70,000].",
    ],
    model: "LightGBM 4.4.0 (expected value) · local event-study code",
    dataVersion: "2024.10.01-rc2",
    codeVersion: "kausa-agent@1.0.0",
    verifier: "passed",
  },
  "C-0031": {
    claimId: "C-0031",
    query: `-- Lagged cross-correlation, detrended series
SELECT
  corr.detrended(fuel_price, 3) AS xcorr_lag3
FROM   external_series
WHERE  date BETWEEN DATE '2023-01-01' AND DATE '2024-09-28';`,
    rowSample: {
      columns: ["metric", "value"],
      rows: [
        ["xcorr_lag0", -0.22],
        ["xcorr_lag1", -0.27],
        ["xcorr_lag2", -0.29],
        ["xcorr_lag3", -0.31],
      ],
    },
    calculation: [
      "Detrend both series (HP filter), compute lagged cross-correlation.",
      "Bonferroni correction across 12 lags → borderline significance (p ≈ 0.04).",
      "Status capped at 'weak' because the interval includes near-zero after correction.",
    ],
    model: "statsmodels 0.14 (xcorr)",
    dataVersion: "2024.10.01-rc2",
    codeVersion: "kausa-agent@1.0.0",
    verifier: "passed",
  },
};

export const missions: Mission[] = [
  { id: "M-1042", name: "September sales drop — all stores", scope: "Net sales · All stores · Sep 2024", createdAt: "2024-10-01T06:20:00Z", headlineCause: "Promotion depth", confidence: "High", changePct: -8.4, runs: 3, status: "saved" },
  { id: "M-1039", name: "Q3 margin decline — Region North", scope: "Gross margin · Region North · Q3 2024", createdAt: "2024-09-28T09:05:00Z", headlineCause: "Supplier cost pass-through", confidence: "Medium", changePct: -3.1, runs: 1, status: "saved" },
  { id: "M-1035", name: "Traffic drop — Store #442", scope: "Transactions · Store #442 · Sep 2024", createdAt: "2024-09-24T14:40:00Z", headlineCause: "Local competitor opening", confidence: "High", changePct: -12.7, runs: 2, status: "saved" },
  { id: "M-1030", name: "Basket-size move — South region", scope: "Avg basket · South · Aug 2024", createdAt: "2024-09-10T11:15:00Z", headlineCause: "Mix shift", confidence: "Low", changePct: -1.6, runs: 1, status: "saved" },
];

export const memory: MemoryNote[] = [
  { id: "N-1", scope: "Net sales · All stores", kind: "confirmed", hypothesis: "Promotion depth", investigationId: "M-1042", dataVersion: "2024.10.01-rc2", date: "2024-10-01" },
  { id: "N-2", scope: "Net sales · All stores", kind: "confirmed", hypothesis: "Competitor event", investigationId: "M-1042", dataVersion: "2024.10.01-rc2", date: "2024-10-01" },
  { id: "N-3", scope: "Net sales · All stores", kind: "refuted", hypothesis: "Store closures / missing days", investigationId: "M-1042", dataVersion: "2024.10.01-rc2", date: "2024-10-01" },
  { id: "N-4", scope: "Net sales · All stores", kind: "refuted", hypothesis: "Weather anomaly", investigationId: "M-1042", dataVersion: "2024.10.01-rc2", date: "2024-10-01" },
];

export const meta = {
  modelName: "nemotron-4-340b-instruct",
  modelVersion: "2024.08",
  expectedValueModel: "LightGBM 4.4.0 · log target · 8 groups",
  dataVersion: "2024.10.01-rc2",
  codeVersion: "kausa-agent@1.0.0",
  backtest: { storeDayWape: 11.4, allStoreWeeklyWape: 5.2, intervalCoverage: 88.6 },
  injection: { trials: 200, recovered: 184, rate: 92 },
};

export function groupForHypothesis(id: string): string | null {
  const map: Record<string, string> = {
    H1: "promotion",
    H2: "competition",
    H3: "external",
    H4: "calendar",
    H5: "mix",
  };
  return map[id] ?? null;
}

export const glossary: { term: string; meaning: string }[] = [
  { term: "Expected value", meaning: "What the metric would likely have been given normal drivers and no unusual factors." },
  { term: "Gap", meaning: "Actual minus expected." },
  { term: "Attribution", meaning: "Splitting the gap across driver groups that moved between the two windows." },
  { term: "Driver regression", meaning: "A linear fit of the metric on your numeric driver columns, used to estimate each driver's contribution to the gap." },
  { term: "Unexplained remainder", meaning: "The part of the gap not attributed to any uploaded driver, reported explicitly rather than hidden." },
  { term: "Claim", meaning: "A single computed fact stored with the evidence behind it." },
  { term: "Token firewall", meaning: "Keeping raw data out of the language model by sending only compact computed summaries." },
];
