import type { Request, Environment, Collection, Execution } from "../types/index.ts";
import { appendLog } from "../storage/index.ts";

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  rawStdout: string;
}

/** Returns the variable names referenced in a URL pattern using :varName syntax. */
export function extractUrlVariables(url: string): string[] {
  return [...url.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]).filter((v): v is string => v !== undefined);
}

/** Interpolates :varName tokens in a URL. Returns the resolved URL and any missing variable names. */
export function interpolateUrl(url: string, variables: Record<string, string>): { url: string; missing: string[] } {
  const missing: string[] = [];
  const result = url.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => {
    if (name in variables) return variables[name] ?? match;
    missing.push(name);
    return match;
  });
  return { url: result, missing };
}

/** Resolves the full URL from request, collection, and environment rootUrl/relativeUrl configuration. */
export function buildUrl(request: Request, collection: Collection, environment: Environment | null): string {
  return request.rootUrl
    ? `${request.rootUrl}${request.relativeUrl ?? ""}`
    : `${collection.rootUrl ?? environment?.rootUrl ?? ""}${collection.relativeUrl ?? ""}${request.relativeUrl ?? ""}`;
}

export async function executeRequest(
  request: Request,
  collection: Collection,
  environment: Environment | null,
  executionContext: Omit<Execution, "url"> | null,
): Promise<ExecuteResult> {
  const fullUrl = buildUrl(request, collection, environment);

  const allVariables: Record<string, string> = {
    ...environment?.variables,
    ...executionContext?.variables,
  };

  const { url: interpolatedUrl, missing } = interpolateUrl(fullUrl, allVariables);

  if (missing.length > 0) {
    return {
      stdout: "",
      stderr: `Missing URL variables: ${missing.join(", ")}`,
      exitCode: 1,
      rawStdout: "",
    };
  }

  const execution: Execution = {
    method: executionContext?.method ?? request.method,
    url: interpolatedUrl,
    headers: {
      "Content-Type": "application/json",
      ...request.headers,
      ...executionContext?.headers,
    },
    body: executionContext?.body !== undefined ? executionContext.body : request.body,
    jqFilter: executionContext?.jqFilter !== undefined ? executionContext.jqFilter : request.jqFilter,
    variables: Object.keys(allVariables).length > 0 ? allVariables : undefined,
  };

  const args: string[] = ["-s", "-w", "\n", "-X", execution.method, execution.url];

  for (const [key, value] of Object.entries(execution.headers)) {
    args.push("-H", `${key}: ${value}`);
  }

  if (environment?.auth?.type === "basic") {
    args.push("-u", `${environment.auth.email}:${environment.auth.password}`);
  }

  if (execution.body != null) {
    args.push("-d", JSON.stringify(execution.body));
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...environment?.variables,
  };

  const timestamp = new Date().toISOString();
  const startMs = Date.now();

  const curlProc = Bun.spawn(["curl", ...args], { env, stdout: "pipe", stderr: "pipe" });
  const curlStdout = await new Response(curlProc.stdout).text();
  const curlStderr = await new Response(curlProc.stderr).text();
  const curlExit = await curlProc.exited;

  const logBase = {
    timestamp,
    request: { id: request.id, name: request.name },
    execution,
    collection: { id: collection.id, name: collection.name },
    environment: environment ? { id: environment.id, name: environment.name } : undefined,
  };

  if (curlExit !== 0 || !execution.jqFilter) {
    const result = { stdout: curlStdout, stderr: curlStderr, exitCode: curlExit, rawStdout: curlStdout };
    appendLog({ ...logBase, durationMs: Date.now() - startMs, response: result });
    return result;
  }

  const jqProc = Bun.spawn(["jq", execution.jqFilter], {
    stdin: new TextEncoder().encode(curlStdout),
    stdout: "pipe",
    stderr: "pipe",
  });
  const jqStdout = await new Response(jqProc.stdout).text();
  const jqStderr = await new Response(jqProc.stderr).text();
  const jqExit = await jqProc.exited;

  const result = { stdout: jqStdout, stderr: jqStderr || curlStderr, exitCode: jqExit, rawStdout: curlStdout };
  appendLog({ ...logBase, durationMs: Date.now() - startMs, response: result });
  return result;
}

/**
 * Applies a jq filter to the given input string. Returns the filtered output.
 */
export async function applyJqFilter(input: string, filter: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const jqProc = Bun.spawn(["jq", filter], {
    stdin: new TextEncoder().encode(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(jqProc.stdout).text();
  const stderr = await new Response(jqProc.stderr).text();
  const exitCode = await jqProc.exited;
  return { stdout, stderr, exitCode };
}
