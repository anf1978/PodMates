import type { CardRecord } from "../cards/tuple.ts";
import type { DeckEntry } from "./types.ts";
import { CENTRALITY_MECHANICS, IXPROP } from "./commander-ability.ts";

export const CENTRALITY_TERM_BASELINE: Readonly<Record<string, number>> = {
  "X spells": 0.03,
  "legendary cards": 0.12,
  "historic cards": 0.3,
  "noncreature spells": 0.6,
  "creature spells": 0.53,
  "multicolored cards": 0.22,
  "kicker cards": 0.02,
  "cast-from-exile cards": 0.07,
  "cycling cards": 0.02,
  "mill cards": 0.03,
  artifacts: 0.169,
  enchantments: 0.083,
  instants: 0.113,
  sorceries: 0.143,
  planeswalkers: 0.02,
  equipments: 0.016,
  auras: 0.01,
  vehicles: 0.01,
  sagas: 0.01,
  counters: 0.097,
  tokens: 0.159,
  "the graveyard": 0.103,
  sacrifice: 0.1,
  lifegain: 0.049,
  discard: 0.033,
  copying: 0.033,
  lands: 0.033,
};

// Keywords a commander can care about (e.g. "creatures with defender"), and how common each is in a typical
// precon (75th-percentile share of its nonland cards), so only a deck that leans into one counts it as a theme.
export const CENTRALITY_KEYWORDS = [
  "flying",
  "defender",
  "haste",
  "trample",
  "deathtouch",
  "lifelink",
  "vigilance",
  "menace",
  "reach",
  "first strike",
  "double strike",
  "hexproof",
  "indestructible",
  "flash",
  "ward",
  "prowess",
];

export const CENTRALITY_KEYWORD_BASELINE: Readonly<Record<string, number>> = {
  flying: 0.15,
  haste: 0.04,
  trample: 0.05,
  vigilance: 0.04,
};

export const CENTRALITY_TYPE_WORDS = [
  "artifact",
  "enchantment",
  "instant",
  "sorcery",
  "planeswalker",
  "equipment",
  "aura",
  "vehicle",
  "saga",
];

export function centralityPluralForms(sub: string): string[] {
  const s = sub.toLowerCase(),
    forms = [s, s + "s", s + "es"];
  if (/fe?$/.test(s)) forms.push(s.replace(/fe?$/, "ves"));
  if (/y$/.test(s)) forms.push(s.replace(/y$/, "ies"));
  if (/man$/.test(s)) forms.push(s.replace(/man$/, "men"));
  return forms;
}

/** A term the commander's text cares about, and which cards it feeds. */
interface FedTerm {
  label: string;
  test: (c: CardRecord) => boolean;
  kw?: string;
  xspell?: boolean;
  link?: boolean;
}

export interface FedCards {
  fed: Set<string>;
  used: string[];
  poolSize: number;
  lean: number;
  byTerm: Map<string, string>;
  kwFed: Set<string>;
  xFed: Set<string>;
}

