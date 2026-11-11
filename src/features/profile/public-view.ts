import { html, render } from "../../ui/html.ts";
import { cardNameLink } from "../../ui/card-name.ts";
import { getCurrentUser } from "../../services/cloud/session.ts";
import {
  assignPlayerColors,
  computeProfileArchetypeTable,
  computeProfileBracketDistribution,
  computeProfileColorBreakdown,
  computeProfileTypeBreakdown,
  computeProfileVibeTrait,
} from "./public-analytics.ts";
import {
  analyzeDecksForProfile,
  computeMostUsedCommander,
  getPlayerRawDecksForProfile,
  getPodRawDecksForProfile,
} from "./public-data.ts";
import {
  renderBracketHistogramSVG,
  renderPlayerColorLegend,
  renderPodPaceScatterSVG,
} from "./public-charts.ts";
import { renderProfileBreakdowns, renderProfileType } from "./public-sections.ts";
import { publicProfileRuntime } from "./public-runtime.ts";
import type { PublicProfileAnalysis, PublicProfilePod } from "./public-types.ts";

function beginProfile(container: HTMLElement, message: string): boolean {
  container.classList.add("public-profile");
  if (!publicProfileRuntime().isDbReady()) {
    render(
      html`<p class="pp-loading-error">Card database still loading — try again in a moment.</p>`,
      container,
    );
    return false;
  }
  render(html`<p class="pp-loading">${message}</p>`, container);
  return true;
}

export async function renderPlayerProfileContent(
  container: HTMLElement | null,
  uid: string,
  displayName: string,
  podId?: string | null,
): Promise<void> {
  if (!container || !beginProfile(container, "Loading profile…")) return;
  const runtime = publicProfileRuntime();
  const rawDecks = await getPlayerRawDecksForProfile(uid);
  const analyzed = analyzeDecksForProfile(rawDecks);
  let chartedCount = rawDecks.length,
    chartedNote = "";
  if (uid === getCurrentUser()?.uid) {
    const all = runtime.dropLinkedDuplicates(
      Object.values(runtime.loadSavedDecks()).filter((deck) => typeof deck === "object"),
    );
    chartedCount = all.length;
    const hidden = all.filter((deck) => deck.secret === true).length;
    if (hidden) chartedNote = ` (${hidden} secret)`;
  }
  if (!analyzed.length) {
    render(
      html`<h2 class="pp-empty-title">${displayName}</h2>
        <p class="pp-empty">No saved decks yet to build a profile from.</p>`,
      container,
    );
    return;
  }
  const colors = computeProfileColorBreakdown(analyzed);
  const types = computeProfileTypeBreakdown(analyzed);
  const vibe = computeProfileVibeTrait(analyzed);
  const archetypes = computeProfileArchetypeTable(analyzed);
  const topCommander = await computeMostUsedCommander(podId, displayName, colors, vibe, uid);
  const headerCommander = topCommander || archetypes[0]?.commander || analyzed[0].commanderLabel;
  const artUrl = await runtime.fetchCardImageUrl(headerCommander, "normal");
  render(
    html`
      <div class="pp-header">
        ${artUrl ? html`<img src=${artUrl} alt=${headerCommander} class="pp-commander-art" />` : null}
        <div class="pp-player-name">${displayName}</div>
        <div class="pp-commander-name">
          ${artUrl ? headerCommander : cardNameLink(headerCommander)}
        </div>
        <div class="pp-player-count">
          <strong class="pp-count">${chartedCount}</strong
          >${` deck${chartedCount === 1 ? "" : "s"} charted${chartedNote}`}
        </div>
      </div>
      ${renderProfileType(vibe, "Player Type")} ${renderProfileBreakdowns(colors, types)}
      <details>
        <summary class="pp-label pp-archetype-summary">
          Show archetypes <span class="pp-archetype-count">${`(${archetypes.length})`}</span>
        </summary>
        <table class="pp-archetype-table">
          <tbody>
            ${archetypes.map(
              (entry) =>
                html`<tr>
                  <td>${entry.archetype}</td>
                  <td>${cardNameLink(entry.commander)}</td>
                </tr>`,
            )}
          </tbody>
        </table>
      </details>
    `,
    container,
  );
}

