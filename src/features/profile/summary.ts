// Cached quick deck snapshots; scoring uses the unchanged pure engine.
import { parseDecklist } from "../../cards/parse-decklist";
import { matchDecklist } from "../../cards/lookup";
import {
  analyzeDeck,
  parseCommanderField,
  detectWinCondition,
  scoreSpeed,
  scoreConsistency,
  scoreVersatility,
  scoreDisruption,
  scorePowerLevel,
} from "../../engine";
import { computeSpark } from "../../engine/spark";
import { detectBracket } from "../../engine/brackets";
import { html, nothing, render, type TemplateResult } from "../../ui/html";
import { cardNameLink } from "../../ui/card-name";
import { closeModal } from "../../ui/modal";
import { showToast } from "../../ui/toast";
import { reportError } from "../../services/report-error";
import { profileRuntime } from "./runtime";
import { errorMessage } from "./account";
import type { ProfileDeck } from "./state";

interface QuickSummary {
  commander: string;
  winConditionLabel: string;
  commandSpark: number;
  speed: number;
  consistency: number;
  versatility: number;
  disruption: number;
  powerLevel: number;
  bracket: string;
}

export const myDecksSummaryCache = new Map<string, QuickSummary>();

export function computeQuickSummary(deck: ProfileDeck): QuickSummary | { error: string } {
  const cached = myDecksSummaryCache.get(deck.id);
  if (cached) return cached;
  const runtime = profileRuntime();
  if (!runtime.ready()) return { error: "Card database still loading — try again in a moment." };
  try {
    const context = runtime.context();
    const parsed = parseDecklist(deck.decklistText);
    const { matched } = matchDecklist(parsed.entries, runtime.cards(), runtime.indexes());
    if (!matched.length) return { error: "Could not read this deck’s cards." };
    const commanders = parseCommanderField(context, deck.commander || "");
    const agg = { ...analyzeDeck(context, matched, commanders), commanders };
    const winCons = detectWinCondition(agg);
    const speed = scoreSpeed(agg, winCons.length > 0 && winCons[0].confidence !== "fallback");
    const consistency = scoreConsistency(agg);
    const versatility = scoreVersatility(agg, winCons.length);
    const disruption = scoreDisruption(agg);
    const powerLevel = scorePowerLevel(agg);
    const commandSpark = computeSpark(speed, consistency, versatility, disruption, powerLevel);
    const summary = {
      commander: commanders.join(" / ") || "Unknown",
      winConditionLabel: winCons[0]?.label || "Combat damage",
      commandSpark,
      speed,
      consistency,
      versatility,
      disruption,
      powerLevel,
      bracket: detectBracket(agg, commandSpark).bracket,
    };
    myDecksSummaryCache.set(deck.id, summary);
    return summary;
  } catch (error) {
    reportError(error, { operation: "global-error" });
    return { error: "Could not analyze this deck: " + errorMessage(error) };
  }
}

export function renderMyDeckSummary(deck: ProfileDeck): TemplateResult {
  const summary = computeQuickSummary(deck);
  if ("error" in summary) return html`<div class="profile-summary-error">${summary.error}</div>`;
  const chip = (label: string, value: number) =>
    html` <div class="profile-score">
      <div class="profile-axis-value">${value.toFixed(1)}</div>
      <div class="profile-axis-label">${label}</div>
    </div>`;
  const source =
    deck.source === "archidekt" ? "Archidekt" : deck.source === "moxfield" ? "Moxfield" : null;
  const href = profileRuntime().safeUrl(deck.url);
  return html` <div class="profile-summary-body">
    <div class="profile-summary-commander">
      <strong>Commander:</strong> ${cardNameLink(summary.commander)}
    </div>
    <div class="profile-summary-win">
      <strong>Win Condition:</strong>${` ${summary.winConditionLabel} · `}
      <strong>Bracket:</strong>${` ${String(summary.bracket)}`}
    </div>
    <div class="profile-scores">
      <div class="profile-score">
        <div class="profile-spark">${summary.commandSpark.toFixed(1)}</div>
        <div class="profile-spark-label">Spark</div>
      </div>
      <div class="profile-axes">
        ${chip("Speed", summary.speed)}${chip("Consist.", summary.consistency)}${chip("Versat.", summary.versatility)}${chip("Disrupt.", summary.disruption)}${chip("Power", summary.powerLevel)}
      </div>
    </div>
    <button class="ghost profile-price-button" data-action="open-chart" data-id=${deck.id}>
      Open in Deck Chart →
    </button>
    ${href ? html`<div class="profile-original"><a href=${href} target="_blank" rel="noopener">${`View original on ${source} ↗`}</a></div>` : nothing}
  </div>`;
}

export function openDeckSummaryPopup(deck: ProfileDeck): void {
  const runtime = profileRuntime();
  const modal = runtime.open({
    stacked: true,
    id: "tadDeckSummaryOverlay",
    modalStyle: "max-width:420px",
  });
  render(
    html`
      <button class="tad-close" id="tadDeckSummaryCloseBtn">Close ×</button>
      <h2 class="profile-summary-title">${deck.name}</h2>
      ${renderMyDeckSummary(deck)}
    `,
    modal,
  );
  const close = (): void => closeModal(document.getElementById("tadDeckSummaryOverlay"));
  modal.querySelector("#tadDeckSummaryCloseBtn")?.addEventListener("click", close);
  modal.querySelector('[data-action="open-chart"]')?.addEventListener("click", async () => {
    if (!runtime.ready()) {
      showToast("Card database still loading — try again in a moment.");
      return;
    }
    close();
    runtime.close();
    await runtime.chartDeck(deck);
  });
}