export function centralityFedCards(
  cmdCards: readonly CardRecord[],
  matchedCards: readonly DeckEntry[],
  cmdSet: ReadonlySet<string>,
): FedCards {
  const cmdText = cmdCards
    .map((c) => String(c.o || "").replace(/\([^)]*\)/g, ""))
    .join("\n")
    .toLowerCase();
  const pool = matchedCards
    .filter((m) => !cmdSet.has(m.card.n) && !/\bland\b/i.test(m.card.t || ""))
    .map((m) => m.card);
  const terms: FedTerm[] = [];
  for (const w of CENTRALITY_TYPE_WORDS) {
    if (new RegExp("\\b" + w + "s?\\b").test(cmdText))
      terms.push({
        label: w === "sorcery" ? "sorceries" : w + "s",
        test: (c) =>
          String(c.t || "")
            .toLowerCase()
            .includes(w),
      });
  }
  const subFreq = new Map<string, number>();
  for (const c of pool) {
    const t = String(c.t || ""),
      dash = t.indexOf("\u2014");
    if (dash === -1) continue;
    for (const sub of new Set(
      t
        .slice(dash + 1)
        .trim()
        .split(/\s+/),
    ))
      if (sub && sub !== "//") subFreq.set(sub, (subFreq.get(sub) || 0) + 1);
  }
  for (const [sub, n] of subFreq) {
    if (n < 3) continue;
    const forms = centralityPluralForms(sub);
    if (new RegExp("\\b(" + forms.join("|") + ")\\b").test(cmdText))
      terms.push({
        label: sub + "s",
        test: (c) => {
          const t = String(c.t || "");
          const d = t.indexOf("\u2014");
          return (
            d !== -1 &&
            t
              .slice(d + 1)
              .split(/\s+/)
              .includes(sub)
          );
        },
      });
  }
  for (const [label, re] of Object.entries(CENTRALITY_MECHANICS)) {
    if (re.test(cmdText)) terms.push({ label, test: (c) => re.test(String(c.o || "")) });
  }
  // X spells: a commander that copies, doubles or rewards spells and abilities with {X} in the cost. Cards with {X}
  // in their mana cost are fed by it, as are cards that themselves reward X spells (Unbound Flourishing, Zaxara...).
  const xRe =
    /\{x\} in (?:its|their|the) (?:mana|activation) costs?|(?:spells?|abilit(?:y|ies)) with \{x\}|\bx spells?\b|\bwith x in (?:its|their) (?:mana|activation) cost/i;
  if (xRe.test(cmdText))
    terms.push({
      label: "X spells",
      xspell: true,
      test: (c) =>
        /\{X\}/.test(String(c.c || "")) ||
        /\{x\} in (?:its|their) (?:mana|activation) cost|spells? with \{x\}/i.test(
          String(c.o || "").replace(/\([^)]*\)/g, ""),
        ),
    });
  // Legendary matters: a commander that rewards legendary spells, creatures or lands. Fed cards carry the Legendary supertype.
  if (/\blegendary\b|\blegend rule\b/.test(cmdText))
    terms.push({
      label: "legendary cards",
      link: true,
      test: (c) => /\blegendary\b/i.test(String(c.t || "").split("//")[0]),
    });
  // Historic matters: artifacts, legendaries and Sagas (Jhoira, Weatherlight Captain; Teshar...).
  if (/\bhistoric\b/.test(cmdText))
    terms.push({
      label: "historic cards",
      link: true,
      test: (c) => /\b(?:legendary|artifact|saga)\b/i.test(String(c.t || "").split("//")[0]),
    });
  for (const p of IXPROP)
    if (p.cmd.test(cmdText)) terms.push({ label: p.label, link: true, test: p.test });
  // Keywords the commander cares about: "creatures you control with defender", "other flying creatures",
  // "whenever a creature with haste ...". Only a keyword the commander is ABOUT counts -- its own keyword
  // line ("Flying, vigilance") or granting one ("have flying") does not. A card carries the keyword when it
  // is one of the card's own keyword abilities (or, for defender, a Wall).
  for (const kw of CENTRALITY_KEYWORDS) {
    const about = new RegExp(
      "\\bwith " + kw + "\\b|\\b" + kw + " (?:creatures?|permanents?|spells?)\\b",
      "i",
    );
    if (!about.test(cmdText)) continue;
    const own = new RegExp("(^|\\n)(?:[a-z' ]+, )*" + kw + "(?:,|\\n|$| \\(|\\s\\{|\\s\\d)", "i");
    terms.push({
      label: "cards with " + kw,
      kw,
      test: (c) =>
        own.test(String(c.o || "").replace(/\([^)]*\)/g, "")) ||
        (kw === "defender" && /\bWall\b/.test(String(c.t || ""))),
    });
  }
  const fed = new Set<string>(),
    used: string[] = [],
    leans: number[] = [],
    byTerm = new Map<string, string>(),
    kwFed = new Set<string>();
  for (const term of terms) {
    const hits = pool.filter((c) => term.test(c));
    const base =
      CENTRALITY_TERM_BASELINE[term.label] !== undefined
        ? (CENTRALITY_TERM_BASELINE[term.label] as number)
        : term.kw
          ? CENTRALITY_KEYWORD_BASELINE[term.kw] || 0.02
          : 0.1;
    const lean = pool.length ? hits.length / pool.length - base : 0;
    if (hits.length >= 5 && lean >= 0.08) {
      hits.forEach((c) => {
        fed.add(c.n);
        if (!byTerm.has(c.n)) byTerm.set(c.n, term.label);
        if (term.kw || term.xspell || term.link) kwFed.add(c.n);
      }); // kwFed: linked to the commander in this reading only, and still work alone
      if (!used.some((u) => u.toLowerCase() === term.label.toLowerCase())) used.push(term.label);
      leans.push(lean);
    }
  }
  const maxLean = leans.length ? Math.max(...leans) : 0;
  const lean = maxLean + 0.5 * (leans.reduce((a, b) => a + b, 0) - maxLean);
  return {
    fed,
    used,
    poolSize: pool.length,
    lean,
    byTerm,
    kwFed,
    xFed: new Set([...byTerm].filter(([, l]) => l === "X spells").map(([n]) => n)),
  };
}
