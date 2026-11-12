import { html, styleMap, svg } from "../../ui/html.ts";
import type {
  BracketDistribution,
  ColorBreakdown,
  ProfileOwner,
  PublicProfileAnalysis,
} from "./public-types.ts";

export const PROFILE_TYPE_COLORS: Readonly<Record<string, string>> = {
  Creature: "#7BAE7F",
  Land: "#B08D57",
  Artifact: "#9AA5B1",
  Enchantment: "#B48EAD",
  Instant: "#6FA8DC",
  Sorcery: "#C0625A",
  Planeswalker: "#D4AF37",
  Battle: "#E0977A",
  Kindred: "#5FBFBF",
  Unclassified: "#888888",
  Unknown: "#888888",
};

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export function renderProfilePieChartSVG(slices: readonly ColorBreakdown[], size = 150) {
  size = size || 150;
  const cx = size / 2,
    cy = size / 2,
    radius = size / 2 - 2;
  let angle = 0;
  const paths = slices.flatMap((slice) => {
    const sweep = (slice.pct / 100) * 360;
    if (sweep <= 0) return [];
    const start = angle,
      end = Math.min(angle + sweep, angle + 359.99);
    const large = end - start > 180 ? 1 : 0;
    const p1 = polarPoint(cx, cy, radius, start);
    const p2 = polarPoint(cx, cy, radius, end);
    angle += sweep;
    const path = `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
    return [svg`<path d=${path} fill=${slice.color} stroke="var(--bg-main)" stroke-width="1.5"/>`];
  });
  return svg`<svg viewBox=${`0 0 ${size} ${size}`} class="pp-pie"
    style=${styleMap({ width: `${size}px`, height: `${size}px` })}>${paths}</svg>`;
}

export function renderBracketHistogramSVG(distribution: readonly BracketDistribution[]) {
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  const barH = 26,
    gap = 12,
    labelW = 140,
    chartW = 180;
  const height = distribution.length * (barH + gap);
  return svg`<svg viewBox=${`0 0 ${labelW + chartW + 30} ${height}`} class="pp-histogram">
    ${distribution.map((entry, i) => {
      const y = i * (barH + gap);
      const width = Math.max((entry.count / maxCount) * chartW, 3);
      return svg`
        <text x=${labelW - 8} y=${y + barH / 2 + 4} text-anchor="end" font-size="11.5" fill="var(--text-primary)">${entry.label}</text>
        <rect x=${labelW} y=${y} width=${width} height=${barH} fill="var(--gold)" rx="2"/>
        <text x=${labelW + width + 8} y=${y + barH / 2 + 4} font-size="12" fill="var(--text-soft)">${entry.count}</text>
      `;
    })}
  </svg>`;
}

export function renderPlayerColorLegend(
  owners: readonly ProfileOwner[],
  colorMap: Record<string, string>,
) {
  return owners.map(
    (owner) =>
      html`<span class="pp-legend-item">
        <span class="pp-owner-dot" style=${styleMap({ background: colorMap[owner.key] })}></span>
        <span class="pp-legend-name">${owner.name}</span>
      </span>`,
  );
}

export function renderPodPaceScatterSVG(
  decks: readonly PublicProfileAnalysis[],
  colorMap: Record<string, string>,
  onChart: (deck: PublicProfileAnalysis) => void,
) {
  const width = 360,
    height = 300,
    padL = 46,
    padR = 20,
    padT = 16,
    padB = 42;
  const plotW = width - padL - padR,
    plotH = height - padT - padB;
  const toX = (value: number) => padL + ((value - 1) / 9) * plotW;
  const toY = (value: number) => padT + plotH - ((value - 1) / 9) * plotH;
  const showLabels = decks.length <= 10;
  return svg`<svg viewBox=${`0 0 ${width} ${height}`} class="pp-scatter">
    <line x1=${toX(5.5)} y1=${padT} x2=${toX(5.5)} y2=${padT + plotH} stroke="var(--line)" stroke-dasharray="3,3"/>
    <line x1=${padL} y1=${toY(5.5)} x2=${padL + plotW} y2=${toY(5.5)} stroke="var(--line)" stroke-dasharray="3,3"/>
    <line x1=${padL} y1=${padT + plotH} x2=${padL + plotW} y2=${padT + plotH} stroke="var(--line-strong)"/>
    <line x1=${padL} y1=${padT} x2=${padL} y2=${padT + plotH} stroke="var(--line-strong)"/>
    <text x=${padL + plotW / 2} y=${height - 8} text-anchor="middle" font-size="11" fill="var(--text-soft)">Pace (gradual → sudden)</text>
    <text x="12" y=${padT + plotH / 2} text-anchor="middle" font-size="11" fill="var(--text-soft)" transform=${`rotate(-90 12 ${padT + plotH / 2})`}>Interaction (quiet → heavy)</text>
    ${decks.map((deck, i) => {
      const x = toX(deck.pace),
        y = toY(deck.scores.disruption);
      const key = deck._ownerUid || deck._ownerName || "unknown";
      const color = colorMap[key] || "var(--gold)";
      const label = deck.commanderLabel || deck.name;
      const shortLabel = label.length > 14 ? label.slice(0, 13) + "…" : label;
      return svg`
        <circle data-deck-idx=${i} cx=${x} cy=${y} r="6.5" fill=${color} fill-opacity="0.8"
          stroke="var(--bg-main)" stroke-width="1" class="pp-deck-dot" @click=${() => onChart(deck)}/>
        ${showLabels ? svg`<text x=${x} y=${y - 10} text-anchor="middle" font-size="9.5" fill="var(--text-primary)">${shortLabel}</text>` : null}
      `;
    })}
  </svg>`;
}
