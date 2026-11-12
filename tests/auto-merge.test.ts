// scripts/auto-merge.sh against real throwaway git repositories, with a fake `gh` that reports CI.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// On Windows use Git's bash (a bare `bash` may be WSL's); CI runs on Linux.
const bash =
  process.platform === "win32"
    ? join(
        dirname(
          dirname(dirname(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim())),
        ),
        "bin",
        "bash.exe",
      )
    : "bash";
const script = resolve("scripts", "auto-merge.sh").replace(/\\/g, "/");

let root: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = (cwd: string, file: string, text: string) => {
  mkdirSync(dirname(join(cwd, file)), { recursive: true });
  writeFileSync(join(cwd, file), text);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", `edit ${file}`);
  return git(cwd, "rev-parse", "HEAD");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "podmates-automerge-"));
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(root, "clone", "-q", "origin.git", "dev");
  const dev = join(root, "dev");
  for (const [k, v] of [
    ["user.name", "dev"],
    ["user.email", "dev@example.com"],
    ["core.autocrlf", "false"],
  ]) {
    git(dev, "config", k, v);
  }
  commit(dev, "app.txt", "one\n");
  git(dev, "push", "-q", "origin", "HEAD:main");
  mkdirSync(join(root, "bin"));
  writeFileSync(
    join(root, "bin", "gh"),
    `#!/usr/bin/env bash\ncase "$1 $2" in\n  "run list") echo "\${FAKE_GREEN:-1}" ;;\n  "pr view") exit 1 ;;\n  "pr create") echo "pr create" >> "${root.replace(/\\/g, "/")}/gh.log" ;;\nesac\n`,
  );
  chmodSync(join(root, "bin", "gh"), 0o755);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Push a claude/ branch from dev, then run the script from a fresh clone of main (as the workflow does). */
function run(branch: string, env: Record<string, string> = {}) {
  const runner = join(root, `runner-${Math.random().toString(36).slice(2)}`);
  git(root, "clone", "-q", "origin.git", runner);
  const result = spawnSync(bash, [script], {
    cwd: runner,
    encoding: "utf8",
    env: {
      ...process.env,
      BRANCH: branch,
      TESTED_SHA: "",
      GITHUB_OUTPUT: join(root, "out.txt"),
      GITHUB_STEP_SUMMARY: join(root, "summary.md"),
      PATH: `${join(root, "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`,
      ...env,
    },
  });
  const read = (file: string) => {
    try {
      return readFileSync(join(root, file), "utf8");
    } catch {
      return "";
    }
  };
  return {
    status: result.status,
    output: read("out.txt"),
    summary: read("summary.md") + result.stdout + result.stderr,
  };
}
const originHas = (ref: string) => {
  try {
    return git(join(root, "origin.git"), "rev-parse", "--verify", "-q", ref);
  } catch {
    return "";
  }
};

describe("auto-merge.sh", () => {
  it("fast-forwards main to exactly the tested commit and deletes the branch", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/feature");
    const tip = commit(dev, "app.txt", "two\n");
    git(dev, "push", "-q", "origin", "claude/feature");
    const result = run("claude/feature", { TESTED_SHA: tip });
    expect(result.status, result.summary).toBe(0);
    expect(originHas("refs/heads/main")).toBe(tip);
    expect(originHas("refs/heads/claude/feature")).toBe("");
    expect(result.output).toContain(`merged=true\nsha=${tip}`);
    expect(result.summary).toContain("exactly as tested");
  });

  it("rebases onto a newer main, keeping both changes", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/feature");
    commit(dev, "feature.txt", "f\n");
    git(dev, "push", "-q", "origin", "claude/feature");
    git(dev, "switch", "-q", "main");
    const other = commit(dev, "other.txt", "o\n");
    git(dev, "push", "-q", "origin", "main");
    const result = run("claude/feature");
    expect(result.status, result.summary).toBe(0);
    const main = originHas("refs/heads/main");
    expect(git(join(root, "origin.git"), "rev-parse", `${main}~1`)).toBe(other);
    expect(result.summary).toContain("rebased onto a newer main");
  });

  it("refuses a branch without a passing CI run", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/feature");
    commit(dev, "app.txt", "two\n");
    git(dev, "push", "-q", "origin", "claude/feature");
    const before = originHas("refs/heads/main");
    const result = run("claude/feature", { FAKE_GREEN: "0" });
    expect(result.status).toBe(1);
    expect(originHas("refs/heads/main")).toBe(before);
    expect(result.summary).toContain("has no passing CI run");
  });

  it("skips when the branch moved on after CI passed", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/feature");
    const tested = commit(dev, "app.txt", "two\n");
    commit(dev, "app.txt", "three\n");
    git(dev, "push", "-q", "origin", "claude/feature");
    const before = originHas("refs/heads/main");
    const result = run("claude/feature", { TESTED_SHA: tested });
    expect(result.status).toBe(0);
    expect(originHas("refs/heads/main")).toBe(before);
    expect(result.output).toContain("merged=false");
  });

  it("stops on a conflict with main", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/feature");
    commit(dev, "app.txt", "branch\n");
    git(dev, "push", "-q", "origin", "claude/feature");
    git(dev, "switch", "-q", "main");
    const moved = commit(dev, "app.txt", "main\n");
    git(dev, "push", "-q", "origin", "main");
    const result = run("claude/feature");
    expect(result.status).toBe(1);
    expect(originHas("refs/heads/main")).toBe(moved);
    expect(result.summary).toContain("conflicts with main");
  });

  it("leaves workflow-file changes to a human and opens a PR", () => {
    const dev = join(root, "dev");
    git(dev, "switch", "-q", "-c", "claude/ci");
    commit(dev, ".github/workflows/ci.yml", "name: CI\n");
    git(dev, "push", "-q", "origin", "claude/ci");
    const before = originHas("refs/heads/main");
    const result = run("claude/ci");
    expect(result.status).toBe(0);
    expect(originHas("refs/heads/main")).toBe(before);
    expect(readFileSync(join(root, "gh.log"), "utf8")).toContain("pr create");
  });

  it("only merges claude/ branches", () => {
    expect(run("wip/idea").status).toBe(1);
    expect(run("main").status).toBe(1);
  });
});
