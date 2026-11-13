// Firestore serves single-field queries from its automatic indexes, but a query that filters or
// sorts on two different fields (or any collection-group query) needs an index created in the
// Firebase console. The emulator does not enforce indexes, so such a query would pass every test
// here and then fail on the live site with "The query requires an index". This test keeps the
// app's queries inside what the production project has: the default automatic single-field
// indexes, no exemptions and no composite indexes (console, 2026-11-13; firebase/coverage.md).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cloudDir = new URL("../src/services/cloud/", import.meta.url);

function sourceFiles(dir: URL): { name: string; text: string }[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({ name, text: readFileSync(join(dir.pathname, name), "utf8") }));
}

/** Every `query(...)` call's argument text, with balanced parentheses. */
function queryCalls(text: string): string[] {
  const calls: string[] = [];
  const re = /\bquery\(/g;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
    }
    calls.push(text.slice(match.index + match[0].length, i - 1));
  }
  return calls;
}

/** The distinct fields a query filters or sorts on. */
function queryFields(call: string): string[] {
  const fields = [...call.matchAll(/\b(?:where|orderBy)\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (m) => m[1] as string,
  );
  return [...new Set(fields)];
}

describe("Firestore queries stay within automatic single-field indexes", () => {
  const files = sourceFiles(cloudDir);
  const indexes = JSON.parse(
    readFileSync(new URL("../firebase/firestore.indexes.json", import.meta.url), "utf8"),
  ) as { indexes: unknown[] };

  it("finds the cloud repositories' queries", () => {
    const calls = files.flatMap((f) => queryCalls(f.text));
    expect(calls.length).toBeGreaterThanOrEqual(5);
  });

  it("uses no collection-group queries", () => {
    for (const f of files) expect(f.text, f.name).not.toMatch(/\bcollectionGroup\(/);
  });

  it("filters and sorts each query on one field at most", () => {
    // A failure here means the new query needs a composite index. Create it in the Firebase
    // console (Firestore Database -> Indexes -> Composite) BEFORE the change ships, add it to
    // firebase/firestore.indexes.json, and then relax this check for that query.
    for (const f of files) {
      for (const call of queryCalls(f.text)) {
        expect(queryFields(call).length, `${f.name}: query(${call})`).toBeLessThanOrEqual(1);
      }
    }
    expect(indexes.indexes).toEqual([]);
  });

  it("detects a two-field query (self-check of the parser)", () => {
    const [call] = queryCalls(
      'query(col(db, "x"), where("a", "==", f(1)), orderBy("b", "desc"), limit(3))',
    );
    expect(queryFields(call as string)).toEqual(["a", "b"]);
  });
});
