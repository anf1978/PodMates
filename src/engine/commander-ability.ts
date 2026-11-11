import type { CardRecord } from "../cards/tuple.ts";
import type { SupportKind } from "./centrality-rules.ts";
import type { DeckEntry } from "./types.ts";
import { classifyCard } from "./classify.ts";

// What kind of ability does the commander have?
export interface CommanderAbility {
  strength: number;
  kind: string;
  engine: boolean;
  activated: boolean;
  etbOnly: boolean;
  worksFromCommandZone: boolean;
}

export function analyzeCommanderAbility(card: CardRecord | null | undefined): CommanderAbility {
  const text = String((card && card.o) || "").replace(/\([^)]*\)/g, "");
  const eminence = /\bEminence\b/i.test(text);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let triggered = false,
    etbOnlyTrigger = false,
    activated = false,
    statik = false;
  for (const line of lines) {
    if (/^(Partner|Friends forever|Choose a Background|Doctor's companion)/i.test(line)) continue;
    if (/^(Eminence)/i.test(line)) continue;
    const isTrigger =
      /^(Whenever|At the beginning of|When\b)/i.test(line) ||
      /\b(Whenever|At the beginning of)\b/i.test(line);
    const isActivated =
      /^[^:\n]*(\{[^}]+\}|Sacrifice|Discard|Pay|Exile|Tap|Untap|Remove)[^:\n]*:/i.test(line);
    if (isActivated) {
      activated = true;
      continue;
    }
    if (isTrigger) {
      if (
        /\bWhen\b[^,.]*\benters\b/i.test(line) &&
        !/\bWhenever\b|\bAt the beginning of\b/i.test(line)
      )
        etbOnlyTrigger = true;
      else triggered = true;
      continue;
    }
    if (
      /\b(have|has|gets?|can't|cannot|costs?|you may|as long as|instead|each|other|enchanted|equipped)\b/i.test(
        line,
      )
    )
      statik = true;
  }
  let strength: number;
  const engine = triggered || statik;
  if (engine) strength = 0.85;
  else if (activated) strength = 0.75;
  else if (etbOnlyTrigger) strength = 0.35;
  else strength = 0.3;
  if (engine && activated) strength = Math.min(1, strength + 0.1);
  if (eminence) strength = Math.max(strength, 0.7);
  const kind = engine
    ? "a repeating effect"
    : activated
      ? "an activated ability"
      : etbOnlyTrigger
        ? "a one-time enters-the-battlefield effect"
        : "mostly a body with keywords";
  return {
    strength,
    kind,
    engine,
    activated,
    etbOnly: etbOnlyTrigger && !engine && !activated,
    worksFromCommandZone: eminence,
  };
}

// Which cards count as "support for the commander", by kind. Unique names.
export function centralitySupportSets(
  matchedCards: readonly DeckEntry[],
  commanderNames: readonly string[],
): Record<SupportKind, Set<string>> {
  const sets: Record<SupportKind, Set<string>> = {
    protection: new Set(),
    recursion: new Set(),
    tutor: new Set(),
    costReducer: new Set(),
    gear: new Set(),
    direct: new Set(),
  };
  const isCmd = new Set(commanderNames);
  const directRe =
    /\byour commander\b[^.]*\b(gets?|has|gains?|deals?|can|costs?)\b|\b(return|put)\b[^.]*\b(your commander|a commander you own)\b|\bcommander you control (gets?|has|gains?)\b|\bcommander's (cast|cost)\b/i;
  for (const m of matchedCards) {
    const card = m.card,
      name = card.n;
    if (isCmd.has(name)) continue;
    const c = classifyCard(card);
    const t = String(card.t || "").toLowerCase();
    if (c.protection) sets.protection.add(name);
    if (c.reanimate) sets.recursion.add(name);
    if (c.tutor) sets.tutor.add(name);
    if (c.costReducer) sets.costReducer.add(name);
    if (t.includes("equipment") || t.includes("aura")) sets.gear.add(name);
    const text = String(card.o || "").replace(/\([^)]*\)/g, "");
    if (directRe.test(text) && !/color identity/i.test(text)) sets.direct.add(name);
  }
  return sets;
}

// What does the commander's ability care about -- artifacts, a creature type,
// +1/+1 counters, the graveyard? Cards in the deck that match are "fed" by it.
// Terms that are too rare (not a theme) or too common (everything matches, so
// it tells you nothing) are ignored.
export const CENTRALITY_MECHANICS: Readonly<Record<string, RegExp>> = {
  counters: /\+1\/\+1 counter|proliferate|\bcounters? on\b/i,
  tokens: /\btokens?\b/i,
  "the graveyard": /\bgraveyard\b/i,
  sacrifice: /\bsacrifice/i,
  lifegain: /\bgains? (?:\d+|x|that much)? ?life\b|lifelink/i,
  discard: /\bdiscard/i,
  copying: /\bcopy\b|\bcopies\b/i,
  lands: /landfall|\bland enters\b|additional land|search your library for [^.]*\bland\b/i,
};

