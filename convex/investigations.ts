import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  attributionValidator,
  headlineValidator,
  hypothesisValidator,
  recommendationValidator,
  runLogValidator,
  scopeValidator,
  seriesPointValidator,
  statusValidator,
} from "./schema";

const DAY = 86_400_000;
const RUN_WINDOW_MS = 5 * 60_000;
const MAX_RUNS_PER_WINDOW = 10;
const CLAIM_PURGE_BATCH = 500;

function dayFloor(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const investigationReturns = v.object({
  _id: v.id("investigations"),
  datasetId: v.id("datasets"),
  question: v.string(),
  scope: scopeValidator,
  status: statusValidator,
  step: v.string(),
  runLog: v.array(runLogValidator),
  headline: v.union(headlineValidator, v.null()),
  series: v.array(seriesPointValidator),
  hypotheses: v.array(hypothesisValidator),
  attribution: v.array(attributionValidator),
  recommendations: v.array(recommendationValidator),
  limitations: v.array(v.string()),
  whatWouldChange: v.array(v.string()),
  narration: v.union(v.string(), v.null()),
  saved: v.boolean(),
  name: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  model: v.string(),
  dataVersion: v.string(),
  createdAt: v.number(),
  finishedAt: v.union(v.number(), v.null()),
});

type InvDoc = import("./_generated/dataModel").Doc<"investigations">;

function toReturn(d: InvDoc) {
  return {
    _id: d._id,
    datasetId: d.datasetId,
    question: d.question,
    scope: d.scope,
    status: d.status,
    step: d.step,
    runLog: d.runLog,
    headline: d.headline ?? null,
    series: d.series,
    hypotheses: d.hypotheses,
    attribution: d.attribution,
    recommendations: d.recommendations,
    limitations: d.limitations,
    whatWouldChange: d.whatWouldChange,
    narration: d.narration ?? null,
    saved: d.saved,
    name: d.name ?? null,
    error: d.error ?? null,
    model: d.model,
    dataVersion: d.dataVersion,
    createdAt: d.createdAt,
    finishedAt: d.finishedAt ?? null,
  };
}

export const get = query({
  args: { id: v.id("investigations") },
  returns: v.union(investigationReturns, v.null()),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return null;
    return toReturn(d);
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("investigations"),
      question: v.string(),
      status: statusValidator,
      metric: v.string(),
      gap: v.union(v.number(), v.null()),
      changePct: v.union(v.number(), v.null()),
      saved: v.boolean(),
      name: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("investigations")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return docs.map((d) => ({
      _id: d._id,
      question: d.question,
      status: d.status,
      metric: d.scope.metric,
      gap: d.headline?.gap ?? null,
      changePct: d.headline?.changePct ?? null,
      saved: d.saved,
      name: d.name ?? null,
      createdAt: d.createdAt,
    }));
  },
});

export const create = mutation({
  args: {
    datasetId: v.id("datasets"),
    question: v.string(),
    dim: v.optional(v.string()),
    value: v.optional(v.string()),
    windowStart: v.optional(v.number()),
    windowEnd: v.optional(v.number()),
    comparisonStart: v.optional(v.number()),
    comparisonEnd: v.optional(v.number()),
  },
  returns: v.id("investigations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset || dataset.userId !== userId) throw new Error("Dataset not found");
    if (dataset.status !== "ready" || !dataset.dateMax || !dataset.dateMin) {
      throw new Error("Dataset is not ready yet");
    }

    const since = Date.now() - RUN_WINDOW_MS;
    const recent = await ctx.db
      .query("investigations")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_RUNS_PER_WINDOW);
    if (recent.filter((r) => r.createdAt >= since).length >= MAX_RUNS_PER_WINDOW) {
      throw new Error(
        "You've started a lot of investigations recently. Please wait a few minutes and try again.",
      );
    }

    const question = args.question.trim();
    if (question.length < 3) throw new Error("Please enter a question.");
    if (question.length > 800) {
      throw new Error("That question is too long (max 800 characters).");
    }

    let windowEnd = args.windowEnd ? dayFloor(args.windowEnd) : dayFloor(dataset.dateMax);
    let windowStart = args.windowStart ? dayFloor(args.windowStart) : windowEnd - 27 * DAY;
    if (windowStart > windowEnd) {
      const swap = windowStart;
      windowStart = windowEnd;
      windowEnd = swap;
    }
    let comparisonEnd = args.comparisonEnd ? dayFloor(args.comparisonEnd) : windowStart - DAY;
    if (comparisonEnd >= windowStart) comparisonEnd = windowStart - DAY;
    let comparisonStart = args.comparisonStart
      ? dayFloor(args.comparisonStart)
      : comparisonEnd - 27 * DAY;
    if (comparisonStart > comparisonEnd) comparisonStart = comparisonEnd - 27 * DAY;

    const metric = dataset.metricColumn ?? "metric";
    const invId = await ctx.db.insert("investigations", {
      userId,
      datasetId: args.datasetId,
      question,
      scope: {
        metric,
        dim: args.dim ?? "",
        value: args.value ?? "",
        windowStart,
        windowEnd,
        comparisonStart,
        comparisonEnd,
      },
      status: "scoped",
      step: "Scoping the question",
      runLog: [],
      series: [],
      hypotheses: [],
      attribution: [],
      recommendations: [],
      limitations: [],
      whatWouldChange: [],
      saved: false,
      model: "Kausa analysis engine v1 (scoping)",
      dataVersion: `dataset:${dataset._id}`,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.runInvestigation.run, {
      investigationId: invId,
    });
    return invId;
  },
});

