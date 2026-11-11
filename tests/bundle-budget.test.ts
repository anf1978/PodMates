import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";

it("gates inline code and boot data, and rejects missing datasets", () => {
  const root = mkdtempSync(join(tmpdir(), "podmates-budget-"));
  const run = () =>
    execFileSync(process.execPath, [resolve("scripts", "bundle-budget.mjs"), root], {
      encoding: "utf8",
      stdio: "pipe",
    });
  try {
    mkdirSync(join(root, "data"));
    for (const name of [
      "manifest",
      "cards",
      "tags",
      "winrates",
      "SPELLBOOK_SNAPSHOT_B64",
      "REFERENCE_SCORES",
      "REFERENCE_TIERS",
      "STAPLES_BASELINE",
      "MANABASE_BASELINE",
    ]) {
      writeFileSync(join(root, "data", `${name}.json`), "{}");
    }
    writeFileSync(join(root, "index.html"), "<script>boot()</script>");
    expect(run()).toContain("boot data:");
    writeFileSync(join(root, "index.html"), randomBytes(800_000));
    expect(run).toThrow("Bundle budget exceeded");
    writeFileSync(join(root, "index.html"), "<script>boot()</script>");
    writeFileSync(join(root, "data", "cards.json"), randomBytes(3_500_000));
    expect(run).toThrow("Bundle budget exceeded");
    rmSync(join(root, "data", "cards.json"));
    expect(run).toThrow("ENOENT");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
