#!/usr/bin/env bun
/**
 * Import a Postman Collection v2.1.0 JSON file into mouserat.
 *
 * Usage:
 *   bun run import-postman path/to/collection.json
 *
 * See docs/internal/postman-import.md for full mapping details.
 */

import { join, resolve } from "path";
import { homedir } from "os";
import { v4 as uuidv4 } from "uuid";
import { mkdir } from "fs/promises";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCHEMAS_DIR = resolve(import.meta.dir, "../schemas");
const BASE_DIR = join(homedir(), ".mouserat");
const COLLECTIONS_DIR = join(BASE_DIR, "collections");

// ---------------------------------------------------------------------------
// Postman types (v2.1.0 — only the fields we care about)
// ---------------------------------------------------------------------------

export type PostmanUrl =
  | string
  | {
      raw?: string;
      protocol?: string;
      host?: string | string[];
      port?: string;
      path?: string | Array<string | { type?: string; value?: string }>;
      query?: Array<{ key?: string | null; value?: string | null; disabled?: boolean }>;
    };

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: Array<{ key: string; value?: string; disabled?: boolean }>;
  disabled?: boolean;
}

export interface PostmanRequest {
  url?: PostmanUrl;
  method?: string;
  header?: PostmanHeader[] | string;
  body?: PostmanBody | null;
}

export interface PostmanItem {
  id?: string;
  name?: string;
  request?: PostmanRequest | string;
  // item-group fields
  item?: PostmanItems;
}

export type PostmanItems = PostmanItem[];

export interface PostmanCollection {
  info: { name: string; _postman_id?: string; schema?: string };
  item: PostmanItems;
}

// ---------------------------------------------------------------------------
// Supported methods
// ---------------------------------------------------------------------------

export const SUPPORTED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

// ---------------------------------------------------------------------------
// Warning type
// ---------------------------------------------------------------------------

export interface Warning {
  collection: string;
  request: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Variable handling
// ---------------------------------------------------------------------------

/** Strip all {{...}} tokens from a string, keeping surrounding text. */
export function stripVars(s: string): string {
  return s.replace(/\{\{[^}]*\}\}/g, "");
}

/** Returns true if the string contains any {{...}} variables. */
export function hasVars(s: string): boolean {
  return /\{\{[^}]*\}\}/.test(s);
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedUrl {
  rootUrl?: string;
  relativeUrl?: string;
}

export function parsePostmanUrl(url: PostmanUrl): ParsedUrl {
  if (typeof url === "string") {
    return parseRawUrl(url);
  }

  const protocol = url.protocol ? url.protocol.replace(/:$/, "") : undefined;

  let host: string | undefined;
  if (Array.isArray(url.host)) {
    host = url.host.join(".");
  } else if (typeof url.host === "string") {
    host = url.host;
  }

  if (!protocol && !host) {
    return url.raw ? parseRawUrl(url.raw) : {};
  }

  const strippedHost = host ? stripVars(host) : undefined;

  let rootUrl: string | undefined;
  if (strippedHost) {
    if (protocol) {
      rootUrl = `${protocol}://${strippedHost}${url.port ? `:${url.port}` : ""}`;
    } else {
      rootUrl = strippedHost;
    }
  }

  let pathStr = "";
  if (Array.isArray(url.path)) {
    const segments = url.path.map((seg) => {
      if (typeof seg === "string") return seg;
      return seg.value ?? "";
    });
    pathStr = "/" + segments.join("/");
  } else if (typeof url.path === "string") {
    pathStr = url.path.startsWith("/") ? url.path : "/" + url.path;
  }
  pathStr = stripVars(pathStr);

  let queryStr = "";
  if (url.query && url.query.length > 0) {
    const pairs = url.query
      .filter((q) => !q.disabled && q.key != null)
      .map((q) => {
        const k = stripVars(q.key ?? "");
        const v = q.value != null ? stripVars(q.value) : "";
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      });
    if (pairs.length > 0) queryStr = "?" + pairs.join("&");
  }

  const relativeUrl = pathStr + queryStr || undefined;
  return { rootUrl: rootUrl || undefined, relativeUrl: relativeUrl || undefined };
}

