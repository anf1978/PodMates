// My Profile's shell preserves the existing optional onboarding and account sections.
import { html, nothing, type TemplateResult } from "../../ui/html";

export function profileTemplate(welcome: boolean, name: string): TemplateResult {
  return html`
    <button class="tad-close" id="tadCloseBtn">Close ×</button>
    <h2 class="profile-title">${welcome ? "Welcome! Set up your profile" : "My Profile"}</h2>
    <p class="profile-intro">
      ${
        welcome
          ? 'Optional — paste links to your Archidekt or Moxfield decks to add them here, ready to load anytime. Skip this and come back anytime from "My Profile."'
          : "All your decks live here — anything saved from Chart Deck, plus anything linked from Archidekt or Moxfield below."
      }
    </p>
    ${
      welcome
        ? nothing
        : html` <div id="myProfileHeaderArea" class="profile-header-area"></div>
            <div id="profileSignInBox" class="profile-section"></div>`
    }
    <div class="profile-section">
      <label class="profile-label"
        >Display name — this is what your podmates see, instead of your email</label
      >
      <div class="row profile-row">
        <input
          id="profileDisplayNameInput"
          class="profile-input"
          type="text"
          .value=${name}
          placeholder="e.g. Alex"
        />
        <button id="profileSaveNameBtn" class="ghost profile-nowrap">Save Name</button>
      </div>
      <div id="profileNameStatus" class="profile-small-status"></div>
    </div>
    ${
      welcome
        ? nothing
        : html` <div class="profile-section">
            <label class="profile-label"
              >Your Archidekt / Moxfield profiles — a quick link to your full collection
              elsewhere</label
            >
            <div id="profileLinksArea"></div>
          </div>`
    }
    <div class="row profile-row profile-add-row">
      <input
        id="profileDeckLinkInput"
        class="profile-input"
        type="text"
        placeholder="archidekt.com/decks/... or moxfield.com/decks/..."
      />
      <button
        id="profileAddDeckBtn"
        class="ghost has-tooltip profile-nowrap"
        data-tooltip="Creates a deck that stays synced with Archidekt/Moxfield going forward. For a one-time import instead, use Import Deck on the Deck Chart tab."
      >
        Add Deck
      </button>
    </div>
    <div id="profileSyncStatus" class="profile-sync-status"></div>
    <details id="profileDeckListDetails" ?open=${welcome} class="profile-deck-details">
      <summary class="profile-summary">
        Show my decks <span id="profileDeckCount" class="profile-count"></span>
      </summary>
      <div id="profileLinkedDecks" class="profile-gap8"></div>
    </details>
    ${
      welcome
        ? html` <p class="profile-skip"><a href="#" id="profileSkipLink">Skip for now</a></p>`
        : html` <details id="profileTableDetails" class="profile-lower-section">
              <summary class="profile-summary">
                My decks table — compare every deck's scores
              </summary>
              <div class="profile-gap12">
                <button id="profileBuildTableBtn" class="ghost profile-bottom8">
                  Build my decks table
                </button>
                <div id="profileTableStatus" class="status profile-min-status"></div>
                <div id="profileTableArea" class="profile-gap8"></div>
              </div>
            </details>
            <details id="profileDisplayDetails" class="profile-lower-section">
              <summary class="profile-summary">Display settings — colour themes</summary>
              <div id="profileDisplayArea" class="profile-gap12"></div>
            </details>
            <details class="profile-lower-section">
              <summary class="profile-summary">Backup &amp; Restore</summary>
              <div class="profile-gap12">
                <p class="profile-backup-hint">
                  A personal safety-net copy of your saved decks — not needed for normal use, since
                  everything here is already saved to your account.
                </p>
                <button id="profileDownloadBackupBtn" class="ghost profile-backup-button">
                  Download My Data
                </button>
                <label class="profile-label">Restore from a downloaded backup file:</label>
                <input
                  type="file"
                  id="profileRestoreFile"
                  accept=".json,application/json"
                  class="profile-restore-file"
                />
                <div id="profileDataStatus" class="profile-data-status"></div>
              </div>
            </details>
            <div class="profile-lower-section">
              <button id="profilePriceScryBtn" class="ghost profile-price-button">
                View PriceScry
              </button>
            </div>`
    }
  `;
}
