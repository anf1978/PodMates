import { HARD_COMBOS } from "../data/combos.ts";
import { ixUsable } from "./legality.ts";
import type { CardRecord } from "../cards/tuple.ts";
import type { EngineContext, SpellbookIndex, SpellbookRow, SpellbookSnapshot } from "./context.ts";
import type { CuratedCombo, NearMissGroup, NearMissLine } from "./types.ts";

export function comboSlotsMatch(namesInDeck: ReadonlySet<string>, combo: CuratedCombo): boolean {
  for (const slot of combo.s) {
    if (!slot.some((name) => namesInDeck.has(name))) return false;
  }
  return true;
}

// ---- Commander Spellbook offline snapshot ---------------------------------
// A compact copy of Commander Spellbook's combos that WIN or WARP a game, embedded in the page
// (see the "combo-data-script" block and .github/scripts/spellbook-snapshot.mjs). The app sets
// ctx.spellbook at startup; with it null (a failed decode) analyzeDeck simply
// finds only the curated HARD_COMBOS. Snapshot combo = [cardIdx[], code, outcomeIdx, popLog] where
// code = class (2 win, 1 warp) + 4 if infinite.
export const SPELLBOOK_MAX_COMBOS = 6; // best lines fed into the scores; the rest are only counted

export function buildSpellbookIndex(snap: SpellbookSnapshot): SpellbookIndex {
  const byCard: (number[] | undefined)[] = new Array(snap.n.length);
  snap.c.forEach((r, i) => {
    r[0].forEach((ci) => {
      (byCard[ci] || (byCard[ci] = [])).push(i);
    });
  });
  const nameIdx = new Map(snap.n.map((n, i) => [n, i]));
  return { snap, nameIdx, byCard };
}

/** Every snapshot combo whose cards are ALL in the deck (names already exclude banned cards). */
export function matchSpellbookCombos(
  ctx: EngineContext,
  namesInDeck: ReadonlySet<string>,
): SpellbookRow[] {
  if (!ctx.spellbook) return [];
  const { snap, nameIdx, byCard } = ctx.spellbook;
  const hits = new Map();
  namesInDeck.forEach((name) => {
    const ci = nameIdx.get(name);
    if (ci === undefined || !byCard[ci]) return;
    for (const k of byCard[ci]) hits.set(k, (hits.get(k) || 0) + 1);
  });
  const out: SpellbookRow[] = [];
  hits.forEach((cnt, k) => {
    const r = snap.c[k] as SpellbookRow;
    if (cnt === r[0].length) out.push(r);
  });
  return out;
}

// ---- "One card away" combos (display only: never feeds a score) ------------
// For every combo (curated or Spellbook) where the deck holds all the pieces but ONE, group by that
// missing card, so the user sees "add X and you complete N lines". The missing card must be usable in
// Commander, inside the commander's colours and not already in the deck.
export function comboCardByName(ctx: EngineContext, n: string): CardRecord | undefined {
  return ctx.cardByName(n);
}

