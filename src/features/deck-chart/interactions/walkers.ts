// Planeswalker plan (Super Friends): ultimates, loyalty boosters, extra activations,
// protection and finding walkers. Moved unchanged from the inline INTERACTION PACKAGES block.

import type { CardRecord } from "../../../cards/tuple.ts";
import { escapeHtml } from "../../../ui/card-name.ts";
import { ixFaceText, ixLinkSlot, ixNames, ixPlan, ixText } from "./text.ts";
import type { IxEntry, IxPackage } from "./types.ts";

export const IXW_LOYALTY_LINE = /^(?:[+−–-]\d+|[−–-]x|0): /;
export const IXW = {
  doubler:
    /(?:put|puts) twice that many (?:of (?:those|each of those kinds of) )?counters|twice that many of those counters/,
  doubleNow: /double the number of each kind of counter on [^.]*(?:permanents?|planeswalkers?)/,
  prolif: /\bproliferate\b/,
  prolifBoost: /if you would proliferate, proliferate twice/,
  feed: /whenever a planeswalker you control enters[^.]*loyalty counter|loyalty counters? on (?:each|target|up to|that|a) planeswalker|put a loyalty counter on/,
  free: /loyalty abilities you activate cost an additional \[?\+1\]?/,
  extra: /additional loyalty counter/,
  again:
    /as though (?:none|it) of its loyalty abilities|loyalty abilit[^.]{0,80}(?:additional time|twice|once more)/,
  copyAbil:
    /whenever you activate an ability of a planeswalker[^.]*copy that ability|copy target activated or triggered ability you control from another legendary source|copy the next loyalty ability you activate|copy (?:target |that )?loyalty ability/,
  borrow: /has all loyalty abilities of all other planeswalkers/,
  instant: /activate loyalty abilities of planeswalkers you control on any player's turn/,
  copyWalker: /enter as a copy of a (?:creature or )?planeswalker/,
  protectStrict:
    /planeswalkers? you control (?:have|gain)|damage that would be dealt to you and planeswalkers|can't attack you or planeswalkers|(?:permanents|planeswalkers?) you control[^.]*phase out|phase out[^.]*planeswalker/,
  protect:
    /(?:planeswalkers?|permanents?) you control[^.]*phase out|phase out[^.]*planeswalker|planeswalkers? you control (?:have|gain)[^.]*(?:hexproof|indestructible|shroud)|permanents you control gain (?:hexproof|indestructible)|damage that would be dealt to you and planeswalkers|can't attack you or planeswalkers|prevent[^.]*damage[^.]*planeswalker/,
  tutor:
    /search your library for (?:a|an|up to [a-z]+) (?:legendary )?planeswalker card|reveal[^.]*planeswalker card|until you reveal a[^.]*planeswalker|if a planeswalker card is revealed|put a planeswalker card[^.]*onto the battlefield/,
  rebuy:
    /return all legendary permanent cards from your graveyard|planeswalker cards? from your graveyard|planeswalker (?:spell|card)[^.]{0,80}(?:return|graveyard)|planeswalker you control dies[^.]*(?:return|put)/,
  payoff:
    /whenever you cast a planeswalker spell|whenever a planeswalker (?:you control )?(?:enters|dies)|planeswalker you control dies/,
} as const;
const IXW_MIN_WALKERS = 8;

interface WalkerAbility {
  cost: number | null;
  text: string;
}

export interface WalkerInfo {
  abil: WalkerAbility[];
  ult: (WalkerAbility & { cost: number }) | null;
  plus: number;
  ly: number | null;
}

export function ixWalkerInfo(card: Pick<CardRecord, "o" | "ly">): WalkerInfo {
  const abil: WalkerAbility[] = [];
  for (const raw of String(card.o || "").split("\n")) {
    const line = raw.replace(/\([^)]*\)/g, "").trim();
    const m = /^([+−–-]\d+|[−–-]X|0): (.*)$/.exec(line);
    if (!m) continue;
    const c =
      m[1] === "0"
        ? 0
        : /X$/i.test(m[1]!)
          ? null
          : (m[1]![0] === "+" ? 1 : -1) * parseInt(m[1]!.replace(/\D/g, ""), 10);
    abil.push({ cost: c, text: m[2]! });
  }
  let ult: WalkerInfo["ult"] = null;
  for (const a of abil)
    if (a.cost !== null && a.cost <= -5 && (!ult || a.cost < ult.cost))
      ult = a as WalkerAbility & { cost: number };
  const plus = Math.max(1, ...abil.map((a) => (a.cost !== null && a.cost > 0 ? a.cost : 0)));
  const ly = /^\d+$/.test(String(card.ly || "")) ? parseInt(String(card.ly), 10) : null;
  return { abil, ult, plus, ly };
}

