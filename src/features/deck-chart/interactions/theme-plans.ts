// Lands, historic, legendary, commander-property, X-spell and go-wide plans, read from the
// deck's make-up like the planeswalker plan. Moved unchanged from index.html.

import type { CardRecord } from "../../../cards/tuple.ts";
import { IXPROP } from "../../../engine/commander-ability.ts";
import { ixLinkSlot, ixNames, ixPlan, ixRoles, ixText } from "./text.ts";
import type { IxCommanderEntry, IxEntry, IxPackage } from "./types.ts";

const IXL = {
  landfall:
    /landfall|(?:whenever|when) (?:a|another|one or more) (?:basic )?lands? (?:you control )?enters?/,
  gy: /(?:whenever|when) (?:one or more |a |an )?(?:land|desert)[a-z ]*? (?:cards? )?(?:you control )?(?:is |are )?put into (?:a|your) graveyard|this land is put into a graveyard/,
  feed: /sacrifice (?:a|an|any number of|x|up to \w+|two|three) lands?\b|\bsacrifice ~[^.]*:|, sacrifice ~|put the chosen cards into your graveyard|discard a land/,
  replay:
    /(?:play|may play) (?:desert )?lands? (?:cards? )?from your graveyard|return (?:up to \w+ |target |all )?(?:target )?land cards? from your graveyard|land card from your graveyard/,
  ramp: /play an additional land|additional land|(?:search your library for|put) [^.]{0,70}lands?[^.]{0,80}onto the battlefield/,
  doubler: /land entering causes a triggered ability[^.]*additional time/,
  animate: /all lands are \d\/\d creatures|lands you control (?:are|become) [^.]*creatures/,
} as const;
const IXG = {
  anthem:
    /creature tokens you control get|(?<!land )(?:other )?creatures you control (?:each )?get \+\d\/\+\d|each (?:other )?creature you control gets \+\d\/\+\d/,
  haste: /creatures you control have haste|all creatures have haste/,
  finisher:
    /creatures you control (?:gain|get)[^.]*\+x\/\+x|creatures you control get \+x\/\+x|each creature you control gets \+x\/\+x/,
  doubler: /twice that many (?:of those )?tokens|twice that many creature tokens/,
} as const;
/** X spells: cards with {X} in the mana cost, and what copies or doubles them. */
export const IXX = {
  cmdCopies:
    /\{x\} in (?:its|their|the) (?:mana|activation) costs?|(?:spells?|abilit(?:y|ies)) with \{x\}|\bx spells?\b/,
  doubler:
    /(?:spells?|abilit(?:y|ies)) with \{x\}[^.]*(?:copy|twice|double)|(?:copy|double)[^.]*(?:spells?|abilit(?:y|ies)) with \{x\}|double the value of x|value of x[^.]*(?:twice|double)/,
  copySpell:
    /(?<!or )\bcopy (?:target|that|it|each|a|an|the) [^.]*(?:instant|sorcery|spell)(?![^.]*wasn't cast)/,
} as const;
export const IXLG = {
  payoff:
    /legendary (?:creature|spell|permanent|land|card|artifact)s?[^.]*(?:enters?|you cast|you control|cast)|(?:cast|play|whenever)[^.]*legendary (?:spell|creature|permanent|land)|number of legendary|for each legendary/,
  legendRule: /legend rule/,
  cost: /legendary (?:spells?|creatures?|permanents?)[^.]*cost[^.]*less|legendary[^.]*spells? you cast cost/,
  tutor: /search your library for (?:a|an|up to \w+) legendary/,
} as const;
export const IXH = {
  payoff: /\bhistoric\b/,
  cost: /historic[^.]*cost[^.]*less|cost[^.]*less[^.]*historic/,
} as const;
const IXH_MIN = 18; // historic nonland cards (artifacts, legendaries, Sagas) for the plan to show; the median precon has 30%, the 90th percentile 63%
const IXLG_MIN = 14; // legendary nonland cards for the plan to show (the 90th-percentile precon has about 24%)
const IXX_MIN = 8; // X spells for the plan to show (the median precon has about 1, the 90th percentile about 4)
// payoffs for the lands plan; token makers for the go-wide plan, alone or with a go-wide shell (all rare among the 159 precons)
const IXL_MIN = 6,
  IXG_MIN = 16,
  IXG_SHELL_MIN = 9;

export function ixThemePlans(
  cards: readonly CardRecord[],
  all: IxEntry[],
  nonland: IxEntry[],
  used: Set<string>,
  commanders: readonly string[],
): IxPackage[] {
  const plans: IxPackage[] = [];
  const nm = ixNames;
  const pick = (arr: IxEntry[], re: RegExp, skipCmd: boolean): IxEntry[] =>
    arr.filter((m) => re.test(m.text) && !(skipCmd && m.isCmd));
  const mk = (payoff: string, isCmd: boolean, head: string, lines: string[]): void => {
    plans.push(ixPlan(payoff, isCmd, head, lines));
  };
  // The commander may not be among the matched cards (it can be typed in its own box), so it is
  // also looked up by name.
  const commanderEntries = (test: (text: string) => boolean): IxCommanderEntry[] =>
    (all.filter((m) => m.isCmd && test(m.text)) as IxCommanderEntry[]).concat(
      (commanders || [])
        .map((n) => cards.find((c) => c.n === n))
        .filter(
          (c): c is CardRecord => !!c && !all.some((m) => m.card.n === c.n) && test(ixText(c)),
        )
        .map((c) => ({ card: c, text: ixText(c), isCmd: true })),
    );
  // Lands as the engine
  {
    const landfall = pick(all, IXL.landfall, true),
      gy = pick(all, IXL.gy, true);
    const payoffs = landfall.concat(gy.filter((m) => !landfall.includes(m)));
    const feed = pick(all, IXL.feed, true).filter(
      (m) => !payoffs.includes(m) || /sacrifice/.test(m.text),
    );
    const replay = pick(all, IXL.replay, false);
    const ramp = pick(nonland, IXL.ramp, true).filter((m) => !replay.includes(m));
    const dbl = pick(all, IXL.doubler, false);
    const animate = pick(all, IXL.animate, false);
    if (payoffs.length >= IXL_MIN && feed.length + replay.length >= 3) {
      const lines: string[] = [];
      if (landfall.length) lines.push("Pay off a land entering: " + nm(landfall, 5) + ".");
      if (gy.length)
        lines.push(
          "Pay off a land going to the graveyard: " +
            nm(gy, 5) +
            ". Each land can pay twice: once when it is played and once when it is lost.",
        );
      if (feed.length) lines.push("Put lands in the graveyard on purpose: " + nm(feed, 5) + ".");
      if (replay.length)
        lines.push(
          '<span style="color:var(--gold);">Play them again</span>: ' + nm(replay, 5) + ".",
        );
      if (dbl.length)
        lines.push(
          '<span style="color:var(--gold);">Landfall twice</span>: ' +
            nm(dbl, 2) +
            " makes every land drop trigger an extra time.",
        );
      if (ramp.length)
        lines.push(
          ramp.length + " ways to put extra lands onto the battlefield (" + nm(ramp, 4) + ").",
        );
      if (animate.length)
        lines.push(
          "Lands become creatures: " +
            nm(animate, 2) +
            ". Every land is then a body, and a target.",
        );
      mk(
        "__plan_lands",
        false,
        "<strong>Lands are the engine</strong>: " +
          payoffs.length +
          " cards pay off lands entering or leaving, with " +
          (feed.length + replay.length) +
          " ways to lose and replay them.",
        lines,
      );
      payoffs.concat(feed, replay, ramp, dbl, animate).forEach((m) => used.add(m.card.n));
    }
  }
  // Historic matters as the plan
  {
    const isHis = (m: IxEntry): boolean =>
      /\b(?:legendary|artifact|saga)\b/i.test(String(m.card.t || "").split("//")[0]!);
    const his = nonland.filter((m) => !m.isCmd && isHis(m));
    const cmdH = commanderEntries((t) => IXH.payoff.test(t));
    const nlq = nonland.reduce((a, m) => a + (m.qty || 1), 0) || 1;
    if (
      (his.length >= IXH_MIN && his.length / nlq >= 0.5) ||
      (cmdH.length && his.length >= 14 && his.length / nlq >= 0.4)
    ) {
      const pay = nonland.filter((m) => !m.isCmd && IXH.payoff.test(m.text));
      const red = pay.filter((m) => IXH.cost.test(m.text));
      const lines: string[] = [];
      if (cmdH.length)
        lines.push(
          ixLinkSlot(cmdH[0]!.card.n) +
            " rewards casting historic spells (artifacts, legendary cards and Sagas).",
        );
      if (pay.length) lines.push("Cards that reward historic spells: " + nm(pay, 4) + ".");
      if (red.length) lines.push("Cheaper historic spells: " + nm(red, 3) + ".");
      lines.push("Historic cards: " + nm(his, 6) + ".");
      mk(
        "__plan_historic",
        false,
        "<strong>" +
          his.length +
          " historic cards</strong> (artifacts, legendaries and Sagas): the deck casts them in bulk.",
        lines,
      );
      his.concat(pay).forEach((m) => used.add(m.card.n));
    }
  }
  // Legendary matters as the plan
  {
    const isLeg = (m: IxEntry): boolean =>
      /\blegendary\b/i.test(String(m.card.t || "").split("//")[0]!);
    const legs = nonland.filter((m) => !m.isCmd && isLeg(m));
    const cmdLg = commanderEntries((t) => /\blegendary\b/.test(t));
    const nlq = nonland.reduce((a, m) => a + (m.qty || 1), 0) || 1;
    const histPlan = plans.some((p) => p.payoff === "__plan_historic"); // legends are part of historic, so that plan already covers them
    if (
      !(histPlan && !cmdLg.length) &&
      ((legs.length >= IXLG_MIN && legs.length / nlq >= 0.25) ||
        (cmdLg.length && legs.length >= 10))
    ) {
      const pay = nonland.filter(
        (m) => !m.isCmd && IXLG.payoff.test(m.text) && !/enchanted creature/.test(m.text),
      );
      const rule = nonland.filter((m) => !m.isCmd && IXLG.legendRule.test(m.text));
      const lines: string[] = [];
      if (cmdLg.length)
        lines.push(ixLinkSlot(cmdLg[0]!.card.n) + " pays you for casting legendary spells.");
      if (pay.length) lines.push("Cards that reward legendary permanents: " + nm(pay, 4) + ".");
      if (rule.length) lines.push("Keep duplicates alive: " + nm(rule, 3) + ".");
      lines.push("Legendary cards: " + nm(legs, 6) + ".");
      mk(
        "__plan_legend",
        false,
        "<strong>" + legs.length + " legendary cards</strong>: the deck is built around legends.",
        lines,
      );
      legs.concat(pay, rule).forEach((m) => used.add(m.card.n));
    }
  }
  // Generic property plans (noncreature, multicolored, kicker, cast from exile, cycling...):
  // shown when the commander rewards the property and the deck leans into it
  for (const p of IXPROP) {
    const cmdP = commanderEntries((t) => p.cmd.test(t));
    if (!cmdP.length) continue;
    const hits = nonland.filter((m) => !m.isCmd && p.test(m.card));
    const nlq = nonland.length || 1;
    if (hits.length < 5 || hits.length / nlq < p.base + 0.08) continue;
    const pay = nonland.filter((m) => !m.isCmd && p.pay.test(m.text)),
      red = nonland.filter((m) => !m.isCmd && p.cost.test(m.text));
    const lines = [ixLinkSlot(cmdP[0]!.card.n) + " rewards " + p.label + "."];
    if (pay.length) lines.push("Cards that reward them: " + nm(pay, 4) + ".");
    if (red.length) lines.push("Cheaper ones: " + nm(red, 3) + ".");
    if (p.half) {
      const half = p.half;
      const halves = nonland.filter((m) => !m.isCmd && half.test(m.text));
      if (halves.length) {
        const dbl = p.doubles && p.doubles.test(cmdP[0]!.text);
        lines.push(
          '<span style="color:var(--gold);">Mill half a library</span>: ' +
            nm(halves, 6) +
            "." +
            (dbl
              ? " With " +
                ixLinkSlot(cmdP[0]!.card.n) +
                " doubling the mill, each of these empties a whole library, so they are your finishers."
              : ""),
        );
      }
    }
    lines.push(p.label.charAt(0).toUpperCase() + p.label.slice(1) + ": " + nm(hits, 6) + ".");
    mk(
      "__plan_prop_" + p.key,
      false,
      "<strong>" + hits.length + " " + p.label + "</strong>: " + p.head,
      lines,
    );
    hits.concat(pay, red).forEach((m) => used.add(m.card.n));
  }
  // X spells as the plan
  {
    const hasX = (m: IxEntry): boolean => /\{X\}/.test(String(m.card.c || ""));
    const xs = nonland.filter((m) => !m.isCmd && hasX(m));
    const cmdX = commanderEntries((t) => IXX.cmdCopies.test(t));
    if (xs.length >= IXX_MIN || (cmdX.length && xs.length >= 5)) {
      const dbl = nonland.filter((m) => !m.isCmd && !hasX(m) && IXX.doubler.test(m.text));
      const cp = nonland.filter(
        (m) => !m.isCmd && !hasX(m) && !dbl.includes(m) && IXX.copySpell.test(m.text),
      );
      const lines: string[] = [];
      if (cmdX.length)
        lines.push(
          ixLinkSlot(cmdX[0]!.card.n) +
            " copies the next X spell or ability you use, so each one counts twice.",
        );
      if (dbl.length)
        lines.push('<span style="color:var(--gold);">Double or copy X</span>: ' + nm(dbl, 3) + ".");
      if (cp.length) lines.push("Copy a spell: " + nm(cp, 4) + ".");
      lines.push(
        "X spells: " +
          nm(xs, 6) +
          ". The more mana you can put into X, the more each copy is worth.",
      );
      mk(
        "__plan_x",
        false,
        "<strong>" +
          xs.length +
          " X spells</strong>: the deck turns spare mana into big, scalable effects." +
          (cmdX.length ? " Your commander rewards exactly this." : ""),
        lines,
      );
      xs.concat(dbl, cp).forEach((m) => used.add(m.card.n));
    }
  }
  // Go wide
  {
    const makers = nonland.filter((m) => m.tokens.some((t) => t.creature));
    const anthem = pick(nonland, IXG.anthem, true),
      haste = nonland.filter(
        (m) => !m.isCmd && (IXG.haste.test(m.text) || ixRoles(m.text).hasteAll),
      );
    const fin = pick(nonland, IXG.finisher, true),
      dbl = pick(nonland, IXG.doubler, true);
    const shell = [anthem, haste, fin, dbl].filter((a) => a.length).length; // how many of the four go-wide helpers the deck has
    if (makers.length >= IXG_MIN || (makers.length >= IXG_SHELL_MIN && shell >= 3)) {
      const lines: string[] = [];
      if (dbl.length)
        lines.push('<span style="color:var(--gold);">Twice the tokens</span>: ' + nm(dbl, 3) + ".");
      if (anthem.length) lines.push("Make every body bigger: " + nm(anthem, 4) + ".");
      if (haste.length)
        lines.push(
          "Give them haste: " + nm(haste, 3) + ", so new tokens can attack the turn they appear.",
        );
      if (fin.length)
        lines.push(
          '<span style="color:var(--gold);">Finishers</span> that count your bodies: ' +
            nm(fin, 3) +
            ".",
        );
      lines.push("Token makers: " + nm(makers, 6) + ".");
      mk(
        "__plan_wide",
        false,
        "<strong>" + makers.length + " cards make creature tokens</strong>: the deck goes wide.",
        lines,
      );
      makers.concat(anthem, haste, fin, dbl).forEach((m) => used.add(m.card.n));
    }
  }
  return plans;
}
