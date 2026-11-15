// Tutorial templates: the tip card (welcome and tour steps) and the Help & tips menu.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { IconRef } from "./state";

export interface CardButton {
  label: string;
  primary?: boolean;
  run(): void;
}

export interface CardContent {
  title: string;
  text: string;
  /** "Step 3 of 10", or null. */
  progress: string | null;
  buttons: CardButton[];
  /** Real control icons with their names (filled in by place.ts fillIcons). */
  icons?: readonly IconRef[];
}

export function cardView(content: CardContent): TemplateResult {
  return html`<section class="tut-card" role="dialog" aria-modal="false" aria-labelledby="tutTitle">
    ${content.progress ? html`<div class="tut-progress">${content.progress}</div>` : nothing}
    <h2 id="tutTitle" class="tut-title">${content.title}</h2>
    <p class="tut-text">${content.text}</p>
    ${
      content.icons?.length
        ? html`<ul class="tut-icons">
            ${content.icons.map(
              (icon) =>
                html`<li>
                  <span class="tut-icon" data-from=${icon.from}></span><span>${icon.label}</span>
                </li>`,
            )}
          </ul>`
        : nothing
    }
    <div class="tut-actions">
      ${content.buttons.map(
        (button) =>
          html`<button type="button" class=${button.primary ? "" : "ghost"} @click=${button.run}>
            ${button.label}
          </button>`,
      )}
    </div>
  </section>`;
}

export function helpButtonView(open: () => void): TemplateResult {
  return html`<button
    type="button"
    id="pmHelpBtn"
    class="icon-btn ghost pm-help-btn"
    aria-label="Help and tips"
    data-tooltip="Help and tips"
    @click=${open}
  >
    ?
  </button>`;
}

export interface HelpActions {
  close(): void;
  tour(): void;
  toggle(): void;
  reset(): void;
}

export function helpMenuView(off: boolean, actions: HelpActions): TemplateResult {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${actions.close}>Close ×</button>
    <h2 class="tut-menu-title">Help and tips</h2>
    <p class="tad-sub">New to PodMates? The tour charts a precon and walks through the results.</p>
    <div class="tut-menu">
      <button type="button" id="tutTourBtn" @click=${actions.tour}>Take the tour</button>
      <button type="button" class="ghost" id="tutToggleBtn" @click=${actions.toggle}>
        ${off ? "Turn tips on" : "Turn tips off"}
      </button>
      <button type="button" class="ghost" id="tutResetBtn" @click=${actions.reset}>
        Show all tips again
      </button>
    </div>`;
}