function ixUltShort(u: WalkerAbility, name: string): string {
  const t = String(u.text || "")
    .replace(/^you get an emblem with "?/i, "emblem: ")
    .replace(/"$/, "")
    .replace(new RegExp(String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "it");
  return t.length > 84 ? t.slice(0, 81).replace(/\s+\S*$/, "") + "..." : t;
}

type WalkerRow = WalkerInfo & { m: IxEntry; ult: NonNullable<WalkerInfo["ult"]> };

export function ixWalkerPlans(all: IxEntry[], _nonland: IxEntry[], used: Set<string>): IxPackage[] {
  const plans: IxPackage[] = [];
  const ft = (m: IxEntry): string => m.ft || (m.ft = ixFaceText(m.card));
  const isW = (m: IxEntry): boolean =>
    /\bplaneswalker\b/i.test(String(m.card.t || "").split("//")[0]!);
  const walkers = all.filter(isW);
  const helpers = all.filter((m) => !isW(m));
  const nm = ixNames;
  const pick = (arr: IxEntry[], re: RegExp): IxEntry[] => arr.filter((m) => re.test(ft(m)));
  const doublers = pick(helpers, IXW.doubler);
  const doubleNow = pick(helpers, IXW.doubleNow);
  const prolif = pick(helpers, IXW.prolif).filter((m) => !IXW.prolifBoost.test(ft(m)));
  const prolifBoost = pick(helpers, IXW.prolifBoost);
  const feeders = pick(helpers, IXW.feed).concat(
    pick(helpers, IXW.extra).filter((m) => !pick(helpers, IXW.feed).includes(m)),
  );
  const freeCtr = pick(helpers, IXW.free);
  const again = pick(helpers, IXW.again).concat(pick(helpers, IXW.instant));
  const copiers = pick(helpers, IXW.copyAbil)
    .concat(pick(helpers, IXW.copyWalker))
    .concat(pick(walkers, IXW.borrow));
  const protect = pick(helpers, IXW.protect);
  const finders = pick(helpers, IXW.tutor).concat(
    pick(helpers, IXW.rebuy).filter((m) => !pick(helpers, IXW.tutor).includes(m)),
  );
  const payoffs = pick(helpers, IXW.payoff).filter(
    (m) => !finders.includes(m) && !feeders.includes(m),
  );
  const infos = walkers.map((m) => ({ m, ...ixWalkerInfo(m.card) }));
  const withUlt = infos.filter((i): i is WalkerRow => !!i.ult);
  const haveLoyalty = infos.some((i) => i.ly !== null);
  const factor = doublers.length >= 2 ? 4 : doublers.length === 1 ? 2 : 1;
  const turnTo = (i: WalkerRow, f: number): number => {
    const need = Math.abs(i.ult.cost);
    const start = i.ly! * f,
      step = i.plus * f;
    return Math.ceil(Math.max(0, need - start) / step) + 1;
  };
  const mk = (payoff: string, isCmd: boolean, head: string, lines: string[]): void => {
    plans.push(ixPlan(payoff, isCmd, head, lines));
  };
  // Commander whose other face puts walkers onto the battlefield
  for (const c of all.filter((x) => x.isCmd)) {
    const back = ixText({ n: c.card.n, o: c.card.ob || "" });
    if (/until you reveal a[^.]*planeswalker/.test(back) && /battlefield/.test(back)) {
      const lines: string[] = [];
      if (doublers.length)
        lines.push(
          '<span style="color:var(--gold);">Doubled</span> with ' +
            nm(doublers, 3) +
            ": a walker put onto the battlefield this way still gets its loyalty doubled.",
        );
      mk(
        "__plan_cmd_walkers",
        true,
        "<strong>" +
          ixLinkSlot(c.card.n) +
          "</strong> finds walkers for free: its other face reveals cards until a planeswalker (or creature) and puts it onto the battlefield, with no mana spent.",
        lines,
      );
    }
  }
  if (walkers.length < IXW_MIN_WALKERS) return plans;
  const lines: string[] = [];
  const ultLine = (i: WalkerRow, extra?: string): string =>
    ixLinkSlot(i.m.card.n) +
    " (−" +
    escapeHtml(Math.abs(i.ult.cost) + ", " + ixUltShort(i.ult, i.m.card.n)) +
    (extra || "") +
    ")";
  const weakUlt = (i: WalkerRow): boolean => /^gain \d+ life\.?$/i.test(String(i.ult.text).trim());
  withUlt.sort((a, b) => (weakUlt(a) ? 1 : 0) - (weakUlt(b) ? 1 : 0));
  if (withUlt.length) {
    if (haveLoyalty && factor > 1) {
      const instant = withUlt.filter((i) => i.ly !== null && turnTo(i, 2) === 1);
      const fast = withUlt.filter(
        (i) => i.ly !== null && !instant.includes(i) && turnTo(i, 2) === 2,
      );
      const who = nm(doublers, 3);
      if (instant.length)
        lines.push(
          '<span style="color:var(--gold);">Ultimate the turn it lands</span>: with ' +
            who +
            " a walker enters with double its loyalty (and its plus abilities count double too), so " +
            instant.length +
            " of " +
            withUlt.length +
            " can use their ultimate at once: " +
            instant
              .slice(0, 5)
              .map((i) => ultLine(i))
              .join("; ") +
            (instant.length > 5 ? " +" + (instant.length - 5) + " more" : "") +
            ". An ultimate is a permanent emblem, and the walker is not exposed to attacks first." +
            (factor === 4
              ? " With both doublers out, a walker has loyalty left over after the ultimate, so it can go again."
              : ""),
        );
      if (fast.length)
        lines.push(
          "Next turn: " +
            fast
              .slice(0, 5)
              .map((i) => ixLinkSlot(i.m.card.n))
              .join(", ") +
            (fast.length > 5 ? " +" + (fast.length - 5) + " more" : "") +
            ".",
        );
    } else if (haveLoyalty) {
      const soon = withUlt
        .filter((i) => i.ly !== null)
        .map((i) => ({ i, t: turnTo(i, 1) }))
        .sort((a, b) => a.t - b.t)
        .slice(0, 4);
      lines.push(
        withUlt.length +
          " of the walkers have an ultimate. With no doubler in the deck the quickest are " +
          soon.map((x) => ixLinkSlot(x.i.m.card.n) + " (turn " + x.t + ")").join(", ") +
          ". Counter doublers such as Doubling Season would let many use it the turn they land.",
      );
    } else {
      lines.push(
        withUlt.length +
          " of the walkers have an ultimate (" +
          withUlt
            .slice(0, 4)
            .map((i) => ixLinkSlot(i.m.card.n) + " " + escapeHtml(String(Math.abs(i.ult.cost))))
            .join(", ") +
          (withUlt.length > 4 ? " +" + (withUlt.length - 4) + " more" : "") +
          "). Starting loyalty, which shows how fast each can be reached, arrives with the next weekly database rebuild.",
      );
    }
  }
  const boost: string[] = [];
  if (doublers.length) boost.push("doublers " + nm(doublers, 3));
  if (doubleNow.length) boost.push("double what is already there: " + nm(doubleNow, 2));
  if (prolif.length)
    boost.push(
      prolif.length +
        " proliferate effects (" +
        nm(prolif, 4) +
        ")" +
        (prolifBoost.length ? ", and " + nm(prolifBoost, 2) + " makes each one count twice" : ""),
    );
  if (feeders.length) boost.push("extra loyalty: " + nm(feeders, 3));
  if (freeCtr.length)
    boost.push(nm(freeCtr, 2) + " adds a counter every time a walker is activated");
  if (boost.length)
    lines.push('<span style="color:var(--gold);">More loyalty</span>: ' + boost.join("; ") + ".");
  if (again.length || copiers.length) {
    const bits: string[] = [];
    if (again.length) bits.push("activate again: " + nm(again, 3));
    if (copiers.length) bits.push("copy abilities: " + nm(copiers, 4));
    lines.push(
      '<span style="color:var(--gold);">Extra uses</span>: ' +
        bits.join("; ") +
        "." +
        (copiers.length && withUlt.length
          ? " A copied ultimate costs no loyalty and stacks a second emblem."
          : ""),
    );
  }
  if (protect.length) lines.push("Keeping them alive: " + nm(protect, 5) + ".");
  if (finders.length) lines.push("Finding and rebuying walkers: " + nm(finders, 5) + ".");
  if (payoffs.length) lines.push("Pay off when a walker arrives or dies: " + nm(payoffs, 3) + ".");
  mk(
    "__plan_walkers",
    false,
    "<strong>" +
      walkers.length +
      " planeswalkers</strong>" +
      (withUlt.length ? ", " + withUlt.length + " with an ultimate" : "") +
      ": the deck plays a Super Friends game, where the walkers are the engine rather than the commander.",
    lines,
  );
  walkers
    .concat(
      doublers,
      doubleNow,
      prolif,
      prolifBoost,
      feeders,
      freeCtr,
      again,
      copiers,
      protect,
      finders,
      payoffs,
    )
    .forEach((m) => used.add(m.card.n));
  return plans;
}
