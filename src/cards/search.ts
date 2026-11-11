// Ranked card-name search shared by every card picker (Deck Crafter, PriceScry, trades, Impact).
//
// Ranking, best first (each group is then ordered staples-first, then one-word names, then
// shorter names, then alphabetical):
//   0  exact name                     1  name starts with the text
//   2  a later word starts with it    3  text appears inside a name (spaces ignored too)
//   4  every typed word starts some word of the name, in any order ("kraum tymna")
//   5  forgiving: typos, swapped letters, missing letters, a missing space ("swrds to fire")
// Group 5 is only searched when the exact groups did not fill the list.
import type { CardRecord } from "./tuple";

export interface SearchOptions {
  /** Only cards whose colour identity fits inside this commander's. */
  commanderCard?: Pick<CardRecord, "ci"> | null;
  /** In a tie within a group, legendary creatures / commanders come first. */
  preferCommanders?: boolean;
}

/** Cards in at least this many built-in decks count as staples. */
export const STAPLE_MIN_DECKS = 10;

/** iOS "smart punctuation" and friends: fold every apostrophe-like character to a straight one. */
export function normalizeApostrophes(str: string | null | undefined): string {
  return (str || "").replace(/[‘’ʼ´`]/g, "'");
}

/**
 * Names and typed text reduced to one plain form: lower case, accents removed (Lim-Dûl -> lim-dul),
 * apostrophes dropped (Atraxa's -> atraxas), other punctuation turned into spaces.
 */
export function searchNorm(str: unknown): string {
  let t = String(str || "").toLowerCase();
  try {
    t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    /* very old browser: accents stay */
  }
  t = t
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d");
  t = t.replace(/[‘’ʼ´`']/g, "");
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Commander's subset rule; no commander means nothing to flag against. */
export function cardFitsCommanderIdentity(
  card: Pick<CardRecord, "ci">,
  commanderCard: Pick<CardRecord, "ci"> | null | undefined,
): boolean {
  if (!commanderCard) return true;
  const colors = new Set((commanderCard.ci || "").split(""));
  return (card.ci || "").split("").every((c) => colors.has(c));
}

// Edit distance that counts a swapped pair of letters as ONE slip (blot -> bolt). Rows are reused
// because this runs over tens of thousands of names while typing.
const rowA = new Int32Array(96),
  rowB = new Int32Array(96),
  rowC = new Int32Array(96);
function searchDist(a: string, b: string, cap: number): number {
  const la = a.length,
    lb = b.length;
  if (Math.abs(la - lb) > cap || la > 90 || lb > 90) return cap + 1;
  let prev2 = rowA,
    prev = rowB,
    cur = rowC;
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      let v = prev[j - 1] + (ca === cb ? 0 : 1);
      const del = prev[j] + 1;
      if (del < v) v = del;
      const ins = cur[j - 1] + 1;
      if (ins < v) v = ins;
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        const tr = prev2[j - 2] + 1;
        if (tr < v) v = tr;
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return prev[lb];
}

/** How many slips are forgiven for a typed word of this length. */
const tolerance = (len: number) => (len <= 3 ? 0 : len <= 7 ? 1 : 2);

/** Which letters/digits a string uses, as a bit mask: a cheap "could this possibly match?" test. */
function searchMask(str: string): number {
  let m = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    m |= c >= 97 && c <= 122 ? 1 << (c - 97) : c >= 48 && c <= 57 ? 1 << (26 + ((c - 48) % 6)) : 0;
  }
  return m;
}

function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** A typed word compared with the START of a name word, since people type the beginning of names. */
function prefixDist(qt: string, nt: string, cap: number, qMask: number, ntMask: number): number {
  if (nt.startsWith(qt)) return 0;
  if (popcount(qMask & ~ntMask) > cap) return cap + 1;
  if (nt.length < qt.length - cap) return cap + 1;
  let best = cap + 1;
  for (let k = -1; k <= 1; k++) {
    const len = qt.length + k;
    if (len < 1) continue;
    const d = searchDist(qt, nt.slice(0, len), cap);
    if (d < best) best = d;
  }
  return best;
}

interface IndexEntry {
  card: CardRecord;
  nameLower: string;
  norm: string;
  compact: string;
  tokens: string[];
  cmask: number;
  masks: number[];
}

const indexes = new WeakMap<readonly CardRecord[], { size: number; entries: IndexEntry[] }>();
function searchIndex(db: readonly CardRecord[]): IndexEntry[] {
  const cached = indexes.get(db);
  if (cached && cached.size === db.length) return cached.entries;
  const entries: IndexEntry[] = [];
  const seen = new Set<string>();
  for (const card of db) {
    const nameLower = normalizeApostrophes(card.n.toLowerCase());
    if (seen.has(nameLower)) continue;
    seen.add(nameLower);
    const norm = searchNorm(card.n);
    const tokens = norm.split(" "),
      compact = norm.replace(/ /g, "");
    entries.push({
      card,
      nameLower,
      norm,
      compact,
      tokens,
      cmask: searchMask(compact),
      masks: tokens.map(searchMask),
    });
  }
  indexes.set(db, { size: db.length, entries });
  return entries;
}

const popularities = new WeakMap<readonly object[], Map<string, number>>();
/**
 * How many built-in decks (Try-a-Deck precons and curated lists) each card appears in: a light
 * "is this a staple?" nudge. Built once per library.
 */
export function cardPopularity(
  decks: readonly { decklist?: string | null }[],
): Map<string, number> {
  const cached = popularities.get(decks);
  if (cached) return cached;
  const counts = new Map<string, number>();
  for (const deck of decks) {
    const inThisDeck = new Set<string>();
    for (const line of String(deck.decklist || "").split("\n")) {
      const m = line.match(/^\s*\d+x?\s+(.+?)\s*$/);
      if (m) inThisDeck.add(normalizeApostrophes(m[1].toLowerCase()));
    }
    for (const name of inThisDeck) counts.set(name, (counts.get(name) || 0) + 1);
  }
  popularities.set(decks, counts);
  return counts;
}

interface Hit {
  card: CardRecord;
  tier: number;
  dist: number;
  pop: number;
  staple: number;
  cmdr: number;
  oneWord: number;
  len: number;
  nameLower: string;
}

export function searchCards(
  db: readonly CardRecord[],
  popularity: ReadonlyMap<string, number>,
  query: string,
  limit = 5,
  opts?: SearchOptions | null,
): CardRecord[] {
  limit = limit || 5;
  const q = searchNorm(query);
  if (q.length < 2) return [];
  const commanderCard = opts && opts.commanderCard ? opts.commanderCard : null;
  const preferCmdr = !!(opts && opts.preferCommanders);
  const qc = q.replace(/ /g, "");
  const qTokens = q.split(" ");
  const idx = searchIndex(db);
  const hits: Hit[] = [];
  const mk = (e: IndexEntry, tier: number, dist = 0): Hit => {
    const pop = popularity.get(e.nameLower) || 0;
    const t = String(e.card.t || "");
    return {
      card: e.card,
      tier,
      dist,
      pop,
      staple: pop >= STAPLE_MIN_DECKS ? 0 : 1,
      cmdr: preferCmdr && /Legendary/.test(t) && /Creature|Planeswalker|Background/.test(t) ? 0 : 1,
      oneWord: e.tokens.length === 1 ? 0 : 1,
      len: e.norm.length,
      nameLower: e.nameLower,
    };
  };
  const have = new Set<string>();
  for (const e of idx) {
    if (commanderCard && !cardFitsCommanderIdentity(e.card, commanderCard)) continue;
    let tier = -1;
    if (e.norm === q || e.compact === qc) tier = 0;
    else if (e.norm.startsWith(q) || e.compact.startsWith(qc)) tier = 1;
    else {
      const at = e.norm.indexOf(q);
      if (at > 0 && e.norm.charAt(at - 1) === " ") tier = 2;
      else if (at > 0 || e.compact.indexOf(qc) !== -1) tier = 3;
      else if (
        qTokens.length > 1 &&
        qTokens.every((qt) => e.tokens.some((nt) => nt.startsWith(qt)))
      )
        tier = 4;
    }
    if (tier >= 0) {
      hits.push(mk(e, tier));
      have.add(e.nameLower);
    }
  }
  if (hits.length < limit && qc.length >= 4 && qc.length <= 60) {
    const tolWhole = tolerance(qc.length);
    const qcMask = searchMask(qc);
    const qtMasks = new Map(qTokens.map((qt) => [qt, searchMask(qt)]));
    for (const e of idx) {
      if (have.has(e.nameLower)) continue;
      if (commanderCard && !cardFitsCommanderIdentity(e.card, commanderCard)) continue;
      let best = 99;
      // the whole typed text against the start of the whole name (covers a missing/extra space)
      if (tolWhole) {
        const d = prefixDist(qc, e.compact, tolWhole, qcMask, e.cmask);
        if (d <= tolWhole) best = d;
      }
      // every typed word against some word of the name
      if (best > 0 && (qTokens.length > 1 || best === 99)) {
        let total = 0,
          ok = true;
        const used = new Set<number>();
        for (const qt of qTokens) {
          const tol = tolerance(qt.length);
          let bd = 99,
            bi = -1;
          for (let i = 0; i < e.tokens.length; i++) {
            if (used.has(i)) continue;
            const d = prefixDist(qt, e.tokens[i], tol, qtMasks.get(qt)!, e.masks[i]);
            if (d < bd) {
              bd = d;
              bi = i;
              if (d === 0) break;
            }
          }
          if (bd > tol) {
            ok = false;
            break;
          }
          used.add(bi);
          total += bd;
        }
        if (ok && total < best) best = total;
      }
      if (best < 99) hits.push(mk(e, 5, best));
    }
  }
  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.dist - b.dist ||
      a.cmdr - b.cmdr ||
      a.staple - b.staple ||
      (a.staple === 0 && b.staple === 0 ? b.pop - a.pop : 0) ||
      a.oneWord - b.oneWord ||
      a.len - b.len ||
      (a.nameLower < b.nameLower ? -1 : a.nameLower > b.nameLower ? 1 : 0),
  );
  return hits.slice(0, limit).map((h) => h.card);
}
