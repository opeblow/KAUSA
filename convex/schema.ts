import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const columnValidator = v.object({
  name: v.string(),
  kind: v.union(v.literal("date"), v.literal("number"), v.literal("text")),
  samples: v.array(v.string()),
});

export const scopeValidator = v.object({
  metric: v.string(),
  dim: v.string(),
  value: v.string(),
  windowStart: v.number(),
  windowEnd: v.number(),
  comparisonStart: v.number(),
  comparisonEnd: v.number(),
});

export const hypothesisValidator = v.object({
  id: v.string(),
  title: v.string(),
  test: v.string(),
  params: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("testing"),
    v.literal("supported"),
    v.literal("weak"),
    v.literal("refuted"),
    v.literal("untestable"),
  ),
  contribution: v.union(v.number(), v.null()),
  interval: v.union(v.array(v.number()), v.null()),
  reason: v.string(),
  claimIds: v.array(v.string()),
  durationMs: v.number(),
});

export const attributionValidator = v.object({
  group: v.string(),
  key: v.string(),
  contribution: v.number(),
  interval: v.array(v.number()),
  color: v.string(),
  kind: v.union(v.literal("cause"), v.literal("unexplained")),
  evidenceStatus: v.union(
    v.literal("supported"),
    v.literal("weak"),
    v.literal("measured"),
  ),
});

export const recommendationValidator = v.object({
  id: v.string(),
  title: v.string(),
  detail: v.string(),
  addresses: v.string(),
  kind: v.literal("inference"),
});

export const seriesPointValidator = v.object({
  date: v.string(),
  actual: v.number(),
  expected: v.number(),
  lo: v.number(),
  hi: v.number(),
});

export const headlineValidator = v.object({
  actual: v.number(),
  expected: v.number(),
  changePct: v.number(),
  gap: v.number(),
  interval: v.array(v.number()),
  outsideNormalVariation: v.boolean(),
});

export const runLogValidator = v.object({
  t: v.number(),
  label: v.string(),
  detail: v.optional(v.string()),
  status: v.union(
    v.literal("running"),
    v.literal("done"),
    v.literal("failed"),
  ),
});

export const statusValidator = v.union(
  v.literal("scoped"),
  v.literal("planned"),
  v.literal("testing"),
  v.literal("attributing"),
  v.literal("narrating"),
  v.literal("verified"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const datasetStatusValidator = v.union(
  v.literal("parsing"),
  v.literal("ready"),
  v.literal("error"),
);

// --- H-MEM (Meterless memory engine) --------------------------------------
export const memoryTypeValidator = v.union(
  v.literal("personal"),
  v.literal("factual"),
  v.literal("preference"),
  v.literal("general"),
);

export const memoryLayerValidator = v.union(
  v.literal("short_term"),
  v.literal("working"),
  v.literal("long_term"),
);

export const memoryProvenanceValidator = v.object({
  origin: v.string(),
  learnedAt: v.number(),
  label: v.string(),
  datasetId: v.optional(v.id("datasets")),
  investigationId: v.optional(v.id("investigations")),
});

export default defineSchema({
  ...authTables,

  datasets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    status: datasetStatusValidator,
    error: v.optional(v.string()),
    rowCount: v.number(),
    columns: v.array(columnValidator),
    dateColumn: v.optional(v.string()),
    metricColumn: v.optional(v.string()),
    numericColumns: v.array(v.string()),
    categoricalColumns: v.array(v.string()),
    dateMin: v.optional(v.number()),
    dateMax: v.optional(v.number()),
    sampleRows: v.array(v.array(v.union(v.string(), v.number()))),
    unit: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  // Records which authenticated user owns each uploaded blob, so a dataset can
  // only be created from a storage id that user actually uploaded. The row is
  // consumed on dataset creation.
  uploads: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
  })
    .index("by_storage", ["storageId"])
    .index("by_user", ["userId"]),

  datasetPoints: defineTable({
    datasetId: v.id("datasets"),
    dim: v.string(),
    value: v.string(),
    date: v.number(),
    metric: v.number(),
    drivers: v.record(v.string(), v.number()),
  })
    .index("by_dataset_slice_date", ["datasetId", "dim", "value", "date"])
    .index("by_dataset_date", ["datasetId", "date"]),

  investigations: defineTable({
    userId: v.id("users"),
    datasetId: v.id("datasets"),
    question: v.string(),
    scope: scopeValidator,
    status: statusValidator,
    step: v.string(),
    runLog: v.array(runLogValidator),
    headline: v.optional(headlineValidator),
    series: v.array(seriesPointValidator),
    hypotheses: v.array(hypothesisValidator),
    attribution: v.array(attributionValidator),
    recommendations: v.array(recommendationValidator),
    limitations: v.array(v.string()),
    whatWouldChange: v.array(v.string()),
    narration: v.optional(v.string()),
    saved: v.boolean(),
    name: v.optional(v.string()),
    error: v.optional(v.string()),
    model: v.string(),
    dataVersion: v.string(),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_dataset", ["datasetId"]),

  claims: defineTable({
    investigationId: v.id("investigations"),
    userId: v.id("users"),
    claimId: v.string(),
    label: v.string(),
    value: v.number(),
    unit: v.union(
      v.literal("USD"),
      v.literal("pct"),
      v.literal("count"),
      v.literal("index"),
    ),
    interval: v.union(v.array(v.number()), v.null()),
    kind: v.string(),
    query: v.string(),
    rowSample: v.object({
      columns: v.array(v.string()),
      rows: v.array(v.array(v.union(v.string(), v.number()))),
    }),
    calculation: v.array(v.string()),
    model: v.string(),
    dataVersion: v.string(),
    codeVersion: v.string(),
    verifier: v.union(
      v.literal("passed"),
      v.literal("repaired"),
      v.literal("fallback"),
    ),
  })
    .index("by_investigation", ["investigationId"])
    .index("by_user", ["userId"]),

  // H-MEM durable memory: the canonical record is per-user. A record with no
  // `source` is rejected by construction (see convex/memories.ts). The
  // deterministic embedding enables the eight-signal hybrid ranker in
  // convex/lib/hmem.ts without an external vector service.
  memories: defineTable({
    userId: v.id("users"),
    content: v.string(),
    type: memoryTypeValidator,
    layer: memoryLayerValidator,
    tags: v.array(v.string()),
    domain: v.string(),
    namespace: v.string(),
    source: v.string(),
    confidence: v.number(),
    accessCount: v.number(),
    lastAccessed: v.number(),
    timestamp: v.number(),
    embedding: v.array(v.number()),
    entities: v.array(v.string()),
    relatedTo: v.array(v.id("memories")),
    supersedes: v.optional(v.id("memories")),
    supersededBy: v.optional(v.id("memories")),
    provenance: memoryProvenanceValidator,
  })
    .index("by_user", ["userId"])
    .index("by_user_layer", ["userId", "layer"])
    .index("by_user_last", ["userId", "lastAccessed"]),

  // H-MEM trust ledger: append-only audit of every memory mutation.
  memoryLedger: defineTable({
    userId: v.id("users"),
    memoryId: v.optional(v.id("memories")),
    action: v.string(),
    actor: v.string(),
    signal: v.optional(v.string()),
    detail: v.optional(v.string()),
    previousConfidence: v.optional(v.number()),
    newConfidence: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_memory", ["memoryId"]),
});
