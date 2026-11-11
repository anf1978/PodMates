import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";

/** @param {string} path */
export function readInputAsText(path) {
  const buffer = readFileSync(path);
  const wasGzipped = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  const raw = wasGzipped ? gunzipSync(buffer) : buffer;
  return { text: raw.toString("utf8"), wasGzipped };
}

/** @param {string} path @param {unknown} value */
export function writeCompressedJson(path, value) {
  const encoded = gzipSync(Buffer.from(JSON.stringify(value), "utf8")).toString("base64");
  writeFileSync(path, encoded, "utf8");
  return encoded.length;
}
