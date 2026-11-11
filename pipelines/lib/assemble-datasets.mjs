import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { datasetNames, upgradeManifest, verifyManifest } from "./dataset-files.mjs";

const branch = process.argv[2] || "data";
if (!/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("Invalid data branch");
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
git("check-ref-format", `refs/heads/${branch}`);
const remote = git("ls-remote", "--heads", "origin", `refs/heads/${branch}`);
const revision = remote.split(/\s/)[0];
const files = {};
let manifest;
if (revision) {
  git("fetch", "--no-tags", "origin", revision);
  for (const name of datasetNames)
    files[`${name}.json`] = git("show", `${revision}:${name}.json`) + "\n";
  manifest = upgradeManifest(
    files,
    JSON.parse(git("show", `${revision}:manifest.json`)),
    git("show", "-s", "--format=%cI", revision),
    `Legacy publication ${branch}@${revision} (publication time)`,
  );
} else {
  console.warn(`Data branch ${branch} does not exist; using committed fallback snapshots.`);
  for (const name of datasetNames)
    files[`${name}.json`] = readFileSync(`public/data/${name}.json`, "utf8");
  manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
  verifyManifest(files, manifest);
}
mkdirSync("dist/data", { recursive: true });
for (const [name, contents] of Object.entries(files)) writeFileSync(`dist/data/${name}`, contents);
const combined = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
for (const name of datasetNames) combined.files[`${name}.json`] = manifest.files[`${name}.json`];
writeFileSync("dist/data/manifest.json", JSON.stringify(combined, null, 2) + "\n");
const provenance = {
  source: revision ? branch : "committed-fallback",
  revision: revision || git("rev-parse", "HEAD"),
  ...manifest,
};
writeFileSync("dist/data/build-manifest.json", JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify(provenance, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Dataset provenance:\n\`\`\`json\n${JSON.stringify(provenance, null, 2)}\n\`\`\`\n`,
    { flag: "a" },
  );
}
