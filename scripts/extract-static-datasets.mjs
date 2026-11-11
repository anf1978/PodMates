// One-off migration: node scripts/extract-static-datasets.mjs [original.html] [--replace-inline]
// Re-run against the pre-extraction HTML to reproduce the committed JSON files.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { updateManifest, writeDeckMetadata } from "../pipelines/lib/dataset-manifest.mjs";

const root = new URL("../", import.meta.url);
const args = process.argv.slice(2);
const sourcePath = args.find((arg) => arg !== "--replace-inline");
const source = readFileSync(sourcePath ? resolve(sourcePath) : new URL("index.html", root), "utf8");
const names = [
  "SPELLBOOK_SNAPSHOT_B64",
  "KNOW_JSON",
  "IMPACT_CANDS",
  "REFERENCE_SCORES",
  "REFERENCE_TIERS",
  "PRECON_FINGERPRINTS",
  "STAPLES_BASELINE",
  "MANABASE_BASELINE",
  "TRY_A_DECK_OPTIONS",
];
let migrated = source;
const outputDir = new URL("public/data/", root);
mkdirSync(outputDir, { recursive: true });

for (const name of names) {
  const pattern =
    name === "TRY_A_DECK_OPTIONS"
      ? /^const TRY_A_DECK_OPTIONS = (\[[\s\S]*?\]);(?=\s*\/\* @golden:samples:end \*\/)/m
      : new RegExp(`^const ${name} = ([^\\r\\n]+);`, "m");
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing original inline dataset: ${name}`);
  const value = runInNewContext(`(${match[1]})`, {}, { timeout: 10_000 });
  const json = JSON.stringify(value);
  assert.equal(typeof json, "string", `${name} must be JSON serializable`);
  assert.deepEqual(JSON.parse(json), structuredClone(value), `${name} must round-trip losslessly`);
  const output = new URL(`${name}.json`, outputDir);
  writeFileSync(output, json + "\n");
  assert.equal(readFileSync(output, "utf8"), json + "\n");
  migrated = migrated.replace(match[0], `let ${name};`);
  console.log(`${name}.json: ${Buffer.byteLength(json + "\n")} bytes`);
}

writeDeckMetadata(fileURLToPath(outputDir));
updateManifest(
  fileURLToPath(outputDir),
  [...names, "TRY_A_DECK_METADATA"],
  `Static extraction from ${sourcePath ? basename(sourcePath) : "index.html"}`,
);

if (args.includes("--replace-inline")) {
  for (const name of ["CARD_DB_COMPRESSED_B64", "IX_TAGS_JSON", "COMMANDER_TIER_DATA"]) {
    const pattern = new RegExp(`^const ${name} = [^\\r\\n]+`, "m");
    assert.equal(migrated.match(pattern)?.[0], source.match(pattern)?.[0], `${name} changed`);
  }
  const htmlPath = new URL("index.html", root);
  writeFileSync(htmlPath, migrated);
  console.log(
    `${fileURLToPath(htmlPath)}: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(migrated)} bytes`,
  );
}
