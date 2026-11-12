// Writes a short, phone-readable Markdown summary of a CI job to $GITHUB_STEP_SUMMARY: each step's
// result and, for failed steps, the failing test names and the first error lines. It also emits
// `::error` annotations, which show on the run's Summary page and through the public checks API.
//
// Usage: node scripts/ci-summary.mjs "<job title>" "<label>::<outcome>::<log file>" ...
// <outcome> is the step's `steps.<id>.outcome` (success, failure, skipped, cancelled) or `info`
// for a log shown as-is (the golden diff stats).
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_TESTS = 20;
const MAX_ERRORS = 15;
const ICONS = {
  success: "✅ passed",
  failure: "❌ failed",
  skipped: "⏭️ skipped",
  cancelled: "⛔ cancelled",
};

/** @param {string} text */
export const stripAnsi = (text) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

/**
 * Pull failing test names and the first error lines out of vitest, Playwright, tsc, ESLint and npm output.
 * @param {string} log
 * @returns {{ tests: string[], errors: string[] }}
 */
export function extractFailures(log) {
  const lines = stripAnsi(log).split(/\r?\n/);
  const tests = new Set();
  const errors = [];
  let lastFile = "";
  for (const raw of lines) {
    const line = raw.trimEnd();
    const vitest = /^\s*(?:FAIL|×)\s+(.+?)(?:\s+\d+(?:\.\d+)?\s*m?s)?$/.exec(line);
    const playwright = /^\s*\d+\)\s+(\[[^\]]+\]\s+›.+?)\s*─*$/.exec(line);
    if (vitest) tests.add(vitest[1]);
    else if (playwright) tests.add(playwright[1]);
    if (/^(?:[A-Za-z]:)?[\\/]\S+\.[cm]?[jt]sx?$/.test(line.trim())) lastFile = line.trim();
    if (errors.length >= MAX_ERRORS) continue;
    if (/^\s*\d+:\d+\s+error\s/.test(line)) errors.push(`${lastFile}  ${line.trim()}`);
    else if (
      /error TS\d+:/.test(line) ||
      /^\s*(?:[A-Za-z]*Error|Expected|Received)\b[:\s]/.test(line) ||
      /npm (?:ERR!|error)/.test(line) ||
      /✖ \d+ problems?/.test(line)
    ) {
      errors.push(line.trim());
    }
  }
  // vitest prints each failure twice: "× suite > test" in the tree and "FAIL file > suite > test" below.
  const names = [...tests];
  const unique = names.filter((name) => !names.some((other) => other.endsWith(` > ${name}`)));
  return { tests: unique.slice(0, MAX_TESTS), errors };
}

/** @param {string} text */
const escapeAnnotation = (text) =>
  text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

/**
 * @param {string} title
 * @param {Array<{ label: string, outcome: string, log: string }>} steps
 * @returns {{ markdown: string, annotations: string[] }}
 */
export function summarize(title, steps) {
  const out = [`## ${title}`, "", "| Step | Result |", "|---|---|"];
  const details = [];
  const annotations = [];
  for (const step of steps.filter((s) => s.outcome !== "info")) {
    out.push(
      `| ${step.label} | ${ICONS[/** @type {keyof typeof ICONS} */ (step.outcome)] ?? step.outcome} |`,
    );
    if (step.outcome !== "failure") continue;
    const { tests, errors } = extractFailures(step.log);
    const shown = errors.length || tests.length ? errors : tailLines(step.log, MAX_ERRORS);
    details.push("", `### ❌ ${step.label}`);
    if (tests.length)
      details.push("", "**Failing tests**", "", ...tests.map((name) => `- ${name}`));
    if (shown.length) details.push("", "**First error lines**", "", "```text", ...shown, "```");
    for (const message of (tests.length ? tests : shown).slice(0, 10)) {
      annotations.push(
        `::error title=${escapeAnnotation(step.label)}::${escapeAnnotation(message)}`,
      );
    }
  }
  for (const step of steps.filter((s) => s.outcome === "info")) {
    const text = stripAnsi(step.log).trim();
    details.push(
      "",
      `### ${step.label}`,
      "",
      text ? ["```text", text, "```"].join("\n") : "No changes.",
    );
  }
  return { markdown: [...out, ...details, ""].join("\n"), annotations };
}

/** @param {string} log @param {number} count */
function tailLines(log, count) {
  return stripAnsi(log)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-count);
}

function main() {
  const [title = "CI", ...specs] = process.argv.slice(2);
  const steps = specs.flatMap((spec) => {
    const [label = "", outcome = "", path = ""] = spec.split("::");
    if (outcome === "info" && !existsSync(path)) return [];
    return [{ label, outcome, log: path && existsSync(path) ? readFileSync(path, "utf8") : "" }];
  });
  const { markdown, annotations } = summarize(title, steps);
  for (const annotation of annotations) console.log(annotation);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  else console.log(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
