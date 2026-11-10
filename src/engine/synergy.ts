import type { CardRecord } from "../cards/tuple.ts";
import { classifyCard, normalizeText } from "./classify.ts";
import { hasTrait } from "./types.ts";
import type { CardTag, CardTraits, DeckEntry, SynergyEdge } from "./types.ts";

// ---- Structured interaction analysis ----
// The interaction layer deliberately uses explicit, explainable signals rather
// than asking an LLM to assign a subjective deck score.
// The actual card types per the comprehensive rules (205.2a) — used to credit
// a card's type-frequency count correctly, and to exclude supertypes like
// "Legendary", "Basic", or "Snow" which aren't card types themselves.
export const REAL_CARD_TYPES: ReadonlySet<string> = new Set([
  "Artifact",
  "Battle",
  "Creature",
  "Enchantment",
  "Instant",
  "Land",
  "Planeswalker",
  "Sorcery",
  "Kindred",
  "Tribal",
  "Conspiracy",
  "Dungeon",
  "Plane",
  "Phenomenon",
  "Scheme",
  "Vanguard",
]);

export const SYNERGY_THEMES: readonly string[] = [
  "aristocrats",
  "tokens",
  "artifacts",
  "spellslinger",
  "graveyard",
  "drain",
  "lifegain",
  "landfall",
  "counters",
  "blink",
  "stax",
  "landBuffing",
  "minusCounters",
  "impulseDraw",
  "exileMatters",
];

export const VERSATILITY_FEATURE_KEYS: readonly CardTag[] = [
  "ramp",
  "draw",
  "removal",
  "wipe",
  "protection",
  "counterMagic",
  "stax",
  "discard",
  "tutor",
  "reanimate",
  "tokens",
  "artifactsMatter",
  "spellslinger",
  "graveyard",
  "lifegain",
  "drain",
  "landfall",
  "counters",
  "blink",
  "sacOutlet",
  "landBuffing",
  "minusCounters",
  "impulseDraw",
  "exileMatters",
];

export interface InteractionProfile {
  events: string[];
  produces: string[];
  consumes: string[];
  roles: string[];
  modal: boolean;
  cmc: number;
  recurring: boolean;
}

export interface CommanderSignals {
  signal: Record<string, number>;
  roles: Record<string, number>;
}

export function cardInteractionProfile(card: CardRecord, c: CardTraits): InteractionProfile {
  const text = normalizeText(card.o);
  const events: string[] = [];
  const produces: string[] = [];
  const consumes: string[] = [];
  const roles: string[] = [];

  if (c.ramp) produces.push("mana");
  if (c.draw) produces.push("cards");
  if (c.tokens) produces.push("tokens");
  if (c.reanimate) produces.push("creatures_from_graveyard");
  if (c.tutor) produces.push("selection");
  if (c.sacOutlet || c.sac) consumes.push("creatures_for_sacrifice");
  if (c.counterMagic) consumes.push("spells_on_stack");
  if (c.artifactsMatter) consumes.push("artifacts");
  if (c.spellslinger) consumes.push("spells");
  if (c.graveyard) consumes.push("graveyard");

  if (
    /\bwhenever\s+(?:a|one or more)\s+[^.]{0,80}\benters\b|\bwhen\s+[^.]{0,80}\benters\b/i.test(
      text,
    )
  )
    events.push("enters");
  if (/\bwhenever\s+[^.]{0,80}\bdies\b|\bwhen\s+[^.]{0,80}\bdies\b/i.test(text))
    events.push("dies");
  if (/\bwhenever\s+[^.]{0,80}\battacks?\b/i.test(text)) events.push("attacks");
  if (/\bwhenever\s+[^.]{0,80}\bcasts?\b|\bwhenever\s+you cast\b/i.test(text)) events.push("casts");
  if (/\bwhenever\s+[^.]{0,80}\bdraws?\b|\bwhenever\s+you draw\b/i.test(text)) events.push("draws");
  if (/\bwhenever\s+[^.]{0,80}\bsacrifices?\b|\bwhenever\s+you sacrifice\b/i.test(text))
    events.push("sacrifices");
  if (/\bwhenever\s+[^.]{0,80}\bdiscards?\b|\bwhenever\s+you discard\b/i.test(text))
    events.push("discards");
  if (/\bwhenever\s+[^.]{0,80}\bland\b[^.]{0,30}\benters\b|\blandfall\b/i.test(text))
    events.push("landfall");
  if (/\bwhenever\s+[^.]{0,80}\bdeals? damage\b/i.test(text)) events.push("damage");

  for (const theme of SYNERGY_THEMES) if (hasTrait(c, theme)) roles.push(theme);
  if (c.ramp) roles.push("ramp");
  if (c.draw) roles.push("draw");
  if (c.removal) roles.push("removal");
  if (c.protection) roles.push("protection");
  if (c.tutor) roles.push("tutor");
  if (c.reanimate) roles.push("recursion");
  if (c.counterMagic) roles.push("stack_interaction");
  if (c.tokens) roles.push("token_generation");
  if (c.sacOutlet) roles.push("sacrifice_outlet");

  const modal = /\bchoose one\b|\bchoose two\b|\bchoose any\b|\bup to\b|\binstead\b|\bmay\b/i.test(
    text,
  );
  return { events, produces, consumes, roles, modal, cmc: c.cmc, recurring: c.engine };
}

