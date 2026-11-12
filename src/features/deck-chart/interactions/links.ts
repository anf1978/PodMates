// Which cards make a trigger happen again (repeaters) or count twice (multipliers). Every
// check stays honest about what the trigger is about: a creature-only blinker never feeds a
// land trigger, and nothing makes a token enter again. Moved unchanged from index.html.

import type { CardRecord } from "../../../cards/tuple.ts";
import { IX_LAND_SUBS, ixTokenMatches } from "./text.ts";
import type { IxFilter, IxToken } from "./types.ts";

export const ixTagged = (set: ReadonlySet<string>, c: { n?: string }): boolean =>
  set.has(
    String(c.n || "")
      .split("//")[0]!
      .trim()
      .toLowerCase(),
  );

// Which card words can a filter's event involve? "a Desert" -> land, "a Vehicle" -> artifact,
// "an Elf" -> creature, "a token" -> creature. Used to keep every repeater/doubler honest.
const IX_NONCREATURE_SUBS: Readonly<Record<string, string>> = {
  vehicle: "artifact",
  equipment: "artifact",
  treasure: "artifact",
  clue: "artifact",
  food: "artifact",
  blood: "artifact",
  map: "artifact",
  powerstone: "artifact",
  junk: "artifact",
  gold: "artifact",
  incubator: "artifact",
  aura: "enchantment",
  saga: "enchantment",
  class: "enchantment",
  shrine: "enchantment",
  role: "enchantment",
  curse: "enchantment",
};

function ixNouns(f: IxFilter): Set<string> {
  const n = new Set(["permanent"]);
  if (f.token === true) {
    n.add("creature");
    n.add("token");
    return n;
  }
  const subs = (f.subs || []).map((x) => String(x).toLowerCase());
  if (subs.length && subs.every((x) => IX_NONCREATURE_SUBS[x])) {
    subs.forEach((x) => n.add(IX_NONCREATURE_SUBS[x]!));
    return n;
  }
  if (subs.length && subs.every((x) => IX_LAND_SUBS.has(x.charAt(0).toUpperCase() + x.slice(1)))) {
    n.add("land");
    return n;
  }
  (f.types || []).forEach((t) => n.add(t));
  if ((f.subs && f.subs.length) || (f.kws && f.kws.length)) n.add("creature");
  return n;
}

export function ixNounOk(snip: string, f: IxFilter): boolean {
  if (f.self) return true;
  let t = String(snip);
  const nn = ixNouns(f);
  if (nn.has("land") && nn.size <= 2) t = t.replace(/\bnon-?land\s+\w+/g, "nx"); // "nonland permanent" cannot reach a land
  t = t.replace(/\bnon-?(?:land|creature|artifact|token)\b/g, "nx");
  return [...nn].some((w) => new RegExp("\\b" + w + "s?\\b").test(t));
}

// A card Scryfall tags as a blinker only counts when its exile-and-return can reach what the
// trigger is about (never a creature-only blinker for a land trigger, and never for tokens,
// which cease to exist).
/** The return only happens once, when the card is sacrificed or lost. */
function ixOneShotReturn(text: string): boolean {
  return /sacrifice (?:this|~)[^.]{0,20}[:.]|is put into a graveyard|leaves the battlefield[^.]{0,60}return|\bbanishing\b/.test(
    text,
  );
}

export function ixHurtsOnlyYou(clause: string): boolean {
  return (
    /damage to you\b/.test(clause) &&
    !/\bany target|target (?:creature|player|opponent)|each opponent|each creature|each player|\bdraws?\b|\bcreate/.test(
      clause,
    )
  );
}

export function ixBlinkFits(
  blink: ReadonlySet<string>,
  card: Pick<CardRecord, "n">,
  text: string,
  f: IxFilter,
): boolean {
  if (
    !ixTagged(blink, card) ||
    f.token === true ||
    ixOneShotReturn(text) ||
    /\bharness\b/.test(text)
  )
    return false;
  const i = text.indexOf("exile");
  if (i < 0 || !/return/.test(text) || !/you control|target creature|target permanent/.test(text))
    return false;
  return ixNounOk(text.slice(i, i + 110), f);
}

