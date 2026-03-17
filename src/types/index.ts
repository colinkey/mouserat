export interface Collection {
  $schema?: string;
  id: string;
  name: string;
  rootUrl?: string;
}

export interface Request {
  $schema?: string;
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
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

export type Screen = "collections" | "collection" | "environments" | "request";

export interface AppState {
  screen: Screen;
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeRequestId: string | null;
}
