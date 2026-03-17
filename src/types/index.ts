export interface Collection {
  $schema?: string;
  id: string;
  name: string;
  rootUrl?: string;
  relativeUrl?: string;
}

export interface Request {
  $schema?: string;
  id: string;
  name: string;
  method: HttpMethod;
  rootUrl?: string;
  relativeUrl?: string;
  headers?: Record<string, string>;
  body?: unknown;
  jqFilter?: string;
}

export interface Environment {
  $schema?: string;
  id: string;
  name: string;
  rootUrl?: string;
  auth?: BasicAuth;
  variables?: Record<string, string>;
}

export interface BasicAuth {
  type: "basic";
  email: string;
  password: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/** The effective parameters for a single run of a request. Stored in the log. */
export interface Execution {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  jqFilter?: string;
}

export interface RequestLog {
  timestamp: string;
  durationMs: number;
  request: { id: string; name: string };
  execution: Execution;
  collection: { id: string; name: string };
  environment?: { id: string; name: string };
  response: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
}

export type Screen = "collections" | "collection" | "environments" | "request" | "logs" | "log";

export interface AppState {
  screen: Screen;
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeRequestId: string | null;
}
