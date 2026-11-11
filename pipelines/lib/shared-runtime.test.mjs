import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The workflows run the pipelines with plain `node` (no npm install, no build step), and the pipelines import
// src/shared/*.ts. Vitest would transpile those files itself, so this runs a real Node child process: it fails
// if src/shared uses TypeScript that Node's built-in type stripping cannot erase (enums, namespaces, parameter
// properties, extensionless relative imports) or if the Node version cannot strip types at all.
const script = `
  const lib = await import("./pipelines/lib/pricescry-lib.mjs");
  const { planTrade } = await import("./pipelines/pricescry/pricescry-study.mjs");
  const { build } = await import("./pipelines/card-db/build-card-db.mjs");
  console.log(JSON.stringify({
    shard: lib.shardFile(lib.shardOf(lib.nameKey("Sol Ring"))),
    day: lib.dayIndex("2026-11-10"),
    verdict: planTrade({ priceYen: 1000, refYen: 1000, pHit: 0.6 }).verdict,
    builder: typeof build,
  }));
`;

describe("pipelines importing src/shared under plain Node", () => {
  it("loads and runs the shared TypeScript", () => {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    expect(JSON.parse(out.trim().split("\n").pop())).toEqual({
      shard: "cards/485.json.gz",
      day: 2505,
      verdict: "buy",
      builder: "function",
    });
  });
});
