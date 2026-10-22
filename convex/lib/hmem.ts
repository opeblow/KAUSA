/**
 * H-MEM core — a faithful, Convex-native port of the Meterless H-MEM reference
 * engine (engines/hmem, Apache-2.0). The reference is documentation-first: the
 * hybrid ranker, memory record, feedback deltas and reinjection format below
 * match its spec section-for-section, but storage is Convex and the embedder is
 * the reference's deterministic hash embedder (no external vector service).
 *
 * This module is pure (no Node APIs) so it runs in both the default V8 runtime
 * and the Node action runtime.
 */

export type MemoryType = "personal" | "factual" | "preference" | "general";
export type MemoryLayer = "short_term" | "working" | "long_term";

export interface MemoryRow {
  _id: string;
  content: string;
  type: MemoryType;
  layer: MemoryLayer;
  tags: string[];
  domain: string;
  source: string;
  confidence: number;
  accessCount: number;
  lastAccessed: number;
  timestamp: number;
  embedding: number[];
  entities: string[];
  supersededBy?: string;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULTS = {
  retrievalTopN: 5,
  retrievalThreshold: 0.35,
  entityCap: 10,
  relatedCap: 5,
  recencyDays: 14,
} as const;

export const FEEDBACK_DELTAS = { helpful: 0.05, not_helpful: -0.03, wrong: -0.2 } as const;
export type FeedbackKind = keyof typeof FEEDBACK_DELTAS;

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const LAYER_WEIGHT: Record<MemoryLayer, number> = {
  long_term: 1.0,
  working: 0.8,
  short_term: 0.6,
};

// --- Deterministic embedder (reference/src/embeddings.ts) ------------------
const DIM = 64;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const idx = h % DIM;
    const sign = (h >>> 8) % 2 === 0 ? 1 : -1;
    const mag = 1 + ((h >>> 16) % 8) / 8;
    vec[idx] += sign * mag;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// --- Enrichment (reference/src/memoryStore.ts) -----------------------------
const TECH_TERMS = [
  "react", "python", "typescript", "javascript", "rust", "sqlite", "postgres", "indexeddb",
  "node", "docker", "graphql", "redis", "webrtc", "tauri", "electron", "llm", "embedding",
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  tech: ["code", "bug", "api", "database", "deploy", "framework", "library", "server", ...TECH_TERMS],
  work: ["meeting", "deadline", "client", "project", "sprint", "review", "report"],
  personal: ["family", "hobby", "prefer", "like", "dislike", "morning", "evening"],
  // Kausa-specific domains so recall can group analytics memory usefully.
  analytics: ["metric", "sales", "revenue", "driver", "footfall", "seasonality", "baseline", "gap", "dataset", "investigation"],
};

export function classifyDomain(content: string, tags: string[], type: MemoryType): string {
  for (const t of tags) {
    if (t.startsWith("project:")) return t.slice("project:".length);
    if (t.startsWith("tech:")) return "tech";
  }
  const tokens = new Set(tokenize(content));
  let best = "general";
  let bestScore = 0;
  for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = kws.reduce((s, kw) => s + (tokens.has(kw) ? 1 : 0), 0);
    if (domain === "personal" && (type === "personal" || type === "preference")) score += 1;
    if (score > bestScore) {
      best = domain;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : "general";
}

export function namespaceFor(domain: string, type: MemoryType): string {
  const bucket = type === "preference" || type === "personal" ? "profile" : type === "factual" ? "facts" : "notes";
  return `${domain}/${bucket}`;
}

export function extractEntities(content: string): string[] {
  const entities = new Set<string>();
  for (const t of tokenize(content)) if (TECH_TERMS.includes(t)) entities.add(t);
  for (const m of content.matchAll(/\b([A-Z][a-zA-Z]{2,})\b/g)) {
    const norm = m[1].toLowerCase();
    if (!["the", "this", "that", "with"].includes(norm)) entities.add(norm);
  }
  return [...entities].slice(0, DEFAULTS.entityCap);
}

// --- Hybrid ranker (reference/src/memoryRetrieval.ts) ----------------------
//   raw = 0.35*semantic + 0.20*keyword + 0.10*tag + 0.10*domain
//       + 0.15*entity   + 0.05*layer   + 0.05*recency - 0.20*superseded
//   score = clamp01(raw) * confidence
export function scoreMemory(m: MemoryRow, query: string, now: number): number {
  const queryEmbedding = embed(query);
  const queryTokens = tokenize(query).slice(0, 8);
  const queryEntities = extractEntities(query);
  const queryDomain = classifyDomain(query, [], "general");

  const semantic = clamp01(cosine(queryEmbedding, m.embedding));
  const keyword = jaccard(queryTokens, tokenize(m.content));
  const tag = jaccard(queryTokens, m.tags.map((t) => t.toLowerCase()));
  const domain = m.domain === queryDomain ? 1 : 0;
  const entity = jaccard(queryEntities, m.entities);
  const layer = LAYER_WEIGHT[m.layer];
  const ageDays = (now - m.lastAccessed) / DAY_MS;
  const recency = Math.exp(-ageDays / DEFAULTS.recencyDays);
  const superseded = m.supersededBy ? 1 : 0;

  const raw =
    0.35 * semantic + 0.2 * keyword + 0.1 * tag + 0.1 * domain +
    0.15 * entity + 0.05 * layer + 0.05 * recency - 0.2 * superseded;
  return clamp01(raw) * m.confidence;
}

export interface Retrieved {
  memory: MemoryRow;
  relevance: number;
}

export interface RecallResult {
  memories: Retrieved[];
  strategy: "minimal" | "personal" | "comprehensive";
  domain: string;
  scores: Record<string, number>;
}

export function recall(
  rows: MemoryRow[],
  query: string,
  now: number,
  opts?: { topN?: number; threshold?: number },
): RecallResult {
  const threshold = opts?.threshold ?? DEFAULTS.retrievalThreshold;
  const topN = opts?.topN ?? DEFAULTS.retrievalTopN;
  const queryDomain = classifyDomain(query, [], "general");

  const scored: Retrieved[] = [];
  for (const m of rows) {
    const s = scoreMemory(m, query, now);
    if (s >= threshold) scored.push({ memory: m, relevance: s });
  }
  scored.sort((a, b) => b.relevance - a.relevance || a.memory._id.localeCompare(b.memory._id));
  const top = scored.slice(0, topN);

  const strategy: RecallResult["strategy"] =
    top.length <= 1
      ? "minimal"
      : top.some((t) => t.memory.type === "personal" || t.memory.type === "preference")
        ? "personal"
        : "comprehensive";

  return {
    memories: top,
    strategy,
    domain: queryDomain,
    scores: Object.fromEntries(top.map((t) => [t.memory._id, Number(t.relevance.toFixed(4))])),
  };
}

// Domain-grouped reinjection blocks with layer markers and entities.
export function formatReinjection(items: Retrieved[]): string {
  if (items.length === 0) return "";
  const byDomain = new Map<string, Retrieved[]>();
  for (const it of items) {
    const list = byDomain.get(it.memory.domain) ?? [];
    list.push(it);
    byDomain.set(it.memory.domain, list);
  }
  const lines: string[] = ["[MEMORY CONTEXT]"];
  for (const [domain, list] of [...byDomain.entries()].sort()) {
    lines.push(`## ${domain}`);
    for (const { memory } of list) {
      const marker = memory.layer === "long_term" ? "LT" : memory.layer === "working" ? "WK" : "ST";
      const ents = memory.entities.length ? ` (entities: ${memory.entities.join(", ")})` : "";
      lines.push(`- [${marker}] ${memory.content}${ents}`);
    }
  }
  lines.push("[/MEMORY CONTEXT]");
  return lines.join("\n");
}

// --- Mining prompt (reference memoryMining.ts, adapted) --------------------
export const MINING_EVENT_TYPES = [
  "chat_message", "user_correction", "file_save", "file_open", "file_edit",
  "model_response", "plan_completion",
] as const;
export type MiningEventType = (typeof MINING_EVENT_TYPES)[number];

export const MINING_SYSTEM =
  "You are Kausa's memory writer. From an analytics investigation you extract " +
  "durable, reusable memories that would help FUTURE investigations for the same " +
  "user. Return ONLY a JSON array of short strings (each <= 180 chars). Each string " +
  "must be a standalone, timeless fact, preference, or user correction about their " +
  "data, metrics, terminology, or known causes. Do NOT include run-specific numbers " +
  "or verdicts. Return [] if nothing is durable. At most 4 items.";

export function buildMiningPrompt(event: MiningEventType, text: string): string {
  return `Event type: ${event}\n\nContent:\n${text}\n\nReturn the JSON array of durable memories.`;
}

/** Parse a strict JSON string array; returns [] on any malformed output. */
export function parseMemoryList(raw: string): string[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && s.length <= 240)
    .slice(0, 4);
}

/**
 * Keep the narration number-firewall intact: memory context is prose only, so we
 * remove digits before it reaches the narrator. The model may not echo a number
 * it was never given.
 */
export function sanitizeForModel(text: string): string {
  return text.replace(/\d+/g, "#");
}
