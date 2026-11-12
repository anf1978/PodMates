// Deck Crafter templates preserve the legacy structure; all text is escaped by lit.
import { html, nothing } from "../../ui/html";
import type { CrafterState, Draft } from "./state";

export function crafterTemplate(state: CrafterState, restored: boolean, current: Draft | null) {
  return html`
    <button class="tad-close" id="tadCloseBtn">Close ×</button>
    <h2 class="db-heading">Deck Crafter</h2>
    <p class="tad-sub">
      Search for cards to add them. Set a commander first and search will only show cards that fit
      its colors (you can switch that off).
    </p>
    ${restored ? html`<p id="dbDraftNotice" class="db-notice">Picked up where you left off. <button type="button" id="dbStartNewBtn" class="ghost db-notice-button">Start New Deck</button>${current ? html` <button type="button" id="dbLoadCurrentBtn" class="ghost db-notice-button">${`Load ${current.commander || "current decklist"} instead`}</button>` : nothing}</p>` : current ? html`<p class="db-notice">${`Editing ${current.commander || "the current decklist"} from Deck Chart.`}</p>` : nothing}
    <div class="db-field">
      <label class="db-label">Commander</label>
      <div id="dbCommanderDisplay"></div>
      <input
        id="dbCommanderSearch"
        class="db-input db-commander-search"
        type="text"
        placeholder="Search for a commander…"
      />
      <div id="dbCommanderResults"></div>
    </div>
    <div class="db-field">
      <label class="db-label">Player</label>
      <input
        id="dbPlayerInput"
        class="db-input"
        type="text"
        .value=${state.player}
        placeholder="Required to save — e.g. Alex"
      />
    </div>
    <div class="db-cards-field">
      <label class="db-label">Add cards</label>
      <input id="dbCardSearch" class="db-input" type="text" placeholder="Search for a card…" />
      <label id="dbIdentityRow" class="db-identity-row">
        <input type="checkbox" id="dbIdentityToggle" checked />
        <span
          >Only show cards that fit <span id="dbIdentityName" class="db-gold"></span>'s colors (plus
          colorless)</span
        >
      </label>
      <div id="dbCardResults"></div>
      <button type="button" id="dbScanBtn" class="ghost db-scan">📷 Scan cards from a photo</button>
    </div>
    <div class="db-count">Your deck (<span id="dbCardCount">0</span> cards)</div>
    <div id="dbDeckList" class="db-deck-list"></div>
    <div class="row db-actions">
      <button id="dbSaveBtn" class="ghost">Save Deck</button>
      <button id="dbChartBtn">Chart This Deck</button>
    </div>
  `;
}
