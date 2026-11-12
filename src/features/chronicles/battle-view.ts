// The existing Log/Repeat/New Battle controls, rendered without string HTML.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { ChronicleBattle } from "./state";

export interface BattleActions {
  log: () => void;
  repeat: () => void;
  startNew: () => void;
  end: () => void;
}

export function battleTemplate(
  context: ChronicleBattle | null,
  actions: BattleActions,
): TemplateResult | typeof nothing {
  if (!context) return nothing;
  if (context.loggedChronicleId) {
    if (!context.isHost)
      return html`<div class="panel chronicles-battle-thanks">
        <p>Battle logged — thanks for playing!</p>
      </div>`;
    return html`
      <div class="panel chronicles-battle-panel">
        <p class="pm-battle-logged-pop chronicles-battle-heading">Battle logged. What's next?</p>
        <div class="row chronicles-battle-buttons">
          <button id="repeatBattleBtn" class="ghost" @click=${actions.repeat}>Repeat Battle</button>
          <button id="startNewBattleBtn" class="ghost" @click=${actions.startNew}>
            Start New Battle
          </button>
        </div>
        <button
          id="endGatheringFromResultsBtn"
          class="ghost chronicles-battle-end"
          @click=${actions.end}
        >
          End Gathering
        </button>
      </div>
    `;
  }
  if (!context.isHost)
    return html`<p class="chronicles-battle-waiting">
      ${`Waiting for ${context.hostName || "the host"} to log this battle.`}
    </p>`;
  return html`<button id="logBattleBtn" class="ghost chronicles-battle-log" @click=${actions.log}>
    Log Battle
  </button>`;
}
