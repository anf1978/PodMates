import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const datasetNames = ["cards", "tags", "winrates"];

export function validateDataset(name, value) {
  if (name === "cards") {
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      throw new Error("Cards must be a gzip/base64 string");
    }
    const data = JSON.parse(gunzipSync(Buffer.from(value, "base64")).toString("utf8"));
    if (
      !Array.isArray(data.cards) ||
      data.cards.length < 5000 ||
      !data.cards.every(
        (card) => Array.isArray(card) && card.length >= 16 && typeof card[0] === "string",
      ) ||
      !Array.isArray(data.gc) ||
      !Array.isArray(data.banned)
    ) {
      throw new Error("Malformed or suspiciously small card database");
    }
    for (const [field, minimum] of [
      [8, 800],
      [10, 5000],
      [12, 300],
      [13, 300],
      [14, 800],
    ]) {
      if (data.cards.filter((card) => Boolean(card[field])).length < minimum) {
        throw new Error(`Suspiciously few cards with field ${field}`);
      }
    }
  } else if (name === "tags") {
    for (const [tag, minimum] of Object.entries({ blink: 50, "extra-combat": 10 })) {
      if (
        !Array.isArray(value?.[tag]) ||
        value[tag].length < minimum ||
        !value[tag].every((card) => typeof card === "string" && card.length > 0)
      ) {
        throw new Error(`Malformed or suspiciously small tag list: ${tag}`);
      }
    }
  } else if (name === "winrates") {
    if (
      !Array.isArray(value) ||
      value.length < 500 ||
      value.length > 5000 ||
      !value.every(
        (row) =>
          typeof row.n === "string" &&
          row.n.length > 0 &&
          /^[SABCD]$/.test(row.t) &&
          Number.isFinite(row.w) &&
          row.w >= 0 &&
          row.w <= 100 &&
          Number.isInteger(row.g) &&
          row.g >= 250 &&
          Number.isInteger(row.r) &&
          row.r > 0,
      )
    ) {
      throw new Error("Malformed or suspiciously small win-rate database");
    }
  } else {
    throw new Error(`Unknown dataset: ${name}`);
  }
}

export function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function createManifest(files) {
  return {
    files: Object.fromEntries(
      datasetNames.map((name) => {
        const contents = files[`${name}.json`];
        validateDataset(name, JSON.parse(contents));
        return [`${name}.json`, { sha256: digest(contents), bytes: Buffer.byteLength(contents) }];
      }),
    ),
  };
}

export function verifyManifest(files, manifest) {
  const expected = createManifest(files);
  for (const [name, entry] of Object.entries(expected.files)) {
    if (
      manifest?.files?.[name]?.sha256 !== entry.sha256 ||
      manifest.files[name].bytes !== entry.bytes
    ) {
      throw new Error(`Dataset manifest mismatch: ${name}`);
    }
  }
}