export function commanderSignalProfile(commanderCards: readonly CardRecord[]): CommanderSignals {
  const signal: Record<string, number> = Object.fromEntries(SYNERGY_THEMES.map((k) => [k, 0]));
  const roles: Record<string, number> = {};
  for (const card of commanderCards) {
    const c = classifyCard(card);
    for (const theme of SYNERGY_THEMES) if (hasTrait(c, theme)) (signal[theme] as number) += 1;
    for (const r of cardInteractionProfile(card, c).roles) roles[r] = (roles[r] || 0) + 1;
  }
  const text = commanderCards.map((c) => normalizeText(c.o)).join(" ");
  const add = (theme: string, re: RegExp, weight = 1) => {
    if (re.test(text)) (signal[theme] as number) += weight;
  };
  add("tokens", /create .*token|token(s)? you control/);
  add("aristocrats", /sacrifice|dies/);
  add("artifacts", /artifact/);
  add("counters", /counter/);
  add("graveyard", /graveyard|return .* from .* graveyard/);
  add("spellslinger", /instant or sorcery|cast .* spell/);
  add("landfall", /land enters|landfall|play an additional land/);
  add("blink", /exile .* return .* battlefield|flicker/);
  add("lifegain", /gain life|life total/);
  add("drain", /loses? .* life|each opponent .* life/);
  return { signal, roles };
}

export function interactionBetween(
  a: CardRecord,
  b: CardRecord,
  pa: InteractionProfile,
  pb: InteractionProfile,
  commanderSignals: CommanderSignals,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, reason: string) => {
    score += n;
    reasons.push(reason);
  };

  for (const resource of pa.produces) {
    if (pb.consumes.includes(resource))
      add(4, `${a.n} produces ${resource.replaceAll("_", " ")}, which ${b.n} uses`);
  }
  for (const e of pa.events) {
    if (pb.events.includes(e) && ["dies", "sacrifices", "draws", "casts", "landfall"].includes(e))
      add(3, `both interact with ${e}`);
  }
  for (const theme of SYNERGY_THEMES) {
    if (pa.roles.includes(theme) && pb.roles.includes(theme)) add(1.5, `shared ${theme} theme`);
  }
  if (
    pa.roles.includes("token_generation") &&
    (pb.roles.includes("sacrifice_outlet") || pb.roles.includes("aristocrats"))
  )
    add(4, "tokens feed sacrifice/death payoffs");
  if (
    pb.roles.includes("token_generation") &&
    (pa.roles.includes("sacrifice_outlet") || pa.roles.includes("aristocrats"))
  )
    add(4, "tokens feed sacrifice/death payoffs");
  if (
    (pa.roles.includes("recursion") && pb.roles.includes("graveyard")) ||
    (pb.roles.includes("recursion") && pa.roles.includes("graveyard"))
  )
    add(3, "graveyard recursion loop");
  if (pa.roles.includes("ramp") && pb.roles.includes("landfall"))
    add(2, "mana development supports landfall plan");
  if (pb.roles.includes("ramp") && pa.roles.includes("landfall"))
    add(2, "mana development supports landfall plan");

  let commanderBonus = 0;
  for (const theme of SYNERGY_THEMES) {
    const sig = commanderSignals.signal[theme] || 0;
    if (sig > 0 && (pa.roles.includes(theme) || pb.roles.includes(theme)))
      commanderBonus += Math.min(sig, 2) * 0.75;
  }
  if (commanderBonus) add(Math.min(commanderBonus, 2.5), "aligned with commander signals");

  return { score, reasons };
}

