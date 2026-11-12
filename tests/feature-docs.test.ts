// Every feature folder has a change doc describing it: docs/changes/NNN_feature_<name>.md (or
// NNN_feature_<name>-<more>.md). /new-feature writes one for new features.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const features = readdirSync(fileURLToPath(new URL("../src/features/", import.meta.url)), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const docs = readdirSync(fileURLToPath(new URL("../docs/changes/", import.meta.url)));

it("finds the feature folders", () => {
  expect(features.length).toBeGreaterThan(0);
});

it.each(features)("src/features/%s has a feature doc in docs/changes/", (name) => {
  const doc = new RegExp(`^\\d{3}_feature_${name}(?:-[a-z0-9-]+)?\\.md$`);
  expect(
    docs.some((file) => doc.test(file)),
    `add docs/changes/NNN_feature_${name}.md (template in docs/changes/README.md)`,
  ).toBe(true);
});
