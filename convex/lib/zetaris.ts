/**
 * Zetaris federated-SQL client (Zetaris AI Data Harness / Lightning REST API).
 *
 * Instead of pretending the uploaded rows are the only source, Kausa can run its
 * analysis query *where the data lives* through Zetaris and read back the
 * aggregated slice. Zetaris federates across datasources, so the same SQL can
 * span a warehouse, an object store and a REST API without moving raw rows.
 *
 * Flow (per the current Zetaris REST docs):
 *   GET    /api/v1.0/auth/login                     → bearer token (username/password)
 *   POST   /api/v1.0/query/sql/start  { select, pageLimit }   → { records, queryToken, totalPages }
 *   GET    /api/v1.0/query/sql/page   ?queryToken=&pageLimit=&pageNumber= → { records }
 *   DELETE /api/v1.0/query/sql/close/{queryToken}
 *   (an API key may be used as the bearer token directly, skipping login)
 *   Falls back to the legacy /sql-editor/sqls/run-query  { sql } → { headers, data }
 *
 * All calls require an `X-Org-ID` header (an integer org id on the SaaS API) and
 * an `X-Request-ID` for tracing.
 *
 * Env (values come from the Zetaris Cloud console → Hackathon bundle):
 *   ZETARIS_BASE_URL   e.g. https://api.saas.enterprise.zetaris.com
 *   ZETARIS_ORG_ID     organization id (integer on the SaaS API, NOT the slug)
 *   ZETARIS_API_KEY    bearer token   -- OR --  ZETARIS_USERNAME + ZETARIS_PASSWORD
 *   ZETARIS_SOURCE     the table/view to federate, e.g. kausa.retail_sales
 */

export interface ZetarisConfig {
  baseUrl: string;
  orgId: string;
  apiKey?: string;
  username?: string;
  password?: string;
  source: string;
}

export interface ZetarisRows {
  headers: string[];
  rows: Record<string, string | number | null>[];
}

function requestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * True for loopback base URLs (a local Docker stack / dev proxy). Convex
 * functions run remotely, so a localhost endpoint is unreachable in production;
 * we treat it as unconfigured and fall back to the local data store instead of
 * blocking on a dead host. Set ZETARIS_ALLOW_LOCAL=true to opt in (e.g. when
 * running against a local Convex backend).
 */
function isLoopbackUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function zetarisConfig(): ZetarisConfig | null {
  const baseUrl = process.env.ZETARIS_BASE_URL?.trim().replace(/\/$/, "");
  const orgId = process.env.ZETARIS_ORG_ID?.trim();
  const apiKey = process.env.ZETARIS_API_KEY?.trim();
  const username = process.env.ZETARIS_USERNAME?.trim();
  const password = process.env.ZETARIS_PASSWORD;
  const source = process.env.ZETARIS_SOURCE?.trim();
  if (!baseUrl || !orgId || !source) return null;
  if (!apiKey && !(username && password)) return null;
  // Never depend on a local Docker container from the deployed backend.
  if (isLoopbackUrl(baseUrl) && process.env.ZETARIS_ALLOW_LOCAL !== "true") return null;
  return { baseUrl, orgId, apiKey, username, password, source };
}

export function zetarisEnabled(): boolean {
  return zetarisConfig() !== null;
}

/** Human-readable status line for the run log / UI. */
export function zetarisStatus(): string {
  const cfg = zetarisConfig();
  if (!cfg) return "not configured";
  return `federated via ${cfg.baseUrl}`;
}