export function buildSynergyModel(
  matchedCards: readonly DeckEntry[],
  commanders: readonly string[] | null | undefined,
) {
  const commanderSet = new Set((commanders || []).map((n) => n.toLowerCase()));
  const commanderCards = matchedCards
    .filter((m) => commanderSet.has((m.card.n || "").toLowerCase()))
    .map((m) => m.card);
  const commanderSignals = commanderSignalProfile(commanderCards);
  const nodes = matchedCards.filter((m) => !classifyCard(m.card).isLand);
  const profiles = nodes.map((m) => ({
    ...m,
    profile: cardInteractionProfile(m.card, classifyCard(m.card)),
  }));
  const edges: SynergyEdge[] = [];
  const degree = new Map<string, number>();
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const r = interactionBetween(
        profiles[i].card,
        profiles[j].card,
        profiles[i].profile,
        profiles[j].profile,
        commanderSignals,
      );
      if (r.score >= 4) {
        edges.push({
          a: profiles[i].card.n,
          b: profiles[j].card.n,
          score: r.score,
          reasons: r.reasons,
        });
        degree.set(profiles[i].card.n, (degree.get(profiles[i].card.n) || 0) + 1);
        degree.set(profiles[j].card.n, (degree.get(profiles[j].card.n) || 0) + 1);
      }
    }
  }
  const engineCards = new Set<string>();
  for (const m of profiles) {
    const c = classifyCard(m.card);
    if (c.engine || (degree.get(m.card.n) || 0) >= 2) engineCards.add(m.card.n);
  }
  // Connected components of meaningful interactions; largest is the top cluster.
  const graph = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!graph.has(e.a)) graph.set(e.a, new Set());
    if (!graph.has(e.b)) graph.set(e.b, new Set());
    graph.get(e.a)!.add(e.b);
    graph.get(e.b)!.add(e.a);
  }
  let topCluster: string[] = [];
  const seen = new Set<string>();
  for (const n of graph.keys()) {
    if (seen.has(n)) continue;
    const q = [n],
      comp: string[] = [];
    seen.add(n);
    while (q.length) {
      const x = q.pop() as string;
      comp.push(x);
      for (const y of graph.get(x) || [])
        if (!seen.has(y)) {
          seen.add(y);
          q.push(y);
        }
    }
    if (comp.length > topCluster.length) topCluster = comp;
  }
  const nl = Math.max(
    nodes.reduce((s, m) => s + m.qty, 0),
    1,
  );
  const engineCount = [...engineCards].reduce(
    (sum, n) => sum + (matchedCards.find((m) => m.card.n === n)?.qty || 1),
    0,
  );
  const commanderAligned = nodes.reduce((sum, m) => {
    const c = classifyCard(m.card);
    const roles = cardInteractionProfile(m.card, c).roles;
    return (
      sum +
      (roles.some((r) => SYNERGY_THEMES.includes(r) && (commanderSignals.signal[r] || 0) > 0)
        ? m.qty
        : 0)
    );
  }, 0);
  return {
    commanderSignals,
    edges,
    engineCards: [...engineCards],
    engineCount,
    engineRatio: engineCount / nl,
    topCluster,
    topClusterSize: topCluster.length,
    commanderAligned,
    commanderAlignment: commanderAligned / nl,
  };
}