export function comboNearMisses(
  ctx: EngineContext,
  namesInDeck: ReadonlySet<string>,
  commanders: readonly string[] | null | undefined,
  identity: ReadonlySet<string> | null,
): NearMissGroup[] {
  type Group = { missing: string; mv: number; lines: NearMissLine[]; best: number };
  const groups = new Map<string, Group>();
  const okMissing = (name: string) => {
    if (namesInDeck.has(name)) return false;
    const c = comboCardByName(ctx, name);
    if (!c) return false;
    if (!ixUsable(c)) return false;
    return (
      !identity ||
      String(c.ci || "")
        .split("")
        .every((x) => identity.has(x))
    );
  };
  const add = (missing: string, line: NearMissLine) => {
    let g = groups.get(missing);
    if (!g) {
      const c = comboCardByName(ctx, missing);
      g = { missing, mv: c ? c.m || 0 : 0, lines: [], best: -1e9 };
      groups.set(missing, g);
    }
    g.lines.push(line);
    if (line.rank > g.best) g.best = line.rank;
  };
  if (ctx.spellbook) {
    const { snap, nameIdx, byCard } = ctx.spellbook;
    const hits = new Map();
    namesInDeck.forEach((name) => {
      const ci = nameIdx.get(name);
      if (ci === undefined || !byCard[ci]) return;
      for (const k of byCard[ci]) hits.set(k, (hits.get(k) || 0) + 1);
    });
    const completeKeys = new Set<string>(),
      near: SpellbookRow[] = [];
    hits.forEach((cnt, k) => {
      const r = snap.c[k] as SpellbookRow,
        len = r[0].length;
      if ((r[1] & 3) === 0) return; // two-card value loops are for the Bracket rule only
      if (cnt === len)
        completeKeys.add(
          r[0]
            .slice()
            .sort((a, b) => a - b)
            .join(","),
        );
      else if (cnt === len - 1) near.push(r);
    });
    for (const r of near) {
      const held = r[0].filter((i) => namesInDeck.has(snap.n[i])).sort((a, b) => a - b);
      const missIdx = r[0].find((i) => !namesInDeck.has(snap.n[i]));
      const missing = snap.n[missIdx as number] as string;
      if (!okMissing(missing)) continue;
      // skip a row that only extends a combo the deck already has complete
      let ext = false;
      const m = held.length;
      for (let mask = 1; mask < 1 << m && !ext; mask++) {
        let c = 0;
        const key: number[] = [];
        for (let b = 0; b < m; b++)
          if (mask & (1 << b)) {
            c++;
            key.push(held[b]);
          }
        if (c >= 2 && completeKeys.has(key.join(","))) ext = true;
      }
      if (ext) continue;
      const cls = r[1] & 3,
        inf = (r[1] & 4) !== 0,
        heldNames = held.map((i) => snap.n[i] as string);
      const cmdr = heldNames.some((n) => (commanders || []).includes(n));
      add(missing, {
        held: heldNames,
        outcome: snap.o[r[2]] || null,
        win: cls === 2,
        inf,
        len: r[0].length,
        cmdr,
        source: "spellbook",
        rank:
          cls * 100 -
          r[0].length * 12 +
          (heldNames.length >= 2 ? 20 : 0) +
          (cmdr ? 15 : 0) +
          r[3] * 0.5 +
          (inf ? 4 : 0),
      });
    }
  }
  for (const combo of HARD_COMBOS) {
    if (combo.s.length < 2) continue;
    const unmatched = combo.s.filter((slot) => !slot.some((n) => namesInDeck.has(n)));
    if (unmatched.length !== 1) continue;
    const held = combo.s
      .filter((slot) => slot.some((n) => namesInDeck.has(n)))
      .map((slot) => slot.find((n) => namesInDeck.has(n)) as string);
    const cmdr = held.some((n) => (commanders || []).includes(n));
    const inf = combo.t === "infinite_combo";
    for (const alt of unmatched[0]) {
      if (!okMissing(alt)) continue;
      add(alt, {
        held,
        outcome: combo.o || null,
        win: true,
        inf,
        len: combo.s.length,
        cmdr,
        source: "curated",
        rank:
          200 -
          combo.s.length * 12 +
          (held.length >= 2 ? 20 : 0) +
          (cmdr ? 15 : 0) +
          40 +
          (inf ? 4 : 0),
      });
    }
  }
  const out: NearMissGroup[] = [];
  groups.forEach((g) => {
    g.lines.sort((a, b) => b.rank - a.rank);
    const keep: NearMissLine[] = [];
    for (const l of g.lines) {
      if (keep.length >= 3) break;
      if (
        keep.some(
          (k) =>
            (k.held.length === l.held.length && l.held.every((n) => k.held.includes(n))) ||
            (k.outcome === l.outcome &&
              l.held.filter((n) => k.held.includes(n)).length >=
                Math.min(l.held.length, k.held.length)),
        )
      )
        continue;
      keep.push(l);
    }
    out.push({ missing: g.missing, mv: g.mv, count: g.lines.length, lines: keep, best: g.best });
  });
  out.sort((a, b) => b.best - a.best);
  // a single held card should not fill the list: at most 2 groups per lone held card
  const lone = new Map<string, number>(),
    res: NearMissGroup[] = [];
  for (const g of out) {
    const key = g.lines[0].held.length === 1 ? g.lines[0].held[0] : null;
    if (key) {
      const n = lone.get(key) || 0;
      if (n >= 2) continue;
      lone.set(key, n + 1);
    }
    res.push(g);
  }
  return res.slice(0, 8);
}

export function describeCombo(combo: CuratedCombo): string {
  if (combo.o) {
    const cardList = combo.s.map((slot) => slot.join(" / ")).join(" + ");
    return `${cardList} (${combo.o})`;
  }
  return combo.s.map((slot) => slot.join(" / ")).join(" + ");
}
