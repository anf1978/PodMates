import type { CardRecord } from "../cards/tuple.ts";
import type { EngineContext } from "./context.ts";
import type { DeckEntry } from "./types.ts";

// ---- Commander names: reading what a person typed --------------------------
// A two-faced commander is ONE card named "Front // Back". The Commander box
// used to split on every slash, so "Front // Back" became two commanders and
// raised a false "this pairing likely isn't legal" warning. It also meant a
// commander typed as just the front face, or in lower case, never matched its
// card, so later checks (color identity, the Centrality panel) quietly skipped it.
// These two functions are the single place that turns text into commander cards.
export function resolveCommanderName(
  ctx: EngineContext,
  name: unknown,
  matchedCards?: readonly DeckEntry[] | null,
): CardRecord | null {
  const norm = (s: unknown) =>
    String(s || "")
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  const want = norm(name).replace(/\s*\/{1,2}\s*/g, " // "); // "A / B", "A/B" and "A // B" all read as the two-faced name "A // B"
  if (!want) return null;
  const pools = [(matchedCards || []).map((m) => m.card), ctx.cards];
  for (const pool of pools) {
    for (const c of pool) if (norm(c.n) === want) return c;
    for (const c of pool) if (norm(c.n).startsWith(want + " // ")) return c; // front face only
  }
  return null;
}

// "Tymna the Weaver / Kraum, Ludevic's Opus" -> two commanders.
// "Esika, God of the Tree // The Prismatic Bridge" or just "Esika, God of the Tree" -> one.
export function parseCommanderField(
  ctx: EngineContext,
  raw: unknown,
  matchedCards?: readonly DeckEntry[] | null,
): string[] {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return [];
  const whole = resolveCommanderName(ctx, text, matchedCards);
  if (whole) return [whole.n]; // one card, however it was typed
  const SENT = "\u0001";
  const parts = text
    .replace(/\s*\/\/\s*/g, SENT)
    .split(/\s*\/\s*|\s+&\s+/)
    .map((x) => x.split(SENT).join(" // ").trim())
    .filter(Boolean);
  const names = parts.map((x) => {
    const c = resolveCommanderName(ctx, x, matchedCards);
    return c ? c.n : x;
  });
  return names.filter((n, i) => names.indexOf(n) === i);
}
