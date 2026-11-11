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

const PARTNER_RE =
  /\bpartner\b|\bfriends forever\b|\bchoose a background\b|\bdoctor's companion\b/i;

/** The commander(s) of a pasted list: the names from its Commander: section when it has one,
 * otherwise a best guess from its single-copy legendary creatures and planeswalkers. */
export function detectCommander(
  matched: readonly (DeckEntry & { originalName?: string })[],
  commanderNamesFromParse?: readonly string[] | null,
): string[] {
  // Prefer explicit Commander: section names
  if (commanderNamesFromParse && commanderNamesFromParse.length) {
    const found: string[] = [];
    for (const cn of commanderNamesFromParse) {
      const m = matched.find(
        (x) =>
          x.card.n.toLowerCase() === cn.toLowerCase() ||
          x.card.n.toLowerCase().startsWith(cn.toLowerCase() + " //") ||
          (x.originalName && x.originalName.toLowerCase() === cn.toLowerCase()),
      );
      if (m) found.push(m.card.n);
      else found.push(cn); // keep typed name even if not in DB
    }
    if (found.length) return [...new Set(found)];
  }
  // Fallback: single-copy legendary creatures / planeswalkers
  const legendaries = matched.filter((m) => {
    const t = (m.card.t || "").toLowerCase();
    return (
      m.qty === 1 &&
      t.includes("legendary") &&
      (t.includes("creature") || t.includes("planeswalker"))
    );
  });
  const only = legendaries[0];
  if (!only) return [];
  if (legendaries.length === 1) return [only.card.n];

  // Only treat two-or-more legendaries as co-commanders if they actually carry
  // partner-enabling text — otherwise a deck with an unrelated bonus legendary
  // in the 99 gets misread as having two commanders.
  const partnerCapable = legendaries.filter((m) => PARTNER_RE.test(m.card.o || ""));
  if (partnerCapable.length >= 2) {
    return partnerCapable.slice(0, 2).map((m) => m.card.n);
  }

  // No verified partner pair — score all candidates and take the single best.
  const scored = legendaries.map((m) => {
    const n = m.card.n;
    let score = 0;
    if (/,/.test(n)) score += 3; // "Name, Title"
    if (/\bthe\b/i.test(n)) score += 2; // "The Lord of …"
    if (n.split(/\s+/).length <= 4) score += 1;
    if (PARTNER_RE.test(m.card.o || "")) score += 2; // partner-capable card is still a decent signal alone
    return { n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return [(scored[0] as { n: string }).n];
}
