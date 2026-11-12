// Display settings tray (inside My Profile): text size buttons and the colour theme tiles. Each
// tile previews its own theme (its own background, text and accent colours), shows the mana
// symbols of its colours and names the colour combination.

import { html, nothing, styleMap, type TemplateResult } from "../../ui/html";
import { manaSymbol } from "../../ui/mana-symbol";
import { TEXT_SIZES } from "./apply";
import { buildTheme, COLOR_NAMES, findTheme, THEMES, type Theme, type ThemeKind } from "./palette";

/** Classic has no computed values; its tile previews the stylesheet's own colours. */
const CLASSIC_PREVIEW: Record<string, string> = {
  "--bg-panel-raised": "#241C14",
  "--bg-main": "#0F0C0A",
  "--text-primary": "#F0E6D2",
  "--text-soft": "#B8A88A",
  "--gold": "#E8C14A",
  "--cyan": "#4EC8E0",
  "--wine": "#6B2A32",
  "--line": "rgba(232,193,74,0.35)",
};

const GROUPS: [ThemeKind, string][] = [
  ["Classic", "Classic"],
  ["Guild", "Guilds — two colours"],
  ["Triome", "Triomes — three colours"],
  ["Four colours", "Four colours"],
  ["Five colours", "Five colours"],
];

export interface DisplayActions {
  chooseTheme(id: string): void;
  chooseSize(id: string): void;
}

/** The colour-name subtitle under a tile's name. */
export function themeSubtitle(t: Theme): string {
  const full = t.colors
    ? t.colors
        .split("")
        .map((c) => COLOR_NAMES[c])
        .join(" / ")
    : "";
  return t.sub || (t.land ? `${full} · ${t.land}` : full);
}

function tile(t: Theme, selected: boolean, actions: DisplayActions): TemplateResult {
  const v = buildTheme(t) || CLASSIC_PREVIEW;
  const swatch = (c: string | undefined) =>
    html`<span class="pm-theme-swatch" style=${styleMap({ background: c })}></span>`;
  const keydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    actions.chooseTheme(t.id);
  };
  // Theme preview colours are computed per tile, so they are the only inline values.
  const colors = styleMap({
    "--pm-tile-bg": v["--bg-panel-raised"],
    "--pm-tile-accent": v["--gold"],
    "--pm-tile-cyan": v["--cyan"],
    "--pm-tile-line": v["--line"],
    "--pm-tile-text": v["--text-primary"],
    "--pm-tile-soft": v["--text-soft"],
  });
  return html`<div
    class="pm-theme-tile"
    role="radio"
    tabindex="0"
    aria-checked=${selected ? "true" : "false"}
    data-theme-id=${t.id}
    style=${colors}
    @click=${() => actions.chooseTheme(t.id)}
    @keydown=${keydown}
  >
    <div class="pm-theme-tile-head">
      ${
        t.colors
          ? t.colors.split("").map((c) => manaSymbol(c, 19))
          : html`<span class="pm-theme-classic-pip"></span>`
      }<span class="pm-theme-check">${selected ? "✓" : ""}</span>
    </div>
    <div class="pm-theme-name">${t.name}</div>
    <div class="pm-theme-sub">${themeSubtitle(t)}</div>
    <div class="pm-theme-swatches">
      ${swatch(v["--bg-main"])}${swatch(v["--gold"])}${swatch(v["--cyan"])}${swatch(v["--wine"])}
    </div>
  </div>`;
}

function sizeRow(curSize: string, actions: DisplayActions): TemplateResult {
  return html`<div class="pm-display-label pm-display-label-first">Text size</div>
    <div role="radiogroup" aria-label="Text size" class="pm-size-grid">
      ${TEXT_SIZES.map(
        (z) =>
          html`<button
            type="button"
            role="radio"
            aria-checked=${z.id === curSize ? "true" : "false"}
            class="pm-size-btn"
            data-size=${z.id}
            @click=${() => actions.chooseSize(z.id)}
          >
            <span
              class="pm-size-sample"
              style=${styleMap({ "font-size": `${Math.round((13 * z.pct) / 100)}px` })}
              >Aa</span
            ><span class="pm-size-label">${z.label}</span>
          </button>`,
      )}
    </div>
    <p class="pm-display-note pm-display-note-size">
      Makes everything bigger, like zooming in. Saved on this device only.
    </p>`;
}

export function displaySettingsView(
  curTheme: string,
  curSize: string,
  actions: DisplayActions,
): TemplateResult {
  const curT = findTheme(curTheme);
  return html`${sizeRow(curSize, actions)}
    <p class="pm-display-note">
      Pick a colour scheme for the whole app. It is saved on this device only. Now:
      <b class="pm-display-current">${curT ? curT.name : "Classic PodMates"}</b>
    </p>
    ${GROUPS.map(([kind, label]) => {
      const list = THEMES.filter((t) => t.kind === kind);
      if (!list.length) return nothing;
      return html`<div class="pm-display-label">${label}</div>
        <div role="radiogroup" aria-label=${label} class="pm-theme-grid">
          ${list.map((t) => tile(t, t.id === curTheme, actions))}
        </div>`;
    })}`;
}
