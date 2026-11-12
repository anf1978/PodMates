// Optional balance suggestions preserve the legacy thresholds and three-item limit.
import type { ComparisonDeck } from "./state";

export function buildBalanceNudges(decks: readonly ComparisonDeck[]) {
  if (decks.length < 2) return null;
  const sorted = [...decks].sort((a, b) => b.commandSpark - a.commandSpark);
  const high = sorted[0],
    low = sorted[sorted.length - 1];
  const spread = high.commandSpark - low.commandSpark;
  if (spread < 0.7)
    return {
      spread,
      skipReason:
        "Spark values are already close — no balance tweaks needed unless the table wants a specific feel.",
      high: null,
      low: null,
    };
  const name = (d: ComparisonDeck): string => d.commanderLabel || d.name || "This deck";
  return {
    spread,
    skipReason: null,
    high: { label: name(high), spark: high.commandSpark, nudges: highNudges(high) },
    low: { label: name(low), spark: low.commandSpark, hints: lowHints(low) },
  };
}

function highNudges(d: ComparisonDeck): string[] {
  const a = d.agg,
    s = d.scores,
    out: string[] = [];
  if ((a.freeInteraction || 0) >= 2) {
    const ex = (a.freeInteractionCards || []).slice(0, 2);
    out.push(
      "You could leave a free interaction piece in the box for tonight" +
        (ex.length ? ` (e.g. something like ${ex.join(" / ")})` : "") +
        " — softens stack control without rewriting the deck.",
    );
  }
  if ((a.gameChangers || []).length >= 2)
    out.push(
      "Seating one Game Changer on the bench is a gentle tweak if the table wants a fairer ceiling.",
    );
  if ((a.detectedCombos || []).length >= 1 && s.speed >= 6.5)
    out.push(
      "If wins feel too early, parking one combo piece keeps the plan intact but slows the fastest line.",
    );
  if ((a.fastMana || 0) >= 3 && s.speed >= 7)
    out.push(
      "Swapping one fast-mana rock for a slower value piece nudges speed down without changing identity.",
    );
  if ((a.stax || 0) >= 4)
    out.push(
      "Fewer hard stax pieces (or agreeing a lighter lock) often does more for table feel than cutting power cards.",
    );
  if (!out.length)
    out.push(
      "A light touch is enough: one fewer premium interaction or acceleration card is usually plenty.",
    );
  return out.slice(0, 3);
}

function lowHints(d: ComparisonDeck): string[] {
  const a = d.agg,
    s = d.scores,
    out: string[] = [];
  const theme = a.topThemes?.[0]?.theme || "";
  if ((a.freeInteraction || 0) === 0 && (a.cheapInteraction || 0) < 4)
    out.push(
      "If you own them, a couple of cheap answers (2 mana or less) help you participate in stacks — only if it fits the deck.",
    );
  if ((a.earlyDensity || 0) < 0.35 && (a.ramp || 0) < 8)
    out.push(
      "One or two early mana pieces (if available) can help you keep up with faster tables without a full rebuild.",
    );
  if ((a.tutor || 0) <= 1 && (a.draw || 0) < 8)
    out.push(
      "A bit more card selection or draw on-theme would raise consistency more than random staples.",
    );
  if ((a.detectedCombos || []).length === 0 && (s.versatility || 0) < 5)
    out.push(
      "A second clear win path or more redundancy in your main theme often closes gaps more than a single expensive bomb.",
    );
  if ((a.protection || 0) < 2 && (a.engines || 0) > 3)
    out.push(
      "Light protection for your engine/commander (if you have it) helps the deck show its real power level.",
    );
  if (theme === "drain" || theme === "aristocrats")
    out.push(
      "On-theme redundancy (extra drain/sac outlets you already own) beats off-plan power cards for this strategy.",
    );
  if (!out.length)
    out.push(
      "Lean into what the deck already does — one more on-theme early play or answer is enough of a nudge.",
    );
  return out.slice(0, 3);
}
