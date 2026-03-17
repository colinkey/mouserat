import type { Request, Environment, Collection, Execution } from "../types/index.ts";
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
  executionContext: Omit<Execution, "url"> | null,
): Promise<ExecuteResult> {
  const fullUrl = request.rootUrl
    ? `${request.rootUrl}${request.relativeUrl ?? ""}`
    : `${collection.rootUrl ?? environment?.rootUrl ?? ""}${collection.relativeUrl ?? ""}${request.relativeUrl ?? ""}`;

  const execution: Execution = {
    method: executionContext?.method ?? request.method,
    url: fullUrl,
    headers: {
      "Content-Type": "application/json",
      ...request.headers,
      ...executionContext?.headers,
    },
    body: executionContext?.body !== undefined ? executionContext.body : request.body,
    jqFilter: executionContext?.jqFilter !== undefined ? executionContext.jqFilter : request.jqFilter,
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
    const result = { stdout: curlStdout, stderr: curlStderr, exitCode: curlExit };
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

  const result = { stdout: jqStdout, stderr: jqStderr || curlStderr, exitCode: jqExit };
  appendLog({ ...logBase, durationMs: Date.now() - startMs, response: result });
  return result;
}
