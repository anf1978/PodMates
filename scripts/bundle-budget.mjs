import { readdir, readFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(process.argv[2] ?? "dist");
const bootData = [
  "manifest",
  "cards",
  "tags",
  "winrates",
  "SPELLBOOK_SNAPSHOT_B64",
  "REFERENCE_SCORES",
  "REFERENCE_TIERS",
  "STAPLES_BASELINE",
  "MANABASE_BASELINE",
];

async function codeBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "data") bytes += await codeBytes(path);
    } else if (/\.(?:html|js|css)$/.test(entry.name)) {
      const size = gzipSync(await readFile(path)).length;
      console.log(`${relative(root, path)}: ${size} gzip bytes`);
      bytes += size;
    }
  }
  return bytes;
}

// Count all chunks (even lazy ones), the uncached DB worker and the full inline HTML.
const code = await codeBytes(root);
let data = 0;
for (const name of bootData) {
  data += gzipSync(await readFile(join(root, "data", `${name}.json`))).length;
}
const total = code + data;
console.log(`Code including inline HTML: ${code}; boot data: ${data}; total: ${total} gzip bytes`);
console.log(`Plan §10 target: <1500000; current gap: ${Math.max(0, total - 1_499_999)} bytes`);
// Interim ratchet: the pinned cards alone exceed the plan target. See docs/deploy.md.
if (code >= 750_000 || total >= 3_500_000) {
  throw new Error("Bundle budget exceeded: code <750000 and code + boot data <3500000 gzip bytes");
}
