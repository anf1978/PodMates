// The whole interaction reading for one deck: trigger/rule packages, game plans, the stat-axis
// rule, cards that depend on your creatures' stats, and cards with no link or everyday job.
// Computed only when the Synergy panel is drawn; it never feeds a score.

import type { MatchedCard } from "../../../cards/lookup.ts";
import { ixDeckPlans } from "./deck-plans.ts";
import { triggerPackages } from "./packages.ts";
import { ixTrait } from "./secondary-packages.ts";
import { ixStat, ixRoles, ixText, ixTokensMade } from "./text.ts";
import { ixThemePlans } from "./theme-plans.ts";
import type {
  InteractionData,
  InteractionReading,
  IxConditional,
  IxEntry,
  IxLink,
} from "./types.ts";
import { ixWalkerPlans } from "./walkers.ts";

const IX_AXIS_RE =
  /assigns? combat damage equal to its (toughness|power) rather than its (?:power|toughness)/;
const IX_PUMP =
  /(?:creatures? you control|each creature|target creatures?|each other creature you control)[^.]{0,50}\bgets? \+(\d+|x)\/\+(\d+|x)|\bgets? \+(\d+|x)\/\+(\d+|x)[^.]{0,40}(?:creatures? you control|each creature)/;
/** Pump that reaches the whole team (not one target, not an Aura/Equipment): toughness part must be above zero. */
export const IX_MASS_PUMP =
  /(?:other )?creatures you control (?:each )?get \+(\d+|x)\/\+([1-9]\d*|x)|each (?:other )?creature you control gets \+(\d+|x)\/\+([1-9]\d*|x)|(?:up to [a-z ]+ )?target creatures each get \+(\d+|x)\/\+([1-9]\d*|x)/;
/** The stat-swap rule applied to every creature you control, not just one equipped or enchanted creature. */
export const IX_TEAM_AXIS =
  /(?:each|all|every) creature(?:s)?(?: you control)? (?:assigns?|assign) combat damage equal to (?:its|their) toughness|creatures you control (?:each )?assign combat damage equal to their toughness/;

/** Everyday jobs: a card with one of these is never listed as "not understood". */
const JOB_FLAGS = [
  "ramp",
  "fastMana",
  "manaDork",
  "manaRock",
  "draw",
  "removal",
  "wipe",
  "protection",
  "counterMagic",
  "tutor",
  "reanimate",
  "tokens",
  "stax",
  "sac",
  "sacOutlet",
  "extraTurn",
  "discard",
  "mld",
  "costReducer",
  "altWin",
  "burnFace",
  "drain",
  "engine",
  "landEngine",
  "impulseDraw",
  "manaMultiplier",
  "extraLand",
  "treasureRamp",
  "ritual",
  "lifegain",
  "counters",
  "artifactsMatter",
  "spellslinger",
  "graveyard",
  "aristocrats",
  "blink",
  "landfall",
];

export function buildInteractionPackages(
  data: InteractionData,
  matchedCards: readonly MatchedCard[],
  commanders: readonly string[],
): InteractionReading {
  const cmdSet = new Set((commanders || []).map((n) => String(n).toLowerCase()));
  const all: IxEntry[] = matchedCards.map((m) => ({
    ...m,
    card: m.card,
    text: ixText(m.card),
    isCmd: cmdSet.has(String(m.card.n).toLowerCase()),
    tokens: [],
  }));
  const nonland = all.filter((m) => !/\bland\b/i.test(m.card.t || ""));
  const nl = Math.max(
    1,
    nonland.reduce((s, m) => s + (m.qty || 1), 0),
  );
  const subtypes = new Set<string>();
  for (const m of all) {
    const t = String(m.card.t || ""),
      d = t.indexOf("—");
    if (d >= 0)
      t.slice(d + 1)
        .trim()
        .split(/\s+/)
        .forEach((w) => {
          if (w && w !== "//" && /^[A-Z]/.test(w)) subtypes.add(w);
        });
  }
  const subs = [...subtypes];
  for (const m of all) m.tokens = ixTokensMade(m.text);
  const used = new Set<string>(); // cards that take part in some package
  const top = triggerPackages(data.tags, all, nonland, subs, nl);
  const plans = ixDeckPlans(all, nonland, used);
  try {
    ixWalkerPlans(all, nonland, used).forEach((p) => plans.push(p));
  } catch (e) {
    console.error(e);
  }
  try {
    ixThemePlans(data.cards, all, nonland, used, commanders).forEach((p) => plans.push(p));
  } catch (e) {
    console.error(e);
  }
  const shown = plans.concat(top.slice(0, 5));
  // Stat axis: when a card changes which stat deals combat damage, cards that raise that stat are
  // finishers, and cards that repeat the rule are backups if the commander is removed.
  const axisCards = all.filter((x) => IX_AXIS_RE.test(x.text));
  const axis = axisCards.length ? IX_AXIS_RE.exec(axisCards[0]!.text)![1]! : null;
  if (axis === "toughness") {
    shown
      .filter((pk) => pk.kind === "rule" && pk.isCmd)
      .forEach((pk) => {
        const fin: IxLink[] = [],
          back: IxLink[] = [];
        for (const o of all) {
          if (o.isCmd || o.card.n === pk.payoff) continue;
          if (IX_TEAM_AXIS.test(o.text))
            back.push({ name: o.card.n, how: "repeats the rule if the commander is removed" });
          const mm = IX_MASS_PUMP.exec(o.text) || IX_PUMP.exec(o.text);
          if (!mm) continue;
          const tough = mm[2] || mm[4] || mm[6];
          if (/^\+?0$/.test(tough || "0")) continue;
          fin.push({ name: o.card.n, how: "raises toughness, which is now damage" });
        }
        pk.finishers = fin;
        pk.backups = back;
        const objs = new Set(pk.objects);
        let sp = 0,
          st = 0,
          cn = 0;
        for (const o of all) {
          if (!objs.has(o.card.n)) continue;
          const q = ixStat(o.card);
          if (!q || q.t === null) continue;
          const k = o.qty || 1;
          cn += k;
          st += (q.t || 0) * k;
          sp += (q.p || 0) * k;
        }
        if (cn >= 5)
          pk.statLine = `Under this rule your ${cn} matching creatures hit for ${st} combined, against ${sp} if power still counted.`;
        fin.concat(back).forEach((r) => used.add(r.name));
      });
  }
  shown.forEach((pk) => {
    (pk.members || []).forEach((m) => used.add(m.name));
    used.add(pk.payoff);
    pk.objects.forEach((n) => used.add(n));
    pk.tokenMakers.forEach((n) => used.add(n));
    pk.repeaters.forEach((r) => used.add(r.name));
    pk.multipliers.forEach((r) => used.add(r.name));
  });
  const conditional = conditionalCards(all, nonland, used, axis);
  // Cards with no link and no everyday job of their own: worth a second look (not an instruction to cut).
  // Dig spells count as card selection.
  const idle = nonland
    .filter(
      (m) =>
        !m.isCmd &&
        !used.has(m.card.n) &&
        !JOB_FLAGS.some((k) => ixTrait(m.card, k)) &&
        !Object.keys(ixRoles(m.text)).length &&
        !m.card.g &&
        !/reveal the top (?:two|three|four|five|six|seven|x|\d+) cards of your library[^]{0,160}?(?:into your hand|from among them)/.test(
          m.text,
        ),
    )
    .map((m) => m.card.n);
  return { packages: shown, idle, conditional, axis, nonlandCount: nl };
}

