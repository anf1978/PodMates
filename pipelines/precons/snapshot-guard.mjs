// Fails unless a golden snapshot update only ADDED entries: every snapshot in the committed file
// must still be there, byte for byte. The precon importer runs it after writing snapshots for new
// decks, so a new deck can never quietly change an existing deck's results.
//
// Usage: node pipelines/precons/snapshot-guard.mjs <before.snap> <after.snap>
import { readFileSync } from "node:fs";
import { isMain } from "../lib/cli.mjs";

/** Snapshot name -> body, from a Vitest .snap file. @param {string} text */
export function parseSnapshots(text) {
  const out = new Map();
  for (const m of text.matchAll(/^exports\[`((?:[^`\\]|\\.)*)`\] = `((?:[^`\\]|\\.)*)`;$/gms))
    out.set(m[1], m[2]);
  return out;
}

/** Names of snapshots changed or removed, and names added. @param {string} before @param {string} after */
export function compareSnapshots(before, after) {
  const a = parseSnapshots(before);
  const b = parseSnapshots(after);
  const changed = [...a.keys()].filter((name) => b.get(name) !== a.get(name));
  const added = [...b.keys()].filter((name) => !a.has(name));
  return { changed, added, before: a.size };
}

if (isMain(import.meta.url)) {
  const [beforePath, afterPath] = process.argv.slice(2);
  const result = compareSnapshots(
    readFileSync(beforePath, "utf8"),
    readFileSync(afterPath, "utf8"),
  );
  if (!result.before)
    throw new Error("No snapshots found in the committed file; refusing to guess.");
  if (result.changed.length) {
    console.error(`Existing snapshots changed or removed:\n${result.changed.join("\n")}`);
    process.exit(1);
  }
  console.log(`OK: ${result.before} existing snapshots unchanged; ${result.added.length} added.`);
}
