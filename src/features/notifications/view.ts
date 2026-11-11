// Escaped inbox and bell templates; the controller owns actions and subscriptions.
import { html, type TemplateResult } from "../../ui/html";
import { ago, TYPES, visible, type InboxState, type NotificationItem } from "./state";

export interface InboxActions {
  openItem(item: NotificationItem): void;
  preference(group: "types" | "muted", key: string, checked: boolean): void;
}

export function bellView(open: () => void): TemplateResult {
  return html`<button
    id="pmBellBtn"
    type="button"
    class="ghost pm-notif-bell"
    aria-label="Notifications"
    @click=${open}
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg
    ><span id="pmBellBadge" class="pm-notif-badge"></span>
  </button>`;
}

export function modalView(close: () => void): TemplateResult {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="pm-notif-title">Notifications</h2>
    <div id="pmNotifBody"></div>`;
}

export function bodyView(
  state: InboxState,
  openSince: number,
  actions: InboxActions,
  now: number,
): TemplateResult {
  const items = visible(state, now);
  return html` <div id="pmNotifList">
      ${
        items.length
          ? items.map((item, i) => {
              const type = TYPES[item.type],
                fresh = item.createdAt > openSince;
              const pod = state.pods.find((p) => p.id === item.podId);
              return html`<button
                type="button"
                data-n=${i}
                class=${`pm-notif-row pm-notif-${item.type}${fresh ? " pm-notif-fresh" : ""}`}
                @click=${() => actions.openItem(item)}
              >
                <span class="pm-notif-dot"></span>
                <span class="pm-notif-content"
                  ><span class="pm-notif-text"
                    >${type.text(item.byName || "Someone", item.subject)}</span
                  ><span class="pm-notif-meta"
                    ><span class="pm-notif-tag">${type.tag}</span
                    >${` · ${pod?.name || "Pod"} · ${ago(item.createdAt, now)}`}</span
                  ></span
                >
              </button>`;
            })
          : html`<p class="pm-notif-empty">
              Nothing new yet. When someone in your pods charts a deck or sets up a gathering, it
              will show up here.
            </p>`
      }
    </div>
    <details class="pm-notif-settings">
      <summary>What to tell me about</summary>
      <div class="pm-notif-options">
        ${Object.entries(TYPES).map(([key, type]) => html`<label class="pm-notif-option"><input type="checkbox" data-type=${key} .checked=${state.prefs.types[key] !== false} @change=${(event: Event) => actions.preference("types", key, (event.currentTarget as HTMLInputElement).checked)} /> ${type.label}</label>`)}
        ${state.pods.map((pod) => html`<label class="pm-notif-option"><input type="checkbox" data-mute=${pod.id} .checked=${Boolean(state.prefs.muted[pod.id])} @change=${(event: Event) => actions.preference("muted", pod.id, (event.currentTarget as HTMLInputElement).checked)} /> ${`Mute ${pod.name || "Pod"}`}</label>`)}
        <div class="pm-notif-hint">
          These settings are saved on this device. You never get notified about your own actions.
        </div>
      </div>
    </details>`;
}
