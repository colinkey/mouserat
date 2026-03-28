import { join, resolve } from "path";
import { homedir } from "os";
import { v4 as uuidv4 } from "uuid";
import type { Collection, Environment, Execution, Request, RequestLog } from "../types/index.ts";

const SCHEMAS_DIR = resolve(import.meta.dir, "../../schemas");

function getBaseDir() { return process.env.MOUSERAT_BASE_DIR ?? join(homedir(), ".mouserat"); }
function getCollectionsDir() { return join(getBaseDir(), "collections"); }
function getEnvironmentsDir() { return join(getBaseDir(), "environments"); }
function getLogsDir() { return join(getBaseDir(), "logs"); }
function getLastExecutionDir() { return join(getBaseDir(), "last-execution"); }
function getPreferencesFile() { return join(getBaseDir(), "preferences.json"); }

type Preferences = {
  activeEnvironmentId?: string | null;
};

async function ensureDir(path: string) {
  await Bun.file(path).exists(); // probe
  await import("fs/promises").then((fs) => fs.mkdir(path, { recursive: true }));
}

export async function init() {
  await ensureDir(getCollectionsDir());
  await ensureDir(getEnvironmentsDir());
  await ensureDir(getLogsDir());
  await ensureDir(getLastExecutionDir());
}

export async function getPreferences(): Promise<Preferences> {
  try {
    const raw = await Bun.file(getPreferencesFile()).text();
    return JSON.parse(raw) as Preferences;
  } catch {
    return {};
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await Bun.write(getPreferencesFile(), JSON.stringify(prefs, null, 2));
}

export async function appendLog(log: RequestLog): Promise<void> {
  await ensureDir(getLogsDir());
  const safeTimestamp = log.timestamp.replace(/:/g, "-");
  const filePath = join(getLogsDir(), `${safeTimestamp}-${log.request.id}.json`);
  await Bun.write(filePath, JSON.stringify(log, null, 2));
}

// Collections

export async function listCollections(): Promise<Collection[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(getCollectionsDir(), { withFileTypes: true });
    const collections: Collection[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = join(getCollectionsDir(), entry.name, "collection.json");
      try {
        const raw = await Bun.file(filePath).text();
        collections.push(JSON.parse(raw) as Collection);
      } catch {
        // skip malformed entries
      }
    }
    return collections.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getCollectionDir(collectionId: string): Promise<string> {
  return join(getCollectionsDir(), collectionId);
}

export async function getCollectionFilePath(collectionId: string): Promise<string> {
  return join(getCollectionsDir(), collectionId, "collection.json");
}

export async function createCollection(): Promise<{ id: string; filePath: string }> {
  const id = uuidv4();
  const dir = join(getCollectionsDir(), id);
  const requestsDir = join(dir, "requests");
  const fs = await import("fs/promises");
  await fs.mkdir(requestsDir, { recursive: true });

  const collection = {
    $schema: join(SCHEMAS_DIR, "collection.schema.json"),
    id,
    name: "New Collection",
    rootUrl: "https://api.example.com",
  };

  const filePath = join(dir, "collection.json");
  await Bun.write(filePath, JSON.stringify(collection, null, 2));
  return { id, filePath };
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(join(getCollectionsDir(), collectionId), { recursive: true, force: true });
}

// Requests

export async function listRequests(collectionId: string): Promise<Request[]> {
  const fs = await import("fs/promises");
  const requestsDir = join(getCollectionsDir(), collectionId, "requests");
  try {
    const entries = await fs.readdir(requestsDir, { withFileTypes: true });
    const requests: Request[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Bun.file(join(requestsDir, entry.name)).text();
        requests.push(JSON.parse(raw) as Request);
      } catch {
        // skip malformed entries
      }
    }
    return requests.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getRequestFilePath(collectionId: string, requestId: string): Promise<string> {
  return join(getCollectionsDir(), collectionId, "requests", `${requestId}.json`);
}

export async function createRequest(collectionId: string): Promise<{ id: string; filePath: string }> {
  const id = uuidv4();
  const request = {
    $schema: join(SCHEMAS_DIR, "request.schema.json"),
    id,
    name: "New Request",
    method: "GET",
    relativeUrl: "/",
    headers: {},
    body: null,
    jqFilter: "",
  };

  const filePath = join(getCollectionsDir(), collectionId, "requests", `${id}.json`);
  await Bun.write(filePath, JSON.stringify(request, null, 2));
  return { id, filePath };
}

export async function saveRequestJqFilter(collectionId: string, requestId: string, jqFilter: string): Promise<void> {
  const filePath = join(getCollectionsDir(), collectionId, "requests", `${requestId}.json`);
  const raw = await Bun.file(filePath).text();
  const request = JSON.parse(raw) as Record<string, unknown>;
  request.jqFilter = jqFilter;
  await Bun.write(filePath, JSON.stringify(request, null, 2));
}

export async function deleteRequest(collectionId: string, requestId: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(join(getCollectionsDir(), collectionId, "requests", `${requestId}.json`), { force: true });
}

// Environments

export async function listEnvironments(): Promise<Environment[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(getEnvironmentsDir(), { withFileTypes: true });
    const environments: Environment[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Bun.file(join(getEnvironmentsDir(), entry.name)).text();
        environments.push(JSON.parse(raw) as Environment);
      } catch {
        // skip malformed entries
      }
    }
    return environments.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getEnvironmentFilePath(environmentId: string): Promise<string> {
  return join(getEnvironmentsDir(), `${environmentId}.json`);
}

export async function deleteEnvironment(environmentId: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(join(getEnvironmentsDir(), `${environmentId}.json`), { force: true });
}

export async function listLogs(): Promise<RequestLog[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(getLogsDir(), { withFileTypes: true });
    const logs: RequestLog[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Bun.file(join(getLogsDir(), entry.name)).text();
        logs.push(JSON.parse(raw) as RequestLog);
      } catch {
        // skip malformed entries
      }
    }
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

// Last execution context

export async function getLastExecution(requestId: string): Promise<Omit<Execution, "url"> | null> {
  try {
    const raw = await Bun.file(join(getLastExecutionDir(), `${requestId}.json`)).text();
    return JSON.parse(raw) as Omit<Execution, "url">;
  } catch {
    return null;
  }
}

export async function saveLastExecution(requestId: string, context: Omit<Execution, "url">): Promise<void> {
  await ensureDir(getLastExecutionDir());
  await Bun.write(join(getLastExecutionDir(), `${requestId}.json`), JSON.stringify(context, null, 2));
}

export async function createEnvironment(): Promise<{ id: string; filePath: string }> {
  const id = uuidv4();
  const environment = {
    $schema: join(SCHEMAS_DIR, "environment.schema.json"),
    id,
    name: "New Environment",
    rootUrl: "https://api.example.com",
    auth: {
      type: "basic",
      email: "user@example.com",
      password: "secret",
    },
    variables: {},
  };

  const filePath = join(getEnvironmentsDir(), `${id}.json`);
  await Bun.write(filePath, JSON.stringify(environment, null, 2));
  return { id, filePath };
}
