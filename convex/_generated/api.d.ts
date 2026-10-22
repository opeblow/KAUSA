/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as datasets from "../datasets.js";
import type * as http from "../http.js";
import type * as investigations from "../investigations.js";
import type * as lib_hmem from "../lib/hmem.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_parse from "../lib/parse.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_zetaris from "../lib/zetaris.js";
import type * as memories from "../memories.js";
import type * as parseDataset from "../parseDataset.js";
import type * as runInvestigation from "../runInvestigation.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  datasets: typeof datasets;
  http: typeof http;
  investigations: typeof investigations;
  "lib/hmem": typeof lib_hmem;
  "lib/llm": typeof lib_llm;
  "lib/parse": typeof lib_parse;
  "lib/stats": typeof lib_stats;
  "lib/zetaris": typeof lib_zetaris;
  memories: typeof memories;
  parseDataset: typeof parseDataset;
  runInvestigation: typeof runInvestigation;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
