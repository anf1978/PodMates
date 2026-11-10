import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createHarness, stableJson } from "./harness";
import { extractBlock, htmlUrl } from "./source.mjs";

it.each([
  "",
  "/* @golden:test:start */",
  "/* @golden:test:start *//* @golden:test:start *//* @golden:test:end */",
  "/* @golden:test:start *//* @golden:test:end *//* @golden:test:end */",
  "/* @golden:test:end *//* @golden:test:start */",
])("rejects missing, duplicate or reversed extraction markers: %s", (source) => {
  expect(() => extractBlock(source, "test")).toThrow("Expected exactly one golden block");
});

it("keeps analysis independent of refreshed embedded card and Spellbook blobs", () => {
  const html = readFileSync(htmlUrl, "utf8");
  const changed = html.replace(
    /const (CARD_DB_COMPRESSED_B64|SPELLBOOK_SNAPSHOT_B64) = "[^"]+";/g,
    'const $1 = "deliberately invalid compressed data";',
  );
  expect(changed).not.toBe(html);
  const original = createHarness(html);
  const refreshed = createHarness(changed);
  for (const sample of original.samples) {
    expect(stableJson(refreshed.analyzeSample(sample))).toBe(
      stableJson(original.analyzeSample(sample)),
    );
  }
});
