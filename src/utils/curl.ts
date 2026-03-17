import type { Request, Environment, Collection } from "../types/index.ts";
import { appendLog } from "../storage/index.ts";

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function executeRequest(
  request: Request,
  collection: Collection,
  environment: Environment | null,
  jqFilterOverride?: string,
): Promise<ExecuteResult> {
  const rootUrl =
    collection.rootUrl ?? environment?.rootUrl ?? "";
  const fullUrl = `${rootUrl}${request.url}`;

  const args: string[] = ["-s", "-w", "\n", "-X", request.method, fullUrl];

  // Headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...request.headers,
  };
  for (const [key, value] of Object.entries(headers)) {
    args.push("-H", `${key}: ${value}`);
  }

  // Basic auth
  if (environment?.auth?.type === "basic") {
    args.push("-u", `${environment.auth.email}:${environment.auth.password}`);
  }

  // Body
  if (request.body != null) {
    args.push("-d", JSON.stringify(request.body));
  }

  // Env vars for the child process
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...environment?.variables,
  };

  const jqFilter = jqFilterOverride ?? request.jqFilter;

  const timestamp = new Date().toISOString();
  const startMs = Date.now();

  // Run curl
  const curlProc = Bun.spawn(["curl", ...args], { env, stdout: "pipe", stderr: "pipe" });
  const curlStdout = await new Response(curlProc.stdout).text();
  const curlStderr = await new Response(curlProc.stderr).text();
  const curlExit = await curlProc.exited;

  if (curlExit !== 0 || !jqFilter) {
    const result = { stdout: curlStdout, stderr: curlStderr, exitCode: curlExit };
    appendLog({
      timestamp,
      durationMs: Date.now() - startMs,
      request: { id: request.id, name: request.name, method: request.method, url: fullUrl, headers, body: request.body, jqFilter: jqFilter || undefined },
      collection: { id: collection.id, name: collection.name },
      environment: environment ? { id: environment.id, name: environment.name } : undefined,
      response: result,
    });
    return result;
  }

  // Pipe through jq
  const jqProc = Bun.spawn(["jq", jqFilter], {
    stdin: new TextEncoder().encode(curlStdout),
    stdout: "pipe",
    stderr: "pipe",
  });
  const jqStdout = await new Response(jqProc.stdout).text();
  const jqStderr = await new Response(jqProc.stderr).text();
  const jqExit = await jqProc.exited;

  const result = {
    stdout: jqStdout,
    stderr: jqStderr || curlStderr,
    exitCode: jqExit,
  };
  appendLog({
    timestamp,
    durationMs: Date.now() - startMs,
    request: { id: request.id, name: request.name, method: request.method, url: fullUrl, headers, body: request.body, jqFilter },
    collection: { id: collection.id, name: collection.name },
    environment: environment ? { id: environment.id, name: environment.name } : undefined,
    response: result,
  });
  return result;
}
