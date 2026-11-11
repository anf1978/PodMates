// Suggestions for the deck-wide plans, only where the link is exact: rule helpers for a
// stat-swap rule, mana for a mana-sink commander, historic/legendary/property/X-spell
// helpers, Super Friends support and creature-token makers for a sacrifice commander.
// Moved unchanged from the inline INTERACTION PACKAGES block.

import type { CardRecord } from "../../../cards/tuple.ts";
import { IXPROP } from "../../../engine/commander-ability.ts";
import { IX_MASS_PUMP, IX_TEAM_AXIS } from "./reading.ts";
import { IX_MANA_DOUBLE_RE, IX_UNTAP_RE, ixFaceText, ixText, ixTokensMade } from "./text.ts";
import { IXH, IXLG, IXX } from "./theme-plans.ts";
import { knowQ } from "./knowledge.ts";
import type { IxPick, IxPickGroup, IxSuggestion, Knowledge, SuggestionContext } from "./types.ts";
import { IXW, ixWalkerInfo } from "./walkers.ts";

type By = (a: IxPick, b: IxPick) => number;
/** Whether a card carries a knowledge sort bonus (ranked on a community list). */
type Rated = (c: CardRecord) => boolean;

const pickOf = (c: CardRecord, why: string): IxPick => ({ n: c.n, m: c.m || 0, why, g: c.g });
const cheapNonland = (c: CardRecord): boolean => !((c.m || 0) > 6 || /\bland\b/i.test(c.t));
const nonEmpty = (groups: IxPickGroup[]): IxPickGroup[] => groups.filter((g) => g.list.length);

export function planSuggestions(
  ctx: SuggestionContext,
  knowledge: Knowledge,
  pool: readonly CardRecord[],
  by2: By,
  out: IxSuggestion[],
): void {
  const rated: Rated = (c) => knowQ(knowledge, c.n) > 0;
  const packages = ctx.packages || [];
  const has = (payoff: string): boolean => packages.some((k) => k.payoff === payoff);
  if (ctx.axis === "toughness" && out.length < 4) {
    const fin: IxPick[] = [],
      back: IxPick[] = [];
    for (const c of pool) {
      const text = ixText(c);
      if (IX_TEAM_AXIS.test(text)) {
        back.push(pickOf(c, "repeats the rule for your whole team if the commander is removed"));
        continue;
      }
      const mm = IX_MASS_PUMP.exec(text);
      if (
        mm &&
        (c.m || 0) <= 5 &&
        !/\bland\b/i.test(c.t) &&
        !/\b(?:equipped|enchanted) creature\b/.test(text)
      ) {
        const tb = mm[2] || mm[4] || mm[6];
        fin.push({
          n: c.n,
          m: c.m || 0,
          bonus: tb === "x" ? 4 : +tb!,
          why: "raises your whole team's toughness (+" + tb + "), which is damage under the rule",
          g: c.g,
        });
      }
    }
    const groups = nonEmpty([
      { label: "Repeat the rule", list: back.sort(by2).slice(0, 5) },
      {
        label: "Toughness finishers",
        list: fin.sort((a, b) => b.bonus! - a.bonus! || by2(a, b)).slice(0, 5),
      },
    ]);
    if (groups.length)
      out.push({ title: "The toughness rule", sub: "toughness deals combat damage", groups });
  }
  const sink = packages.find((k) => String(k.payoff).startsWith("__plan_sink_"));
  if (sink && out.length < 4) {
    const un: IxPick[] = [],
      db: IxPick[] = [];
    for (const c of pool) {
      if (!cheapNonland(c)) continue;
      const text = ixText(c);
      if (IX_UNTAP_RE.test(text)) un.push(pickOf(c, "untaps your mana again"));
      else if (IX_MANA_DOUBLE_RE.test(text)) db.push(pickOf(c, "doubles the mana you tap"));
    }
    const groups = nonEmpty([
      { label: "Untap your mana again", list: un.sort(by2).slice(0, 5) },
      { label: "Double your mana", list: db.sort(by2).slice(0, 5) },
    ]);
    if (groups.length)
      out.push({ title: "Spare mana", sub: "your commander spends it on abilities", groups });
  }
  if (has("__plan_historic") && out.length < 6) {
    const gh = { cost: [] as IxPick[], pay: [] as IxPick[] };
    for (const c of pool) {
      if (!cheapNonland(c)) continue;
      const t = ixText(c);
      if (!IXH.payoff.test(t)) continue;
      if (IXH.cost.test(t)) gh.cost.push(pickOf(c, "makes historic spells cheaper"));
      else gh.pay.push(pickOf(c, "rewards casting historic spells"));
    }
    const groups = nonEmpty([
      { label: "Cheaper historic spells", list: gh.cost.sort(by2).slice(0, 5) },
      { label: "Rewards historic spells", list: gh.pay.sort(by2).slice(0, 6) },
    ]);
    if (groups.length)
      out.push({ title: "Historic matters", sub: "artifacts, legendaries and Sagas", groups });
  }
  if (has("__plan_legend") && out.length < 6) legendSuggestions(pool, rated, by2, out);
  for (const p of IXPROP) {
    if (!has("__plan_prop_" + p.key) || out.length >= 6) continue;
    const g = {
      pay: [] as IxPick[],
      cost: [] as IxPick[],
      top: [] as IxPick[],
      half: [] as IxPick[],
    };
    for (const c of pool) {
      if (!cheapNonland(c)) continue;
      const t = ixText(c);
      if (p.half && p.half.test(t))
        g.half.push(pickOf(c, "mills half a library (all of it with a doubler)"));
      else if (p.cost.test(t)) g.cost.push(pickOf(c, "makes them cheaper"));
      else if (p.pay.test(t) && !(p.test(c) && !rated(c)))
        g.pay.push(pickOf(c, "rewards " + p.label));
      else if (p.top && p.test(c) && rated(c) && (c.m || 0) <= 5)
        g.top.push(pickOf(c, "a top-rated " + p.label.replace(/s$/, "")));
    }
    const groups = nonEmpty([
      { label: "Mill half a library", list: g.half.sort(by2).slice(0, 5) },
      { label: "Cheaper " + p.label, list: g.cost.sort(by2).slice(0, 4) },
      { label: "Rewards " + p.label, list: g.pay.sort(by2).slice(0, 6) },
      { label: "Top-rated " + p.label, list: g.top.sort(by2).slice(0, 5) },
    ]);
    if (groups.length)
      out.push({
        title: p.label.charAt(0).toUpperCase() + p.label.slice(1) + " matter",
        sub: "your commander rewards them",
        groups,
      });
  }
  if (has("__plan_x") && out.length < 6) xSuggestions(pool, rated, by2, out);
  if (has("__plan_walkers") && out.length < 6) walkerSuggestions(pool, by2, out);
  const fod = packages.find((k) => k.event === "fodder");
  if (fod && out.length < 4) {
    const mk: IxPick[] = [];
    for (const c of pool) {
      const text = ixText(c);
      if (
        (c.m || 0) <= 3 &&
        !/\bland\b/i.test(c.t) &&
        ixTokensMade(text).some((t) => t.creature) &&
        /\bwhen(?:ever)?\b.*\benters\b|^create|\{t\}|at the beginning/.test(text)
      )
        mk.push(pickOf(c, "makes creature tokens to sacrifice"));
    }
    if (mk.length)
      out.push({
        title: fod.payoff + " (commander)",
        sub: "it needs bodies to sacrifice",
        groups: [{ label: "Cheap body makers", list: mk.sort(by2).slice(0, 5) }],
      });
  }
}

