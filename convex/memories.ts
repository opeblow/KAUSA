/**
 * H-MEM durable memory for Kausa (Meterless engine, Convex-native port).
 *
 * Flow:
 *   runInvestigation → memories._recall (context for the narrator)
 *                    → memories._noteRecalls (trust-ledger "read")
 *                    → memories.mine (LLM extraction → _insertMany "create")
 *   UI               → memories.list / memories.ledger
 *                    → memories.remember (user-told fact) / feedback / forget
 *
 * A memory record without a `source` is impossible by construction (source is a
 * required column), matching the H-MEM contract.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  memoryLayerValidator,
  memoryTypeValidator,
} from "./schema";
import {
  buildMiningPrompt,
  classifyDomain,
  clamp01,
  cosine,
  embed,
  extractEntities,
  FEEDBACK_DELTAS,
  formatReinjection,
  MINING_EVENT_TYPES,
  MINING_SYSTEM,
  namespaceFor,
  parseMemoryList,
  recall,
  type FeedbackKind,
  type MemoryRow,
  type MiningEventType,
} from "./lib/hmem";
import { chatComplete } from "./lib/llm";

const CORRECTION = /\b(actually|instead|no longer|not anymore|changed to|correction|rename|prefer|call(?:ed)? it)\b/i;
const MAX_MEMORIES = 1000;

function toRow(d: Doc<"memories">): MemoryRow {
  return {
    _id: String(d._id),
    content: d.content,
    type: d.type,
    layer: d.layer,
    tags: d.tags,
    domain: d.domain,
    source: d.source,
    confidence: d.confidence,
    accessCount: d.accessCount,
    lastAccessed: d.lastAccessed,
    timestamp: d.timestamp,
    embedding: d.embedding,
    entities: d.entities,
    supersededBy: d.supersededBy ? String(d.supersededBy) : undefined,
  };
}

/** Retrieve the memories most relevant to a query. Read-only. */
export const _recall = internalQuery({
  args: {
    userId: v.id("users"),
    query: v.string(),
    topN: v.optional(v.number()),
  },
  returns: v.object({
    context: v.string(),
    strategy: v.string(),
    domain: v.string(),
    memories: v.array(
      v.object({
        _id: v.id("memories"),
        content: v.string(),
        type: memoryTypeValidator,
        layer: memoryLayerValidator,
        domain: v.string(),
        relevance: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { userId, query, topN }) => {
    const rows = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_MEMORIES);
    const res = recall(rows.map(toRow), query, Date.now(), { topN });
    return {
      context: formatReinjection(res.memories),
      strategy: res.strategy,
      domain: res.domain,
      memories: res.memories.map((r) => ({
        _id: r.memory._id as unknown as Id<"memories">,
        content: r.memory.content,
        type: r.memory.type,
        layer: r.memory.layer,
        domain: r.memory.domain,
        relevance: Number(r.relevance.toFixed(4)),
      })),
    };
  },
});

/** Record a "read" in the trust ledger and bump recency/access counts. */
export const _noteRecalls = internalMutation({
  args: {
    userId: v.id("users"),
    query: v.string(),
    ids: v.array(v.id("memories")),
  },
  returns: v.null(),
  handler: async (ctx, { userId, query, ids }) => {
    const now = Date.now();
    for (const id of ids) {
      const m = await ctx.db.get(id);
      if (!m || m.userId !== userId) continue;
      await ctx.db.patch(id, { lastAccessed: now, accessCount: m.accessCount + 1 });
      await ctx.db.insert("memoryLedger", {
        userId,
        memoryId: id,
        action: "read",
        actor: `user:${userId}`,
        detail: query.slice(0, 200),
        at: now,
      });
    }
    return null;
  },
});

/** Extract durable memories from an event, using the sponsor LLM chain. */
export const mine = internalAction({
  args: {
    userId: v.id("users"),
    event: v.string(),
    text: v.string(),
    origin: v.string(),
    label: v.string(),
    fallback: v.optional(v.string()),
    datasetId: v.optional(v.id("datasets")),
    investigationId: v.optional(v.id("investigations")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const event: MiningEventType = (MINING_EVENT_TYPES as readonly string[]).includes(args.event)
      ? (args.event as MiningEventType)
      : "plan_completion";

    let items: string[] = [];
    const res = await chatComplete(MINING_SYSTEM, buildMiningPrompt(event, args.text), 512);
    if (res) items = parseMemoryList(res.text);
    const usedLlm = items.length > 0;

    // Model-free fallback: never drop the input. Capture a short-term summary.
    if (!usedLlm && args.fallback) items = [args.fallback.slice(0, 240)];
    if (items.length === 0) return 0;

    await ctx.runMutation(internal.memories._insertMany, {
      userId: args.userId,
      items,
      origin: usedLlm ? args.origin : "plan_completion",
      label: usedLlm ? args.label : `${args.label} (summary)`,
      layer: usedLlm ? "working" : "short_term",
      datasetId: args.datasetId,
      investigationId: args.investigationId,
    });
    return items.length;
  },
});

/** Insert memories with enrichment, dedupe, supersede detection, and ledger. */
export const _insertMany = internalMutation({
  args: {
    userId: v.id("users"),
    items: v.array(v.string()),
    origin: v.string(),
    label: v.string(),
    layer: memoryLayerValidator,
    type: v.optional(memoryTypeValidator),
    datasetId: v.optional(v.id("datasets")),
    investigationId: v.optional(v.id("investigations")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_MEMORIES);

    let inserted = 0;
    for (const content of args.items) {
      const emb = embed(content);
      const dupe = existing.find(
        (m) => m.content.toLowerCase() === content.toLowerCase() || cosine(m.embedding, emb) > 0.94,
      );
      if (dupe) continue;

      const type = args.type ?? "factual";
      const domain = classifyDomain(content, [], type);

      // Supersede: a correction overrides the closest prior memory (never deleted,
      // only penalized in ranking — AGENTS.md section 10).
      let supersedes: Id<"memories"> | undefined;
      let supersededTarget: Doc<"memories"> | undefined;
      if (CORRECTION.test(content)) {
        for (const m of existing) {
          if (cosine(m.embedding, emb) > 0.8) {
            supersedes = m._id;
            supersededTarget = m;
            break;
          }
        }
      }

      const id = await ctx.db.insert("memories", {
        userId: args.userId,
        content,
        type,
        layer: args.layer,
        tags: [`origin:${args.origin}`],
        domain,
        namespace: namespaceFor(domain, type),
        source: args.label,
        confidence: args.layer === "long_term" ? 0.9 : 0.7,
        accessCount: 0,
        lastAccessed: now,
        timestamp: now,
        embedding: emb,
        entities: extractEntities(content),
        relatedTo: [],
        supersedes,
        provenance: {
          origin: args.origin,
          learnedAt: now,
          label: args.label,
          datasetId: args.datasetId,
          investigationId: args.investigationId,
        },
      });

      if (supersedes && supersededTarget) {
        await ctx.db.patch(supersedes, { supersededBy: id });
      }

      await ctx.db.insert("memoryLedger", {
        userId: args.userId,
        memoryId: id,
        action: "create",
        actor: `system:${args.origin}`,
        detail: args.label,
        at: now,
      });
      inserted++;
    }
    return inserted;
  },
});

/** User feedback moves future ranking via the confidence multiplier. */
export const feedback = mutation({
  args: {
    id: v.id("memories"),
    kind: v.union(v.literal("helpful"), v.literal("not_helpful"), v.literal("wrong")),
  },
  returns: v.number(),
  handler: async (ctx, { id, kind }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const m = await ctx.db.get(id);
    if (!m || m.userId !== userId) throw new Error("Memory not found");

    const delta = FEEDBACK_DELTAS[kind as FeedbackKind];
    const next = clamp01(m.confidence + delta);
    const patch: { confidence: number; accessCount?: number; tags?: string[] } = { confidence: next };
    if (kind === "helpful") patch.accessCount = m.accessCount + 1;
    if (kind === "wrong" && !m.tags.includes("review")) patch.tags = [...m.tags, "review"];
    await ctx.db.patch(id, patch);

    await ctx.db.insert("memoryLedger", {
      userId,
      memoryId: id,
      action: "feedback",
      actor: `user:${userId}`,
      signal: kind,
      previousConfidence: m.confidence,
      newConfidence: next,
      at: Date.now(),
    });
    return next;
  },
});

/** The user explicitly tells Kausa something worth remembering. */
export const remember = mutation({
  args: { content: v.string(), type: v.optional(memoryTypeValidator) },
  returns: v.id("memories"),
  handler: async (ctx, { content, type }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const text = content.trim();
    if (text.length < 3) throw new Error("That memory is too short.");
    if (text.length > 500) throw new Error("That memory is too long (max 500 characters).");

    const now = Date.now();
    const t = type ?? "preference";
    const domain = classifyDomain(text, [], t);
    const id = await ctx.db.insert("memories", {
      userId,
      content: text,
      type: t,
      layer: "long_term",
      tags: ["origin:user_explicit"],
      domain,
      namespace: namespaceFor(domain, t),
      source: "user_explicit",
      confidence: 0.9,
      accessCount: 0,
      lastAccessed: now,
      timestamp: now,
      embedding: embed(text),
      entities: extractEntities(text),
      relatedTo: [],
      provenance: {
        origin: "user_explicit",
        learnedAt: now,
        label: "Told to Kausa by the user",
      },
    });
    await ctx.db.insert("memoryLedger", {
      userId,
      memoryId: id,
      action: "create",
      actor: `user:${userId}`,
      detail: "manual",
      at: now,
    });
    return id;
  },
});

export const forget = mutation({
  args: { id: v.id("memories") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const m = await ctx.db.get(id);
    if (!m || m.userId !== userId) return null;
    await ctx.db.insert("memoryLedger", {
      userId,
      memoryId: id,
      action: "delete",
      actor: `user:${userId}`,
      at: Date.now(),
    });
    await ctx.db.delete(id);
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("memories"),
      content: v.string(),
      type: memoryTypeValidator,
      layer: memoryLayerValidator,
      domain: v.string(),
      namespace: v.string(),
      source: v.string(),
      confidence: v.number(),
      accessCount: v.number(),
      tags: v.array(v.string()),
      entities: v.array(v.string()),
      createdAt: v.number(),
      lastAccessed: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(500);
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows.map((m) => ({
      _id: m._id,
      content: m.content,
      type: m.type,
      layer: m.layer,
      domain: m.domain,
      namespace: m.namespace,
      source: m.source,
      confidence: m.confidence,
      accessCount: m.accessCount,
      tags: m.tags,
      entities: m.entities,
      createdAt: m.timestamp,
      lastAccessed: m.lastAccessed,
    }));
  },
});

export const ledger = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("memoryLedger"),
      action: v.string(),
      signal: v.union(v.string(), v.null()),
      detail: v.union(v.string(), v.null()),
      memoryId: v.union(v.id("memories"), v.null()),
      at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("memoryLedger")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      _id: r._id,
      action: r.action,
      signal: r.signal ?? null,
      detail: r.detail ?? null,
      memoryId: r.memoryId ?? null,
      at: r.at,
    }));
  },
});
