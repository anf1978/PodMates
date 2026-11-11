import { ordinal } from "./format.ts";

// The five-axis radar ("radial") chart drawn under Deck Chart. Pure: it returns the
// SVG markup as a string, so the caller decides where it goes.

export interface RadarAxis {
  key: string;
  /** Trusted app text (axis names), inserted without escaping. */
  label: string;
}

export interface RadarChartInput {
  axes: readonly RadarAxis[];
  /** Score per axis key, 0–10. */
  scores: Readonly<Record<string, number>>;
  /** Reference-set percentile for an axis score, or null when there is none. */
  percentile: (axisKey: string, score: number) => number | null;
  /** Width in CSS pixels the chart will be shown at. */
  boxWidth: number;
  /** Current text-size multiplier (1 = default). */
  textZoom?: number;
}

const WIDTH = 680;
const HEIGHT = 560;
const LEVELS = 5;
const LABEL_FRAC = 1.2;

/**
 * Builds the radar SVG. The viewBox has generous margins, so every label keeps
 * 55px+ of clearance at any width; the SVG scales as a whole. Below 480px the
 * text is sized from the real box width instead, so it stays readable on phones.
 */
export function radarChartSvg({
  axes,
  scores,
  percentile,
  boxWidth,
  textZoom = 1,
}: RadarChartInput): string {
  const width = WIDTH,
    height = HEIGHT;
  const cx = width / 2,
    cy = height / 2;
  const narrow = boxWidth < 480;
  const uu = width / Math.max(boxWidth, 200); // viewBox units per screen pixel
  const radius = narrow ? 118 : 150;
  const n = axes.length;
  const longest = Math.max(...axes.map((a) => String(a.label).length + 2));
  const roomUnits = cx - radius * LABEL_FRAC * 0.95 - 6; // room beside the widest side labels
  const fsName = narrow ? Math.min(13.5 * uu, roomUnits / (longest * 0.6)) : 16;
  const fsVal = narrow ? Math.min(19 * uu, fsName * 1.5) : 31.5;
  const fsPct = narrow ? Math.min(12 * uu, fsName * 0.9) : 12.5;
  // With larger text on a phone the plain score list below the chart carries the numbers.
  const hideVals = narrow && textZoom > 1;
  const fontStyle = (size: number) => (narrow ? ` style="font-size:${size.toFixed(1)}px"` : "");

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i: number, frac: number): [number, number] => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * radius * frac, cy + Math.sin(a) * radius * frac];
  };

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:560px;">`;

  for (let l = 1; l <= LEVELS; l++) {
    const frac = l / LEVELS;
    const pts: string[] = [];
    for (let i = 0; i < n; i++) pts.push(pointAt(i, frac).join(","));
    svg += `<polygon class="grid-ring" points="${pts.join(" ")}"/>`;
  }

  for (let i = 0; i < n; i++) {
    const axis = axes[i]!;
    const score = scores[axis.key]!;
    const [x, y] = pointAt(i, 1);
    svg += `<line class="grid-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
    const [lx, ly] = pointAt(i, LABEL_FRAC);
    const cosA = Math.cos(angleFor(i));
    const sinA = Math.sin(angleFor(i));
    const anchor = Math.abs(cosA) < 0.2 ? "middle" : cosA > 0 ? "start" : "end";
    // Value/percentile lines stack away from the centre, so upper-half labels
    // (Speed, straight up) don't drag their numbers back into the grid.
    const stackDir = sinA >= 0 ? 1 : -1;
    svg += `<text class="axis-label axis-label-clickable" data-explain="${axis.key}" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle"${fontStyle(fsName)}>${axis.label} ⓘ</text>`;
    const valY = narrow
      ? stackDir > 0
        ? ly + fsName * 0.65 + fsVal * 0.85
        : ly - fsName * 0.75
      : ly + stackDir * 30;
    const pctY = narrow
      ? stackDir > 0
        ? valY + fsPct * 1.3
        : valY - fsVal * 0.9 - fsPct * 0.1
      : ly + stackDir * 52;
    if (!hideVals)
      svg += `<text class="axis-value" x="${lx}" y="${valY}" text-anchor="${anchor}"${fontStyle(fsVal)}>${score.toFixed(1)}</text>`;
    const pct = percentile(axis.key, score);
    if (pct !== null && !hideVals) {
      svg += `<text class="axis-percentile" x="${lx}" y="${pctY}" text-anchor="${anchor}"${fontStyle(fsPct)}>${ordinal(pct)} pct.</text>`;
    }
  }

  const shapePts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const frac = Math.max(scores[axes[i]!.key]! / 10, 0.04);
    shapePts.push(pointAt(i, frac));
  }
  svg += `<polygon class="deck-shape" points="${shapePts.map((p) => p.join(",")).join(" ")}"/>`;
  for (const [x, y] of shapePts) {
    svg += `<circle class="deck-point" cx="${x}" cy="${y}" r="4"/>`;
  }

  return svg + "</svg>";
}