function legendSuggestions(
  pool: readonly CardRecord[],
  rated: Rated,
  by2: By,
  out: IxSuggestion[],
): void {
  const gl = {
    pay: [] as IxPick[],
    rule: [] as IxPick[],
    cost: [] as IxPick[],
    find: [] as IxPick[],
  };
  for (const c of pool) {
    if (!cheapNonland(c)) continue;
    const t = ixText(c),
      isLeg = /\blegendary\b/i.test(String(c.t || "").split("//")[0]!);
    if (IXLG.legendRule.test(t)) gl.rule.push(pickOf(c, "lets you run duplicate legends"));
    else if (IXLG.cost.test(t)) gl.cost.push(pickOf(c, "makes your legendary spells cheaper"));
    else if (IXLG.tutor.test(t)) gl.find.push(pickOf(c, "finds a legendary card"));
    else if (
      IXLG.payoff.test(t) &&
      !/enchanted creature|target legendary|legendary creatures? (?:your opponents|an opponent)/.test(
        t,
      ) &&
      (!isLeg || rated(c))
    )
      gl.pay.push(pickOf(c, "rewards legendary cards"));
  }
  const groups = nonEmpty([
    { label: "Cheaper legends", list: gl.cost.sort(by2).slice(0, 5) },
    { label: "Find a legend", list: gl.find.sort(by2).slice(0, 5) },
    { label: "Duplicate legends", list: gl.rule.sort(by2).slice(0, 4) },
    { label: "Rewards legendary cards", list: gl.pay.sort(by2).slice(0, 6) },
  ]);
  if (groups.length)
    out.push({ title: "Legendary matters", sub: "a deck full of legends", groups });
}
function xSuggestions(
  pool: readonly CardRecord[],
  rated: Rated,
  by2: By,
  out: IxSuggestion[],
): void {
  const gx = {
    dbl: [] as IxPick[],
    cp: [] as IxPick[],
    mana: [] as IxPick[],
    more: [] as IxPick[],
  };
  for (const c of pool) {
    if (!cheapNonland(c)) continue;
    const t = ixText(c),
      isX = /\{X\}/.test(String(c.c || ""));
    if (!isX && IXX.doubler.test(t)) gx.dbl.push(pickOf(c, "copies or doubles your X spells"));
    else if (
      !isX &&
      IXX.copySpell.test(t) &&
      !/targets only|creature spell you control, except/.test(t) &&
      (c.m || 0) <= 5
    )
      gx.cp.push(pickOf(c, "copies a spell, so an X spell counts again"));
    else if (
      !isX &&
      (IX_UNTAP_RE.test(t) ||
        /add (?:an )?additional|twice (?:that much|as much)|double the (?:amount of )?mana|one mana of any type that (?:land|permanent) produced/.test(
          t,
        ))
    )
      gx.mana.push(pickOf(c, "more mana to pour into X"));
    else if (isX && rated(c)) gx.more.push(pickOf(c, "another X spell to copy"));
  }
  const groups = nonEmpty([
    { label: "Copy or double X", list: gx.dbl.sort(by2).slice(0, 5) },
    { label: "Copy a spell", list: gx.cp.sort(by2).slice(0, 5) },
    { label: "More mana for X", list: gx.mana.sort(by2).slice(0, 5) },
    { label: "Top-rated X spells", list: gx.more.sort(by2).slice(0, 6) },
  ]);
  if (groups.length) out.push({ title: "X spells", sub: "a deck full of {X} costs", groups });
}