/** How a card makes an "enters" or "dies" event happen again, or null. */
export function ixRepeaterKind(
  text: string,
  ev: string,
  f: IxFilter,
  tokensMade: readonly IxToken[],
): string | null {
  const landF = f.types.includes("land") && !f.types.includes("creature");
  if (ev === "enters" && landF) {
    // a plain ramp spell only feeds a "Desert enters" trigger if it names Deserts
    const subHit = !f.subs.length || f.subs.some((x) => text.includes(x.toLowerCase()));
    if (
      subHit &&
      /(?:play|may play) (?:desert )?lands? (?:cards? )?from your graveyard|return (?:up to \w+ |target |all )?(?:target )?land cards? from your graveyard to the battlefield/.test(
        text,
      )
    )
      return "replays lands from the graveyard";
    if (
      subHit &&
      /(?:search your library for|put) [^.]{0,70}lands?[^.]{0,80}onto the battlefield/.test(text)
    )
      return "puts more lands onto the battlefield";
    if (!f.subs.length && /play an additional land|additional land/.test(text))
      return "gives extra land drops";
  }
  if (ev === "enters") {
    let m: RegExpExecArray | null;
    if (
      !landF &&
      f.token !== true &&
      (m =
        /exile (?:target |another |each |any number of |up to \w+ )?(?:other |nontoken |non-?\w+ )?(?:creatures?|permanents?|artifacts?|enchantments?)[^.]{0,40}you control[^]{0,170}?(?:return|put)[^]{0,90}?(?:to|onto) the battlefield/.exec(
          text,
        )) &&
      ixNounOk(m[0], f) &&
      !ixOneShotReturn(text)
    )
      return "flickers them back in";
    if (
      landF &&
      /exile (?:target |another |each |any number of |up to \w+ )?(?:other )?(?:lands?|permanents?)[^.]{0,40}you control[^]{0,170}?(?:return|put)[^]{0,90}?(?:to|onto) the battlefield/.exec(
        text.replace(/\bnonland\b/g, "nx"),
      )
    )
      return "flickers them back in";
    // "any creature" reanimation is not a plan for "Elves" or "creatures with flying"
    const restricted = (f.subs.length || f.kws.length) && !landF;
    if (!landF && f.token !== true && !restricted) {
      if (
        (m =
          /return [^.]{0,70}cards?[^.]{0,70}from (?:your|a|any|all|each) graveyards? to the battlefield/.exec(
            text,
          )) &&
        !/card named/.test(m[0]) &&
        ixNounOk(m[0], f) &&
        !ixOneShotReturn(text)
      )
        return "returns them from the graveyard";
      if (
        (m =
          /put [^.]{0,60}(?:creature|permanent|artifact)[^.]{0,60}(?:from your hand|from your library|from your graveyard|card)[^.]{0,30}onto the battlefield/.exec(
            text,
          )) &&
        ixNounOk(m[0], f) &&
        !ixOneShotReturn(text)
      )
        return "puts them onto the battlefield";
    }
    if (
      !landF &&
      (m =
        /create (?:a |an )?(?:token that's a )?cop(?:y|ies) of (?:target|another|a|each) ((?:\w+ )?\w+)/.exec(
          text,
        )) &&
      (/\btoken/.test(m[1]!) ? f.token === true : ixNounOk(m[1]!, f))
    )
      return "copies them";
    if (tokensMade.some((t) => ixTokenMatches(t, f))) return "makes matching tokens";
  }
  if (ev === "dies") {
    let m: RegExpExecArray | null;
    if (
      /sacrifice (?:a|an|another|any number of|x|up to)[^:.]{0,40}(?::|,|\.|$)/.test(text) &&
      /(?:^|\n|\{[^}]*\}[^:]*:)\s*sacrifice|sacrifice [^:.]{0,40}:/.test(text)
    ) {
      const w =
        /sacrifice (?:another |an? |any number of |up to \w+ |x )?(?:other |nontoken )?([a-z]+)/.exec(
          text,
        );
      // "Sacrifice a Treasure" is not a way to kill your creatures
      if (
        !w ||
        (/^(?:creature|artifact|permanent|enchantment|land|planeswalker)s?$/.test(w[1]!) &&
          ixNounOk(w[1]!, f))
      )
        return "sacrifices things (an outlet)";
    }
    if (
      (m =
        /destroy all[^.]{0,40}|each creature gets -[^.]{0,20}|all creatures get -[^.]{0,20}/.exec(
          text,
        )) &&
      ixNounOk(m[0] + " creature", f)
    )
      return "wipes the board";
  }
  return null;
}

/** How a card makes a payoff's trigger count twice, or null. `p` is the payoff, when known. */
export function ixMultiplierKind(
  text: string,
  ev: string,
  f: IxFilter,
  p?: { tokens?: readonly IxToken[]; card: Pick<CardRecord, "t"> },
): string | null {
  if (
    p &&
    p.tokens &&
    p.tokens.length &&
    /twice that many (?:of those )?(?:creature )?tokens/.test(text)
  )
    return "doubles the tokens it makes";
  // only the sentence that says "triggers an additional time" says which event it doubles
  const sentence = text.split(/[.\n]/).find((x) => /additional time|triggers twice/.test(x));
  if (!sentence) return null;
  // only legendary permanents (or artifacts) are doubled
  if (/\blegendary\b/.test(sentence) && !/legendary creature you control/.test(sentence))
    return f.types.includes("artifact") && /\bartifact\b/.test(sentence) && !f.subs.length
      ? "makes it trigger twice"
      : null;
  if (/triggered ability of a legendary creature you control/.test(sentence))
    return p && /legendary creature/i.test(String(p.card.t || "").split("—")[0]!)
      ? "makes it trigger twice (legendary creature)"
      : null;
  if (/\bland\b/.test(sentence) && /entering|enters/.test(sentence))
    return f.types.includes("land") ? "makes it trigger twice" : null;
  if (ev === "enters") {
    // what has to enter? "a Wizard", "a land" are too narrow to double an unrelated creature trigger
    const sub =
      /(?:^|if |whenever |when )(?:an? |one or more |another )?([a-z' ,-]+?) (?:entering|entered|enters|enter)\b/.exec(
        sentence,
      );
    if (sub && !/\b(?:permanent|creature|artifact)s?\b/.test(sub[1]!)) return null;
    if (sub && /\bland\b|\bwizard\b|\bnontoken\b/.test(sub[1]!)) return null;
  }
  if (
    ev === "enters" &&
    /\benter/.test(sentence) &&
    (f.self
      ? true
      : f.types.some((t) => /creature|artifact/.test(t)) || f.subs.length || f.kws.length)
  )
    return ixNounOk(sentence, f) && /artifact or creature|creature|permanent/.test(sentence)
      ? "makes it trigger twice"
      : null;
  if (ev === "dies" && /\bdy(?:ing)|\bdies\b/.test(sentence))
    return ixNounOk(sentence, f) ? "makes it trigger twice" : null;
  return null;
}
