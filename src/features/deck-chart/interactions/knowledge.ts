// Card knowledge from ranked community lists (KNOW_JSON): sort bonuses, best-of themes the
// deck leans on, and thin spots in core jobs. Display only. Moved unchanged from index.html.

import type { CardRecord } from "../../../cards/tuple.ts";
import { ixFaceText } from "./text.ts";
import type {
  IxPick,
  IxRoleCounts,
  IxSuggestion,
  KnowCard,
  KnowEntry,
  Knowledge,
} from "./types.ts";

function knowLabel(k: Knowledge, i: number): string {
  const id = (k.json.lists[i] || [""])[0];
  return id
    .replace(/^best-/, "")
    .replace(/-/g, " ")
    .replace(/ cards$/, "");
}

export function knowCard(k: Knowledge, name: string): KnowCard | null {
  return k.byName.get(String(name || "").toLowerCase()) || null;
}

/** Lists that rank cards for a purpose count in full; all-format colour lists, budget lists and precon upgrade guides only add to consensus. */
function knowStrong(k: Knowledge, e: KnowEntry): boolean {
  return !e[2] && ["role", "theme", "enabler"].indexOf(k.json.lists[e[0]]![3]) >= 0;
}

/** Sort bonus: only cards ranked in the top ~40% of a list (score 2 or more) are lifted; everything else keeps mana-value order. */
export function knowQ(k: Knowledge, name: string): number {
  const c = knowCard(k, name);
  if (!c) return 0;
  const s = c[1].reduce((m, e) => (knowStrong(k, e) ? Math.max(m, e[1]) : m), 0);
  return s >= 2 ? s + Math.min(c[1].filter((e) => !e[2]).length - 1, 3) * 0.25 : 0;
}

/** The "★ top-rated" note beside a suggested card, or null. */
export function knowBadge(k: Knowledge, name: string): { reason: string; text: string } | null {
  const c = knowCard(k, name);
  if (!c) return null;
  const top = c[1].filter((e) => e[1] >= 3 && knowStrong(k, e)).map((e) => knowLabel(k, e[0]));
  if (!top.length) return null;
  return { reason: c[2] || "", text: "★ top-rated: " + top.slice(0, 2).join(", ") };
}

/** Best-of lists (themes) the deck already leans on, with the top-ranked cards it is missing. Display only. */
export function knowThemeSuggestions(
  k: Knowledge,
  matched: ReadonlyArray<{ card: CardRecord }>,
  pool: readonly CardRecord[],
): IxSuggestion[] {
  const out: IxSuggestion[] = [];
  try {
    const lists = k.json.lists;
    const have = new Map<number, number>();
    for (const m of matched) {
      const c = knowCard(k, m.card.n);
      if (!c) continue;
      for (const e of c[1])
        if (!e[2] && lists[e[0]]![3] === "theme") have.set(e[0], (have.get(e[0]) || 0) + 1);
    }
    const poolMap = new Map(pool.map((c) => [String(c.n).toLowerCase(), c]));
    const ranked = Array.from(have.entries())
      .filter(([i, n]) => n >= Math.max(5, lists[i]![1] * 0.1))
      .sort((a, b) => b[1] / lists[b[0]]![1] - a[1] / lists[a[0]]![1]);
    // The broad 'commander staples' list fits every deck and is well known, so it is never shown.
    const isStaples = (i: number): boolean => /commander-staples/.test(lists[i]![0]);
    const pick = ranked.filter((r) => !isStaples(r[0])).slice(0, 2);
    for (const [i, n] of pick) {
      const cand: IxPick[] = [];
      for (const name in k.json.cards) {
        const kc = k.json.cards[name]!,
          e = kc[1].find((x) => x[0] === i && !x[2]);
        if (!e || e[1] < 2) continue;
        const c = poolMap.get(name.toLowerCase());
        if (!c) continue;
        cand.push({
          n: c.n,
          m: c.m || 0,
          r: e[3] || 99,
          why: kc[3] === i && kc[2] ? kc[2] : "ranked #" + (e[3] || "?") + " on its best-of list",
          g: c.g,
        });
      }
      if (!cand.length) continue;
      cand.sort((a, b) => a.r! - b.r! || a.m - b.m);
      out.push({
        title: knowLabel(k, i).replace(/^./, (s) => s.toUpperCase()),
        sub: "you already run " + n + " of the " + lists[i]![1] + " best",
        groups: [{ label: "Top cards you are missing", list: cand.slice(0, 6) }],
      });
    }
  } catch {
    // display only: a malformed list never breaks the sheet
  }
  return out;
}

