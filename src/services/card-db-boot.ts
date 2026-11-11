import "../cards/legacy-globals";
import "../engine/legacy-globals";
import { buildLookupIndexes, loadCardDatabase } from "../cards/load-db";
import { loadDataset, updateDataFreshness } from "../data/load-dataset";
import { buildSpellbookIndex } from "../engine/combos";
import type { CommanderTierRecord, SpellbookIndex, SpellbookSnapshot } from "../engine/context";
import { reportError } from "./report-error";

export interface StaticDatasets {
  referenceScores: number[][];
  referenceTiers: string[];
  staplesBaseline: { keys: string[]; baselines: Record<string, Record<string, number>> };
  manabaseBaseline: {
    byIdentity: Record<string, Record<string, number>>;
    byCount: Record<string, Record<string, number>>;
  };
  tags: Record<string, string[]>;
  commanderTiers: CommanderTierRecord[];
}

interface BootPorts {
  progress(message: string, percent: number): void;
  staticDatasets(data: StaticDatasets): void;
  database(
    database: Awaited<ReturnType<typeof loadCardDatabase>>,
    buildIndexes: typeof buildLookupIndexes,
  ): void;
  loadingSpellbook(): void;
  spellbookSource(source: string): void;
  spellbook(index: SpellbookIndex | null): void;
  spellbookError(message: string): void;
  ready(message: string): void;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Timed out during: ${label} (waited ${Math.round(ms / 1000)}s)`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function loadStaticDatasets(publish: BootPorts["staticDatasets"]): Promise<void> {
  const [referenceScores, referenceTiers, staplesBaseline, manabaseBaseline, tags, commanderTiers] =
    await Promise.all([
      loadDataset<StaticDatasets["referenceScores"]>("REFERENCE_SCORES"),
      loadDataset<StaticDatasets["referenceTiers"]>("REFERENCE_TIERS"),
      loadDataset<StaticDatasets["staplesBaseline"]>("STAPLES_BASELINE"),
      loadDataset<StaticDatasets["manabaseBaseline"]>("MANABASE_BASELINE"),
      loadDataset<StaticDatasets["tags"]>("tags"),
      loadDataset<StaticDatasets["commanderTiers"]>("winrates"),
    ]);
  publish({
    referenceScores,
    referenceTiers,
    staplesBaseline,
    manabaseBaseline,
    tags,
    commanderTiers,
  });
  await updateDataFreshness();
}

async function loadSpellbookSnapshot(ports: BootPorts) {
  const source = await loadDataset<string>("SPELLBOOK_SNAPSHOT_B64");
  ports.spellbookSource(source);
  const binaryStr = atob(source);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const [, , buffer] = await Promise.all([
    writer.write(bytes),
    writer.close(),
    // Drain concurrently: a large snapshot can fill the stream's output buffer.
    new Response(ds.readable).arrayBuffer(),
  ]);
  const snap: SpellbookSnapshot = JSON.parse(new TextDecoder().decode(buffer));
  const index = buildSpellbookIndex(snap);
  ports.spellbook(index);
  return index;
}

/** Loads required data first; optional Spellbook failures retain the curated-combo fallback. */
export async function bootCardDatabase(ports: BootPorts): Promise<void> {
  try {
    const [, database] = await Promise.all([
      loadStaticDatasets(ports.staticDatasets),
      loadCardDatabase(ports.progress),
    ]);
    ports.database(database, buildLookupIndexes);
    if (!database.cards?.length) throw new Error("CARD_DB missing or empty after decompression");

    ports.loadingSpellbook();
    let spellbook: SpellbookIndex | null = null;
    try {
      spellbook = await withTimeout(loadSpellbookSnapshot(ports), 15_000, "combo snapshot load");
    } catch (error) {
      ports.spellbook(null);
      ports.spellbookError(error instanceof Error ? error.message : String(error));
    }
    ports.ready(
      `Ready — ${database.cards.length.toLocaleString()} cards${spellbook ? " and " + spellbook.snap.c.length.toLocaleString() + " combos (Spellbook lines that win, warp or loop)" : ""} loaded.` +
        (spellbook
          ? ""
          : " The combo snapshot could not be loaded, so only the built-in combo list is used.") +
        " You can chart decks now.",
    );
  } catch (error) {
    reportError(error, { operation: "card-database" });
    throw error;
  }
}