// How much of a typical precon baseline deck matches each term (median share of its
// nonland cards). A term only counts when THIS deck leans into it noticeably
// harder than that, so "has some artifacts" does not read as "built around
// an artifact commander". Creature-type terms default to 0.10.
// Card properties a commander can reward ("noncreature spells", "multicolored", "kicked", "cast from exile"...).
// base = about the 75th-percentile share of a precon's nonland cards (measured over the 159 original precon and curated decks), so a deck only counts as leaning
// into the property when it is clearly above a typical deck. cmd reads the commander's text; test reads a card; pay and cost read other cards' text.
export const PROP_COLORS = (c: CardRecord): Set<string> => {
  const s = new Set<string>();
  String(c.c || "").replace(/\{([^}]+)\}/g, (m, x: string) => {
    x.split("/").forEach((q) => {
      if (/^[WUBRG]$/.test(q)) s.add(q);
    });
    return m;
  });
  return s;
};

/** A card property a commander can reward (see the comment above PROP_COLORS). */
export interface IxProp {
  key: string;
  label: string;
  base: number;
  cmd: RegExp;
  test: (c: CardRecord) => boolean;
  pay: RegExp;
  cost: RegExp;
  top: boolean;
  half?: RegExp;
  doubles?: RegExp;
  head: string;
}

export const IXPROP: readonly IxProp[] = [
  {
    key: "noncreature",
    label: "noncreature spells",
    base: 0.6,
    cmd: /noncreature (?:spell|permanent|card)/,
    test: (c) => !/\bcreature\b/i.test(String(c.t || "").split("//")[0]),
    pay: /whenever you cast (?:a |an )?noncreature spell|noncreature spells you cast(?! cost)/,
    cost: /noncreature spells you cast[^.]*cost[^.]*less/,
    top: false,
    head: "the deck is mostly spells rather than creatures.",
  },
  {
    key: "creature",
    label: "creature spells",
    base: 0.53,
    cmd: /creature spells?\b/,
    test: (c) => /\bcreature\b/i.test(String(c.t || "").split("//")[0]),
    pay: /whenever you cast (?:a |an )?(?:[a-z-]+ )?creature spell|creature spells you cast(?! cost)/,
    cost: /(?<!non)creature spells you cast[^.]*cost[^.]*less/,
    top: false,
    head: "the deck is built on casting creatures.",
  },
  {
    key: "multicolor",
    label: "multicolored cards",
    base: 0.22,
    cmd: /multicolou?red/,
    test: (c) => PROP_COLORS(c).size >= 2,
    pay: /^(?![\s\S]*(?:target multicolou?red|protection from multicolou?red))[\s\S]*(?:whenever you cast (?:a |an )?multicolou?red|multicolou?red (?:spells|creatures|permanents) you (?:cast|control)|cast a multicolou?red spell)/,
    cost: /multicolou?red spells you cast[^.]*cost[^.]*less/,
    top: true,
    head: "two or more colours in the mana cost.",
  },
  {
    key: "kicker",
    label: "kicker cards",
    base: 0.02,
    cmd: /\bkick(?:ed|er)\b|multikicker/,
    test: (c) => /\bkicker\b|multikicker|\bkicked\b/i.test(String(c.o || "")),
    pay: /whenever you (?:cast|kick) a kicked spell|whenever you kick|spells? you cast with kicker|kicked spells? you/,
    cost: /kicker costs?[^.]*less/,
    top: true,
    head: "spells with a kicker cost.",
  },
  {
    key: "exile",
    label: "cast-from-exile cards",
    base: 0.07,
    cmd: /from exile|exiled (?:card|with|this way)|(?:cast|play)[^.]*\bexiled\b/,
    test: (c) =>
      /exile[^.]*\byou may (?:play|cast)|you may (?:play|cast)[^.]*(?:from|exiled)|cast[^.]*from exile|exiled with|foretell|\bsuspend\b|\bplot\b|\badventure\b/i.test(
        String(c.o || ""),
      ),
    pay: /whenever you cast (?:a |an )?(?:[a-z-]+ )?spell from exile|spells? you cast from exile|(?:first|each) spell you cast from exile/,
    cost: /from exile[^.]*cost[^.]*less/,
    top: true,
    head: "cards you exile and then cast, or that cast from exile.",
  },
  {
    key: "mill",
    label: "mill cards",
    base: 0.03,
    cmd: /\bmills?\b|\bmilled\b/,
    test: (c) =>
      /\bmills?\b|put the top [^.]*cards? of (?:their|target (?:player|opponent)'s|each (?:player|opponent)'s)? ?library into (?:their|its owner's|your) graveyard/i.test(
        String(c.o || ""),
      ),
    pay: /whenever (?:you|a player|an opponent|one or more)[^.]*\bmills?\b|(?:would|if) [^.]*\bmills?\b[^.]*(?:twice|instead|that many)|(?:cards?|creatures?) (?:is|are) put into (?:a|an opponent's|your|their) graveyard from (?:a |your |their )?librar/,
    cost: /(?!)/,
    top: true,
    half: /half (?:of )?(?:their|his or her|that player's|target (?:player|opponent)'s|each (?:player|opponent)'s|your) library|half (?:of )?(?:the )?cards in (?:their|your) library/,
    doubles: /\bmills? (?:twice|double)|twice that many|double that many|two times that many/,
    head: "cards that mill, built around emptying libraries.",
  },
  {
    key: "cycling",
    label: "cycling cards",
    base: 0.02,
    cmd: /\bcycl(?:e|ing|ed)\b/,
    test: (c) => /\bcycling\b/i.test(String(c.o || "")),
    pay: /whenever you cycle/,
    cost: /cycling costs?[^.]*less/,
    top: true,
    head: "cards with cycling.",
  },
];
