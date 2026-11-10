import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createManifest, datasetNames, validateDataset, verifyManifest } from "./dataset-files.mjs";

const [kind, input, tagsPath] = process.argv.slice(2);
if (!["cards", "winrates"].includes(kind) || !input) {
  throw new Error("Usage: node publish-datasets.mjs <cards|winrates> <input> [tags.json]");
}
const ref = process.env.GITHUB_REF_NAME;
if (!ref || !/^[A-Za-z0-9._/-]+$/.test(ref)) throw new Error("Invalid GITHUB_REF_NAME");
const branch = ref === "main" ? "data" : `data-${ref}`;
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
git("check-ref-format", `refs/heads/${branch}`);
const remote = git("ls-remote", "--heads", "origin", `refs/heads/${branch}`);
const previous = remote.split(/\s/)[0];
const files = {};
if (previous) {
  git("fetch", "--no-tags", "origin", `refs/heads/${branch}`);
  for (const name of datasetNames)
    files[`${name}.json`] = git("show", `${previous}:${name}.json`) + "\n";
  verifyManifest(files, JSON.parse(git("show", `${previous}:manifest.json`)));
} else {
  for (const name of datasetNames)
    files[`${name}.json`] = readFileSync(`public/data/${name}.json`, "utf8");
}
const value =
  kind === "cards" ? readFileSync(input, "utf8").trim() : JSON.parse(readFileSync(input, "utf8"));
validateDataset(kind, value);
files[`${kind}.json`] = JSON.stringify(value) + "\n";
if (tagsPath) {
  const tags = JSON.parse(readFileSync(tagsPath, "utf8"));
  validateDataset("tags", tags);
  files["tags.json"] = JSON.stringify(tags) + "\n";
} else if (kind === "cards") {
  console.warn("WARNING: function tags were not fetched; preserving the previous validated lists.");
}
files["manifest.json"] = JSON.stringify(createManifest(files), null, 2) + "\n";
const temporary = mkdtempSync(join(tmpdir(), "podmates-data-"));
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
  const indexedGit = (...args) => execFileSync("git", args, { env, encoding: "utf8" }).trim();
  indexedGit("read-tree", "--empty");
  for (const [name, contents] of Object.entries(files)) {
    const path = join(temporary, name);
    writeFileSync(path, contents);
    const object = indexedGit("hash-object", "-w", "--", path);
    indexedGit("update-index", "--add", "--cacheinfo", `100644,${object},${name}`);
  }
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "github-actions[bot]@users.noreply.github.com");
  const tree = indexedGit("write-tree");
  const commit = indexedGit(
    "commit-tree",
    tree,
    "-m",
    `Refresh ${kind} datasets from ${process.env.GITHUB_SHA}`,
  );
  git(
    "push",
    `--force-with-lease=refs/heads/${branch}:${previous}`,
    "origin",
    `${commit}:refs/heads/${branch}`,
  );
  console.log(`Published ${branch} at ${commit}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `Published \`${branch}\` at \`${commit}\`.\n`, {
      flag: "a",
    });
  }
} finally {
  rmSync(temporary, { recursive: true });
}
