import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { compareSnapshots, parseSnapshots } from "./snapshot-guard.mjs";

const real = readFileSync(
  new URL("../../tests/golden/__snapshots__/engine.golden.test.ts.snap", import.meta.url),
  "utf8",
);

it("reads every snapshot in the committed golden file", () => {
  const snaps = parseSnapshots(real);
  expect(snaps.size).toBeGreaterThanOrEqual(178);
  expect([...snaps.keys()].some((name) => name.includes("cmd2024-science"))).toBe(true);
});

it("allows additions only", () => {
  const added = real + '\nexports[`embedded sample decks > cmd2099-new 1`] = `"{}"`;\n';
  expect(compareSnapshots(real, added)).toMatchObject({
    changed: [],
    added: ["embedded sample decks > cmd2099-new 1"],
  });
  const name = [...parseSnapshots(real).keys()][0];
  const edited = real.replace(/(exports\[`[^`]+`\] = `)/, "$1 ");
  expect(compareSnapshots(real, edited).changed).toEqual([name]);
  const removed = real.replace(/^exports\[`[^`]+`\] = `(?:[^`\\]|\\.)*`;$/ms, "");
  expect(compareSnapshots(real, removed).changed).toEqual([name]);
});
