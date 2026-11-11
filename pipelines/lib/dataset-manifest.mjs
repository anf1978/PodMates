import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function datasetEntry(contents, source, generatedAt = new Date().toISOString()) {
  const sha256 = createHash("sha256").update(contents).digest("hex");
  return {
    version: sha256.slice(0, 12),
    generatedAt,
    sha256,
    bytes: Buffer.byteLength(contents),
    source,
  };
}

export function updateManifest(directory, names, source) {
  const path = join(directory, "manifest.json");
  const manifest = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { files: {} };
  for (const name of names) {
    manifest.files[`${name}.json`] = datasetEntry(
      readFileSync(join(directory, `${name}.json`), "utf8"),
      source,
    );
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

export function writeDeckMetadata(directory) {
  const decks = JSON.parse(readFileSync(join(directory, "TRY_A_DECK_OPTIONS.json"), "utf8"));
  const metadata = decks.map(({ decklist, ...deck }) => ({
    ...deck,
    // Only announced decks need their list to check whether their cards are available.
    ...(deck.awaitsCards ? { validationDecklist: decklist } : {}),
  }));
  writeFileSync(join(directory, "TRY_A_DECK_METADATA.json"), JSON.stringify(metadata) + "\n");
}

export function snapshotManifest(directory) {
  writeDeckMetadata(directory);
  const path = join(directory, "manifest.json");
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { files: {} };
  const names = readdirSync(directory)
    .filter((name) => name.endsWith(".json") && name !== "manifest.json")
    .filter(
      (name) =>
        previous.files[name]?.sha256 !==
        datasetEntry(readFileSync(join(directory, name), "utf8"), "snapshot").sha256,
    )
    .map((name) => name.slice(0, -5));
  updateManifest(directory, names, "Committed extraction snapshot");
}
