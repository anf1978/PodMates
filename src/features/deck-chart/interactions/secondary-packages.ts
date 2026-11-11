// Package passes beyond the type-line triggers: triggers matched by what the deck holds
// (casting, drawing, lifegain, tokens, combat damage), an attacking commander's helpers, and
// sacrifice-outlet or cost-reducer commanders. Moved unchanged from index.html.

import type { CardRecord } from "../../../cards/tuple.ts";
import { classifyCard } from "../../../engine/classify.ts";
import { escapeHtml } from "../../../ui/card-name.ts";
import { ixTagged } from "./links.ts";
import { ixEffect, ixLinkSlot } from "./text.ts";
import type { InteractionTags, IxEntry, IxPackage } from "./types.ts";
import { IXW_LOYALTY_LINE } from "./walkers.ts";

/** A classifier flag by name; unknown names read as absent, as before. */
export function ixTrait(card: CardRecord, key: string): unknown {
  return (classifyCard(card) as unknown as Record<string, unknown>)[key];
}

interface SimpleSpec {
  phrase: string;
  pred: (o: IxEntry) => boolean;
}

/** Loyalty abilities and emblems are read by the planeswalker plan, not as triggers. */
export const skipLine = (line: string): boolean =>
  IXW_LOYALTY_LINE.test(line) || /emblem/.test(line);

/** More triggers, matched by what the deck holds rather than by a card's type line. */
export function simplePackages(
  packages: IxPackage[],
  all: IxEntry[],
  nonland: IxEntry[],
  nl: number,
): void {
  const hasType = (o: IxEntry, re: RegExp): boolean =>
    re.test(
      String(o.card.t || "")
        .split("—")[0]!
        .toLowerCase(),
    );
  const SIMPLE: ReadonlyArray<readonly [string, RegExp, (m1: string) => SimpleSpec | null]> = [
    [
      "cast",
      /whenever you cast (?:a|an|your first|your second|another)? ?([^,.;:]*?)spell/,
      (m1) => {
        const t = m1.toLowerCase();
        if (/\bnon/.test(t) && !/noncreature/.test(t)) return null;
        if (/\bwith\b|\bfrom\b|\bof\b|\bthat\b/.test(t)) return null;
        const tests: Array<[string, RegExp]> = [
          ["creature", /creature/],
          ["artifact", /artifact/],
          ["enchantment", /enchantment/],
          ["instant or sorcery", /instant|sorcery/],
          ["planeswalker", /planeswalker/],
        ];
        if (/noncreature/.test(t))
          return { phrase: "you cast a noncreature spell", pred: (o) => !hasType(o, /creature/) };
        for (const [lab, re] of tests)
          if (re.test(t))
            return {
              phrase: "you cast " + (/^[aeiou]/.test(lab) ? "an " : "a ") + lab + " spell",
              pred: (o) => hasType(o, re),
            };
        return t.trim() === "" ? { phrase: "you cast a spell", pred: () => true } : null;
      },
    ],
    [
      "draw",
      /whenever you draw (?:a|your (?:first|second)) card/,
      () => ({ phrase: "you draw a card", pred: (o) => !!ixTrait(o.card, "draw") }),
    ],
    [
      "lifegain",
      /whenever you gain life/,
      () => ({
        phrase: "you gain life",
        pred: (o) => !!ixTrait(o.card, "lifegain") || /lifelink/.test(o.text),
      }),
    ],
    [
      "sacrifice",
      /whenever you sacrifice (?:a|another|one or more) ([^,.;:]*)/,
      () => ({ phrase: "you sacrifice something", pred: (o) => !!ixTrait(o.card, "sacOutlet") }),
    ],
    [
      "tokens",
      /whenever you create (?:one or more |a )?(?:[a-z0-9/ ]+ )?tokens?/,
      () => ({ phrase: "you create a token", pred: (o) => o.tokens.length > 0 }),
    ],
    [
      "dmg",
      /whenever (?:~|a creature you control|one or more creatures you control) deals? combat damage to (?:a player|an opponent)/,
      () => ({
        phrase: "your creatures connect",
        pred: (o) =>
          hasType(o, /creature/) &&
          /flying|menace|trample|can't be blocked|shadow|fear|intimidate/.test(o.text),
      }),
    ],
  ];
  for (const p of all) {
    for (const line of p.text.split("\n")) {
      if (skipLine(line)) continue;
      for (const [ev, re, mk] of SIMPLE) {
        const mm = re.exec(line);
        if (!mm) continue;
        const spec = mk(mm[1] || "");
        if (!spec) continue;
        const eff = ixEffect(line.slice(mm.index + mm[0].length));
        const objs = nonland.filter((o) => o !== p && spec.pred(o));
        const objCount = objs.reduce((a, o) => a + (o.qty || 1), 0);
        if (objCount < (p.isCmd ? 4 : 7)) continue;
        let score =
          eff.w *
          (0.55 * Math.min(1, objCount / 10)) *
          (1 + Math.min(0.5, (objCount / nl) * 1.2)) *
          0.9;
        if (p.isCmd) score *= 1.5;
        packages.push({
          kind: "trigger",
          payoff: p.card.n,
          isCmd: p.isCmd,
          event: ev,
          phrase: spec.phrase,
          filter: { label: spec.phrase, generic: false },
          effect: eff.label,
          objects: objs.map((o) => o.card.n),
          objCount,
          tokenMakers: [],
          repeaters: [],
          multipliers: [],
          score,
        });
        break;
      }
    }
  }
}

