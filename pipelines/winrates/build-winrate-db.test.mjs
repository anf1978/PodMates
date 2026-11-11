import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, commanderRow } from "./build-winrate-db.mjs";
import { validateDataset } from "../lib/dataset-files.mjs";

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

it("writes ranked commander rows, retaining qualification thresholds and tier boundaries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "podmates-winrate-builder-"));
  directories.push(directory);
  const output = join(directory, "winrates.json");
  const rates = [35, 30, 23, 18, 17.9];
  const fetchCommander = vi.fn(async (id) =>
    id <= 500
      ? {
          name: `Commander ${id}`,
          global_rank: 501 - id,
          stats: { games_count: 250, decks_count: 10, win_rate: rates[(id - 1) % rates.length] },
        }
      : id === 501
        ? {
            name: "Too few games",
            global_rank: 501,
            stats: { games_count: 249, decks_count: 10, win_rate: 50 },
          }
        : null,
  );
  const sleep = vi.fn(async () => {});
  const stats = await build(output, { fetchCommander, sleep });
  const rows = JSON.parse(readFileSync(output, "utf8"));
  expect(stats).toEqual({ count: 500, highestIdChecked: 801 });
  expect(rows).toHaveLength(500);
  expect(rows[0]).toEqual({ n: "Commander 500", t: "D", w: 17.9, g: 250, r: 1 });
  expect(rows.slice(-5).map((row) => row.t)).toEqual(["D", "C", "B", "A", "S"]);
  expect(() => validateDataset("winrates", rows)).not.toThrow();
  expect(sleep).toHaveBeenCalledWith(240);
});

it("excludes unqualified records but rejects malformed qualifying statistics", () => {
  expect(
    commanderRow({
      name: "Few decks",
      global_rank: 1,
      stats: { games_count: 250, decks_count: 9 },
    }),
  ).toBeNull();
  expect(commanderRow({ name: "No statistics", global_rank: 1 })).toBeNull();
  expect(() =>
    commanderRow({
      name: "Broken",
      global_rank: 1,
      stats: { games_count: 250, decks_count: 10, win_rate: 101 },
    }),
  ).toThrow(/Malformed/);
});
