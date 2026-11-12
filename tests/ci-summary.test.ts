// The phone-readable CI summary: failing test names and first error lines from real tool output.
import { describe, expect, it } from "vitest";
import { extractFailures, summarize } from "../scripts/ci-summary.mjs";

const vitestLog = `
 ✓ tests/tooling.test.ts (1 test) 3ms
 ❯ tests/deploy-gate.test.ts (3 tests | 1 failed) 12ms
   × deploy gate > deploys main's head 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/deploy-gate.test.ts > deploy gate > deploys main's head
AssertionError: expected false to be true // Object.is equality
 ❯ tests/deploy-gate.test.ts:12:20
`;

const playwrightLog = `
Running 40 tests using 2 workers
  1) [chromium] › tests/e2e/smoke.spec.ts:8:1 › boots and charts a deck ─────────────────

    Error: \u001b[2mexpect(\u001b[22mlocator).toBeVisible()
`;

const tscLog = `src/app/page.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.`;

const eslintLog = `
/home/runner/work/PodMates/src/app/page.ts
  4:1  error  'x' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)
`;

describe("extractFailures", () => {
  it("finds vitest failures without duplicates", () => {
    const { tests, errors } = extractFailures(vitestLog);
    expect(tests).toEqual(["tests/deploy-gate.test.ts > deploy gate > deploys main's head"]);
    expect(errors).toEqual(["AssertionError: expected false to be true // Object.is equality"]);
  });

  it("finds Playwright failures and strips colours", () => {
    const { tests, errors } = extractFailures(playwrightLog);
    expect(tests).toEqual(["[chromium] › tests/e2e/smoke.spec.ts:8:1 › boots and charts a deck"]);
    expect(errors).toEqual(["Error: expect(locator).toBeVisible()"]);
  });

  it("finds tsc and ESLint errors with their file", () => {
    expect(extractFailures(tscLog).errors).toEqual([tscLog]);
    expect(extractFailures(eslintLog).errors).toEqual([
      "/home/runner/work/PodMates/src/app/page.ts  4:1  error  'x' is assigned a value but never used  @typescript-eslint/no-unused-vars",
      "✖ 1 problem (1 error, 0 warnings)",
    ]);
  });
});

describe("summarize", () => {
  it("lists every step, details failures and annotates them", () => {
    const { markdown, annotations } = summarize("Checks", [
      { label: "npm run check", outcome: "failure", log: vitestLog },
      { label: "Golden diff", outcome: "info", log: " tests/golden/__snapshots__/x.snap | 4 ++--" },
      { label: "Browser tests", outcome: "skipped", log: "" },
    ]);
    expect(markdown).toContain("| npm run check | ❌ failed |");
    expect(markdown).toContain("| Browser tests | ⏭️ skipped |");
    expect(markdown).toContain("- tests/deploy-gate.test.ts > deploy gate > deploys main's head");
    expect(markdown).toContain(
      "### Golden diff\n\n```text\ntests/golden/__snapshots__/x.snap | 4 ++--\n```",
    );
    expect(annotations[0]).toBe(
      "::error title=npm run check::tests/deploy-gate.test.ts > deploy gate > deploys main's head",
    );
  });

  it("falls back to the last log lines when nothing is recognised", () => {
    const { markdown } = summarize("Checks", [
      { label: "Budget", outcome: "failure", log: "line one\nCode total 900000 exceeds 750000\n" },
    ]);
    expect(markdown).toContain("```text\nline one\nCode total 900000 exceeds 750000\n```");
  });
});
