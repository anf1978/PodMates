// Deck Chart state: the pure rules behind the Structure & Legality panel and the Mana Base
// bars. No DOM, no page globals -- the panels pass data in and render what comes back.

import type { CardRecord } from "../../cards/tuple.ts";
import type { MatchedCard } from "../../cards/lookup.ts";

/** Cards that lift Commander's one-copy limit, and how many copies they allow. */
// Commander is singleton, but a few cards say otherwise in their own rules text ("A deck can
// have any number of cards named X" / "up to nine cards named X"). The limit is read from that
// text, so any card Wizards adds later is picked up automatically by the weekly database
// rebuild. This table is a safety net for the 13 known cards (as of Oct 2026) in case the text
// is ever missing or reworded; the text wins when both exist.
const COPY_LIMIT_FALLBACK: Record<string, number> = {
  "Cid, Timeless Artificer": Infinity,
  "Dragon's Approach": Infinity,
  "Hare Apparent": Infinity,
  "Nazg\u00FBl": 9,
  "Persistent Petitioners": Infinity,
  "Rat Colony": Infinity,
  "Relentless Rats": Infinity,
  "Shadowborn Apostle": Infinity,
  "Seven Dwarves": 7,
  "Slime Against Humanity": Infinity,
  "Sphinx's Approach": Infinity,
  "Tempest Hawk": Infinity,
  "Templar Knight": Infinity,
};

const COPY_LIMIT_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

// Each card's limit is read once per card record; the records live as long as the card database
// does, so a WeakMap keeps the cache off the record itself.
const copyLimits = new WeakMap<CardRecord, number>();

/**
 * How many copies of this card a deck may hold (basic lands are handled by the caller):
 * 1 for most cards, a number for "up to N", Infinity for "any number".
 */
export function getCopyLimit(card: CardRecord | null | undefined): number {
  if (!card) return 1;
  const cached = copyLimits.get(card);
  if (cached !== undefined) return cached;
  let limit = 1;
  const m = /a deck can have (any number of|up to (\w+)) cards named/i.exec(String(card.o || ""));
  if (m) {
    if (!m[2]) limit = Infinity;
    else {
      const w = m[2].toLowerCase();
      const n = /^\d+$/.test(w) ? parseInt(w, 10) : COPY_LIMIT_NUMBER_WORDS[w];
      limit = n || COPY_LIMIT_FALLBACK[card.n] || Infinity;
    }
  } else if (Object.prototype.hasOwnProperty.call(COPY_LIMIT_FALLBACK, card.n)) {
    limit = COPY_LIMIT_FALLBACK[card.n];
  }
  copyLimits.set(card, limit);
  return limit;
}

export interface LegalityInput {
  matched: MatchedCard[];
  commanders: string[];
  notFound: string[];
  /** The commander names resolved to card records; empty when none resolved. */
  commanderCards: CardRecord[];
}

export interface LegalityReport {
  ok: boolean;
  issues: string[];
  notes: string[];
  total: number;
  lands: number;
  banned: string[];
  dupes: string[];
  /** The subset of `issues` that are genuine rule violations, not sanity heuristics. */
  hardViolations: string[];
}

