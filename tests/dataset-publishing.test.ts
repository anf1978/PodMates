import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  createManifest,
  upgradeManifest,
  validateDataset,
  verifyManifest,
} from "../pipelines/lib/dataset-files.mjs";
import { snapshotManifest } from "../pipelines/lib/dataset-manifest.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

it("static extraction writes metadata and a hashed manifest without embedding decklists in chart metadata", () => {
  const temporary = mkdtempSync(join(tmpdir(), "podmates-extract-test-"));
  try {
    cpSync(join(root, "scripts"), join(temporary, "scripts"), { recursive: true });
    mkdirSync(join(temporary, "pipelines", "lib"), { recursive: true });
    cpSync(
      join(root, "pipelines", "lib", "dataset-manifest.mjs"),
      join(temporary, "pipelines", "lib", "dataset-manifest.mjs"),
    );
    const datasets = {
      SPELLBOOK_SNAPSHOT_B64: "unchanged-encoding",
      KNOW_JSON: { lists: [], cards: {} },
      IMPACT_CANDS: [],
      REFERENCE_SCORES: [[1, 2, 3, 4, 5]],
      REFERENCE_TIERS: "p",
      PRECON_FINGERPRINTS: [["sample", [1]]],
      STAPLES_BASELINE: {},
      MANABASE_BASELINE: {},
      TRY_A_DECK_OPTIONS: [
        { key: "sample", decklist: "1 Sol Ring" },
        { key: "announced", awaitsCards: true, decklist: "1 Future Card" },
      ],
    };
    const source = Object.entries(datasets)
      .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
      .join("\n");
    const original = join(temporary, "original.html");
    writeFileSync(original, source + "\n/* @golden:samples:end */");
    execFileSync(
      process.execPath,
      [join(temporary, "scripts", "extract-static-datasets.mjs"), original],
      { stdio: "pipe" },
    );
    const directory = join(temporary, "public", "data");
    const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
    for (const [name, value] of Object.entries(datasets)) {
      const contents = readFileSync(join(directory, `${name}.json`), "utf8");
      expect(JSON.parse(contents)).toEqual(value);
      expect(manifest.files[`${name}.json`].bytes).toBe(Buffer.byteLength(contents));
      expect(manifest.files[`${name}.json`].sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(Number.isFinite(Date.parse(manifest.files[`${name}.json`].generatedAt))).toBe(true);
    }
    expect(JSON.parse(readFileSync(join(directory, "TRY_A_DECK_METADATA.json"), "utf8"))).toEqual([
      { key: "sample" },
      { key: "announced", awaitsCards: true, validationDecklist: "1 Future Card" },
    ]);
  } finally {
    rmSync(temporary, { recursive: true });
  }
});

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
  const malformed = structuredClone(manifest);
  malformed.files["cards.json"].generatedAt = "not a date";
  expect(() => verifyManifest(files, malformed)).toThrow(/metadata/);
  const legacy = {
    files: Object.fromEntries(
      Object.entries(manifest.files).map(([name, { sha256, bytes }]) => [name, { sha256, bytes }]),
    ),
  };
  const migrated = upgradeManifest(files, legacy, "2026-11-01T00:00:00Z", "Legacy publication");
  expect(migrated.files["cards.json"].generatedAt).toBe("2026-11-01T00:00:00Z");
  expect(migrated.files["cards.json"].source).toBe("Legacy publication");
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
    const snapshotManifestPath = join(repo, "public", "data", "manifest.json");
    const snapshotBefore = readFileSync(snapshotManifestPath, "utf8");
    snapshotManifest(join(repo, "public", "data"));
    expect(readFileSync(snapshotManifestPath, "utf8")).toBe(snapshotBefore);
    const run = (script: string, ...args: string[]) =>
      execFileSync(process.execPath, [join(root, "pipelines", "lib", script), ...args], {
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
    const firstManifest = JSON.parse(git("show", `${first}:manifest.json`));
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
    const secondManifest = JSON.parse(git("show", `${second}:manifest.json`));
    expect(secondManifest.files["cards.json"]).toEqual(firstManifest.files["cards.json"]);
    expect(secondManifest.files["tags.json"]).toEqual(firstManifest.files["tags.json"]);
    expect(secondManifest.files["winrates.json"].source).toBe("Playgroup.gg commander win-rates");
    expect(git("ls-remote", "--heads", "origin", "refs/heads/data")).toBe("");
    run("assemble-datasets.mjs", "data-test-cutover");
    const manifest = JSON.parse(
      readFileSync(join(repo, "dist", "data", "build-manifest.json"), "utf8"),
    );
    expect(manifest.revision).toBe(second);
    const browserManifest = JSON.parse(
      readFileSync(join(repo, "dist", "data", "manifest.json"), "utf8"),
    );
    expect(browserManifest.files["cards.json"]).toEqual(secondManifest.files["cards.json"]);
    expect(browserManifest.files["TRY_A_DECK_OPTIONS.json"]).toEqual(
      JSON.parse(readFileSync(join(repo, "public", "data", "manifest.json"), "utf8")).files[
        "TRY_A_DECK_OPTIONS.json"
      ],
    );
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
