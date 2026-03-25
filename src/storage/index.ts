import { join, resolve } from "path";
import { homedir } from "os";
import { v4 as uuidv4 } from "uuid";
import type { Collection, Environment, Request, RequestLog } from "../types/index.ts";

const SCHEMAS_DIR = resolve(import.meta.dir, "../../schemas");

const BASE_DIR = join(homedir(), ".mouserat");
const COLLECTIONS_DIR = join(BASE_DIR, "collections");
const ENVIRONMENTS_DIR = join(BASE_DIR, "environments");
const LOGS_DIR = join(BASE_DIR, "logs");
const PREFERENCES_FILE = join(BASE_DIR, "preferences.json");

type Preferences = {
  activeEnvironmentId?: string | null;
};

async function ensureDir(path: string) {
  await Bun.file(path).exists(); // probe
  await import("fs/promises").then((fs) => fs.mkdir(path, { recursive: true }));
}

export async function init() {
  await ensureDir(COLLECTIONS_DIR);
  await ensureDir(ENVIRONMENTS_DIR);
  await ensureDir(LOGS_DIR);
}

export async function getPreferences(): Promise<Preferences> {
  try {
    const raw = await Bun.file(PREFERENCES_FILE).text();
    return JSON.parse(raw) as Preferences;
  } catch {
    return {};
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await Bun.write(PREFERENCES_FILE, JSON.stringify(prefs, null, 2));
}

export async function appendLog(log: RequestLog): Promise<void> {
  await ensureDir(LOGS_DIR);
  const safeTimestamp = log.timestamp.replace(/:/g, "-");
  const filePath = join(LOGS_DIR, `${safeTimestamp}-${log.request.id}.json`);
  await Bun.write(filePath, JSON.stringify(log, null, 2));
}

// Collections

export async function listCollections(): Promise<Collection[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(COLLECTIONS_DIR, { withFileTypes: true });
    const collections: Collection[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = join(COLLECTIONS_DIR, entry.name, "collection.json");
      try {
        const raw = await Bun.file(filePath).text();
        collections.push(JSON.parse(raw) as Collection);
      } catch {
        // skip malformed entries
      }
    }
    return collections;
  } catch {
    return [];
  }
}

export async function getCollectionDir(collectionId: string): Promise<string> {
  return join(COLLECTIONS_DIR, collectionId);
}

export async function getCollectionFilePath(collectionId: string): Promise<string> {
  return join(COLLECTIONS_DIR, collectionId, "collection.json");
}

export async function createCollection(): Promise<{ id: string; filePath: string }> {
  const id = uuidv4();
  const dir = join(COLLECTIONS_DIR, id);
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
  await fs.rm(join(COLLECTIONS_DIR, collectionId), { recursive: true, force: true });
}

// Requests

export async function listRequests(collectionId: string): Promise<Request[]> {
  const fs = await import("fs/promises");
  const requestsDir = join(COLLECTIONS_DIR, collectionId, "requests");
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
    return requests;
  } catch {
    return [];
  }
}

export async function getRequestFilePath(collectionId: string, requestId: string): Promise<string> {
  return join(COLLECTIONS_DIR, collectionId, "requests", `${requestId}.json`);
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

  const filePath = join(COLLECTIONS_DIR, collectionId, "requests", `${id}.json`);
  await Bun.write(filePath, JSON.stringify(request, null, 2));
  return { id, filePath };
}

export async function saveRequestJqFilter(collectionId: string, requestId: string, jqFilter: string): Promise<void> {
  const filePath = join(COLLECTIONS_DIR, collectionId, "requests", `${requestId}.json`);
  const raw = await Bun.file(filePath).text();
  const request = JSON.parse(raw) as Record<string, unknown>;
  request.jqFilter = jqFilter;
  await Bun.write(filePath, JSON.stringify(request, null, 2));
}

export async function deleteRequest(collectionId: string, requestId: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(join(COLLECTIONS_DIR, collectionId, "requests", `${requestId}.json`), { force: true });
}

// Environments

export async function listEnvironments(): Promise<Environment[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(ENVIRONMENTS_DIR, { withFileTypes: true });
    const environments: Environment[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Bun.file(join(ENVIRONMENTS_DIR, entry.name)).text();
        environments.push(JSON.parse(raw) as Environment);
      } catch {
        // skip malformed entries
      }
    }
    return environments;
  } catch {
    return [];
  }
}

export async function getEnvironmentFilePath(environmentId: string): Promise<string> {
  return join(ENVIRONMENTS_DIR, `${environmentId}.json`);
}

export async function deleteEnvironment(environmentId: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(join(ENVIRONMENTS_DIR, `${environmentId}.json`), { force: true });
}

export async function listLogs(): Promise<RequestLog[]> {
  const fs = await import("fs/promises");
  try {
    const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
    const logs: RequestLog[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Bun.file(join(LOGS_DIR, entry.name)).text();
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

  const filePath = join(ENVIRONMENTS_DIR, `${id}.json`);
  await Bun.write(filePath, JSON.stringify(environment, null, 2));
  return { id, filePath };
}
