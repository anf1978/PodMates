// Comparison shell and table views; all deck/player text is escaped by lit.
import { html, type TemplateResult } from "../../ui/html";
import { AXES, bestTier, generatePodSummary, type ComparisonDeck, type TableState } from "./state";
export function shellView(): TemplateResult {
  return html`<div id="battleControlsArea"></div>
    <div id="podSummaryBanner" class="pod-summary-banner" hidden></div>
    <div class="panel">
      <details class="panel-collapsible">
        <summary class="panel-toggle">Table Alignment</summary>
        <div id="podBalanceArea"></div>
      </details>
    </div>
    <div class="panel">
      <details class="panel-collapsible">
        <summary class="panel-toggle">Seats at a Glance</summary>
        <div id="podRankArea"></div>
      </details>
    </div>
    <div class="panel">
      <details class="panel-collapsible">
        <summary class="panel-toggle">How We Differ</summary>
        <div id="podAxisArea"></div>
      </details>
    </div>
    <div class="panel">
      <details class="panel-collapsible">
        <summary class="panel-toggle">Archetype Matchup Radar</summary>
        <p class="comparison-radar-intro">
          Spark parity doesn't guarantee a close game — this checks whether these decks share a
          similar relationship to time and interaction, not just raw power.
        </p>
        <div id="paceRadarArea"></div>
      </details>
    </div>
    <div class="panel">
      <details class="panel-collapsible">
        <summary class="panel-toggle">Each Deck’s Shape</summary>
        <div id="podChartsArea"></div>
      </details>
    </div>`;
}
export function summaryView(decks: ComparisonDeck[]): TemplateResult {
  return html`<div class="pod-summary-label">Rule Zero Overview</div>
    <div class="pod-summary-text">${generatePodSummary(decks)}</div>
    ${decks.map(ruleZeroView)}`;
}
function ruleZeroView(d: ComparisonDeck): TemplateResult {
  const gc = d.agg.gameChangers || [],
    combos = d.agg.detectedCombos || [];
  const bits: string[] = [];
  if (combos.length)
    bits.push(
      `a known combo (${combos[0]})${combos.length > 1 ? ` and ${combos.length - 1} more` : ""}`,
    );
  if (gc.length)
    bits.push(
      `${gc.length} Game Changer${gc.length === 1 ? "" : "s"}${gc.length <= 2 ? ` (${gc.join(", ")})` : ""}`,
    );
  return html`<div class="comparison-rule-zero">
    <strong>${d.playerName || d.commanderLabel}</strong
    >${` — Bracket ${d.bracket.bracket ?? "?"}, ${(d.style || "").toLowerCase()} built around ${d.commanderLabel}${bits.length ? " — runs " + bits.join(" and ") : ""}.`}
  </div>`;
}
const deltaClass = (delta: number, threshold: number): string =>
  delta >= threshold ? "comparison-ahead" : delta <= -threshold ? "comparison-behind" : "";
export function rankView(state: TableState, open: (index: number) => void): TemplateResult {
  return html`<table class="comparison-rank">
      <thead>
        <tr>
          <th>Deck</th>
          <th>Spark</th>
          <th>vs Avg</th>
          <th>Cmdr Tier</th>
          <th>Spirit</th>
          <th>Style</th>
          <th>Bracket signals</th>
          <th>Vibe</th>
        </tr>
      </thead>
      <tbody>
        ${state.decks.map((d, i) => {
          const delta = d.commandSpark - state.avgSpark,
            tier = bestTier(d);
          return html`<tr>
            <td>
              <span class="comparison-dot" style=${`background:${d.color}`}></span>
              <strong class="pod-deck-clickable" data-pod-deck-index=${i} @click=${() => open(i)}
                >${d.name}</strong
              >
              <div class="comparison-commander">
                ${d.commanders.length ? d.commanders.join(" / ") : "—"}
              </div>
            </td>
            <td>${d.commandSpark.toFixed(1)}</td>
            <td class=${deltaClass(delta, 0.7)}>${(delta >= 0 ? "+" : "") + delta.toFixed(1)}</td>
            <td>
              ${tier ? html`<span class=${`comparison-tier comparison-tier-${tier.t}`}>${tier.t}</span> <span class="comparison-winrate">${tier.w.toFixed(0) + "%"}</span>` : html`<span class="comparison-no-tier">—</span>`}
            </td>
            <td>${d.bracket.spirit?.band || "—"}</td>
            <td>${d.style}</td>
            <td>${d.bracket.bracket || "—"}</td>
            <td>${d.tableFeel.label}</td>
          </tr>`;
        })}
      </tbody>
    </table>
    <p class="comparison-caption comparison-rank-caption">
      Spark is a weighted average of all five axes — Power Level and Disruption count for more,
      since they're what most directly predicts whether a deck will dominate a table. Cmdr Tier is
      real win-rate data from Playgroup.gg (S=35%+, A=30-35%, B=23-30%, C=18-23%, D=below 18%),
      shown only when the commander has enough tracked games — a different kind of evidence than
      everything else in this table. Tap a deck's name for the full breakdown behind these numbers.
    </p>`;
}
export function axisView(decks: ComparisonDeck[]): TemplateResult {
  return html`<div class="comparison-axis-scroll">
      <table class="comparison-axis">
        <thead>
          <tr>
            <th>Axis</th>
            ${decks.map((d) => html`<th><span class="comparison-dot comparison-axis-dot" style=${`background:${d.color}`}></span>${d.name.length > 12 ? d.name.slice(0, 11) + "…" : d.name}</th>`)}
            <th>Avg</th>
          </tr>
        </thead>
        <tbody>
          ${AXES.map((ax) => {
            const avg = decks.reduce((sum, d) => sum + d.scores[ax.key], 0) / decks.length;
            return html`<tr>
              <td>${ax.label}</td>
              ${decks.map((d) => html`<td class=${deltaClass(d.scores[ax.key] - avg, 0.8)}>${d.scores[ax.key].toFixed(1)}</td>`)}
              <td>${avg.toFixed(1)}</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
    <p class="comparison-caption">
      Values notably above average are highlighted. Use this to see *why* one deck sits higher (e.g.
      much more disruption or speed).
    </p>`;
}
export function miniCardView(d: ComparisonDeck, chart: TemplateResult): TemplateResult {
  return html`<div class="comparison-mini">
    <div class="comparison-mini-name">
      <span class="comparison-dot comparison-mini-dot" style=${`background:${d.color}`}></span>
      ${d.name}
    </div>
    <div class="comparison-mini-spark">${d.commandSpark.toFixed(1)}</div>
    <div class="comparison-mini-style">${`${d.style} · ${d.bracket.bracket}`}</div>
    ${chart}
  </div>`;
}
