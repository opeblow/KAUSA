import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { columnValidator } from "./schema";

const pointValidator = v.object({
  dim: v.string(),
  value: v.string(),
  date: v.number(),
  metric: v.number(),
  drivers: v.record(v.string(), v.number()),
});

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

const UPLOAD_WINDOW_MS = 5 * 60_000;
const MAX_UPLOADS_PER_WINDOW = 15;
const PURGE_BATCH = 500;

async function enforceUploadRate(ctx: MutationCtx, userId: Id<"users">) {
  const since = Date.now() - UPLOAD_WINDOW_MS;
  const recent = await ctx.db
    .query("datasets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_UPLOADS_PER_WINDOW);
  const count = recent.filter((d) => d._creationTime >= since).length;
  if (count >= MAX_UPLOADS_PER_WINDOW) {
    throw new Error(
      "Too many uploads in a short time. Please wait a few minutes and try again.",
    );
  }
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("datasets"),
      name: v.string(),
      fileName: v.string(),
      status: v.union(v.literal("parsing"), v.literal("ready"), v.literal("error")),
      rowCount: v.number(),
      dateColumn: v.union(v.string(), v.null()),
      metricColumn: v.union(v.string(), v.null()),
      dateMin: v.union(v.number(), v.null()),
      dateMax: v.union(v.number(), v.null()),
      numericColumns: v.array(v.string()),
      categoricalColumns: v.array(v.string()),
      error: v.union(v.string(), v.null()),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("datasets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return docs.map((d) => ({
      _id: d._id,
      name: d.name,
      fileName: d.fileName,
      status: d.status,
      rowCount: d.rowCount,
      dateColumn: d.dateColumn ?? null,
      metricColumn: d.metricColumn ?? null,
      dateMin: d.dateMin ?? null,
      dateMax: d.dateMax ?? null,
      numericColumns: d.numericColumns,
      categoricalColumns: d.categoricalColumns,
      error: d.error ?? null,
      _creationTime: d._creationTime,
    }));
  },
});

export const get = query({
  args: { id: v.id("datasets") },
  returns: v.union(
    v.object({
      _id: v.id("datasets"),
      name: v.string(),
      fileName: v.string(),
      status: v.union(v.literal("parsing"), v.literal("ready"), v.literal("error")),
      rowCount: v.number(),
      columns: v.array(columnValidator),
      dateColumn: v.union(v.string(), v.null()),
      metricColumn: v.union(v.string(), v.null()),
      numericColumns: v.array(v.string()),
      categoricalColumns: v.array(v.string()),
      dateMin: v.union(v.number(), v.null()),
      dateMax: v.union(v.number(), v.null()),
      sampleRows: v.array(v.array(v.union(v.string(), v.number()))),
      error: v.union(v.string(), v.null()),
      fileUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return null;
    const fileUrl = await ctx.storage.getUrl(d.storageId);
    return {
      _id: d._id,
      name: d.name,
      fileName: d.fileName,
      status: d.status,
      rowCount: d.rowCount,
      columns: d.columns,
      dateColumn: d.dateColumn ?? null,
      metricColumn: d.metricColumn ?? null,
      numericColumns: d.numericColumns,
      categoricalColumns: d.categoricalColumns,
      dateMin: d.dateMin ?? null,
      dateMax: d.dateMax ?? null,
      sampleRows: d.sampleRows,
      error: d.error ?? null,
      fileUrl,
    };
  },
});

export const dimensions = query({
  args: { id: v.id("datasets") },
  returns: v.array(v.object({ dim: v.string(), values: v.array(v.string()) })),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return [];
    const out: { dim: string; values: string[] }[] = [];
    for (const dim of d.categoricalColumns) {
      const rows = await ctx.db
        .query("datasetPoints")
        .withIndex("by_dataset_slice_date", (q) => q.eq("datasetId", id).eq("dim", dim))
        .take(2000);
      const values = Array.from(new Set(rows.map((r) => r.value))).sort();
      if (values.length > 0) out.push({ dim, values });
    }
    return out;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Bind an uploaded blob to the caller. The client calls this right after it
 * POSTs the file to the upload URL and before creating the dataset. `create`
 * only accepts a storage id that has been claimed by the same user.
 */
export const claimUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("Upload not found");
    const existing = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (existing) {
      if (existing.userId !== userId) throw new Error("That upload is already in use.");
      return null;
    }
    await ctx.db.insert("uploads", { userId, storageId });
    return null;
  },
});

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    name: v.string(),
  },
  returns: v.id("datasets"),
  handler: async (ctx, { storageId, fileName, name }) => {
    const userId = await requireUserId(ctx);
    await enforceUploadRate(ctx, userId);
    if (fileName.length > 300) throw new Error("That file name is too long.");

    // The blob must have been uploaded by this same user.
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (!upload || upload.userId !== userId) {
      throw new Error("Upload not found for this account. Please upload the file again.");
    }

    const cleanName = (name.trim() || fileName).slice(0, 120);
    const datasetId = await ctx.db.insert("datasets", {
      userId,
      name: cleanName,
      fileName,
      storageId,
      status: "parsing",
      rowCount: 0,
      columns: [],
      numericColumns: [],
      categoricalColumns: [],
      sampleRows: [],
    });
    await ctx.db.delete(upload._id);
    await ctx.scheduler.runAfter(0, internal.parseDataset.parse, { datasetId });
    return datasetId;
  },
});

