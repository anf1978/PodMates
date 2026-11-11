// The pairs behind "New dimension": a maker side and a payoff side for tokens, artifacts,
// counters, sacrifice, graveyard, lifegain, spells, land ramp and blink, with the cheap cards
// that fill each side. Moved unchanged from the inline IXD table.

import type { CardRecord } from "../../../cards/tuple.ts";
import { ixBlinkFits } from "./links.ts";
import { ixParseFilter, ixTokensMade } from "./text.ts";

export const IXD_CHEAP = 6;
export type SideTest = (t: string, c: CardRecord) => boolean;
type Cand = readonly [RegExp | SideTest, string];

export interface Side {
  name: string;
  verb: string;
  test: SideTest;
  cands: readonly Cand[];
  min: number;
  max: number;
  one: string;
}

interface Dimension {
  id: string;
  label: string;
  make: Side;
  pay: Side;
  mk: string;
  mk2?: string;
  cmd: string;
  reverse?: boolean;
}

export function ixdTyp(c: Pick<CardRecord, "t">): string {
  return String(c.t || "")
    .split("—")[0]!
    .toLowerCase();
}
function ixdSide(
  name: string,
  verb: string,
  test: SideTest,
  cands: readonly Cand[],
  min: number,
  max?: number,
  one?: string,
): Side {
  return { name, verb, test, cands, min, max: max === undefined ? 3 : max, one: one || name };
}
export function ixdPl(side: Side, n: number): string {
  return n + " " + (n === 1 ? side.one : side.name);
}