/** A commander that attacks for value: what helps it attack, or attack again. */
export function commanderPackages(
  packages: IxPackage[],
  tags: InteractionTags,
  all: IxEntry[],
): void {
  for (const p of all.filter((x) => x.isCmd)) {
    if (!/whenever ~ attacks|whenever (?:you attack|a creature you control attacks)/.test(p.text))
      continue;
    const eff = ixEffect(
      p.text.slice(p.text.search(/whenever (?:~|you|a creature you control) (?:attacks?)/)),
    );
    const helpers = all
      .filter(
        (o) =>
          o !== p &&
          (/additional combat phase|untap all creatures you control|(?:creatures?|permanents?)[^.]{0,30}(?:have|gain) haste|all creatures have haste/.test(
            o.text,
          ) ||
            ixTagged(tags.extraCombat, o.card)),
      )
      .map((o) => ({
        name: o.card.n,
        how: /additional combat/.test(o.text) ? "extra combat" : "helps it attack sooner",
      }));
    if (!helpers.length) continue;
    packages.push({
      kind: "trigger",
      payoff: p.card.n,
      isCmd: true,
      event: "attack",
      phrase: "~ attacks".replace("~", p.card.n.split(",")[0]!),
      filter: { label: "", generic: false },
      effect: eff.label,
      objects: [],
      objCount: 0,
      tokenMakers: [],
      repeaters: helpers,
      multipliers: [],
      score: eff.w * (0.3 + 0.35 * Math.min(1, helpers.length / 2)) * 1.5,
    });
  }
}

/** Commanders that work in other ways: sacrifice outlets (need fodder) and cost reducers (need matching spells). */
export function sacrificeAndCostPackages(
  packages: IxPackage[],
  all: IxEntry[],
  nonland: IxEntry[],
): void {
  for (const p of all.filter((x) => x.isCmd)) {
    if (packages.some((k) => k.payoff === p.card.n)) continue;
    const sm =
      /(?:^|\n)([^\n]*?sacrifice (?:another |a |an )?(?:other )?(?:creature|permanent|artifact)[^\n:]{0,20}:\s*[^\n]*)/.exec(
        p.text,
      );
    if (sm) {
      const eff = ixEffect(sm[1]!.slice(sm[1]!.indexOf(":") + 1));
      const makers = nonland
        .filter(
          (o) =>
            o !== p &&
            (o.tokens.length ||
              (/creature/i.test(o.card.t || "") && /when [^,.]*enters/.test(o.text))),
        )
        .map((o) => o.card.n);
      const outlets = all
        .filter((o) => o !== p && ixTrait(o.card, "sacOutlet"))
        .map((o) => ({ name: o.card.n, how: "another way to sacrifice" }));
      if (makers.length >= 3)
        packages.push({
          kind: "trigger",
          payoff: p.card.n,
          isCmd: true,
          event: "fodder",
          head: `<strong>${ixLinkSlot(p.card.n)}</strong> turns spare creatures into value (${escapeHtml(eff.label)}) by sacrificing them.`,
          filter: { label: "", generic: false },
          effect: eff.label,
          objects: makers,
          objCount: makers.length,
          tokenMakers: [],
          repeaters: outlets,
          multipliers: [],
          score: eff.w * (0.4 + 0.3 * Math.min(1, makers.length / 12)) * 1.5,
          fodderLabel: "cards give it bodies to sacrifice",
        });
      continue;
    }
    const cm =
      /(white|blue|black|red|green|artifact|creature|enchantment|noncreature|instant|sorcery|multicolored)?,?(?: and\/or | or | and )?([a-z]+)? ?spells you cast cost \{(\d)\} less/.exec(
        p.text,
      );
    if (cm) {
      const words = [
        "white",
        "blue",
        "black",
        "red",
        "green",
        "artifact",
        "creature",
        "enchantment",
        "noncreature",
        "instant",
        "sorcery",
      ].filter((w) => new RegExp("\\b" + w + "\\b").test(p.text.split("spells you cast")[0]!));
      const COL: Record<string, string> = {
        white: "W",
        blue: "U",
        black: "B",
        red: "R",
        green: "G",
      };
      const objs = nonland.filter(
        (o) =>
          o !== p &&
          (!words.length ||
            words.some((w) =>
              COL[w]
                ? (o.card.c || "").includes(COL[w])
                : w === "noncreature"
                  ? !/creature/i.test(o.card.t || "")
                  : new RegExp(w, "i").test(o.card.t || ""),
            )),
      );
      if (objs.length >= 8)
        packages.push({
          kind: "rule",
          payoff: p.card.n,
          isCmd: true,
          event: "rule",
          head: `<strong>${ixLinkSlot(p.card.n)}</strong> makes ${escapeHtml(words.join(", ") || "your")} spells cost less${/opponents cast cost/.test(p.text) ? " and taxes your opponents" : ""}.`,
          filter: { label: "", generic: false },
          effect: "",
          objects: objs.map((o) => o.card.n),
          objCount: objs.length,
          tokenMakers: [],
          repeaters: [],
          multipliers: [],
          score: 3 * Math.min(1, objs.length / 25) * 1.5 + 0.5,
        });
    }
  }
}
