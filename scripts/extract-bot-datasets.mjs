// One-off migration from the pre-cutover HTML; generated snapshots are not hand-edited.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { updateManifest } from "./dataset-manifest.mjs";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("index.html", root), "utf8");
let migrated = source;
for (const [binding, file] of Object.entries({
  CARD_DB_COMPRESSED_B64: "cards",
  IX_TAGS_JSON: "tags",
  COMMANDER_TIER_DATA: "winrates",
})) {
  const pattern = new RegExp(`^const ${binding} = ([^\\r\\n]+);`, "m");
  const match = source.match(pattern);
  assert.ok(match, `Missing inline ${binding}`);
  const value = runInNewContext(`(${match[1]})`, {}, { timeout: 10_000 });
  const json = JSON.stringify(value) + "\n";
  writeFileSync(new URL(`public/data/${file}.json`, root), json);
  if (file === "winrates") {
    mkdirSync(new URL("tests/golden/fixtures/", root), { recursive: true });
    writeFileSync(new URL("tests/golden/fixtures/winrates.json", root), json);
  }
  migrated = migrated.replace(match[0], `let ${binding};`);
  console.log(`${file}.json: ${Buffer.byteLength(json)} bytes`);
}
writeFileSync(new URL("index.html", root), migrated);
updateManifest(
  fileURLToPath(new URL("public/data/", root)),
  ["cards", "tags", "winrates"],
  "Bot-data extraction from index.html",
);
console.log(`index.html: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(migrated)} bytes`);
