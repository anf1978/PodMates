// Mana Curve panel: expected mana available per turn, drawn as a small area chart.
// The curve itself comes from the engine; this file only draws it.
//
// The SVG fragments below are `prettier-ignore`d on purpose: whitespace inside an SVG
// <text> element is rendered, so reflowing these lines would shift the axis labels.

import { html, svg } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import type { ManaCurvePoint } from "../../../engine/types.ts";
import { howBuilt } from "../view.ts";

const HOW_BUILT =
  "This isn't a simulation of any specific game — it's a hypergeometric expectation, the same math used to answer \"how many lands should I run.\" It models an idealized deck playing land-and-ramp optimally every turn, with no mulligans and no opponent interaction, so it's a fair comparative number between two decks rather than a prediction of any single game. Turn 4 specifically feeds a bonus into the Speed score: a deck genuinely ahead of the typical curve by then gets real credit here, on top of (not instead of) the existing ramp and fast-mana counts — this is the \"can this deck actually spend the mana it has\" half of the picture that a flat card count can't see.";

const W = 380;
const H = 220;
const PAD_L = 34;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function manaCurveTemplate(curve: ManaCurvePoint[]): TemplateResult {
  const maxMana = Math.max(10, ...curve.map((p) => p.mana));
  const toX = (turn: number): number => PAD_L + (turn / 10) * PLOT_W;
  const toY = (mana: number): number => PAD_T + PLOT_H - Math.min(mana / maxMana, 1) * PLOT_H;

  // Horizontal gridlines at nice round mana values
  const gridStep = maxMana > 20 ? 5 : 2;
  const gridlines = [];
  for (let m = 0; m <= maxMana; m += gridStep) {
    // prettier-ignore
    gridlines.push(svg`<line x1=${PAD_L} y1=${toY(m)} x2=${PAD_L + PLOT_W} y2=${toY(m)} stroke="var(--line)" stroke-dasharray="2,3"/><text x=${PAD_L - 6} y=${toY(m) + 3} text-anchor="end" font-size="9" fill="var(--text-soft)">${m}</text>`);
  }

  // prettier-ignore
  const axis = svg`<line x1=${PAD_L} y1=${PAD_T + PLOT_H} x2=${PAD_L + PLOT_W} y2=${PAD_T + PLOT_H} stroke="var(--line-strong)"/>`;
  // prettier-ignore
  const turnLabels = curve.map((p) => svg`<text x=${toX(p.turn)} y=${H - 8} text-anchor="middle" font-size="9" fill="var(--text-soft)">${p.turn}</text>`);

  const linePoints = curve.map((p) => `${toX(p.turn)},${toY(p.mana)}`).join(" ");
  const areaPoints = `${toX(0)},${toY(0)} ${linePoints} ${toX(10)},${toY(0)}`;
  // prettier-ignore
  const plot = svg`<polygon points=${areaPoints} fill="var(--gold)" opacity="0.12"/><polyline points=${linePoints} fill="none" stroke="var(--gold)" stroke-width="2"/>`;
  // prettier-ignore
  const points = curve.map((p) => svg`<circle cx=${toX(p.turn)} cy=${toY(p.mana)} r="2.5" fill="var(--gold-bright)"/>`);

  const t4 = curve[4] ? curve[4].mana : 0;

  return html`<svg viewBox=${`0 0 ${W} ${H}`} class="dc-curve-svg">
      ${gridlines}${axis}${turnLabels}${plot}${points}
    </svg>
    <p class="dc-curve-caption">
      Expected mana by turn 4: <strong class="dc-strong-gold">${t4}</strong>
    </p>
    ${howBuilt("How did we build this?", HOW_BUILT)}`;
}
