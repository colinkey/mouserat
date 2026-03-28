import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import { tmpdir } from "os";
import { rm } from "fs/promises";

// Set base dir before any storage functions are called (they read the env var lazily).
const tmpBase = join(tmpdir(), `mouserat-test-${Date.now()}`);
process.env.MOUSERAT_BASE_DIR = tmpBase;

import {
  init,
  getPreferences,
  savePreferences,
  appendLog,
  listLogs,
  createCollection,
  listCollections,
  deleteCollection,
  getCollectionDir,
  getCollectionFilePath,
  createRequest,
  listRequests,
  deleteRequest,
  saveRequestJqFilter,
  getRequestFilePath,
  createEnvironment,
  listEnvironments,
  deleteEnvironment,
  getEnvironmentFilePath,
  getLastExecution,
  saveLastExecution,
} from "./index";
import { HttpMethods } from "../types";

afterAll(async () => {
  delete process.env.MOUSERAT_BASE_DIR;
  await rm(tmpBase, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

describe("init", () => {
  test("creates the required directories", async () => {
    await init();
    const fs = await import("fs/promises");
    for (const sub of ["collections", "environments", "logs", "last-execution"]) {
      const stat = await fs.stat(join(tmpBase, sub));
      expect(stat.isDirectory()).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// preferences
// ---------------------------------------------------------------------------

describe("getPreferences / savePreferences", () => {
  test("returns empty object when no file exists", async () => {
    expect(await getPreferences()).toEqual({});
  });

  test("round-trips preferences", async () => {
    await savePreferences({ activeEnvironmentId: "env-abc" });
    expect(await getPreferences()).toEqual({ activeEnvironmentId: "env-abc" });
  });

  test("overwrites previous preferences", async () => {
    await savePreferences({ activeEnvironmentId: null });
    expect(await getPreferences()).toEqual({ activeEnvironmentId: null });
  });
});

// ---------------------------------------------------------------------------
// collections
// ---------------------------------------------------------------------------

describe("collections", () => {
  test("listCollections returns empty array when no collections exist", async () => {
    expect(await listCollections()).toEqual([]);
  });

  test("createCollection creates a valid collection file", async () => {
    const { id, filePath } = await createCollection();
    expect(id).toBeTruthy();
    expect(filePath).toContain(id);

    const raw = await Bun.file(filePath).text();
    const data = JSON.parse(raw);
    expect(data.id).toBe(id);
    expect(data.name).toBe("New Collection");
    expect(data.rootUrl).toBe("https://api.example.com");
  });

  test("listCollections includes created collection", async () => {
    const { id } = await createCollection();
    const collections = await listCollections();
    expect(collections.some((c) => c.id === id)).toBe(true);
  });

  test("listCollections is sorted by name", async () => {
    const collections = await listCollections();
    const names = collections.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("getCollectionDir returns path containing collection id", async () => {
    const { id } = await createCollection();
    const dir = await getCollectionDir(id);
    expect(dir).toContain(id);
  });

  test("getCollectionFilePath returns path to collection.json", async () => {
    const { id } = await createCollection();
    const path = await getCollectionFilePath(id);
    expect(path).toContain(id);
    expect(path).toEndWith("collection.json");
  });

  test("deleteCollection removes the collection directory", async () => {
    const { id } = await createCollection();
    await deleteCollection(id);
    const collections = await listCollections();
    expect(collections.some((c) => c.id === id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requests
// ---------------------------------------------------------------------------

describe("requests", () => {
  let collectionId: string;

  beforeAll(async () => {
    const result = await createCollection();
    collectionId = result.id;
  });

  test("listRequests returns empty array for new collection", async () => {
    expect(await listRequests(collectionId)).toEqual([]);
  });

  test("listRequests returns empty array for nonexistent collection", async () => {
    expect(await listRequests("nonexistent-id")).toEqual([]);
  });

  test("createRequest creates a valid request file", async () => {
    const { id, filePath } = await createRequest(collectionId);
    expect(id).toBeTruthy();
    expect(filePath).toContain(id);

    const raw = await Bun.file(filePath).text();
    const data = JSON.parse(raw);
    expect(data.id).toBe(id);
    expect(data.name).toBe("New Request");
    expect(data.method).toBe("GET");
    expect(data.relativeUrl).toBe("/");
  });

  test("listRequests includes created request", async () => {
    const { id } = await createRequest(collectionId);
    const requests = await listRequests(collectionId);
    expect(requests.some((r) => r.id === id)).toBe(true);
  });

  test("listRequests is sorted by name", async () => {
    const requests = await listRequests(collectionId);
    const names = requests.map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("getRequestFilePath returns path to request json", async () => {
    const { id } = await createRequest(collectionId);
    const path = await getRequestFilePath(collectionId, id);
    expect(path).toContain(id);
    expect(path).toEndWith(".json");
  });

  test("saveRequestJqFilter updates jqFilter on disk", async () => {
    const { id, filePath } = await createRequest(collectionId);
    await saveRequestJqFilter(collectionId, id, ".data[]");
    const raw = await Bun.file(filePath).text();
    expect(JSON.parse(raw).jqFilter).toBe(".data[]");
  });

  test("deleteRequest removes the request file", async () => {
    const { id } = await createRequest(collectionId);
    await deleteRequest(collectionId, id);
    const requests = await listRequests(collectionId);
    expect(requests.some((r) => r.id === id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// environments
// ---------------------------------------------------------------------------

describe("environments", () => {
  test("listEnvironments returns empty array when none exist", async () => {
    expect(await listEnvironments()).toEqual([]);
  });

  test("createEnvironment creates a valid environment file", async () => {
    const { id, filePath } = await createEnvironment();
    expect(id).toBeTruthy();

    const raw = await Bun.file(filePath).text();
    const data = JSON.parse(raw);
    expect(data.id).toBe(id);
    expect(data.name).toBe("New Environment");
    expect(data.rootUrl).toBe("https://api.example.com");
    expect(data.auth.type).toBe("basic");
  });

  test("listEnvironments includes created environment", async () => {
    const { id } = await createEnvironment();
    const envs = await listEnvironments();
    expect(envs.some((e) => e.id === id)).toBe(true);
  });

  test("listEnvironments is sorted by name", async () => {
    const envs = await listEnvironments();
    const names = envs.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("getEnvironmentFilePath returns path ending in .json", async () => {
    const { id } = await createEnvironment();
    const path = await getEnvironmentFilePath(id);
    expect(path).toContain(id);
    expect(path).toEndWith(".json");
  });

  test("deleteEnvironment removes the environment file", async () => {
    const { id } = await createEnvironment();
    await deleteEnvironment(id);
    const envs = await listEnvironments();
    expect(envs.some((e) => e.id === id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logs
// ---------------------------------------------------------------------------

describe("logs", () => {
  test("listLogs returns empty array when no logs exist", async () => {
    expect(await listLogs()).toEqual([]);
  });

  test("appendLog + listLogs round-trip", async () => {
    const log = {
      timestamp: "2024-01-15T10:00:00.000Z",
      durationMs: 42,
      request: { id: "req-1", name: "Get Users" },
      collection: { id: "col-1", name: "My API" },
      environment: undefined,
      execution: {
        method: HttpMethods.GET,
        url: "https://api.example.com/users",
        headers: {},
        variables: undefined,
        body: undefined,
        jqFilter: undefined,
      },
      response: { stdout: '{"ok":true}', stderr: "", exitCode: 0, rawStdout: '{"ok":true}' },
    };

    await appendLog(log);
    const logs = await listLogs();
    const found = logs.find((l) => l.request.id === "req-1");
    expect(found).toBeDefined();
    expect(found?.response.stdout).toBe('{"ok":true}');
  });

  test("listLogs is sorted newest first", async () => {
    const make = (ts: string) => ({
      timestamp: ts,
      durationMs: 1,
      request: { id: `req-sort-${ts}`, name: "Sort Test" },
      collection: { id: "col-1", name: "My API" },
      environment: undefined,
      execution: { method: HttpMethods.GET, url: "/", headers: {}, variables: undefined, body: undefined, jqFilter: undefined },
      response: { stdout: "", stderr: "", exitCode: 0, rawStdout: "" },
    });

    await appendLog(make("2024-01-10T00:00:00.000Z"));
    await appendLog(make("2024-01-20T00:00:00.000Z"));

    const logs = await listLogs();
    const timestamps = logs.map((l) => l.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)));
  });
});

// ---------------------------------------------------------------------------
// last execution
// ---------------------------------------------------------------------------

describe("getLastExecution / saveLastExecution", () => {
  test("returns null when no saved execution", async () => {
    expect(await getLastExecution("unknown-req-id")).toBeNull();
  });

  test("round-trips last execution context", async () => {
    const ctx = {
      method: HttpMethods.POST,
      headers: { "Content-Type": "application/json" },
      body: { name: "Alice" },
      jqFilter: ".id",
      variables: { userId: "42" },
    };

    await saveLastExecution("req-last-1", ctx);
    const result = await getLastExecution("req-last-1");
    expect(result).toEqual(ctx);
  });

  test("overwrites previous last execution", async () => {
    await saveLastExecution("req-last-2", { method: HttpMethods.GET, headers: {}, body: undefined, jqFilter: undefined, variables: undefined });
    await saveLastExecution("req-last-2", { method: HttpMethods.DELETE, headers: {}, body: undefined, jqFilter: undefined, variables: undefined });
    const result = await getLastExecution("req-last-2");
    expect(result?.method).toBe("DELETE");
  });
});
