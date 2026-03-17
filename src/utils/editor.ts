import { spawnSync } from "child_process";

export function openInEditor(filePath: string) {
  const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
  spawnSync(editor, [filePath], { stdio: "inherit" });
}
