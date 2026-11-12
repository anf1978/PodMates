// Reading a card's rules text the way a player would: what a trigger watches for ("another
// Elf enters"), which tokens a card makes, what a payoff does, and which printed stats and
// extra jobs it has. Everything is computed from the cards' own text; no card is named here.
// Moved unchanged from the inline INTERACTION PACKAGES block.

import type { CardRecord } from "../../../cards/tuple.ts";
import { CENTRALITY_KEYWORDS, centralityPluralForms } from "../../../engine/centrality-fed.ts";
import type { IxFilter, IxPackage, IxToken } from "./types.ts";

/** Lower-case rules text with reminder text removed and the card's own name written as "~". */
export function ixText(card: { n: string; o?: string | undefined }): string {
  let t = String(card.o || "").replace(/\([^)]*\)/g, "");
  [card.n, String(card.n).split(",")[0]!.trim()].forEach((n) => {
    if (n && n.length >= 3) t = t.split(n).join("~");
  });
  return t
    .toLowerCase()
    .replace(
      /\bthis (?:creature|permanent|artifact|enchantment|land|card|vehicle|equipment|aura|saga|planeswalker|spell)\b/g,
      "~",
    );
}

/** `ixText` of both faces. */
export function ixFaceText(c: Pick<CardRecord, "n" | "o" | "ob">): string {
  return ixText({ n: c.n, o: String(c.o || "") + (c.ob ? "\n" + c.ob : "") });
}

function ixHasKeyword(card: Pick<CardRecord, "t" | "o">, kw: string): boolean {
  if (kw === "defender" && /\bwall\b/i.test(String(card.t || ""))) return true;
  const own = new RegExp("(^|\\n)(?:[a-z' ]+, )*" + kw + "(?:,|\\n|$| \\(|\\s\\{|\\s\\d)", "i");
  return own.test(String(card.o || "").replace(/\([^)]*\)/g, ""));
}

export const IX_LAND_SUBS: ReadonlySet<string> = new Set([
  "Desert",
  "Forest",
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Gate",
  "Cave",
  "Town",
  "Locus",
  "Lair",
]);

/** Reads a trigger's object phrase ("another nontoken Elf"); null when it is not understood. */
export function ixParseFilter(phrase: string, subtypes: readonly string[]): IxFilter | null {
  const p = String(phrase || "")
    .toLowerCase()
    .trim();
  if (!p || /opponent/.test(p)) return null;
  if (p === "~")
    return {
      self: true,
      types: [],
      kws: [],
      subs: [],
      token: null,
      other: false,
      label: "itself",
    };
  const f: IxFilter = {
    self: false,
    types: [],
    kws: [],
    subs: [],
    token: null,
    other: /\b(?:another|other)\b/.test(p),
    label: "",
  };
  ["creature", "artifact", "enchantment", "planeswalker", "land"].forEach((t) => {
    if (new RegExp("\\b" + t + "s?\\b").test(p)) f.types.push(t);
  });
  CENTRALITY_KEYWORDS.forEach((k) => {
    if (new RegExp("\\bwith " + k + "\\b|\\b" + k + " (?:creature|permanent)").test(p))
      f.kws.push(k);
  });
  if (/\bnontoken\b/.test(p)) f.token = false;
  else if (/\btokens?\b/.test(p)) f.token = true;
  subtypes.forEach((s) => {
    if (centralityPluralForms(s).some((w) => new RegExp("\\b" + w + "\\b").test(p))) f.subs.push(s);
  });
  // "without flying", "noncreature": too fiddly to match honestly
  if (/\bwithout\b|\bnon[a-z]+/.test(p.replace(/nontoken/g, ""))) return null;
  {
    let rest = p;
    CENTRALITY_KEYWORDS.forEach((k) => {
      rest = rest.replace(new RegExp("with " + k + "\\b", "g"), "");
    });
    // "power 3 or greater", "of that type": not understood, so not claimed
    if (
      /\bwith\b|\bthat\b|\bof\b|\bwhose\b|\bnamed\b|\bdifferent\b|\bfirst\b|\bsecond\b/.test(rest)
    )
      return null;
  }
  if (!f.types.length && !f.kws.length && !f.subs.length && f.token === null) return null;
  // "a Desert enters" is about lands, not creatures
  if (!f.types.length && f.subs.length && f.subs.every((x) => IX_LAND_SUBS.has(x)))
    f.types = ["land"];
  if (!f.types.length && (f.subs.length || f.kws.length)) f.types = ["creature"];
  const bits: string[] = [];
  if (f.kws.length)
    bits.push(
      f.types[0] === "creature"
        ? "creature with " + f.kws.join(" and ")
        : f.types.join("/") + " with " + f.kws.join(" and "),
    );
  else if (f.subs.length) bits.push(f.subs.map((s) => s.toLowerCase()).join("/"));
  else bits.push((f.token === true ? "token " : "") + f.types.join(" or "));
  f.generic = !f.kws.length && !f.subs.length && f.token === null;
  f.label = (f.other ? "another " : /^[aeiou]/.test(bits[0]!) ? "an " : "a ") + bits[0];
  return f;
}

