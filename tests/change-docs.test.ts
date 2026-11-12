// docs/changes/: every change doc follows the naming convention and the template's headings.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const dir = fileURLToPath(new URL("../docs/changes/", import.meta.url));
const NAME = /^(\d{3})_(feature|fix|change|refactor|ops)_[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const HEADINGS = [
  "## Summary",
  "## What users see",
  "## How it works",
  "## Testing",
  "## Risks and rollback",
  "## Follow-ups",
  "## Related",
];

const docs = readdirSync(dir).filter((name) => name !== "README.md");

it("has change docs", () => {
  expect(docs.length).toBeGreaterThan(0);
});

it.each(docs)("%s follows the name pattern and the template", (name) => {
  const match = NAME.exec(name);
  expect(
    match,
    `${name} must be NNN_<feature|fix|change|refactor|ops>_<kebab-slug>.md`,
  ).not.toBeNull();
  const text = readFileSync(join(dir, name), "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  expect(lines[0], "first line is '# NNN: Title'").toMatch(new RegExp(`^# ${match?.[1]}: \\S`));
  expect(text, "needs a 'Date: YYYY-MM-DD' line").toMatch(/^Date: \d{4}-\d{2}-\d{2}$/m);
  const positions = HEADINGS.map((heading) => lines.indexOf(heading));
  for (const [i, heading] of HEADINGS.entries())
    expect(positions[i], `missing "${heading}"`).toBeGreaterThan(0);
  expect(positions, "template headings in order").toEqual([...positions].sort((a, b) => a - b));
});

it("never reuses a number", () => {
  const numbers = docs.map((name) => name.slice(0, 3));
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  expect(duplicates, "rename the newer doc to the next free number").toEqual([]);
});
