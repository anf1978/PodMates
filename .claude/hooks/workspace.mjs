// Enforces generated-file guards and runs local edit/stop checks for Claude.
// Never format the legacy HTML or treat a failed check as a successful stop.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const require = createRequire(import.meta.url);

function canonicalPath(path) {
  if (existsSync(path)) return realpathSync(path);
  return join(canonicalPath(dirname(path)), basename(path));
}

function run(command, args, shell = false) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}

function generated(path, input) {
  const local = relative(root, path).split(sep).join("/");
  const contents = existsSync(path) ? readFileSync(path, "utf8") : "";
  const header = (text) => /^\s*\/\/ GENERATED\b/m.test(text.split(/\r?\n/).slice(0, 5).join("\n"));
  return (
    /^(public\/data)(\/|$)/i.test(local) ||
    /(^|\/)generated(\/|$)|\.generated\./i.test(local) ||
    header(contents) ||
    header(input.content ?? "")
  );
}

function patchTexts(value) {
  if (typeof value === "string") return value.includes("*** Begin Patch") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(patchTexts);
  if (value && typeof value === "object") return Object.values(value).flatMap(patchTexts);
  return [];
}

// Agents that edit with apply_patch send a patch instead of file_path; list every file it touches.
function patchEdits(input) {
  const edits = [];
  for (const text of patchTexts(input)) {
    let current;
    for (const line of text.split(/\r?\n/)) {
      const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
      const move = /^\*\*\* Move to: (.+)$/.exec(line);
      if (header) {
        current = { file: header[2].trim(), deleted: header[1] === "Delete", content: "" };
        edits.push(current);
      } else if (move && current) {
        current.deleted = true;
        current = { file: move[1].trim(), deleted: false, content: "" };
        edits.push(current);
      } else if (current && line.startsWith("+")) {
        current.content += `${line.slice(1)}\n`;
      }
    }
  }
  return edits;
}

// Agents name the edited file differently: Claude sends file_path/notebook_path and
// content, Copilot CLI sends path with file_text (create) or new_str (edit).
function editedFiles(input) {
  const file = input?.file_path ?? input?.notebook_path ?? input?.path;
  if (typeof file === "string" && file.length > 0)
    return [{ file, deleted: false, content: input.content ?? input.file_text ?? input.new_str }];
  const edits = patchEdits(input);
  if (edits.length === 0) throw new Error("Missing edited file path.");
  return edits;
}

try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const mode = process.argv[2];
  if (mode === "check") {
    // A previous failed Stop must be fixed, not skipped via stop_hook_active.
    run("npm run check", [], true);
  } else if (mode === "protect" || mode === "format") {
    for (const edit of editedFiles(event.tool_input)) {
      const path = canonicalPath(resolve(event.cwd ?? root, edit.file));
      const local = relative(root, path);
      if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) {
        throw new Error("Edited file is outside this project.");
      }
      if (generated(path, edit)) {
        if (mode === "protect") throw new Error("Generated file: edit its pipeline instead.");
        continue;
      }
      if (
        mode !== "format" ||
        edit.deleted ||
        !existsSync(path) ||
        path === join(root, "index.html")
      ) {
        continue;
      }
      const bin = (pkg, entry) => join(dirname(require.resolve(`${pkg}/package.json`)), entry);
      run(process.execPath, [
        bin("prettier", "bin/prettier.cjs"),
        "--write",
        "--ignore-unknown",
        path,
      ]);
      run(process.execPath, [bin("eslint", "bin/eslint.js"), "--fix", "--no-warn-ignored", path]);
    }
  } else {
    throw new Error(`Unknown workspace hook: ${mode}`);
  }
} catch (error) {
  console.error(`Workspace hook: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
