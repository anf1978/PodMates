// "Cards you could add": searched on demand from the whole card database (nothing runs until
// the sheet opens): inside the commander's colours, not banned, not already in the deck.
// Moved unchanged from the inline INTERACTION PACKAGES block.

import type { CardRecord } from "../../../cards/tuple.ts";
import { ixUsable } from "../../../engine/legality.ts";
import { ixNewDimensions } from "./dimensions.ts";
import { knowQ, knowThemeSuggestions, ixThinSuggestions } from "./knowledge.ts";
import { ixBlinkFits, ixHurtsOnlyYou, ixMultiplierKind, ixRepeaterKind } from "./links.ts";
import { planSuggestions } from "./suggestion-plans.ts";
import { ixCardMatches, ixEffect, ixText, ixTokensMade } from "./text.ts";
import type {
  InteractionData,
  IxFilter,
  IxPick,
  IxPickGroup,
  IxSuggestion,
  Knowledge,
  SuggestionContext,
} from "./types.ts";

export interface SuggestionResult {
  items: IxSuggestion[];
  identity: string;
}

export function buildInteractionSuggestions(
  data: InteractionData,
  knowledge: Knowledge,
  ctx: SuggestionContext,
): SuggestionResult {
  const { matched, commanders, packages } = ctx;
  const inDeck = new Set(matched.map((m) => String(m.card.n).toLowerCase()));
  let ident = "";
  (commanders || []).forEach((n) => {
    const c = matched.find((m) => m.card.n === n) || null;
    const cc = c ? c.card : data.cards.find((x) => x.n === n);
    if (cc) ident += cc.ci || "";
  });
  const allowed = new Set(ident.split(""));
  const cmdLower = new Set((commanders || []).map((n) => String(n).toLowerCase()));
  const fits = (c: CardRecord): boolean =>
    ixUsable(c) &&
    String(c.ci || "")
      .split("")
      .every((x) => allowed.has(x)) &&
    !!c.t &&
    !inDeck.has(String(c.n).toLowerCase()) &&
    !cmdLower.has(String(c.n).toLowerCase());
  const pool = data.cards.filter(fits);
  const by = (a: IxPick, b: IxPick): number =>
    knowQ(knowledge, b.n) - knowQ(knowledge, a.n) || a.m - b.m || a.n.localeCompare(b.n);
  const out: IxSuggestion[] = [];
  for (const pk of packages) {
    if (
      pk.kind !== "trigger" ||
      pk.phrase ||
      pk.filter.self ||
      !pk.filter.label ||
      (pk.event !== "enters" && pk.event !== "dies")
    )
      continue;
    // Trigger packages read from a phrase carry the full filter.
    const f = pk.filter as IxFilter,
      ev = pk.event;
    // a filter we could not read ("a nontoken ...") is not claimed
    if (!f.types.length && !f.subs.length && !f.kws.length && f.token !== true) continue;
    // the Super Friends group below covers walkers
    if (/planeswalker/.test(f.label) && packages.some((k) => k.payoff === "__plan_walkers"))
      continue;
    const reps: IxPick[] = [],
      mults: IxPick[] = [],
      feeds: IxPick[] = [];
    const landF = f.types.includes("land") && !f.types.includes("creature");
    for (const c of pool) {
      const text = ixText(c);
      // loyalty ultimates, 7-mana harness costs and one-shot lands are not reliable repeaters
      if (
        /\bplaneswalker\b/i.test(String(c.t).split("—")[0]!) ||
        /\bharness\b/.test(text) ||
        (!landF && /\bland\b/i.test(String(c.t).split("—")[0]!))
      )
        continue;
      const rk =
        ixRepeaterKind(text, ev, f, ixTokensMade(text)) ||
        (ev === "enters" && ixBlinkFits(data.tags.blink, c, text, f)
          ? "flickers permanents"
          : null);
      if (rk && !/makes matching tokens/.test(rk)) {
        reps.push({ n: c.n, m: c.m || 0, why: rk, g: c.g });
        continue;
      }
      const mk = ixMultiplierKind(text, ev, f);
      if (mk) {
        mults.push({ n: c.n, m: c.m || 0, why: mk, g: c.g });
        continue;
      }
      const ownEv =
        ev === "enters"
          ? /\b(?:when|whenever) (?:this|~)[^.,]{0,40}\benters\b/
          : /\b(?:when|whenever) (?:this|~)[^.,]{0,40}\bdies\b/;
      if (
        !f.generic &&
        ixCardMatches(c, f) &&
        ownEv.test(text) &&
        !ixHurtsOnlyYou(text.slice(Math.max(0, text.search(ownEv)))) &&
        !/\bland\b/i.test(c.t) &&
        (c.m || 0) <= 4
      ) {
        const ef = ixEffect(text.slice(Math.max(0, text.search(ownEv))));
        feeds.push({ n: c.n, m: c.m || 0, w: ef.w, why: ef.label, g: c.g });
      }
    }
    const groups: IxPickGroup[] = [
      { label: "Set it off again", list: reps.sort(by).slice(0, 6) },
      { label: "Count it twice", list: mults.sort(by).slice(0, 6) },
      {
        label: "More cards that feed it",
        list: feeds.sort((a, b) => b.w! - a.w! || by(a, b)).slice(0, 6),
      },
    ].filter((g) => g.list.length);
    const sig = JSON.stringify(groups.map((g) => g.list.map((c) => c.n)));
    if (out.some((o) => o.sig === sig)) continue;
    if (groups.length)
      out.push({
        sig,
        title: pk.payoff + (pk.isCmd ? " (commander)" : ""),
        sub: `${f.label} ${ev === "dies" ? "dies" : "enters"}`,
        groups,
      });
    if (out.length >= 3) break;
  }
  planSuggestions(ctx, knowledge, pool, by, out);
  try {
    for (const th of ixThinSuggestions(knowledge, ctx.roles, pool)) out.push(th);
  } catch {
    // display only
  }
  try {
    for (const th of knowThemeSuggestions(knowledge, matched, pool))
      if (out.length < 8) out.push(th);
  } catch {
    // display only
  }
  try {
    for (const nd of ixNewDimensions(knowledge, data.tags.blink, matched, commanders, pool))
      out.push(nd);
  } catch {
    // display only
  }
  // A card is shown once: its first (most specific) appearance wins, so the same card is never
  // listed under several headings.
  const shownOnce = new Set<string>();
  const items: IxSuggestion[] = [];
  for (const it of out) {
    const groups: IxPickGroup[] = [];
    for (const g of it.groups) {
      const list = g.list.filter((c) => !shownOnce.has(c.n));
      list.forEach((c) => shownOnce.add(c.n));
      if (list.length) groups.push(Object.assign({}, g, { list }));
    }
    if (groups.length) items.push(Object.assign({}, it, { groups }));
  }
  return { items, identity: ident };
}
