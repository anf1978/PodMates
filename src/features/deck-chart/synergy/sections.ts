// Pieces of the Synergy panel: themes, strongest pairs, engine chips with their colour legend,
// known synergy pairs and the staples check. Display only.

import type { SynergyEdge, ThemeScore } from "../../../engine/types.ts";
import { cardNameLinkHtml, escapeHtml } from "../../../ui/card-name.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { linkifyKnownCardNames } from "../explainers/card-text.ts";
import { explainerButton } from "../explainers/button.ts";

/** One card-name link (or several joined by `sep`) as escaped markup. */
export function nameLinks(names: readonly string[], sep = ", ") {
  // Trusted: cardNameLinkHtml escapes each name; sep is a constant.
  return trustedHtml(names.map(cardNameLinkHtml).join(sep));
}

const THEME_LABELS: Record<string, string> = {
  aristocrats: "Aristocrats",
  tokens: "Tokens",
  artifacts: "Artifacts Matter",
  spellslinger: "Spellslinger",
  graveyard: "Graveyard",
  drain: "Drain / Pain",
  lifegain: "Lifegain",
  landfall: "Landfall",
  counters: "Counters",
  blink: "Blink",
  stax: "Stax",
};

export function themeChips(themes: readonly ThemeScore[]): TemplateResult[] {
  return themes.map(
    (t) =>
      // prettier-ignore
      html`<span class="syn-theme">
      <strong class="syn-gold">${THEME_LABELS[t.theme] || t.theme}</strong>
      <span class="syn-soft">${` · ${t.count} cards · ${(t.density * 100).toFixed(0)}%`}</span>
    </span>`,
  );
}

export function strongestPairs(edges: readonly SynergyEdge[]): TemplateResult {
  const top = [...edges].sort((a, b) => b.score - a.score).slice(0, 6);
  if (!top.length)
    // prettier-ignore
    return html`<span class="syn-empty">No strong card-to-card interactions detected — this deck reads more as a collection of good individual cards than a tightly interlocking engine.</span>`;
  // prettier-ignore
  return html`${top.map((e) => html`
        <div class="syn-edge">
          <div class="syn-edge-names"><strong class="syn-primary">${nameLinks([e.a])}</strong> <span class="syn-gold">↔</span> <strong class="syn-primary">${nameLinks([e.b])}</strong></div>
          <div class="syn-edge-why">${e.reasons.join("; ")}</div>
        </div>`)}`;
}

// Each engine card is coloured by the DOMINANT kind of interaction it takes part in.
const REASON_CATEGORIES = [
  {
    key: "resource",
    test: /produces .* which .* uses/,
    color: "var(--u)",
    label: "Resource chain",
  },
  { key: "pattern", test: /feed|loop|supports/, color: "var(--g)", label: "Known pattern" },
  {
    key: "commander",
    test: /aligned with commander/,
    color: "var(--gold)",
    label: "Commander-aligned",
  },
  { key: "trigger", test: /^both interact with/, color: "var(--r)", label: "Shared trigger" },
  { key: "theme", test: /^shared .* theme$/, color: "var(--b)", label: "Shared theme" },
];

function categorizeReason(reason: string): string {
  for (const cat of REASON_CATEGORIES) if (cat.test.test(reason)) return cat.key;
  return "theme";
}

/** Engine chips plus a legend of the colours used, or null when there are no engine cards. */
export function engineChips(
  engineCards: readonly string[],
  edges: readonly SynergyEdge[],
): { chips: TemplateResult; legend: TemplateResult | typeof nothing } | null {
  const counts = new Map<string, Record<string, number>>();
  for (const e of edges) {
    for (const cardName of [e.a, e.b]) {
      if (!counts.has(cardName)) counts.set(cardName, {});
      const c = counts.get(cardName) as Record<string, number>;
      for (const r of e.reasons || []) {
        const cat = categorizeReason(r);
        c[cat] = (c[cat] || 0) + 1;
      }
    }
  }
  const dominant = (cardName: string): string | null => {
    const c = counts.get(cardName);
    if (!c) return null;
    let best: string | null = null,
      bestN = 0;
    for (const [cat, n] of Object.entries(c))
      if (n > bestN) {
        best = cat;
        bestN = n;
      }
    return best;
  };
  const used = new Set<string>();
  const chips = engineCards.slice(0, 20).map((n) => {
    const catDef = REASON_CATEGORIES.find((c) => c.key === dominant(n));
    if (catDef) used.add(catDef.key);
    const border = "border-left:3px solid " + (catDef ? catDef.color : "var(--line)") + ";";
    return html`<span class="gc-chip" style=${border}>${nameLinks([n])}</span>`;
  });
  if (!chips.length) return null;
  const legend = used.size
    ? // prettier-ignore
      html`<div class="syn-legend">${REASON_CATEGORIES.filter((c) => used.has(c.key)).map((c) => html`<span class="syn-legend-item"><span class="syn-swatch" style=${"background:" + c.color + ";"}></span>${c.label}</span>`)}</div>`
    : nothing;
  return { chips: joinWithSpaces(chips), legend };
}

function joinWithSpaces(items: TemplateResult[]): TemplateResult {
  return html`${items.map((t, i) => (i ? html` ${t}` : t))}`;
}

function linked(text: string, names: readonly string[]) {
  // Trusted: escapeHtml first, then only known names are swapped for escaped links.
  return trustedHtml(linkifyKnownCardNames(escapeHtml(text), names));
}

export function knownPairs(
  synergies: readonly string[] | undefined,
  details: readonly { cards: string[] }[] | undefined,
): TemplateResult | typeof nothing {
  if (!synergies || !synergies.length) return nothing;
  // prettier-ignore
  return html`<div class="syn-block">
        <div class="syn-h">Known Synergy Pairs <span class="syn-h-note">(documented, not auto-detected)</span></div>
        ${synergies.map((s, i) => html`<div class="syn-known">${linked(s, ((details || [])[i] || { cards: [] }).cards)}</div>`)}
      </div>`;
}

export interface StaplesResult {
  baseline: unknown;
  sampleSize?: number;
  deviations: {
    label: string;
    actual: number;
    baseline: number;
    direction: "under" | "over";
  }[];
}

export function staplesCheck(archetype: string, result: StaplesResult): TemplateResult {
  const { deviations, sampleSize } = result;
  const rows = deviations.length
    ? deviations.map(
        (d) =>
          // prettier-ignore
          html`<div class="syn-staple">
              <span class="syn-primary">${d.label}</span>
              <span class=${d.direction === "under" ? "syn-under" : "syn-over"}>${`${d.direction === "under" ? "↓" : "↑"} ${d.actual} `}<span class="syn-staple-base">${`(${archetype} baseline: ${d.baseline})`}</span></span>
            </div>`,
      )
    : // prettier-ignore
      html`<div class="syn-note-13">${`This deck's staple counts track the ${archetype} baseline closely — nothing stands out as notably over or under.`}</div>`;
  const title = `Median raw counts across real ${archetype} precons in this app's corpus, for 12 mechanical categories. Only categories where this deck sits at half the baseline or below, or 1.75x or more above it, are shown.`;
  // prettier-ignore
  return html`<div class="syn-block">
        <div class="syn-h syn-h-help" title=${title}>Staples Check <span class="syn-h-note">${`(vs. ${archetype}, n=${sampleSize})`}</span>${explainerButton("staplesBaseline")}</div>
        ${rows}
      </div>`;
}
