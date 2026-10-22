"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { aggregate, detectColumns, MAX_BYTES, MAX_ROWS, type RawTable } from "./lib/parse";

// Excel date cells arrive as Date objects (cellDates); store them as ISO days
// so the date detector recognises them.
function cell(c: unknown): string | number {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  if (typeof c === "number" || typeof c === "string") return c;
  if (c == null) return "";
  return String(c);
}

function toTable(matrix: unknown[][]): RawTable {
  if (matrix.length === 0) return { header: [], rows: [] };
  // Column names become database keys (driver records), which must be
  // non-empty printable ASCII and must not start with "$" or "_".
  const seen = new Set<string>();
  const header = (matrix[0] ?? []).map((c, i) => {
    let name = String(cell(c))
      .normalize("NFKD")
      .replace(/[^ -~]/g, "")
      .replace(/^[$_\s]+/, "")
      .trim();
    if (!name) name = `column_${i + 1}`;
    let unique = name;
    for (let n = 2; seen.has(unique); n++) unique = `${name}_${n}`;
    seen.add(unique);
    return unique;
  });
  const rows = matrix
    .slice(1, MAX_ROWS + 1)
    .map((r) => header.map((_, i) => cell(r[i])));
  return { header, rows };
}

export const parse = internalAction({
  args: { datasetId: v.id("datasets") },
  returns: v.null(),
  handler: async (ctx, { datasetId }) => {
    const dataset = await ctx.runQuery(internal.datasets._get, { datasetId });
    if (!dataset) return null;

    try {
      const blob = await ctx.storage.get(dataset.storageId);
      if (!blob) throw new Error("Uploaded file not found in storage");
      if (blob.size > MAX_BYTES) {
        const mb = Math.round(MAX_BYTES / (1024 * 1024));
        throw new Error(`That file is too large. The limit is ${mb} MB.`);
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const name = dataset.fileName.toLowerCase();

      let matrix: unknown[][];
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
          defval: "",
        });
      } else {
        const text = buf.toString("utf8");
        // Strip a UTF-8 BOM so the first header name matches (Excel CSV exports add one).
        const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true });
        matrix = parsed.data as unknown[][];
      }

      const table = toTable(matrix);
      if (table.header.length === 0 || table.rows.length === 0) {
        throw new Error("No tabular data found in the file");
      }

      const detected = detectColumns(table);
      if (!detected.dateColumn) {
        throw new Error(
          "Could not find a date column. Include a column of dates (e.g. 2024-09-01) and try again.",
        );
      }
      if (!detected.metricColumn) {
        throw new Error(
          "Could not find a numeric metric column to analyse (e.g. sales, units, revenue).",
        );
      }

      const result = aggregate(
        table,
        detected.dateColumn,
        detected.metricColumn,
        detected.numericColumns,
        detected.categoricalColumns,
      );

      const sampleRows = [
        table.header,
        ...table.rows.slice(0, 12).map((r) => r.map((c) => (typeof c === "number" ? c : String(c)))),
      ];

      // Clear any points from an earlier (failed or retried) parse, then write the
      // new points, and only then mark the dataset ready.
      while (!(await ctx.runMutation(internal.datasets._clearPoints, { datasetId }))) {
        // keep deleting in batches
      }
      const BATCH = 400;
      for (let i = 0; i < result.points.length; i += BATCH) {
        await ctx.runMutation(internal.datasets._insertPoints, {
          datasetId,
          points: result.points.slice(i, i + BATCH),
        });
      }

      await ctx.runMutation(internal.datasets._persistParse, {
        datasetId,
        rowCount: table.rows.length,
        columns: detected.columns,
        dateColumn: detected.dateColumn,
        metricColumn: detected.metricColumn,
        numericColumns: detected.numericColumns,
        categoricalColumns: detected.categoricalColumns,
        dateMin: result.dateMin,
        dateMax: result.dateMax,
        sampleRows,
      });

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse the file";
      await ctx.runMutation(internal.datasets._setError, { datasetId, error: message });
      return null;
    }
  },
});
