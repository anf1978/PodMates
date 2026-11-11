// Name normalisation, the card-name indexes and every way a typed name is resolved
// to a card: exact, split-card, front/back face and a bounded Levenshtein fallback.
// Pure lookup over decoded card records -- no DOM, no network, no scoring.

import type { CardRecord } from "./tuple.ts";
import type { DeckEntry } from "./parse-decklist.ts";

export type LookupProgress = (message: string, percent: number) => void;

export interface LookupIndexes {
  byExactName: Map<string, CardRecord>;
  byFrontFaceName: Map<string, CardRecord>;
  byBackFaceName: Map<string, CardRecord>;
}

export type MatchType = "exact" | "dfc-front-face" | "dfc-back-face" | "fuzzy";

export interface CardMatch {
  card: CardRecord;
  matchType: MatchType;
  distance?: number;
}

export interface MatchedCard {
  qty: number;
  card: CardRecord;
  originalName: string;
}

export interface MatchedDecklist {
  matched: MatchedCard[];
  notFound: string[];
  fuzzyMatches: { typed: string; matched: string }[];
}

/** The index key for a card name: lookups are case-insensitive, nothing else changes. */
export const normalizeName = (name: string): string => name.toLowerCase();

/** "Fire / Ice" and "Fire/Ice" are how other deckbuilders write Scryfall's "Fire // Ice". */
export const normalizeSplitName = (name: string): string =>
  normalizeName(name)
    .replace(/\s*\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim();

export function buildLookupIndexes(
  db: CardRecord[],
  report: LookupProgress = () => {},
): LookupIndexes {
  const byExactName = new Map<string, CardRecord>();
  const byFrontFaceName = new Map<string, CardRecord>();
  const byBackFaceName = new Map<string, CardRecord>();
  for (const [i, card] of db.entries()) {
    if (i % 1024 === 0) report("Building lookup indexes...", 85 + (i / db.length) * 10);
    byExactName.set(normalizeName(card.n), card);
    if (card.n.includes(" // ")) {
      const [frontRaw, backRaw] = card.n.split(" // ");
      const front = normalizeName(frontRaw.trim());
      const back = normalizeName((backRaw || "").trim());
      if (!byFrontFaceName.has(front)) byFrontFaceName.set(front, card);
      if (back && !byBackFaceName.has(back)) byBackFaceName.set(back, card);
    }
  }
  return { byExactName, byFrontFaceName, byBackFaceName };
}

// Levenshtein distance for fuzzy fallback matching (typo tolerance)
export function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function fuzzyFindCard(
  name: string,
  db: CardRecord[],
  indexes: LookupIndexes,
): CardMatch | null {
  const lower = normalizeName(name);

  // 1. Exact match
  const exact = indexes.byExactName.get(lower);
  if (exact) {
    return { card: exact, matchType: "exact" };
  }

  // 1.5. Split-card single-slash normalization: other deckbuilders commonly
  // export split/fuse cards as "Fire / Ice" or "Fire/Ice" rather than
  // Scryfall's own "Fire // Ice" convention. Normalize and retry the exact
  // lookup before falling through to front/back-face or fuzzy matching.
  if (lower.includes("/")) {
    const normalized = indexes.byExactName.get(normalizeSplitName(name));
    if (normalized) {
      return { card: normalized, matchType: "exact" };
    }
  }

  // 2. Front-face match (double-faced/split cards pasted by their front name only)
  const front = indexes.byFrontFaceName.get(lower);
  if (front) {
    return { card: front, matchType: "dfc-front-face" };
  }

  // 2.5. Back-face match -- typing just the second half of a split card
  // (e.g. "Dawn" for "Dusk // Dawn") would otherwise fall through to fuzzy
  // matching and can silently resolve to an unrelated card with a similar
  // name (e.g. "Damn"). Check this before fuzzy matching, not after.
  const back = indexes.byBackFaceName?.get(lower);
  if (back) {
    return { card: back, matchType: "dfc-back-face" };
  }

  // 3. Fuzzy fallback: only attempt for reasonably short names (perf) and only
  // accept close matches (distance <= 2, or <= 3 for longer names) to avoid
  // wildly wrong substitutions
  if (lower.length > 3) {
    let best: CardRecord | null = null;
    let bestDist = Infinity;
    const maxAllowedDist = lower.length > 12 ? 3 : 2;

    for (const card of db) {
      const candidateName = normalizeName(card.n.split(" // ")[0]);
      // Quick length-based pre-filter to skip obviously-mismatched candidates
      if (Math.abs(candidateName.length - lower.length) > maxAllowedDist) continue;
      const dist = levenshtein(lower, candidateName);
      if (dist < bestDist) {
        bestDist = dist;
        best = card;
      }
      if (bestDist === 0) break;
    }

    if (best && bestDist <= maxAllowedDist) {
      return { card: best, matchType: "fuzzy", distance: bestDist };
    }
  }

  return null;
}

/** The card a typed name resolves to, however it was matched, or null. */
export function getCard(name: string, db: CardRecord[], indexes: LookupIndexes): CardRecord | null {
  return fuzzyFindCard(name, db, indexes)?.card ?? null;
}

export function matchDecklist(
  entries: DeckEntry[],
  db: CardRecord[],
  indexes: LookupIndexes,
): MatchedDecklist {
  const matched: MatchedCard[] = [];
  const notFound: string[] = [];
  const fuzzyMatches: { typed: string; matched: string }[] = [];

  for (const entry of entries) {
    const result = fuzzyFindCard(entry.name, db, indexes);
    if (result) {
      matched.push({ qty: entry.qty, card: result.card, originalName: entry.name });
      if (result.matchType === "fuzzy") {
        fuzzyMatches.push({ typed: entry.name, matched: result.card.n });
      }
    } else {
      notFound.push(entry.name);
    }
  }

  return { matched, notFound, fuzzyMatches };
}
