import { centralityFedCards } from "./centrality-fed.ts";
import {
  CENTRALITY_BANDS,
  CENTRALITY_SUPPORT_LABELS,
  CENTRALITY_SUPPORT_WEIGHTS,
  CENTRALITY_WEIGHTS,
  centralityBaselineFor,
  centralityShortName,
} from "./centrality-rules.ts";
import { IXPROP, analyzeCommanderAbility, centralitySupportSets } from "./commander-ability.ts";
import type { CommanderAbility } from "./commander-ability.ts";
import { resolveCommanderName } from "./commanders.ts";
import type { SupportKind } from "./centrality-rules.ts";
import type { EngineContext } from "./context.ts";
import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { CardRecord } from "../cards/tuple.ts";
import type { DeckEntry, SynergyEdge, WinCondition } from "./types.ts";

export interface CentralityTile {
  name: string;
  level: number;
  why: string;
  land: boolean;
  t: string;
  pm: string;
}

export interface CentralityInvestment {
  key: SupportKind;
  label: string;
  count: number;
  baseline: number;
  names: string[];
}

type CentralityPart = keyof typeof CENTRALITY_WEIGHTS;

export function computeCommanderCentrality(
  ctx: EngineContext,
  agg: Pick<DeckAnalysis, "detectedComboDetails" | "synergyEdges">,
  matchedCards: readonly DeckEntry[],
  commanderNames: readonly string[] | null | undefined,
  winCons: readonly WinCondition[] | null | undefined,
  archetype: string | null | undefined,
) {
  const rawNames = (commanderNames || []).filter(Boolean);
  if (!rawNames.length) return null;
  const byName = new Map(matchedCards.map((m) => [m.card.n, m.card]));
  // Names may arrive typed loosely (front face only, any case), so resolve each to its real card.
  const cmdCards: CardRecord[] = [],
    cmdNames: string[] = [];
  for (const n of rawNames) {
    const c = byName.get(n) || resolveCommanderName(ctx, n, matchedCards);
    if (c && !cmdNames.includes(c.n)) {
      cmdCards.push(c);
      cmdNames.push(c.n);
    }
  }
  if (!cmdCards.length) return null;
  const cmdSet = new Set(cmdNames);
  const base = centralityBaselineFor(archetype);

  // ---- (1a) plan involvement -------------------------------------------
  const combos = agg.detectedComboDetails || [];
  let plan: number | null = null,
    planDetail: { withCmd: number; total: number; kind: "combos" | "wincon" | "theme" } | null =
      null;
  if (combos.length) {
    const withCmd = combos.filter((c) => c.commanderPiece).length;
    plan = withCmd / combos.length;
    planDetail = { withCmd, total: combos.length, kind: "combos" };
  } else {
    const primary = (winCons || []).find(
      (w) => w.confidence !== "fallback" && w.cards && w.cards.length,
    );
    if (primary) {
      plan = primary.cards!.some((n) => cmdSet.has(n)) ? 1 : 0;
      planDetail = { withCmd: plan, total: 1, kind: "wincon" };
    }
  }

  // ---- (1b) engine reliance: ablation on the synergy web ------------------
  // The synergy web only knows a fixed list of themes, so a commander that rewards a KEYWORD (defender, flying...)
  // had no links at all. Cards carrying a keyword the commander is about are linked to it here (this reading only).
  const feedingEarly = centralityFedCards(cmdCards, matchedCards, cmdSet);
  const edges: SynergyEdge[] = (agg.synergyEdges || []).slice();
  for (const n of feedingEarly.kwFed)
    edges.push({
      a: [...cmdSet][0] as string,
      b: n,
      score: 3,
      reasons: [
        feedingEarly.xFed && feedingEarly.xFed.has(n)
          ? "an X spell the commander copies"
          : feedingEarly.byTerm.get(n) === "legendary cards"
            ? "a legendary card the commander rewards"
            : feedingEarly.byTerm.get(n) === "historic cards"
              ? "a historic card the commander rewards"
              : IXPROP.some((p) => p.label === feedingEarly.byTerm.get(n))
                ? "one of the " + feedingEarly.byTerm.get(n) + " the commander rewards"
                : "carries a keyword the commander rewards",
      ],
    });
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const e of edges) {
    link(e.a, e.b);
    link(e.b, e.a);
  }
  const topCluster = (skip: ReadonlySet<string>) => {
    const seen = new Set<string>();
    let best = 0;
    for (const start of adj.keys()) {
      if (skip.has(start) || seen.has(start)) continue;
      let size = 0;
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const n = stack.pop() as string;
        size++;
        for (const nb of adj.get(n) || [])
          if (!skip.has(nb) && !seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
      }
      best = Math.max(best, size);
    }
    return best;
  };
  const clusterWith = topCluster(new Set());
  const clusterWithout = topCluster(cmdSet);
  const collapse = clusterWith ? Math.max(0, (clusterWith - clusterWithout) / clusterWith) : 0;
  const cmdEdges = edges.filter((e) => cmdSet.has(e.a) || cmdSet.has(e.b));
  const linked = new Map<string, number>(); // card -> best edge score with the commander
  for (const e of cmdEdges) {
    const other = cmdSet.has(e.a) ? e.b : e.a;
    if (!cmdSet.has(other)) linked.set(other, Math.max(linked.get(other) || 0, e.score || 0));
  }
  const orphaned = [...linked.keys()].filter(
    (n) => !feedingEarly.kwFed.has(n) && [...(adj.get(n) || [])].every((x) => cmdSet.has(x)),
  ); // keyword-linked cards still do their job alone, so they are not 'orphans'
  const linkedReal = [...linked.keys()].filter((n) => !feedingEarly.kwFed.has(n));
  const edgeShare = edges.length ? cmdEdges.length / edges.length : 0;
  const engine = edges.length
    ? Math.min(
        1,
        0.45 * collapse +
          0.35 * Math.min(1, orphaned.length / 10) +
          0.2 * Math.min(1, edgeShare * 4),
      )
    : 0;

  // ---- (1c) alignment: how much of the deck its ability feeds ---------------
  const feeding = feedingEarly;
  const alignment = Math.min(1, feeding.lean / 0.4);
  // No combo and no specific win condition would leave the plan unmeasured. When a third or more of the deck is
  // what the commander cares about, the commander IS the plan, so count it as one.
  if (plan === null && alignment >= 0.6 && feeding.kwFed.size >= 5) {
    plan = alignment;
    planDetail = { withCmd: 1, total: 1, kind: "theme" };
  }

  // ---- (1d) what kind of ability ---------------------------------------
  const abilities = cmdCards.map(analyzeCommanderAbility);
  const ability = abilities.reduce(
    (a, b) => (b.strength > a.strength ? b : a),
    abilities[0] as CommanderAbility,
  );
  const worksFromCommandZone = abilities.some((a) => a.worksFromCommandZone);

  // ---- (2) investment beyond a typical deck ---------------------------------
  const sets = centralitySupportSets(matchedCards, cmdNames);
  const investment: CentralityInvestment[] = [];
  let weightedExcess = 0;
  for (const key of Object.keys(CENTRALITY_SUPPORT_WEIGHTS) as SupportKind[]) {
    const names = [...sets[key]];
    const baseline = base.values[key] || 0;
    let w = CENTRALITY_SUPPORT_WEIGHTS[key];
    // A commander that works from the command zone does not need protecting or rebuying.
    if (worksFromCommandZone && (key === "protection" || key === "recursion")) w *= 0.3;
    weightedExcess += Math.min(5, Math.max(0, names.length - baseline)) * w; // capped so one kind of card cannot dominate
    investment.push({
      key,
      label: CENTRALITY_SUPPORT_LABELS[key],
      count: names.length,
      baseline,
      names,
    });
  }
  const investmentScore = Math.min(1, weightedExcess / 10);

  // ---- combine (a missing plan signal simply drops out) --------------------
  const parts = (
    [
      ["plan", plan],
      ["engine", engine],
      ["alignment", alignment],
      ["ability", ability.strength],
      ["investment", investmentScore],
    ] as [CentralityPart, number | null][]
  ).filter(([, v]) => v !== null && v !== undefined) as [CentralityPart, number][];
  const wSum = parts.reduce((s, [k]) => s + CENTRALITY_WEIGHTS[k], 0);
  const score = Math.round(
    (100 * parts.reduce((s, [k, v]) => s + CENTRALITY_WEIGHTS[k] * v, 0)) / wSum,
  );
  let bandIndex = 0;
  CENTRALITY_BANDS.forEach((b, i) => {
    if (score >= b.min) bandIndex = i;
  });

  // ---- tiles for the heat grid -------------------------------------------
  const sortedScores = edges.map((e) => e.score || 0).sort((a, b) => a - b);
  const strongEdge = sortedScores.length
    ? sortedScores[Math.floor(sortedScores.length * 0.75)]
    : Infinity;
  const comboCards = new Set<string>();
  combos
    .filter((c) => c.commanderPiece)
    .forEach((c) =>
      c.cards.forEach((slot) =>
        String(slot)
          .split(" / ")
          .forEach((n) => comboCards.add(n)),
      ),
    );
  const supportAny = new Set<string>();
  Object.values(sets).forEach((s) => s.forEach((n) => supportAny.add(n)));
  const shortNames = cmdNames.map(centralityShortName).filter((n) => n.length >= 4);
  const tiles: CentralityTile[] = [];
  for (const m of matchedCards) {
    const name = m.card.n,
      qty = Math.max(1, m.qty || 1);
    let level = 0,
      why = "";
    if (cmdSet.has(name)) {
      level = 4;
      why = "Your commander";
    } else if (comboCards.has(name)) {
      level = 3;
      why = "Part of a combo with your commander";
    } else if (shortNames.some((sn) => String(m.card.o || "").includes(sn))) {
      level = 3;
      why = "Names your commander";
    } else if (
      linked.has(name) &&
      !feeding.kwFed.has(name) &&
      (orphaned.includes(name) || (linked.get(name) as number) >= strongEdge)
    ) {
      level = 3;
      why = orphaned.includes(name)
        ? "Only works with your commander in this deck"
        : "Strong synergy with your commander";
    } else if (linked.has(name) && !feeding.kwFed.has(name)) {
      level = 2;
      why = "Synergizes with your commander";
    } else if (feeding.fed.has(name)) {
      level = 2;
      why =
        "Matches what your commander cares about" +
        (feeding.byTerm.get(name) ? " (" + feeding.byTerm.get(name) + ")" : "");
    } else if (supportAny.has(name)) {
      level = 1;
      const kinds = (Object.keys(sets) as SupportKind[])
        .filter((k) => sets[k].has(name))
        .map((k) => CENTRALITY_SUPPORT_LABELS[k].toLowerCase());
      why = "Supports it (" + kinds.join(", ") + ")";
    }
    for (let i = 0; i < qty; i++)
      tiles.push({
        name,
        level,
        why,
        land: /\bland\b/i.test(m.card.t || ""),
        t: m.card.t || "",
        pm: m.card.pm || "",
      });
  }
  tiles.sort(
    (a, b) =>
      b.level - a.level ||
      Number(a.land) - Number(b.land) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );

  // ---- plain-English reasons -----------------------------------------------
  const reasons: string[] = [];
  if (planDetail && planDetail.kind === "combos")
    reasons.push(
      planDetail.withCmd === 0
        ? `None of its ${planDetail.total} detected combo${planDetail.total === 1 ? "" : "s"} need the commander.`
        : `${planDetail.withCmd} of its ${planDetail.total} detected combo${planDetail.total === 1 ? "" : "s"} include the commander.`,
    );
  if (feeding.used.length)
    reasons.push(
      `${feeding.fed.size} cards match what it cares about (${feeding.used.slice(0, 3).join(", ")}).`,
    );
  if (linkedReal.length)
    reasons.push(
      `${linkedReal.length} card${linkedReal.length === 1 ? "" : "s"} synergize directly with it` +
        (orphaned.length
          ? `; ${orphaned.length} of those have no other synergy partner in the deck.`
          : "."),
    );
  else if (edges.length && !feeding.kwFed.size)
    reasons.push("Almost nothing in the deck is tied to the commander through synergy.");
  reasons.push(
    worksFromCommandZone
      ? "Its ability works from the command zone, so it does not need to survive on the battlefield."
      : `Its ability is ${ability.kind}.`,
  );
  const excessBits = investment
    .filter((i) => i.key !== "direct" && i.count > i.baseline)
    .map((i) => `${i.count} ${i.label.toLowerCase()}`);
  if (investmentScore >= 0.4 && excessBits.length)
    reasons.push(
      `Heavier than a typical deck on commander support: ${excessBits.slice(0, 3).join(", ")}.`,
    );
  const notes: string[] = [];
  if (investmentScore >= 0.6 && ((plan !== null && plan < 0.25) || engine < 0.2))
    notes.push(
      "Lots of commander protection, but the deck's plan mostly runs without it. Worth asking the builder why.",
    );
  if (plan === null && !edges.length)
    notes.push(
      "Few synergies or combos were detected, so this reading leans on the commander's ability and the support cards.",
    );

  return {
    score,
    bandIndex,
    band: CENTRALITY_BANDS[bandIndex]!.label,
    blurb: CENTRALITY_BANDS[bandIndex]!.blurb,
    components: { plan, engine, alignment, ability: ability.strength, investment: investmentScore },
    ability,
    worksFromCommandZone,
    reasons: reasons.slice(0, 4),
    notes,
    tiles,
    investment,
    baselineLabel: base.label,
    baselineN: base.n,
    detail: {
      clusterWith,
      clusterWithout,
      linked: linkedReal.length,
      orphaned: orphaned.length,
      edgeShare,
      fed: feeding.fed.size,
      terms: feeding.used,
    },
  };
}
