import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  createManifest,
  validateDataset,
  verifyManifest,
} from "../.github/scripts/dataset-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

it("rejects malformed, undersized, or corrupted publications", () => {
  expect(() => validateDataset("cards", "invalid")).toThrow();
  expect(() => validateDataset("tags", { blink: [], "extra-combat": [] })).toThrow();
  expect(() => validateDataset("winrates", [])).toThrow();
  const files = Object.fromEntries(
    ["cards", "tags", "winrates"].map((name) => [
      `${name}.json`,
      readFileSync(join(root, "public", "data", `${name}.json`), "utf8"),
    ]),
  );
  const manifest = createManifest(files);
  expect(() => verifyManifest(files, manifest)).not.toThrow();
  expect(() =>
    verifyManifest({ ...files, "tags.json": files["tags.json"] + " " }, manifest),
  ).toThrow(/mismatch/);
});

it("publishes isolated orphan data revisions, preserves sibling datasets, and assembles their exact hashes", () => {
  const temporary = mkdtempSync(join(tmpdir(), "podmates-publish-test-"));
  try {
    const repo = join(temporary, "source");
    const remote = join(temporary, "remote.git");
    mkdirSync(repo);
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: repo,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    git("init", "--bare", remote);
    git("init");
    git("config", "user.name", "Dataset test");
    git("config", "user.email", "test@example.invalid");
    git("commit", "--allow-empty", "-m", "source");
    git("remote", "add", "origin", remote);
    mkdirSync(join(repo, "public"));
    cpSync(join(root, "public", "data"), join(repo, "public", "data"), { recursive: true });
    const run = (script: string, ...args: string[]) =>
      execFileSync(process.execPath, [join(root, ".github", "scripts", script), ...args], {
        cwd: repo,
        env: {
          ...process.env,
          GITHUB_REF_NAME: "test-cutover",
          GITHUB_SHA: git("rev-parse", "HEAD"),
        },
        stdio: "pipe",
      });
    const cards = JSON.parse(
      readFileSync(join(repo, "public", "data", "cards.json"), "utf8"),
    ) as string;
    writeFileSync(join(repo, "new-cards.b64"), cards);
    run("publish-datasets.mjs", "cards", "new-cards.b64");
    const first = git("ls-remote", "origin", "refs/heads/data-test-cutover").split(/\s/)[0];
    git("fetch", "origin", "data-test-cutover");
    const oldWinrates = git("show", `${first}:winrates.json`);
    const winrates = JSON.parse(oldWinrates) as { w: number }[];
    winrates[0].w = 39;
    writeFileSync(join(repo, "new-winrates.json"), JSON.stringify(winrates));
    run("publish-datasets.mjs", "winrates", "new-winrates.json");
    const second = git("ls-remote", "origin", "refs/heads/data-test-cutover").split(/\s/)[0];
    expect(second).not.toBe(first);
    git("fetch", "origin", "data-test-cutover");
    expect(git("rev-list", "--count", second)).toBe("1");
    expect(JSON.parse(git("show", `${second}:cards.json`))).toBe(cards);
    expect(JSON.parse(git("show", `${second}:winrates.json`))).toEqual(winrates);
    expect(git("ls-remote", "--heads", "origin", "refs/heads/data")).toBe("");
    run("assemble-datasets.mjs", "data-test-cutover");
    const manifest = JSON.parse(
      readFileSync(join(repo, "dist", "data", "build-manifest.json"), "utf8"),
    );
    expect(manifest.revision).toBe(second);
    expect(JSON.parse(readFileSync(join(repo, "dist", "data", "winrates.json"), "utf8"))).toEqual(
      winrates,
    );
    run("assemble-datasets.mjs", "missing-data");
    expect(
      JSON.parse(readFileSync(join(repo, "dist", "data", "build-manifest.json"), "utf8")).source,
    ).toBe("committed-fallback");
  } finally {
    rmSync(temporary, { recursive: true });
  }
}, 30_000);