export function dimensions(blink: ReadonlySet<string>): Dimension[] {
  const blinkF = () => {
    try {
      return ixParseFilter("a creature", []);
    } catch {
      return null;
    }
  };
  const counterMake = /(?:put|puts|enters with|gets?|distribute)[^.]{0,60}\+1\/\+1 counters?/;
  const tokenMade = (t: string): boolean => ixTokensMade(t).some((k) => k.creature);
  const sacOutlet = /sacrifice (?:a|an|another|any number of|up to \w+)[^:.]{0,40}:/;
  const deathPay =
    /whenever (?:~ or )?(?:another |a |one or more )?(?:nontoken )?creatures? (?:you control )?(?:and\/or [^.]{0,40})?dies[^.]*(?:each opponent loses|loses? \d+ life|deals? \d+ damage|draw|create|put|gain)|whenever you sacrifice (?:a|another)/;
  const reanim =
    /return [^.]{0,70}(?:creature|permanent) cards?[^.]{0,70}from (?:your|a|any) graveyards? to the battlefield|put [^.]{0,60}creature card[^.]{0,60}from (?:your|a|any) graveyards? onto the battlefield/;
  const selfMill =
    /\bmill (?:\w+ )?cards?\b|\bsurveil\b|discard (?:a|one|two|up to \w+) cards?[^.]{0,40}(?:then|,) draw|draw (?:a|two|three) cards?[^.]{0,40}then discard/;
  const tokenPay: Cand[] = [
    // not "Merfolk creatures you control get ..."
    [
      /(?:^|[.,:;\n]\s*|\b(?:and|then|have|gain|until|if|where) )(?:other )?creatures you control get \+\d+\/\+\d+/,
      "boosts your whole team",
    ],
    [
      /twice that many (?:of those )?(?:creature )?tokens|if an effect would create one or more tokens[^.]*instead/,
      "doubles the tokens you make",
    ],
    [
      /(?:for each|equal to the number of) (?:other )?creatures? you control[^.]{0,60}(?:damage|life|draw)|(?:damage|life|draw)[^.]{0,60}(?:for each|equal to the number of) (?:other )?creatures? you control/,
      "scales with how many creatures you have",
    ],
    [
      /whenever (?:one or more )?(?:other )?(?:creature )?tokens? (?:you control )?(?:enters?|are created|you control)/,
      "rewards every token",
    ],
  ];
  const artPay: Cand[] = [
    [
      /(?:for each|equal to the number of) artifacts? you control|artifacts you control (?:get|have)/,
      "scales with your artifacts",
    ],
    [
      /whenever (?:an?|one or more) (?:nontoken )?artifacts?[^.]{0,30}(?:enters?|you control)|whenever you (?:cast an artifact|sacrifice an artifact)|whenever (?:a|one or more) treasures?/,
      "pays you each time an artifact arrives",
    ],
  ];
  const cntPay: Cand[] = [
    [
      /twice that many[^.]{0,40}counters|double the number of[^.]{0,40}counters|put (?:that many )?(?:an )?additional[^.]{0,30}counters?/,
      "doubles your counters",
    ],
    [/\bproliferate\b/, "adds a counter of every kind you have"],
    [
      /(?:for each|number of) \+1\/\+1 counters? (?:on|among)|creatures you control with \+1\/\+1 counters|whenever (?:you put|one or more \+1\/\+1 counters)/,
      "pays off your counters",
    ],
  ];
  const onePay =
    (arr: Cand[]): SideTest =>
    (t) =>
      arr.some((a) => (a[0] as RegExp).test(t));
  const lifeGain = /gain (?:\d+|x|that much) life|lifelink/;
  const lifePay =
    /whenever you gain life|for each (?:1 )?life you gained|life you gained this turn|if you gained life/;
  const spellPay =
    /whenever you cast (?:an? |your (?:first|second) )?(?:instant|sorcery|noncreature)|whenever you cast (?:or copy )?an instant or sorcery/;
  const landRamp =
    /search your library for[^.]{0,60}\bland\b[^.]{0,80}onto the battlefield|put (?:a|up to \w+) lands?[^.]{0,40}onto the battlefield|additional land|play lands from/;
  const landfall =
    /\blandfall\b|whenever (?:a|another|one or more) lands? (?:you control )?enters?/;
  const blinks = (t: string, c: CardRecord): boolean => {
    const f = blinkF();
    return !!f && ixBlinkFits(blink, c, t, f);
  };
  const bodies = /\bwhen(?:ever)?\b[^.]*\benters\b|^create|\{t\}|at the beginning/;
  return [
    {
      id: "tokens",
      label: "Your tokens",
      make: ixdSide(
        "token makers",
        "make tokens",
        (t) => tokenMade(t),
        [[(t, c) => tokenMade(t) && (c.m || 0) <= 3 && bodies.test(t), "makes more bodies"]],
        8,
      ),
      pay: ixdSide(
        "ways to use them",
        "use tokens",
        onePay(tokenPay),
        tokenPay,
        0,
        3,
        "way to use them",
      ),
      mk: "Put your tokens to work",
      mk2: "More token makers",
      cmd: "rewards a big board",
    },
    {
      id: "artifacts",
      label: "Your artifacts",
      make: ixdSide(
        "artifacts and treasure makers",
        "make artifacts",
        (t, c) =>
          (/artifact/.test(ixdTyp(c)) &&
            !/land/.test(ixdTyp(c)) &&
            !/\badd (?:\{|one|two|three|that)/.test(t)) ||
          /create[^.]{0,40}\btreasure\b/.test(t),
        [[(t, c) => /create[^.]{0,40}\btreasure\b/.test(t) && (c.m || 0) <= 3, "makes Treasure"]],
        16,
      ),
      pay: ixdSide(
        "artifact payoffs",
        "reward artifacts",
        onePay(artPay),
        artPay,
        0,
        3,
        "artifact payoff",
      ),
      mk: "Reward your artifacts",
      mk2: "Cheap artifact makers",
      cmd: "rewards artifacts",
    },
    {
      id: "counters",
      label: "Your +1/+1 counters",
      make: ixdSide(
        "counter sources",
        "add counters",
        (t) => counterMake.test(t),
        [
          [
            (t, c) =>
              counterMake.test(t) &&
              (c.m || 0) <= 3 &&
              /\bwhen(?:ever)?\b|\{t\}|at the beginning/.test(t),
            "puts counters on creatures",
          ],
        ],
        8,
      ),
      pay: ixdSide(
        "counter payoffs",
        "multiply counters",
        onePay(cntPay),
        cntPay,
        0,
        3,
        "counter payoff",
      ),
      mk: "Multiply the counters",
      mk2: "More counter sources",
      cmd: "cares about counters",
    },
    {
      id: "sac",
      label: "Sacrifice",
      make: ixdSide(
        "bodies to sacrifice",
        "make fodder",
        (t, c) => tokenMade(t) || (/creature/.test(ixdTyp(c)) && /\bwhen ~ dies\b/.test(t)),
        [
          [
            (t, c) => tokenMade(t) && (c.m || 0) <= 3 && bodies.test(t),
            "makes bodies to sacrifice",
          ],
        ],
        8,
      ),
      pay: ixdSide(
        "sacrifice outlets and death payoffs",
        "cash in sacrifices",
        (t) => sacOutlet.test(t) || deathPay.test(t),
        [
          [
            (t) => sacOutlet.test(t) && /sacrifice (?:a|an|another)[^:.]{0,30}creature/.test(t),
            "a way to sacrifice your own creatures",
          ],
          [
            (t) => deathPay.test(t) && !/sacrifice a creature:/.test(t),
            "drains or draws when your creatures die",
          ],
        ],
        0,
        2,
        "sacrifice outlet or death payoff",
      ),
      mk: "Cash in the sacrifices",
      mk2: "Bodies to sacrifice",
      cmd: "rewards creatures dying",
    },
    {
      id: "gy",
      label: "Your graveyard",
      make: ixdSide(
        "ways to fill the graveyard",
        "fill the graveyard",
        (t) => selfMill.test(t),
        [[(t, c) => selfMill.test(t) && (c.m || 0) <= 3, "puts cards in the graveyard"]],
        6,
      ),
      pay: ixdSide(
        "reanimation spells",
        "bring creatures back",
        (t) => reanim.test(t),
        [[(t) => reanim.test(t), "returns creatures from the graveyard to the battlefield"]],
        3,
        1,
        "reanimation spell",
      ),
      mk: "Bring them back",
      mk2: "Fill the graveyard",
      cmd: "rewards a full graveyard",
      reverse: true,
    },
    {
      id: "life",
      label: "Your lifegain",
      make: ixdSide(
        "lifegain sources",
        "gain life",
        (t) => /gain (?:\d+|x|that much) life|lifelink|gains? life equal/.test(t),
        [[(t, c) => lifeGain.test(t) && (c.m || 0) <= 3, "gains life"]],
        10,
      ),
      pay: ixdSide(
        "lifegain payoffs",
        "reward lifegain",
        (t) => lifePay.test(t),
        [[(t) => lifePay.test(t), "pays you for gaining life"]],
        0,
        3,
        "lifegain payoff",
      ),
      mk: "Pay off the lifegain",
      mk2: "More lifegain",
      cmd: "rewards lifegain",
    },
    {
      id: "spells",
      label: "Your spells",
      make: ixdSide(
        "instants and sorceries",
        "cast spells",
        (_t, c) => /instant|sorcery/.test(ixdTyp(c)),
        [],
        26,
      ),
      pay: ixdSide(
        "spell payoffs",
        "reward spells",
        (t) =>
          /whenever you cast (?:an? |your (?:first|second) )?(?:instant|sorcery|noncreature)|\bmagecraft\b|whenever you cast (?:or copy )?an instant or sorcery/.test(
            t,
          ),
        [[(t) => spellPay.test(t), "pays you each time you cast a spell"]],
        0,
        3,
        "spell payoff",
      ),
      mk: "Reward every spell",
      cmd: "rewards casting spells",
    },
    {
      id: "land",
      label: "Your land ramp",
      make: ixdSide(
        "land ramp cards",
        "put lands onto the battlefield",
        (t) => landRamp.test(t),
        [
          [
            (t, c) =>
              /search your library for[^.]{0,60}\bland\b[^.]{0,80}onto the battlefield|additional land/.test(
                t,
              ) && (c.m || 0) <= 4,
            "puts more lands onto the battlefield",
          ],
        ],
        9,
      ),
      pay: ixdSide(
        "landfall payoffs",
        "reward lands",
        (t) => landfall.test(t),
        [[(t, c) => landfall.test(t) && !/\bland\b/.test(ixdTyp(c)), "pays you for every land"]],
        0,
        3,
        "landfall payoff",
      ),
      mk: "Pay off the lands",
      cmd: "rewards lands",
    },
    {
      id: "blink",
      label: "Your enter-the-battlefield creatures",
      make: ixdSide(
        "enter-the-battlefield creatures",
        "trigger when they enter",
        (t, c) => /creature/.test(ixdTyp(c)) && /\bwhen ~ enters\b/.test(t),
        [],
        12,
      ),
      pay: ixdSide(
        "blink effects",
        "flicker creatures",
        blinks,
        [[(t, c) => blinks(t, c) && (c.m || 0) <= 4, "flickers a creature so it enters again"]],
        0,
        2,
        "blink effect",
      ),
      mk: "Use them twice",
      cmd: "rewards creatures entering",
    },
  ];
}