export const retryParse = mutation({
  args: { id: v.id("datasets") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) throw new Error("Not found");
    if (d.status === "parsing") return null;
    await ctx.db.patch(id, { status: "parsing", error: undefined });
    await ctx.scheduler.runAfter(0, internal.parseDataset.parse, { datasetId: id });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("datasets") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const d = await ctx.db.get(id);
    if (!d || d.userId !== userId) return null;
    await ctx.scheduler.runAfter(0, internal.datasets._purgeDataset, { datasetId: id });
    await ctx.storage.delete(d.storageId);
    await ctx.db.delete(id);
    return null;
  },
});

export const _purgeDataset = internalMutation({
  args: { datasetId: v.id("datasets") },
  returns: v.null(),
  handler: async (ctx, { datasetId }) => {
    const points = await ctx.db
      .query("datasetPoints")
      .withIndex("by_dataset_date", (q) => q.eq("datasetId", datasetId))
      .take(PURGE_BATCH);
    for (const p of points) await ctx.db.delete(p._id);
    if (points.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.datasets._purgeDataset, { datasetId });
    }
    return null;
  },
});

export const _get = internalQuery({
  args: { datasetId: v.id("datasets") },
  returns: v.union(
    v.object({
      _id: v.id("datasets"),
      userId: v.id("users"),
      storageId: v.id("_storage"),
      fileName: v.string(),
      dateColumn: v.union(v.string(), v.null()),
      metricColumn: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { datasetId }) => {
    const d = await ctx.db.get(datasetId);
    if (!d) return null;
    return {
      _id: d._id,
      userId: d.userId,
      storageId: d.storageId,
      fileName: d.fileName,
      dateColumn: d.dateColumn ?? null,
      metricColumn: d.metricColumn ?? null,
    };
  },
});

export const _getColumns = internalQuery({
  args: { datasetId: v.id("datasets") },
  returns: v.union(
    v.object({
      numericColumns: v.array(v.string()),
      categoricalColumns: v.array(v.string()),
      metricColumn: v.union(v.string(), v.null()),
      sampleColumns: v.array(v.string()),
      sampleRows: v.array(v.array(v.union(v.string(), v.number()))),
    }),
    v.null(),
  ),
  handler: async (ctx, { datasetId }) => {
    const d = await ctx.db.get(datasetId);
    if (!d) return null;
    const header = d.sampleRows[0]?.map((c) => String(c)) ?? [];
    const rows = d.sampleRows.slice(1, 7);
    return {
      numericColumns: d.numericColumns,
      categoricalColumns: d.categoricalColumns,
      metricColumn: d.metricColumn ?? null,
      sampleColumns: header,
      sampleRows: rows,
    };
  },
});

export const _slicePoints = internalQuery({
  args: {
    datasetId: v.id("datasets"),
    dim: v.string(),
    value: v.string(),
    start: v.number(),
    end: v.number(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    page: v.array(pointValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { datasetId, dim, value, start, end, cursor, numItems }) => {
    const res = await ctx.db
      .query("datasetPoints")
      .withIndex("by_dataset_slice_date", (q) =>
        q
          .eq("datasetId", datasetId)
          .eq("dim", dim)
          .eq("value", value)
          .gte("date", start)
          .lte("date", end),
      )
      .paginate({ numItems, cursor: cursor ?? null });
    return {
      page: res.page.map((p) => ({
        dim: p.dim,
        value: p.value,
        date: p.date,
        metric: p.metric,
        drivers: p.drivers,
      })),
      isDone: res.isDone,
      continueCursor: res.continueCursor,
    };
  },
});

export const _persistParse = internalMutation({
  args: {
    datasetId: v.id("datasets"),
    rowCount: v.number(),
    columns: v.array(columnValidator),
    dateColumn: v.union(v.string(), v.null()),
    metricColumn: v.union(v.string(), v.null()),
    numericColumns: v.array(v.string()),
    categoricalColumns: v.array(v.string()),
    dateMin: v.union(v.number(), v.null()),
    dateMax: v.union(v.number(), v.null()),
    sampleRows: v.array(v.array(v.union(v.string(), v.number()))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.datasetId))) return null;
    await ctx.db.patch(args.datasetId, {
      status: "ready",
      rowCount: args.rowCount,
      columns: args.columns,
      dateColumn: args.dateColumn ?? undefined,
      metricColumn: args.metricColumn ?? undefined,
      numericColumns: args.numericColumns,
      categoricalColumns: args.categoricalColumns,
      dateMin: args.dateMin ?? undefined,
      dateMax: args.dateMax ?? undefined,
      sampleRows: args.sampleRows,
      error: undefined,
    });
    return null;
  },
});

/** Delete a batch of a dataset's points; returns true when none remain. */
export const _clearPoints = internalMutation({
  args: { datasetId: v.id("datasets") },
  returns: v.boolean(),
  handler: async (ctx, { datasetId }) => {
    const points = await ctx.db
      .query("datasetPoints")
      .withIndex("by_dataset_date", (q) => q.eq("datasetId", datasetId))
      .take(PURGE_BATCH);
    for (const p of points) await ctx.db.delete(p._id);
    return points.length < PURGE_BATCH;
  },
});

export const _insertPoints = internalMutation({
  args: {
    datasetId: v.id("datasets"),
    points: v.array(pointValidator),
  },
  returns: v.null(),
  handler: async (ctx, { datasetId, points }) => {
    if (!(await ctx.db.get(datasetId))) return null;
    for (const p of points) {
      await ctx.db.insert("datasetPoints", {
        datasetId,
        dim: p.dim,
        value: p.value,
        date: p.date,
        metric: p.metric,
        drivers: p.drivers,
      });
    }
    return null;
  },
});

export const _setError = internalMutation({
  args: { datasetId: v.id("datasets"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { datasetId, error }) => {
    if (!(await ctx.db.get(datasetId))) return null;
    await ctx.db.patch(datasetId, { status: "error", error });
    return null;
  },
});