/** Core jobs a deck is light on, using floors just below what the great majority of the 159 precon decks run. Display only. */
const IX_THIN_FLOORS = [
  { key: "removal", label: "Removal", floor: 4, lists: ["best-spot-removal"] },
  { key: "ramp", label: "Ramp", floor: 8, lists: ["best-mana-rocks", "best-mana-dorks"] },
  { key: "draw", label: "Card draw", floor: 8, lists: ["best-card-draw"] },
] as const;

export interface ThinSpot {
  key: (typeof IX_THIN_FLOORS)[number]["key"];
  label: string;
  floor: number;
  lists: readonly string[];
  have: number;
}

export function ixThinSpots(roles: IxRoleCounts | null | undefined): ThinSpot[] {
  if (!roles) return [];
  return IX_THIN_FLOORS.filter(
    (r) => typeof roles[r.key] === "number" && roles[r.key]! < r.floor,
  ).map((r) => ({
    key: r.key,
    label: r.label,
    floor: r.floor,
    lists: r.lists,
    have: roles[r.key]!,
  }));
}

// A thin-spot suggestion must really do the job for an ordinary deck: removal that hits a
// creature or other permanent, ramp that works without conditions, draw that adds cards.
function ixThinFits(key: string, c: CardRecord): boolean {
  const t = ixFaceText(c);
  if (key === "removal")
    return /\b(?:destroy|exile) (?:up to \w+ )?(?:target|another target|each|all) (?:attacking |nonland |nonblack |nonartifact |tapped |nontoken |opponent's )?(?:creature|permanent|planeswalker)|deals? (?:\d+|x) damage to (?:any target|target creature)|target creature gets -|return target (?:nonland )?(?:creature|permanent)[^.]* to its owner's hand|put target creature[^.]*(?:on top of|into) its owner's library/.test(
      t,
    );
  if (key === "ramp")
    return !/tap an untapped|doesn't untap|\bimprint\b|spend this mana only|only to cast|sacrifice (?:this|~)[^.]*add/.test(
      t,
    );
  // conditional engines and one-for-one cantrips do not fix a card-draw gap
  if (key === "draw")
    return (
      !/draw a card at the beginning of the next|draw a card unless|put [^.]*on top of (?:its owner's|your) library|whenever you cast (?:a |an )?(?:creature |noncreature )?spell|whenever one or more tokens|sacrifice (?:a|another) creature:/.test(
        t,
      ) && !((c.m || 0) <= 1 && /instant|sorcery/i.test(String(c.t)))
    );
  return true;
}

export function ixThinSuggestions(
  k: Knowledge,
  roles: IxRoleCounts | null | undefined,
  pool: readonly CardRecord[],
): IxSuggestion[] {
  const out: IxSuggestion[] = [];
  try {
    const lists = k.json.lists;
    const poolMap = new Map(pool.map((c) => [String(c.n).toLowerCase(), c]));
    for (const th of ixThinSpots(roles)) {
      const idxs = th.lists.map((id) => lists.findIndex((l) => l[0] === id)).filter((i) => i >= 0);
      if (!idxs.length) continue;
      const cand: IxPick[] = [];
      for (const name in k.json.cards) {
        const kc = k.json.cards[name]!;
        let best: { p: number; e: KnowEntry } | null = null;
        for (const e of kc[1])
          if (idxs.indexOf(e[0]) >= 0 && !e[2] && e[1] >= 2) {
            const p = (e[3] || 99) / (lists[e[0]]![1] || 1);
            if (!best || p < best.p) best = { p, e };
          }
        if (!best) continue;
        const c = poolMap.get(name.toLowerCase());
        if (!c) continue;
        if (!ixThinFits(th.key, c)) continue;
        cand.push({
          n: c.n,
          m: c.m || 0,
          p: best.p,
          why:
            kc[3] === best.e[0] && kc[2]
              ? kc[2]
              : "ranked #" + (best.e[3] || "?") + " on its best-of list",
          g: c.g,
        });
      }
      if (!cand.length) continue;
      cand.sort((a, b) => a.p! - b.p! || a.m - b.m);
      out.push({
        tag: "Thin spot",
        title: th.label + " is light",
        sub: "you run " + th.have + "; most Commander decks run " + th.floor + " or more",
        groups: [{ label: "Top-ranked options for your colours", list: cand.slice(0, 5) }],
      });
    }
  } catch {
    // display only
  }
  return out;
}