export function ixCardMatches(card: Pick<CardRecord, "t" | "o">, f: IxFilter): boolean {
  if (f.token === true) return false; // tokens are covered by their makers
  const type = String(card.t || "").toLowerCase(),
    dash = type.indexOf("—"),
    sub = dash >= 0 ? type.slice(dash + 1) : "";
  if (
    f.types.length &&
    !f.types.some((t) => type.slice(0, dash >= 0 ? dash : undefined).includes(t))
  )
    return false;
  if (f.kws.length && !f.kws.every((k) => ixHasKeyword(card, k))) return false;
  if (f.subs.length && !f.subs.some((s) => new RegExp("\\b" + s.toLowerCase() + "\\b").test(sub)))
    return false;
  return true;
}

/** Tokens a card makes. */
export function ixTokensMade(text: string): IxToken[] {
  const out: IxToken[] = [],
    re =
      /create (?:an?|one|two|three|four|five|x|\d+|that many|a number of)?\s*([^.;]*?)\btokens?\b(?: with ([^.;]*?))?(?=[.;,]| and |$| that| for each| until| at )/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const desc = (m[1] || "") + " " + (m[2] || "");
    out.push({
      creature: /creature/.test(desc),
      artifact: /artifact|treasure|clue|food|blood|powerstone|incubator|map/.test(desc),
      kws: CENTRALITY_KEYWORDS.filter((k) => new RegExp("\\b" + k + "\\b").test(desc)),
      desc,
    });
  }
  return out;
}

export function ixTokenMatches(tok: IxToken, f: IxFilter): boolean {
  if (f.token === false) return false;
  if (
    f.types.length &&
    !f.types.some((t) => (t === "creature" && tok.creature) || (t === "artifact" && tok.artifact))
  )
    return false;
  if (f.kws.length && !f.kws.every((k) => tok.kws.includes(k))) return false;
  if (
    f.subs.length &&
    !f.subs.some((s) => new RegExp("\\b" + s.toLowerCase() + "\\b").test(tok.desc))
  )
    return false;
  return true;
}