export function openPlayerProfileOverlay(
  uid: string,
  displayName: string,
  podId?: string | null,
): void {
  const runtime = publicProfileRuntime();
  const { modal } = runtime.openTadOverlay();
  render(
    html`<button class="tad-close" id="tadCloseBtn" @click=${() => runtime.closeTryADeckModal()}>
        Close ×
      </button>
      <div id="playerProfileContent"></div>`,
    modal,
  );
  void renderPlayerProfileContent(
    modal.querySelector("#playerProfileContent"),
    uid,
    displayName,
    podId,
  );
}

export function confirmChartDeckFromPodProfile(
  deck: PublicProfileAnalysis,
  pod: PublicProfilePod,
): void {
  const runtime = publicProfileRuntime();
  const label = deck.commanderLabel || deck._rawCommander || "this deck";
  runtime.showActionConfirmModal(
    `Chart ${label}? This loads it into Chart Deck.`,
    "Chart Deck",
    () => runtime.chartDeck(deck),
    () => openPodProfileOverlay(pod),
  );
}

export async function renderPodProfileContent(
  container: HTMLElement | null,
  pod: PublicProfilePod,
): Promise<void> {
  if (!container || !beginProfile(container, "Loading pod profile…")) return;
  const rawDecks = await getPodRawDecksForProfile(pod.id);
  const analyzed = analyzeDecksForProfile(rawDecks);
  if (!analyzed.length) {
    render(
      html`<h2 class="pp-empty-title">${pod.name}</h2>
        <p class="pp-empty">No saved decks across this pod yet to build a profile from.</p>`,
      container,
    );
    return;
  }
  const colors = computeProfileColorBreakdown(analyzed);
  const types = computeProfileTypeBreakdown(analyzed);
  const vibe = computeProfileVibeTrait(analyzed);
  const byOwner: Record<string, number> = {};
  rawDecks.forEach((deck) => {
    const name = deck._ownerName || "Podmate";
    byOwner[name] = (byOwner[name] || 0) + 1;
  });
  const perPlayerCounts = Object.entries(byOwner)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => `${name} ${count}`)
    .join(" · ");
  const brackets = computeProfileBracketDistribution(analyzed);
  const { colorMap, owners } = assignPlayerColors(analyzed, publicProfileRuntime().podColors);
  render(
    html`
      <div class="pp-header">
        <div class="pp-pod-name">${pod.name}</div>
        <div class="pp-pod-count">
          <strong class="pp-count">${rawDecks.length}</strong
          >${` deck${rawDecks.length === 1 ? "" : "s"} charted across the pod`}
        </div>
        ${perPlayerCounts ? html`<div class="pp-player-counts">${perPlayerCounts}</div>` : null}
      </div>
      ${renderProfileType(vibe, "Pod Type")} ${renderProfileBreakdowns(colors, types)}
      ${
        brackets.length
          ? html`<div class="pp-brackets">
              <div class="pp-label pp-bracket-label">Bracket Spread</div>
              ${renderBracketHistogramSVG(brackets)}
            </div>`
          : null
      }
      <div>
        <div class="pp-label pp-chart-label">Pace &amp; Interaction, Across the Library</div>
        <div class="pp-owner-legend">${renderPlayerColorLegend(owners, colorMap)}</div>
        ${renderPodPaceScatterSVG(analyzed, colorMap, (deck) => confirmChartDeckFromPodProfile(deck, pod))}
        <p class="pp-scatter-hint">Click a dot to load that deck into Chart Deck.</p>
      </div>
    `,
    container,
  );
}

export function openPodProfileOverlay(pod: PublicProfilePod): void {
  const runtime = publicProfileRuntime();
  const { modal } = runtime.openTadOverlay();
  render(
    html`<button class="tad-close" id="tadCloseBtn" @click=${() => runtime.closeTryADeckModal()}>
        Close ×
      </button>
      <div id="podProfileContent"></div>`,
    modal,
  );
  void renderPodProfileContent(modal.querySelector("#podProfileContent"), pod);
}