export function parseRawUrl(raw: string): ParsedUrl {
  try {
    const stripped = stripVars(raw);
    const u = new URL(stripped);
    const rootUrl = u.origin !== "null" ? u.origin : undefined;
    const relativeUrl = (u.pathname !== "/" ? u.pathname : "") + u.search || undefined;
    return { rootUrl: rootUrl || undefined, relativeUrl: relativeUrl || undefined };
  } catch {
    return { relativeUrl: stripVars(raw) || undefined };
  }
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

export function parseHeaders(
  header: PostmanHeader[] | string | undefined,
  collectionName: string,
  requestName: string,
  warnings: Warning[]
): Record<string, string> | undefined {
  if (!header || typeof header === "string") return undefined;

  const result: Record<string, string> = {};
  for (const h of header) {
    if (h.disabled) continue;
    result[h.key] = h.value;
    if (hasVars(h.value)) {
      warnings.push({ collection: collectionName, request: requestName, message: `Variable in header "${h.key}" copied verbatim: ${h.value}` });
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

export function parseBody(
  body: PostmanBody | null | undefined,
  collectionName: string,
  requestName: string,
  warnings: Warning[]
): unknown {
  if (!body || body.disabled) return undefined;

  switch (body.mode) {
    case "raw": {
      if (!body.raw) return undefined;
      try {
        return JSON.parse(body.raw);
      } catch {
        return body.raw;
      }
    }
    case "urlencoded": {
      if (!body.urlencoded) return undefined;
      const result: Record<string, string> = {};
      for (const entry of body.urlencoded) {
        if (entry.disabled) continue;
        result[entry.key] = entry.value ?? "";
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
    case "formdata":
    case "file":
    case "graphql": {
      warnings.push({ collection: collectionName, request: requestName, message: `Body mode "${body.mode}" is not supported — body skipped` });
      return undefined;
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Flatten items — recursively collect all leaf requests from an item tree
// ---------------------------------------------------------------------------

export function flattenRequests(items: PostmanItems): PostmanItem[] {
  const result: PostmanItem[] = [];
  for (const item of items) {
    if (item.item) {
      result.push(...flattenRequests(item.item));
    } else {
      result.push(item);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Build collection specs from a parsed Postman collection
// ---------------------------------------------------------------------------

export interface CollectionSpec {
  name: string;
  items: PostmanItem[];
}

export function buildCollectionSpecs(collection: PostmanCollection): CollectionSpec[] {
  const rootRequests: PostmanItem[] = [];
  const folders: PostmanItem[] = [];

  for (const item of collection.item) {
    if (item.item) {
      folders.push(item);
    } else {
      rootRequests.push(item);
    }
  }

  const specs: CollectionSpec[] = [];

  if (rootRequests.length > 0) {
    specs.push({ name: collection.info.name, items: rootRequests });
  }

  for (const folder of folders) {
    specs.push({
      name: folder.name ?? collection.info.name,
      items: flattenRequests(folder.item ?? []),
    });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Write a collection + its requests to ~/.mouserat/
// ---------------------------------------------------------------------------

async function writeCollection(
  spec: CollectionSpec,
  warnings: Warning[]
): Promise<{ requests: number; skipped: number }> {
  const collectionId = uuidv4();
  const collectionDir = join(COLLECTIONS_DIR, collectionId);
  const requestsDir = join(collectionDir, "requests");
  await mkdir(requestsDir, { recursive: true });

  const collectionJson = {
    $schema: join(SCHEMAS_DIR, "collection.schema.json"),
    id: collectionId,
    name: spec.name,
  };
  await Bun.write(join(collectionDir, "collection.json"), JSON.stringify(collectionJson, null, 2));

  let imported = 0;
  let skipped = 0;

  for (const item of spec.items) {
    const requestName = item.name ?? "Unnamed";

    let rawRequest: PostmanRequest;
    if (typeof item.request === "string") {
      rawRequest = { url: item.request, method: "GET" };
    } else if (item.request) {
      rawRequest = item.request;
    } else {
      continue;
    }

    const method = (rawRequest.method ?? "GET").toUpperCase();
    if (!SUPPORTED_METHODS.has(method)) {
      warnings.push({ collection: spec.name, request: requestName, message: `Skipped: unsupported method ${method}` });
      skipped++;
      continue;
    }

    const { rootUrl, relativeUrl } = rawRequest.url
      ? parsePostmanUrl(rawRequest.url)
      : {};

    const headers = parseHeaders(rawRequest.header, spec.name, requestName, warnings);
    const body = parseBody(rawRequest.body, spec.name, requestName, warnings);

    const requestId = uuidv4();
    const requestJson: Record<string, unknown> = {
      $schema: join(SCHEMAS_DIR, "request.schema.json"),
      id: requestId,
      name: requestName,
      method,
    };
    if (rootUrl) requestJson.rootUrl = rootUrl;
    if (relativeUrl) requestJson.relativeUrl = relativeUrl;
    if (headers) requestJson.headers = headers;
    if (body !== undefined) requestJson.body = body;

    await Bun.write(
      join(requestsDir, `${requestId}.json`),
      JSON.stringify(requestJson, null, 2)
    );
    imported++;
  }

  return { requests: imported, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: bun run import-postman <path/to/collection.json>");
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);
  let raw: string;
  try {
    raw = await Bun.file(absolutePath).text();
  } catch {
    console.error(`Error: could not read file: ${absolutePath}`);
    process.exit(1);
  }

  let collection: PostmanCollection;
  try {
    collection = JSON.parse(raw) as PostmanCollection;
  } catch {
    console.error("Error: file is not valid JSON");
    process.exit(1);
  }

  if (!collection.info?.name || !Array.isArray(collection.item)) {
    console.error("Error: file does not appear to be a Postman Collection v2.x (missing info.name or item[])");
    process.exit(1);
  }

  await mkdir(COLLECTIONS_DIR, { recursive: true });

  const specs = buildCollectionSpecs(collection);

  if (specs.length === 0) {
    console.log("Nothing to import — collection is empty.");
    process.exit(0);
  }

  const warnings: Warning[] = [];
  let totalCollections = 0;
  let totalRequests = 0;
  let totalSkipped = 0;

  for (const spec of specs) {
    const { requests, skipped } = await writeCollection(spec, warnings);
    totalCollections++;
    totalRequests += requests;
    totalSkipped += skipped;
  }

  console.log(
    `\nImported ${totalCollections} collection${totalCollections !== 1 ? "s" : ""}, ` +
    `${totalRequests} request${totalRequests !== 1 ? "s" : ""}` +
    (totalSkipped > 0 ? `, ${totalSkipped} skipped` : "") +
    "."
  );

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of warnings) {
      console.log(`  - [${w.collection} / ${w.request}] ${w.message}`);
    }
  }
}

if (import.meta.main) {
  main();
}