export const setSaved = mutation({
  args: { id: v.id("investigations"), saved: v.boolean(), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, saved, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { saved, name: name ?? d.name });
    return null;
  },
});

export const cancel = mutation({
  args: { id: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return null;
    if (d.status === "done" || d.status === "failed") return null;
    await ctx.db.patch(id, { status: "cancelled", step: "Cancelled" });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return null;
    await ctx.scheduler.runAfter(0, internal.investigations._purgeClaims, {
      investigationId: id,
    });
    await ctx.db.delete(id);
    return null;
  },
});

export const _purgeClaims = internalMutation({
  args: { investigationId: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, { investigationId }) => {
    const rows = await ctx.db
      .query("claims")
      .withIndex("by_investigation", (q) => q.eq("investigationId", investigationId))
      .take(CLAIM_PURGE_BATCH);
    for (const c of rows) await ctx.db.delete(c._id);
    if (rows.length === CLAIM_PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.investigations._purgeClaims, {
        investigationId,
      });
    }
    return null;
  },
});

export const _get = internalQuery({
  args: { id: v.id("investigations") },
  returns: v.union(
    v.object({
      _id: v.id("investigations"),
      userId: v.id("users"),
      datasetId: v.id("datasets"),
      question: v.string(),
      scope: scopeValidator,
      status: statusValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    const d = await ctx.db.get(id);
    if (!d) return null;
    return {
      _id: d._id,
      userId: d.userId,
      datasetId: d.datasetId,
      question: d.question,
      scope: d.scope,
      status: d.status,
    };
  },
});

export const _setStatus = internalMutation({
  args: {
    id: v.id("investigations"),
    status: statusValidator,
    step: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, step }) => {
    const d = await ctx.db.get(id);
    if (!d || d.status === "cancelled") return null;
    await ctx.db.patch(id, { status, step });
    return null;
  },
});

export const _appendLog = internalMutation({
  args: {
    id: v.id("investigations"),
    entry: runLogValidator,
  },
  returns: v.null(),
  handler: async (ctx, { id, entry }) => {
    const d = await ctx.db.get(id);
    if (!d || d.status === "cancelled") return null;
    const runLog = [...d.runLog, entry].slice(-60);
    await ctx.db.patch(id, { runLog });
    return null;
  },
});

export const _setResult = internalMutation({
  args: {
    id: v.id("investigations"),
    headline: headlineValidator,
    series: v.array(seriesPointValidator),
    hypotheses: v.array(hypothesisValidator),
    attribution: v.array(attributionValidator),
    recommendations: v.array(recommendationValidator),
    limitations: v.array(v.string()),
    whatWouldChange: v.array(v.string()),
    narration: v.string(),
    model: v.string(),
    dataVersion: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.id);
    if (!d || d.status === "cancelled") return null;
    await ctx.db.patch(args.id, {
      headline: args.headline,
      series: args.series,
      hypotheses: args.hypotheses,
      attribution: args.attribution,
      recommendations: args.recommendations,
      limitations: args.limitations,
      whatWouldChange: args.whatWouldChange,
      narration: args.narration,
      model: args.model,
      dataVersion: args.dataVersion,
      status: "done",
      step: "Verdict ready",
      finishedAt: Date.now(),
    });
    return null;
  },
});

export const _insertClaims = internalMutation({
  args: {
    investigationId: v.id("investigations"),
    userId: v.id("users"),
    claims: v.array(
      v.object({
        claimId: v.string(),
        label: v.string(),
        value: v.number(),
        unit: v.union(v.literal("USD"), v.literal("pct"), v.literal("count"), v.literal("index")),
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
        verifier: v.union(v.literal("passed"), v.literal("repaired"), v.literal("fallback")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { investigationId, userId, claims }) => {
    for (const c of claims) {
      await ctx.db.insert("claims", { investigationId, userId, ...c });
    }
    return null;
  },
});

export const _fail = internalMutation({
  args: { id: v.id("investigations"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, error }) => {
    const d = await ctx.db.get(id);
    if (!d || d.status === "cancelled") return null;
    await ctx.db.patch(id, { status: "failed", step: "Failed", error });
    return null;
  },
});

export const claimsFor = query({
  args: { investigationId: v.id("investigations") },
  returns: v.array(
    v.object({
      claimId: v.string(),
      label: v.string(),
      value: v.number(),
      unit: v.union(v.literal("USD"), v.literal("pct"), v.literal("count"), v.literal("index")),
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
      verifier: v.union(v.literal("passed"), v.literal("repaired"), v.literal("fallback")),
    }),
  ),
  handler: async (ctx, { investigationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const inv = await ctx.db.get(investigationId);
    if (!inv || inv.userId !== userId) return [];
    const rows = await ctx.db
      .query("claims")
      .withIndex("by_investigation", (q) => q.eq("investigationId", investigationId))
      .take(500);
    return rows.map((r) => ({
      claimId: r.claimId,
      label: r.label,
      value: r.value,
      unit: r.unit,
      interval: r.interval ?? null,
      kind: r.kind,
      query: r.query,
      rowSample: r.rowSample,
      calculation: r.calculation,
      model: r.model,
      dataVersion: r.dataVersion,
      codeVersion: r.codeVersion,
      verifier: r.verifier,
    }));
  },
});