/** Soft structural checks on a charted list: counts, singleton, bans, colour identity. */
export function checkLegality({
  matched,
  commanders,
  notFound,
  commanderCards,
}: LegalityInput): LegalityReport {
  const issues: string[] = [];
  const notes: string[] = [];
  const hardViolations: string[] = [];

  // Card count (matched only)
  let total = 0;
  const byName = new Map<string, number>();
  for (const m of matched) {
    total += m.qty;
    const n = m.card.n;
    byName.set(n, (byName.get(n) || 0) + m.qty);
  }

  // Typical paste: 99 + commander in list = 100, or 100 without separate commander, or partners
  if (total === 0) {
    issues.push("No matched cards to check.");
  } else if (total === 100 || total === 99 || total === 98) {
    notes.push(`Card count looks normal (${total} matched).`);
  } else if (total >= 95 && total <= 105) {
    issues.push(
      `Card count is ${total} (typical Commander lists are 100, or 98–99 with partners).`,
    );
  } else {
    issues.push(`Card count is ${total} — far from a standard 100-card Commander list.`);
  }

  // Singleton: qty > 1 on non-basic cards -- except the few cards whose own text lets a deck
  // hold many (or up to N) copies, which are checked against their own limit instead.
  const dupes: string[] = [];
  const multiAllowed: string[] = [];
  const seenDupNames = new Set<string>();
  for (const m of matched) {
    const name = m.card.n;
    if (seenDupNames.has(name)) continue;
    seenDupNames.add(name);
    const t = (m.card.t || "").toLowerCase();
    const isBasic = t.includes("basic");
    const qty = byName.get(name) || m.qty;
    if (isBasic || qty <= 1) continue;
    const limit = getCopyLimit(m.card);
    if (limit === Infinity) {
      multiAllowed.push(`${name} ×${qty}`);
    } else if (qty > limit) {
      dupes.push(limit > 1 ? `${name} (${qty} copies, limit ${limit})` : name);
    } else {
      multiAllowed.push(`${name} ×${qty} (limit ${limit})`);
    }
  }
  if (dupes.length) {
    const msg = `Singleton violations (qty > 1, non-basic): ${dupes.slice(0, 8).join(", ")}${dupes.length > 8 ? "…" : ""}`;
    issues.push(msg);
    hardViolations.push(msg);
  } else {
    notes.push(
      "No non-basic duplicates detected" +
        (multiAllowed.length ? " beyond what card text allows." : "."),
    );
  }
  if (multiAllowed.length) {
    notes.push(`Multiple copies allowed by card text: ${multiAllowed.join(", ")}.`);
  }

  // Banned
  const banned = [...new Set(matched.filter((m) => m.card.b).map((m) => m.card.n))];
  if (banned.length) {
    const msg = `Banned in Commander (per embedded list): ${banned.join(", ")}`;
    issues.push(msg);
    hardViolations.push(msg);
  }

  // Commander present
  if (!commanders || commanders.length === 0) {
    issues.push(
      "No commander identified — fill the Commander field or include a Commander: section.",
    );
  } else {
    notes.push(`Commander: ${commanders.join(" / ")}`);
  }

  // Multiple commanders without partner-style support
  const cmdCards = commanders && commanders.length ? commanderCards : [];
  if (commanders && commanders.length >= 2) {
    const partnerRe =
      /\bpartner\b|\bfriends forever\b|\bchoose a background\b|\bdoctor's companion\b/i;
    const anyPartnerText = cmdCards.some((c) => partnerRe.test(c.o || ""));
    if (!anyPartnerText) {
      const msg = `${commanders.length} commanders named, but none of them have Partner, Friends Forever, Choose a Background, or Doctor's Companion text — this pairing likely isn't legal.`;
      issues.push(msg);
      hardViolations.push(msg);
    }
  }

  // Color identity violations
  if (cmdCards.length) {
    const identitySet = new Set<string>();
    for (const c of cmdCards) {
      for (const ch of c.ci || "") identitySet.add(ch);
    }
    const offenders: string[] = [];
    for (const m of matched) {
      const ci = m.card.ci || "";
      for (const ch of ci) {
        if (!identitySet.has(ch)) {
          if (!offenders.includes(m.card.n)) offenders.push(m.card.n);
          break;
        }
      }
    }
    if (offenders.length) {
      const idLabel = identitySet.size ? [...identitySet].join("") : "colorless";
      const msg = `Outside commander color identity (${idLabel}): ${offenders.slice(0, 8).join(", ")}${offenders.length > 8 ? "…" : ""}`;
      issues.push(msg);
      hardViolations.push(msg);
    } else {
      notes.push("All matched cards fit the commander's color identity.");
    }
  }

  // Unmatched names
  if (notFound && notFound.length) {
    issues.push(`${notFound.length} name(s) not in the database (ignored in scoring).`);
  }

  // Lands sanity
  const lands = matched
    .filter((m) => (m.card.t || "").toLowerCase().includes("land"))
    .reduce((s, m) => s + m.qty, 0);
  if (total >= 90 && lands > 0 && lands < 28) {
    issues.push(`Only ${lands} lands matched — low for most Commander decks (unless intentional).`);
  } else if (total >= 90 && lands > 50) {
    notes.push(`${lands} lands — high land count (possible theme or typo).`);
  }

  const ok = issues.length === 0;
  return { ok, issues, notes, total, lands, banned, dupes, hardViolations };
}

export interface ManaBaseRow {
  color: string;
  /** Share of the deck's coloured pips this colour needs, 0-1. */
  costShare: number;
  /** Share of the deck's coloured sources that make this colour, 0-1. */
  productionShare: number;
  /** Pip count, as counted by the engine. */
  pips: number;
  /** Source count. */
  sources: number;
  /** Whole percentage points by which cost outruns production. */
  gapPoints: number;
  /** True when that gap is wide enough to call out. */
  shortfall: boolean;
  /** Bar widths, scaled so the widest bar in the panel fills its track. */
  costBarPercent: number;
  productionBarPercent: number;
}

/**
 * The Cost vs. Production rows. Colourless is only compared like a colour when the deck
 * actually has {C} costs; otherwise colourless production (Sol Ring, Wastes...) would pad the
 * total and shrink every real colour's share, so the panel notes it separately instead.
 */
export function manaBaseRows(
  pips: Record<string, number>,
  sources: Record<string, number>,
): ManaBaseRow[] {
  const colors = ["W", "U", "B", "R", "G", "C"].filter((c) =>
    c === "C" ? (pips.C || 0) > 0 : (pips[c] || 0) > 0 || (sources[c] || 0) > 0,
  );
  if (colors.length === 0) return [];

  const totalPips = colors.reduce((s, c) => s + (pips[c] || 0), 0) || 1;
  const totalSources = colors.reduce((s, c) => s + (sources[c] || 0), 0) || 1;
  const maxPct =
    Math.max(
      ...colors.map((c) => Math.max((pips[c] || 0) / totalPips, (sources[c] || 0) / totalSources)),
    ) || 1;

  return colors.map((color) => {
    const costShare = (pips[color] || 0) / totalPips;
    const productionShare = (sources[color] || 0) / totalSources;
    const gapPoints = Math.round((costShare - productionShare) * 100);
    return {
      color,
      costShare,
      productionShare,
      pips: pips[color] || 0,
      sources: sources[color] || 0,
      gapPoints,
      shortfall: costShare > 0 && gapPoints > 15,
      costBarPercent: (costShare / maxPct) * 100,
      productionBarPercent: (productionShare / maxPct) * 100,
    };
  });
}
