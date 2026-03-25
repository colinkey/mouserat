import { spawnSync } from "child_process";
import type { Execution, Request } from "../types/index.ts";

export function openInEditor(filePath: string) {
  const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
  spawnSync(editor, [filePath], { stdio: "inherit" });
}

/**
 * Opens a temp file in $EDITOR pre-populated with the current execution context,
 * falling back to the request's own values. Returns the parsed result, or null
 * if the file couldn't be parsed.
 */
export async function openExecutionInEditor(
  request: Request,
  current: Omit<Execution, "url"> | null,
): Promise<Omit<Execution, "url"> | null> {
  const defaults: Omit<Execution, "url"> = {
    method: request.method,
    headers: request.headers ?? {},
    body: request.body,
    jqFilter: request.jqFilter,
  };
  const tmpPath = `${process.env["TMPDIR"] ?? "/tmp"}/mouserat-execution.json`;
  await Bun.write(tmpPath, JSON.stringify(current ?? defaults, null, 2));
  openInEditor(tmpPath);
  try {
    return JSON.parse(await Bun.file(tmpPath).text()) as Omit<Execution, "url">;
  } catch {
    return null;
  }
}

/**
 * Opens a temp file in $EDITOR pre-populated with a jq filter expression.
 * Returns the trimmed filter string, or null if the file was empty or couldn't be read.
 */
export async function openJqFilterInEditor(currentFilter: string): Promise<string | null> {
  const tmpPath = `${process.env["TMPDIR"] ?? "/tmp"}/mouserat-jq-filter.jq`;
  await Bun.write(tmpPath, currentFilter);
  openInEditor(tmpPath);
  try {
    const result = (await Bun.file(tmpPath).text()).trim();
    return result || null;
  } catch {
    return null;
  }
}
