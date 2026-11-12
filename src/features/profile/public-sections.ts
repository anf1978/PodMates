import { html } from "../../ui/html.ts";
import { styleMap } from "../../ui/html.ts";
import { manaSymbol, MANA_COLOR_STYLE } from "../../ui/mana-symbol.ts";
import { PROFILE_TYPE_COLORS, renderProfilePieChartSVG } from "./public-charts.ts";
import type { ColorBreakdown, TypeBreakdown } from "./public-types.ts";

export function renderProfileType(trait: string | null, label: "Player Type" | "Pod Type") {
  return trait
    ? html`<div class="panel pp-type-panel">
        <div class="pp-label">${label}</div>
        <div class="pp-type-name">${trait}</div>
      </div>`
    : null;
}

export function renderProfileBreakdowns(
  colors: readonly ColorBreakdown[],
  types: readonly TypeBreakdown[],
) {
  const colorSlices = colors.map((color) => ({
    pct: color.pct,
    color: MANA_COLOR_STYLE[color.color]?.bg || "#888",
  }));
  const typeSlices = types.map((type) => ({
    pct: type.pct,
    color: PROFILE_TYPE_COLORS[type.type] || "#888",
  }));
  return html`<div class="pp-breakdowns">
    <div class="pp-breakdown">
      <div class="pp-label pp-chart-label">Colors</div>
      ${renderProfilePieChartSVG(colorSlices, 140)}
      <div class="pp-chart-rows">
        ${colors.map(
          (color) =>
            html`<div class="pp-breakdown-row">
              ${manaSymbol(color.color, 18)}
              <span
                class="pp-slice-dot"
                style=${styleMap({ background: MANA_COLOR_STYLE[color.color]?.bg || "#888" })}
              ></span>
              <span class="pp-percentage">${`${color.pct.toFixed(0)}%`}</span>
            </div>`,
        )}
      </div>
    </div>
    <div class="pp-breakdown">
      <div class="pp-label pp-chart-label">Card Types</div>
      ${renderProfilePieChartSVG(typeSlices, 140)}
      <div class="pp-chart-rows">
        ${types.map(
          (type) =>
            html`<div class="pp-breakdown-row">
              <span
                class="pp-slice-dot"
                style=${styleMap({ background: PROFILE_TYPE_COLORS[type.type] || "#888" })}
              ></span>
              <span class="pp-card-type">${type.type}</span>
              <span class="pp-type-percentage">${`${type.pct.toFixed(0)}%`}</span>
            </div>`,
        )}
      </div>
    </div>
  </div>`;
}