/** Cards whose text depends on a stat of your creatures: judged by what the deck contains, not left as "unknown". */
function conditionalCards(
  all: IxEntry[],
  nonland: IxEntry[],
  used: Set<string>,
  axis: string | null,
): IxConditional[] {
  const flag = (m: IxEntry, k: string): boolean => {
    try {
      return !!ixTrait(m.card, k);
    } catch {
      return false;
    }
  };
  const conditional: IxConditional[] = [];
  const creatures: Array<{ p: number | null; t: number | null; q: number }> = [];
  for (const m of all) {
    if (!/\bcreature\b/i.test(m.card.t || "")) continue;
    const st = ixStat(m.card);
    if (st) creatures.push({ p: st.p, t: st.t, q: m.qty || 1 });
  }
  for (const m of nonland) {
    if (m.isCmd || used.has(m.card.n) || flag(m, "ramp")) continue;
    let why: string | null = null;
    if (/total power \d+ or less/.test(m.text))
      why =
        axis === "toughness"
          ? "keeps creatures up to a total power, sacrifices the rest, and your walls count for almost nothing under that limit, so it can wipe the other boards while sparing yours"
          : "keeps creatures up to a total power and sacrifices the rest, so it is only one-sided if your creatures have low power";
    else if (
      /(?:power|toughness)(?: or (?:power|toughness))? \d+ or (?:less|greater)|(?:power|toughness) (?:less|greater) than/.test(
        m.text,
      )
    ) {
      const high =
        /(?:power|toughness)(?: or (?:power|toughness))? \d+ or greater|(?:power|toughness) greater than|(?:power|toughness) \d+ or more/.test(
          m.text,
        );
      why = high
        ? axis === "toughness"
          ? "hits creatures with high power, and yours do not need any, so it mostly lands on opponents"
          : "hits creatures with high power, so it is one-sided only if yours are small"
        : axis === "toughness" && /power/.test(m.text)
          ? "helps creatures with low power, and power does not matter once toughness deals the damage, so the condition is nearly free here"
          : "only helps creatures with small power or toughness, so it depends on what your creatures look like";
    }
    if (why && creatures.length) {
      // judge the condition against the deck's real stats
      const n = creatures.reduce((a, c) => a + c.q, 0);
      const cm = /(power|toughness)(?: or (power|toughness))? (\d+) or (less|greater|more)/.exec(
        m.text,
      );
      const tp = /total power (\d+) or less/.exec(m.text);
      if (tp) {
        const lim = +tp[1]!;
        let sum = 0,
          kept = 0;
        const list: number[] = [];
        creatures.forEach((c) => {
          if (c.p !== null) for (let i = 0; i < c.q; i++) list.push(c.p);
        });
        list.sort((a, b) => a - b);
        for (const v of list) {
          if (sum + v > lim) break;
          sum += v;
          kept++;
        }
        why += ` (you could keep ${kept} of your ${n} creatures)`;
      } else if (cm) {
        const lim = +cm[3]!,
          low = cm[4] === "less",
          stats = [cm[1], cm[2]]
            .filter(Boolean)
            .map((w) => (w === "power" ? "p" : "t") as "p" | "t");
        const q = creatures.reduce(
          (a, c) =>
            a + (stats.some((k) => c[k] !== null && (low ? c[k]! <= lim : c[k]! >= lim)) ? c.q : 0),
          0,
        );
        why += ` (${q} of your ${n} creatures ${low ? "qualify" : "are affected"})`;
      }
    }
    if (why) {
      conditional.push({ name: m.card.n, why });
      used.add(m.card.n);
    }
  }
  return conditional;
}