const IX_EFFECTS: ReadonlyArray<readonly [RegExp, string, number]> = [
  [/\bdraw(?:s)? (?:a|an|one|two|three|x|that many|\d+) cards?|\bdraw a card/, "draws cards", 3],
  [/\bcreate/, "makes tokens", 3],
  [
    /\bloses? \w+ life|\bdeals? \d+ damage|\bdeals? damage|each opponent loses/,
    "drains or damages",
    3.5,
  ],
  [/\badd \{|\badd (?:one|two|that much|an amount)/, "makes mana", 3],
  [/\bproliferate\b/, "proliferates counters", 3],
  [/\+1\/\+1 counter|put [^.]*counter/, "adds counters", 2.5],
  [/\bsearch your library/, "finds cards", 2.5],
  [/\bgain(?:s)? (?:\d+|x|that much)? ?life/, "gains life", 1.5],
  [/\bscry|\bsurveil|\bmill/, "filters cards", 1.2],
  [/\bdestroy|\bexile target|\breturn target [^.]* to its owner's hand/, "removes things", 2.5],
  [/gain control of/, "steals things", 3],
  [
    /return [^.]{0,60}from (?:your|a) graveyard|put [^.]{0,60}from (?:your|a) graveyard/,
    "brings cards back",
    2.5,
  ],
  [/\bcopy|\bcopies/, "copies things", 3],
  [/\buntap/, "untaps things", 1.5],
  [/\bdiscards?\b/, "makes players discard", 2],
  [/look at the top|reveal the top|exile the top/, "digs for cards", 2.5],
  [
    /gets? [+-]\d+\/[+-]\d+|gains? (?:flying|haste|trample|vigilance|lifelink|menace|deathtouch|indestructible|hexproof)/,
    "boosts creatures",
    1.5,
  ],
  [/\bsacrifice/, "forces sacrifices", 2],
  [/\btap target|\bdoesn't untap|\bfreeze/, "taps things down", 1.5],
  [/\bgoad|\bmust attack|\battacks? each/, "forces combat", 2],
  [/monarch|initiative|\bconnive|\binvestigate|\bclue\b|\btreasure/, "makes value tokens", 2.5],
];

export interface IxEffect {
  label: string;
  w: number;
  generic?: boolean;
}

/** What a payoff clause does, with a weight for ranking. */
export function ixEffect(clause: string): IxEffect {
  for (const [re, label, w] of IX_EFFECTS) if (re.test(clause)) return { label, w };
  return { label: "gets a bonus", w: 0.6, generic: true };
}

/** [event key, regex capturing the filter phrase, plain-English "when"]. */
export const IX_LISTENERS: ReadonlyArray<readonly [string, RegExp, string]> = [
  [
    "enters",
    /(?:whenever|when) (?:another |an? |one or more |each |one or more other |another nontoken )?([^,.;:]{0,60}?) enters?(?: the battlefield)?(?: under your control)?/,
    "enters",
  ],
  [
    "dies",
    /(?:whenever|when) (?:another |an? |one or more |each |one or more other )?([^,.;:]{0,60}?) dies/,
    "dies",
  ],
];

/** Printed power and toughness as numbers (null when unknown or "*"); null when the DB has no stats. */
export function ixStat(
  c: Pick<CardRecord, "pw" | "tg">,
): { p: number | null; t: number | null } | null {
  if (c.pw === undefined || c.pw === "" || c.tg === undefined) return null;
  // "*", "1+*", "+2" and similar are unknown, not guessed
  const p = /^\d+$/.test(c.pw) ? parseInt(c.pw, 10) : null,
    t = /^\d+$/.test(c.tg) ? parseInt(c.tg, 10) : null;
  return { p, t };
}

export interface IxRoles {
  landRamp?: true;
  wipeDamage?: true;
  wipeSac?: true;
  threaten?: true;
  hasteAll?: true;
  aura?: true;
  massReturn?: true;
}

/** Extra jobs a card can have, read from its text. Display-only: never feeds the scores. */
export function ixRoles(text: string): IxRoles {
  const r: IxRoles = {};
  if (
    /search your library for [^.]{0,50}(?:lands?|forests?|plains|islands?|swamps?|mountains?)[^.]{0,50}cards?[^.]{0,60}onto the battlefield/.test(
      text,
    )
  )
    r.landRamp = true;
  if (/deals? (?:x|\d+) damage to each (?:non\w+ )?creature/.test(text)) r.wipeDamage = true;
  if (
    /each player sacrifices (?:that many|all|a number|x) |sacrifices all other (?:nonland )?permanents/.test(
      text,
    )
  )
    r.wipeSac = true;
  if (/gain control of (?:all|each|target) creatures?[^.]{0,60}until end of turn/.test(text))
    r.threaten = true;
  if (/creatures you control have haste|all creatures have haste/.test(text)) r.hasteAll = true;
  if (/enchanted creature (?:gets|has|can|gains)|enchanted creature'?s? controller/.test(text))
    r.aura = true;
  if (
    /return all (?:artifact|enchantment|creature|permanent)[^.]{0,40}cards? from (?:all|your|each) graveyards? to the battlefield/.test(
      text,
    )
  )
    r.massReturn = true;
  return r;
}

export const IX_UNTAP_RE =
  /untap all (?:lands|permanents)[^.]*(?:end step|untap step|each other player)|at the beginning of your end step, untap all (?:lands|permanents)|during each other player's untap step, untap all/;
export const IX_MANA_DOUBLE_RE =
  /whenever you tap (?:a|an|another) [a-z ]*(?:land|permanent|creature|artifact)[^.]* for mana, add|if you tap a (?:land|permanent)[^.]*for mana, it produces|(?:lands?|permanents?) you control[^.]*(?:tap|tapped)[^.]*for mana[^.]*(?:additional|twice|one mana of any type that)/;

/** Card names inside prebuilt package markup, swapped for links when the package is described. */
export const ixLinkSlot = (n: string): string => "\u0001" + n + "\u0002";

/** "a, b, c +2 more" with each name in a link slot. */
export function ixNames(arr: ReadonlyArray<{ card: { n: string } }>, k: number): string {
  return (
    arr
      .slice(0, k)
      .map((m) => ixLinkSlot(m.card.n))
      .join(", ") + (arr.length > k ? " +" + (arr.length - k) + " more" : "")
  );
}

/** A game plan read from the deck's make-up rather than from one trigger. */
export function ixPlan(
  payoff: string,
  isCmd: boolean,
  head: string,
  extraLines: string[],
  score = 99,
  withMembers = true,
): IxPackage {
  const plan: IxPackage = {
    kind: "plan",
    event: "plan",
    payoff,
    isCmd,
    head,
    extraLines,
    filter: { label: "" },
    effect: "",
    objects: [],
    objCount: 0,
    tokenMakers: [],
    repeaters: [],
    multipliers: [],
    score,
  };
  // The planeswalker and theme plans carried an empty member list; the others did not.
  return withMembers ? { ...plan, members: [], score } : plan;
}
