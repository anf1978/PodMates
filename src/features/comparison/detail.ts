// Deck detail uses the shared modal and guards the asynchronous dataset handoff.
import "./detail.css";
import { html, nothing, render, type TemplateResult } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { reportError } from "../../services/report-error";
import { detectCommanderSparkDiscrepancy } from "../../engine/commander-tiers";
import type { ArchetypeMatch } from "../../engine/types";
import type { ComparisonDeck } from "./state";

export interface DetailPorts {
  loadDatasets(): Promise<void>;
  archetype(deck: ComparisonDeck): ArchetypeMatch | null;
}
export async function showDeckDetail(
  deck: ComparisonDeck,
  ports: DetailPorts,
  current: () => boolean,
): Promise<void> {
  const { modal } = openTadOverlay({ modalStyle: "max-width:460px" });
  const close = html`<button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>
    Close ×
  </button>`;
  render(
    html`${close}
      <h2>Deck detail</h2>
      <p class="comparison-loading">Loading...</p>`,
    modal,
  );
  try {
    await ports.loadDatasets();
  } catch (error) {
    reportError(error, { operation: "deck-library" });
    if (modal.isConnected)
      render(
        html`${close}
          <h2>Deck detail</h2>
          <p class="comparison-loading">
            ${"Could not load deck detail: " + (error instanceof Error ? error.message : String(error))}
          </p>`,
        modal,
      );
    return;
  }
  if (!modal.isConnected || !current()) return;
  render(html`${close}${detailView(deck, ports)}`, modal);
}
function detailView(d: ComparisonDeck, ports: DetailPorts): TemplateResult {
  const primary = d.winCons[0],
    others = d.winCons.slice(1);
  const discrepancy = d.commanderTiers.length
    ? detectCommanderSparkDiscrepancy(d.commanderTiers, d.commandSpark, ports.archetype(d))
    : null;
  const labels = {
    underbuilt: "Underbuilt for this commander",
    overbuilt: "Overbuilt for this commander",
    matched: "Matches this commander’s track record",
  };
  return html`<h2 class="comparison-detail-title">${d.name}</h2>
    <p class="tad-sub comparison-detail-sub">
      ${`Spark ${d.commandSpark.toFixed(1)} · Bracket ${d.bracket.bracket}`}
    </p>
    <div class="comparison-detail-section">
      <div class="comparison-detail-label">Win Condition</div>
      <div class="comparison-detail-value">
        ${primary?.label || "Combat damage (creature-based)"}
      </div>
      <div class="comparison-detail-text">${primary?.detail || ""}</div>
      ${others.length ? html`<div class="comparison-detail-others">${"Also detected: " + others.map((w) => w.label).join(", ")}</div>` : nothing}
    </div>
    <div class="comparison-detail-section">
      <div class="comparison-detail-label">Table Vibe</div>
      <div class="comparison-detail-value">${d.tableFeel.label}</div>
      <div class="comparison-detail-text">${d.tableFeel.you}</div>
      <div class="comparison-detail-pod"><strong>Your pod:</strong> ${d.tableFeel.pod}</div>
    </div>
    <div class="comparison-detail-section">
      <div class="comparison-detail-label">Deck Craft</div>
      <div class="comparison-detail-value">${d.bracket.spirit.band}</div>
      <div class="comparison-detail-text">${d.bracket.spirit.why || d.bracket.spirit.detail}</div>
    </div>
    ${
      discrepancy
        ? html`<div>
            <div class="comparison-detail-label">Commander Track Record</div>
            <div class=${`comparison-discrepancy comparison-${discrepancy.direction}`}>
              ${labels[discrepancy.direction]}
            </div>
            <div class="comparison-detail-text">${discrepancy.detail}</div>
          </div>`
        : nothing
    }`;
}