async function login(cfg: ZetarisConfig, signal: AbortSignal): Promise<string> {
  const url =
    `${cfg.baseUrl}/api/v1.0/auth/login` +
    `?username=${encodeURIComponent(cfg.username ?? "")}` +
    `&password=${encodeURIComponent(cfg.password ?? "")}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Org-ID": cfg.orgId,
      "X-Request-ID": requestId(),
      accept: "application/json",
    },
    signal,
  });
  if (!res.ok) throw new Error(`Zetaris login failed (${res.status})`);
  const json = (await res.json()) as Record<string, unknown>;
  const nested = (json.data ?? {}) as Record<string, unknown>;
  const token =
    json.token ?? json.accessToken ?? json.access_token ?? json.bearerToken ??
    nested.token ?? nested.accessToken;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Zetaris login returned no token");
  }
  return token;
}

/** Zetaris caps a single page at 100 records. */
const PAGE_LIMIT = 100;

/** Coerce a Zetaris record set (objects or positional arrays) into rows. */
function toRows(raw: unknown[], headersIn: string[] = []): ZetarisRows {
  const first = raw[0];
  const headers =
    headersIn.length > 0
      ? headersIn
      : first && typeof first === "object" && !Array.isArray(first)
        ? Object.keys(first as Record<string, unknown>)
        : [];
  const rows = raw.map((r) => {
    if (Array.isArray(r)) {
      const obj: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? null) as string | number | null;
      });
      return obj;
    }
    return r as Record<string, string | number | null>;
  });
  return { headers, rows };
}

function authHeaders(cfg: ZetarisConfig, token: string): Record<string, string> {
  return {
    "X-Org-ID": cfg.orgId,
    "X-Request-ID": requestId(),
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

/** Current documented flow: start → page → close, returning all records. */
async function runPaginated(
  cfg: ZetarisConfig,
  token: string,
  sql: string,
  signal: AbortSignal,
): Promise<unknown[]> {
  const startRes = await fetch(`${cfg.baseUrl}/api/v1.0/query/sql/start`, {
    method: "POST",
    headers: authHeaders(cfg, token),
    body: JSON.stringify({ select: sql, pageLimit: PAGE_LIMIT }),
    signal,
  });
  if (!startRes.ok) {
    const body = await startRes.text().catch(() => "");
    throw new Error(
      `Zetaris query start failed (${startRes.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  const first = (await startRes.json()) as {
    records?: unknown[];
    queryToken?: string;
    totalPages?: number;
  };
  const queryToken = typeof first.queryToken === "string" ? first.queryToken : "";
  const records: unknown[] = Array.isArray(first.records) ? [...first.records] : [];
  const totalPages = Number(first.totalPages ?? 1);
  try {
    for (let page = 2; page <= totalPages; page++) {
      const res = await fetch(
        `${cfg.baseUrl}/api/v1.0/query/sql/page` +
          `?queryToken=${encodeURIComponent(queryToken)}` +
          `&pageLimit=${PAGE_LIMIT}&pageNumber=${page}`,
        {
          method: "GET",
          headers: {
            "X-Org-ID": cfg.orgId,
            "X-Request-ID": requestId(),
            accept: "application/json",
            authorization: `Bearer ${token}`,
          },
          signal,
        },
      );
      if (!res.ok) break;
      const j = (await res.json()) as { records?: unknown[] };
      if (Array.isArray(j.records)) records.push(...j.records);
    }
  } finally {
    if (queryToken) {
      await fetch(
        `${cfg.baseUrl}/api/v1.0/query/sql/close/${encodeURIComponent(queryToken)}`,
        {
          method: "DELETE",
          headers: {
            "X-Org-ID": cfg.orgId,
            "X-Request-ID": requestId(),
            authorization: `Bearer ${token}`,
          },
          signal,
        },
      ).catch(() => {});
    }
  }
  return records;
}

/** Legacy flow that answers in one shot: { sql } → { headers, data }. */
async function runLegacy(
  cfg: ZetarisConfig,
  token: string,
  sql: string,
  signal: AbortSignal,
): Promise<ZetarisRows> {
  const res = await fetch(`${cfg.baseUrl}/api/v1.0/sql-editor/sqls/run-query`, {
    method: "POST",
    headers: authHeaders(cfg, token),
    body: JSON.stringify({ sql }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Zetaris query failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  const json = (await res.json()) as { headers?: string[]; data?: unknown[] };
  const headers = Array.isArray(json.headers) ? json.headers : [];
  const data = Array.isArray(json.data) ? json.data : [];
  return toRows(data, headers);
}

/** Run a SQL statement through Zetaris and return the rows as objects. */
export async function zetarisRun(
  sql: string,
  opts?: { timeoutMs?: number },
): Promise<ZetarisRows> {
  const cfg = zetarisConfig();
  if (!cfg) throw new Error("Zetaris is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60_000);
  try {
    const token = cfg.apiKey ?? (await login(cfg, controller.signal));
    try {
      const records = await runPaginated(cfg, token, sql, controller.signal);
      if (records.length > 0) return toRows(records);
    } catch {
      // Fall through to the legacy single-shot endpoint below.
    }
    return await runLegacy(cfg, token, sql, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Build the aggregate slice query Zetaris should run over the federated source:
 * per-day SUM(metric) and AVG(drivers), matching Kausa's local aggregation, so
 * results are identical whether the data is read locally or federated.
 */
export function buildSliceSql(args: {
  source: string;
  dateColumn: string;
  metricColumn: string;
  driverColumns: string[];
  dim: string;
  value: string;
  start: number;
  end: number;
}): string {
  const { source, dateColumn, metricColumn, driverColumns, dim, value, start, end } = args;
  const select = [
    `${dateColumn} AS kausa_date`,
    `SUM(${metricColumn}) AS kausa_metric`,
    ...driverColumns.map((c, i) => `AVG(${c}) AS kausa_d_${i}`),
  ].join(", ");
  const where = [
    `${dateColumn} >= '${isoDay(start)}'`,
    `${dateColumn} <= '${isoDay(end)}'`,
    ...(dim && value ? [`${dim} = '${value.replace(/'/g, "''")}'`] : []),
  ].join(" AND ");
  return (
    `SELECT ${select}\nFROM ${source}\nWHERE ${where}\n` +
    `GROUP BY ${dateColumn}\nORDER BY ${dateColumn}`
  );
}

export interface ZetarisPoint {
  date: number;
  metric: number;
  drivers: Record<string, number>;
}

/** Map a Zetaris result set back into Kausa's day points. */
export function toDayPoints(
  rows: Record<string, string | number | null>[],
  driverColumns: string[],
): ZetarisPoint[] {
  const out: ZetarisPoint[] = [];
  for (const r of rows) {
    const raw = r.kausa_date;
    const date =
      typeof raw === "number"
        ? Math.round(raw) < 1e12
          ? raw * DAY
          : raw
        : Date.parse(String(raw ?? ""));
    const metric = Number(r.kausa_metric);
    if (!Number.isFinite(date) || !Number.isFinite(metric)) continue;
    const drivers: Record<string, number> = {};
    driverColumns.forEach((c, i) => {
      const v = Number(r[`kausa_d_${i}`]);
      if (Number.isFinite(v)) drivers[c] = v;
    });
    // Snap to the UTC day so window filters match the local-store path.
    const d = new Date(date);
    out.push({ date: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), metric, drivers });
  }
  return out.sort((a, b) => a.date - b.date);
}