function walkerSuggestions(pool: readonly CardRecord[], by2: By, out: IxSuggestion[]): void {
  const isWalker = (c: CardRecord): boolean =>
    /\bplaneswalker\b/i.test(String(c.t || "").split("//")[0]!);
  const g = {
    dbl: [] as IxPick[],
    pro: [] as IxPick[],
    act: [] as IxPick[],
    safe: [] as IxPick[],
    find: [] as IxPick[],
    walk: [] as IxPick[],
  };
  for (const c of pool) {
    if (isWalker(c)) {
      const wi = ixWalkerInfo(c);
      if (wi.ult && wi.ly !== null && wi.ly * 2 >= Math.abs(wi.ult.cost))
        g.walk.push(
          pickOf(
            c,
            "ultimate (−" +
              Math.abs(wi.ult.cost) +
              ") within reach of a doubled start of " +
              wi.ly * 2,
          ),
        );
      continue;
    }
    if (!cheapNonland(c)) continue;
    const t = ixFaceText(c);
    if (IXW.doubler.test(t))
      g.dbl.push(pickOf(c, "doubles counters, so walkers enter with double loyalty"));
    else if (IXW.doubleNow.test(t))
      g.dbl.push(pickOf(c, "doubles the counters already on your walkers"));
    else if (IXW.prolif.test(t) && (c.m || 0) <= 4)
      g.pro.push({
        n: c.n,
        m: c.m || 0,
        rk: (c.m || 0) + (/combat damage|\bdies\b|attacks/.test(t) ? 10 : 0),
        why: "adds a loyalty counter to every walker",
        g: c.g,
      });
    else if (IXW.again.test(t) || IXW.copyAbil.test(t) || IXW.instant.test(t))
      g.act.push(pickOf(c, "lets a walker be used again or copied"));
    else if (IXW.protect.test(t) && IXW.protectStrict.test(t) && (c.m || 0) <= 4)
      g.safe.push(pickOf(c, "keeps walkers alive"));
    else if ((IXW.tutor.test(t) || IXW.rebuy.test(t)) && (c.m || 0) <= 5)
      g.find.push(pickOf(c, "finds or returns walkers"));
  }
  const groups = nonEmpty([
    { label: "Double the loyalty", list: g.dbl.sort(by2).slice(0, 5) },
    { label: "Proliferate", list: g.pro.sort((a, b) => a.rk! - b.rk! || by2(a, b)).slice(0, 5) },
    { label: "Use them again", list: g.act.sort(by2).slice(0, 5) },
    { label: "Keep them alive", list: g.safe.sort(by2).slice(0, 5) },
    { label: "Find and rebuy walkers", list: g.find.sort(by2).slice(0, 5) },
    { label: "More walkers that can ultimate fast", list: g.walk.sort(by2).slice(0, 6) },
  ]);
  if (groups.length)
    out.push({ title: "Super Friends", sub: "a deck full of planeswalkers", groups });
}
