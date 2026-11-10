// Card Type Frequency & Curve panel: the type breakdown table, the nonland mana-curve bars
// and the two headline figures above them.

import { html, nothing, styleMap } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { stat } from "../view.ts";

const CURVE_BUCKETS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

export interface TypeTableInput {
  typeFrequency: Record<string, number>;
  totalCards: number;
  avgCmc: number;
  manaCurve?: Record<string, number> | null;
}

function curveTemplate(manaCurve: Record<string, number>): TemplateResult {
  const maxBucket = Math.max(...Object.values(manaCurve), 1);
  return html`<div class="mana-curve dc-buckets">
    <div class="dc-buckets-title">Mana Curve (nonlands)</div>
    <div class="dc-buckets-row">
      ${CURVE_BUCKETS.map((b) => {
        const count = manaCurve[b] || 0;
        const h = Math.max(Math.round((count / maxBucket) * 58), count > 0 ? 4 : 0);
        return html`<div class="dc-bucket">
          <div class="dc-bucket-count">${count || ""}</div>
          <div class="dc-bucket-bar" style=${styleMap({ height: `${h}px` })}></div>
          <div class="dc-bucket-label">${b}</div>
        </div>`;
      })}
    </div>
  </div>`;
}

export function typeTableTemplate(input: TypeTableInput): TemplateResult {
  const { typeFrequency, totalCards, avgCmc, manaCurve } = input;
  const entries = Object.entries(typeFrequency).sort((a, b) => b[1] - a[1]);
  return html`<div class="stats-strip dc-stats-strip">
      ${stat(totalCards, "Total Cards")}${stat(avgCmc.toFixed(2), "Avg. CMC (nonland)")}
    </div>
    ${manaCurve ? curveTemplate(manaCurve) : nothing}
    <table class="type-table">
      <thead>
        <tr>
          <th>Type</th>
          <th class="num-col">Count</th>
          <th class="num-col">% of Deck</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(
          ([type, count]) =>
            html`<tr class="type-row-clickable dc-type-row" data-type-name=${type}>
              <td>${type}</td>
              <td class="num-col">${count}</td>
              <td class="num-col">${((count / totalCards) * 100).toFixed(1)}%</td>
            </tr>`,
        )}
      </tbody>
    </table>`;
}
