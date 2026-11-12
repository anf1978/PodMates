// Trigger and rule packages: "this card pays off WHEN something happens; which cards in the
// deck make that happen, which ones make it happen AGAIN, and which ones make it count TWICE?"
// Each payoff with its objects, repeaters and multipliers is a package, ranked by how much of
// the deck feeds it and how much it does. Moved unchanged from the inline block.

import { ixBlinkFits, ixMultiplierKind, ixRepeaterKind } from "./links.ts";
import {
  commanderPackages,
  sacrificeAndCostPackages,
  simplePackages,
  skipLine,
} from "./secondary-packages.ts";
import { IX_LISTENERS, ixCardMatches, ixEffect, ixParseFilter, ixTokenMatches } from "./text.ts";
import type { InteractionTags, IxEntry, IxLink, IxMember, IxPackage } from "./types.ts";

interface EventGroup {
  members: IxMember[];
  repeaters: Map<string, IxLink>;
  multipliers: Map<string, IxLink>;
}

/** Payoff packages from triggers and rules; the commander's own packages lead. */
export function triggerPackages(
  tags: InteractionTags,
  all: IxEntry[],
  nonland: IxEntry[],
  subs: string[],
  nl: number,
): IxPackage[] {
  const packages: IxPackage[] = [];
  const groups: Record<string, EventGroup> = {
    enters: { members: [], repeaters: new Map(), multipliers: new Map() },
    dies: { members: [], repeaters: new Map(), multipliers: new Map() },
  };

  for (const p of all) {
    for (const line of p.text.split("\n")) {
      // ultimates and walker abilities are handled by the planeswalker plan, not read as triggers
      if (skipLine(line)) continue;
      for (const [ev, re] of IX_LISTENERS) {
        const mm = re.exec(line);
        if (!mm) continue;
        const f = ixParseFilter(mm[1]!, subs);
        if (!f) continue;
        const clauseAfter = line.slice(mm.index + mm[0].length);
        const eff = ixEffect(clauseAfter);
        // objects: other cards in the deck that are, or make, what the trigger watches for
        const objects = f.self
          ? []
          : (f.types.includes("land") ? all : nonland).filter(
              (o) => o !== p && ixCardMatches(o.card, f),
            );
        const tokenMakers = f.self
          ? []
          : nonland.filter(
              (o) => o !== p && o.tokens.some((t) => ixTokenMatches(t, f)) && !objects.includes(o),
            );
        const repeaters: IxLink[] = [],
          multipliers: IxLink[] = [];
        for (const o of all) {
          if (o === p) continue;
          let rk = ixRepeaterKind(o.text, ev, f, o.tokens);
          if (!rk && ev === "enters" && !f.self && ixBlinkFits(tags.blink, o.card, o.text, f))
            rk = "flickers permanents (Scryfall tag)";
          if (rk) repeaters.push({ name: o.card.n, how: rk });
          const mk = ixMultiplierKind(o.text, ev, f, p);
          if (mk) multipliers.push({ name: o.card.n, how: mk });
        }
        const objCount = objects.reduce((s, o) => s + (o.qty || 1), 0);
        if (!f.self && objCount + tokenMakers.length < 3 && !(repeaters.length && objCount >= 1))
          continue; // too thin to be a plan
        if (f.self && !repeaters.length && !multipliers.length) continue; // a plain "when ~ enters" is just the card doing its job
        if (f.self) {
          // many such cards share the same helpers: one group, not one package each
          const g = groups[ev]!;
          if (!eff.generic || p.isCmd)
            g.members.push({ name: p.card.n, effect: eff.label, w: eff.w, isCmd: p.isCmd });
          repeaters.forEach((r) => g.repeaters.set(r.name, r));
          multipliers.forEach((r) => g.multipliers.set(r.name, r));
          break;
        }
        const supply = f.self ? 0.35 : Math.min(1, (objCount + tokenMakers.length) / 8);
        const repeatScore = Math.min(1, repeaters.length / 2),
          multScore = multipliers.length ? 1 : 0;
        let score =
          eff.w *
          (0.5 * supply + 0.28 * repeatScore + 0.22 * multScore) *
          (1 + Math.min(0.5, (objCount / nl) * 1.2));
        if (f.generic) score *= 0.8; // 'any creature' payoffs are common; a specific keyword/type is the plan
        if (p.isCmd) score *= 1.5;
        if (eff.w <= 1.5 && !p.isCmd) score *= 0.7;
        packages.push({
          kind: "trigger",
          payoff: p.card.n,
          isCmd: p.isCmd,
          event: ev,
          filter: f,
          effect: eff.label,
          objects: objects.map((o) => o.card.n),
          objCount,
          tokenMakers: tokenMakers.map((o) => o.card.n),
          repeaters,
          multipliers,
          score,
        });
        break;
      }
    }
    // Rule-changers and lords: "<creatures you control with defender / Elves> assign / get / have / can ..."
    for (const line of p.text.split("\n")) {
      if (skipLine(line)) continue;
      const sm =
        /^((?:other |each |all |another )?[a-z' -]*?(?:creatures?|permanents?|artifacts?|[a-z]+s)(?: you control)?(?: with [a-z ]+?)?) (?:you control )?(assigns?|gets?|have|has|can|enters?)\b([^.]*)/.exec(
          line,
        );
      if (!sm || !/you control|with /.test(sm[1] + " " + line.slice(0, 80))) continue;
      const f = ixParseFilter(sm[1]!.replace(/ you control/, ""), subs);
      if (!f || f.self || (!f.kws.length && !f.subs.length)) continue;
      if (/whenever|when |at the beginning/.test(line.slice(0, 12))) continue;
      const objects = nonland.filter((o) => o !== p && ixCardMatches(o.card, f));
      const objCount = objects.reduce((s, o) => s + (o.qty || 1), 0);
      if (objCount < 4) continue;
      const effText = (() => {
        const t = (sm[2]! + sm[3]!).trim().replace(/\.$/, "");
        return t.length <= 170 ? t : t.slice(0, 170).replace(/\s+\S*$/, "") + "…";
      })();
      const accel: IxLink[] = /attack/.test(effText)
        ? all
            .filter(
              (o) =>
                o !== p &&
                /(?:creatures?|permanents?)[^.]{0,30}(?:have|gain) haste|all creatures have haste|gain haste/.test(
                  o.text,
                ),
            )
            .map((o) => ({ name: o.card.n, how: "lets them attack the turn they arrive" }))
        : [];
      if (/attack/.test(effText) && f.kws.length)
        all
          .filter(
            (o) =>
              o !== p &&
              new RegExp("creatures?[^.]{0,40}with " + f.kws[0] + "[^.]{0,60}can attack").test(
                o.text,
              ),
          )
          .forEach((o) => accel.push({ name: o.card.n, how: "also lets them attack (overlaps)" }));
      const score =
        2.5 *
        (0.6 * Math.min(1, objCount / 10) + 0.4 * (accel.length ? 1 : 0.3)) *
        (1 + Math.min(0.5, (objCount / nl) * 1.2)) *
        (p.isCmd ? 1.5 : 1);
      packages.push({
        kind: "rule",
        payoff: p.card.n,
        isCmd: p.isCmd,
        filter: f,
        effect: effText,
        objects: objects.map((o) => o.card.n),
        objCount,
        tokenMakers: [],
        repeaters: accel,
        multipliers: [],
        score,
      });
      break;
    }
  }
  simplePackages(packages, all, nonland, nl);
  commanderPackages(packages, tags, all);
  for (const [ev, g] of Object.entries(groups)) {
    if (g.members.length < 4) continue;
    const reps = [...g.repeaters.values()],
      mults = [...g.multipliers.values()];
    const avgW = g.members.reduce((a, m) => a + m.w!, 0) / Math.max(1, g.members.length);
    const score =
      avgW *
      (0.4 * Math.min(1, g.members.length / 6) +
        0.35 * Math.min(1, reps.length / 2) +
        0.25 * (mults.length ? 1 : 0)) *
      (1 + Math.min(0.5, (g.members.length / nl) * 1.2)) *
      (g.members.some((m) => m.isCmd) ? 1.5 : 1);
    packages.push({
      kind: "group",
      event: ev,
      payoff: "__group_" + ev,
      isCmd: g.members.some((m) => m.isCmd),
      filter: { label: "" },
      effect: "",
      members: g.members,
      objects: [],
      objCount: 0,
      tokenMakers: [],
      repeaters: reps,
      multipliers: mults,
      score,
    });
  }
  sacrificeAndCostPackages(packages, all, nonland);
  poolBroadPackages(packages, nl);
  packages.sort((a, b) => b.score - a.score);
  // keep one package per payoff card (its best), then the top few
  const seen = new Set<string>(),
    top: IxPackage[] = [];
  for (const pk of packages) {
    const k = pk.payoff + "|" + pk.kind;
    if (seen.has(k)) continue;
    seen.add(k);
    top.push(pk);
  }
  // wipes, sacrifice outlets and token makers do not make a walker die again
  top.forEach((pk) => {
    if (
      pk.kind === "trigger" &&
      pk.event === "dies" &&
      pk.filter &&
      /planeswalker/.test(pk.filter.label || "")
    )
      pk.repeaters = [];
  });
  // commander's own packages lead (stable sort keeps score order inside each group)
  top.sort((a, b) => (b.isCmd ? 1 : 0) - (a.isCmd ? 1 : 0));
  return top;
}

/** Payoffs that nearly every card feeds ("whenever a creature enters") are one shared pool, not separate plans. */
function poolBroadPackages(packages: IxPackage[], nl: number): void {
  const broad = packages.filter((k) => k.kind === "trigger" && !k.isCmd && k.objCount >= 0.4 * nl);
  const byEv: Record<string, IxPackage[]> = {};
  broad.forEach((k) => {
    const key =
      k.event +
      "|" +
      String(k.phrase || (k.filter && k.filter.label) || "")
        .replace(/^(?:another|an?) /, "")
        .replace(/^you cast (?:another|an?) /, "you cast ")
        .replace(/^(another|an?) /, "");
    (byEv[key] = byEv[key] || []).push(k);
  });
  const rules: Record<string, IxPackage[]> = {};
  packages
    .filter((k) => k.kind === "rule" && !k.isCmd)
    .forEach((k) => {
      const key = (k.filter.label || "").replace(/^another /, "a ");
      (rules[key] = rules[key] || []).push(k);
    });
  const remove = (arr: IxPackage[]): void =>
    arr.forEach((k) => {
      const i = packages.indexOf(k);
      if (i >= 0) packages.splice(i, 1);
    });
  for (const [key, arr] of Object.entries(rules)) {
    if (arr.length < 2) continue;
    remove(arr);
    packages.push({
      kind: "pool",
      rule: true,
      event: "rule",
      payoff: "__rule_" + key,
      isCmd: false,
      phrase: key,
      filter: { label: key },
      effect: "",
      members: arr.map((k) => ({ name: k.payoff, effect: k.effect })),
      objects: [],
      objCount: arr[0]!.objCount,
      tokenMakers: [],
      repeaters: [],
      multipliers: [],
      score: Math.max(...arr.map((k) => k.score)) * 0.9 + Math.min(0.6, arr.length * 0.08),
    });
  }
  for (const [key, arr] of Object.entries(byEv)) {
    if (arr.length < 2) continue;
    remove(arr);
    const reps = new Map<string, IxLink>(),
      mults = new Map<string, IxLink>();
    arr.forEach((k) => {
      k.repeaters.forEach((r) => reps.set(r.name, r));
      k.multipliers.forEach((r) => mults.set(r.name, r));
    });
    const k0 = arr[0]!;
    packages.push({
      kind: "pool",
      event: k0.event,
      payoff: "__pool_" + key,
      isCmd: false,
      phrase: k0.phrase || k0.filter.label + " " + (k0.event === "dies" ? "dies" : "enters"),
      filter: { label: "" },
      effect: "",
      members: arr.map((k) => ({ name: k.payoff, effect: k.effect })),
      objects: [],
      objCount: 0,
      tokenMakers: [],
      repeaters: [...reps.values()],
      multipliers: [...mults.values()],
      score: Math.max(...arr.map((k) => k.score)) * 0.85 + Math.min(0.6, arr.length * 0.08),
    });
  }
}
