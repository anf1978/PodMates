// SVG templates preserve legacy radar geometry, labels and score interpolation.
import { html, svg, nothing, type TemplateResult } from "../../ui/html";
import { AXES, analyzePaceInteractionRisks, type ComparisonDeck } from "./state";

export function paceView(decks: ComparisonDeck[]): TemplateResult {
  if (decks.length < 2) return html`${nothing}`;
  const W = 360,
    H = 300,
    left = 46,
    right = 20,
    top = 16,
    bottom = 42;
  const width = W - left - right,
    height = H - top - bottom;
  const x = (v: number): number => left + ((v - 1) / 9) * width;
  const y = (v: number): number => top + height - ((v - 1) / 9) * height;
  const risks = analyzePaceInteractionRisks(decks);
  return html`<svg viewBox="0 0 360 300" class="comparison-pace">
      <line
        x1=${x(5.5)}
        y1=${top}
        x2=${x(5.5)}
        y2=${top + height}
        stroke="var(--line)"
        stroke-dasharray="3,3"
      />
      <line
        x1=${left}
        y1=${y(5.5)}
        x2=${left + width}
        y2=${y(5.5)}
        stroke="var(--line)"
        stroke-dasharray="3,3"
      />
      <line
        x1=${left}
        y1=${top + height}
        x2=${left + width}
        y2=${top + height}
        stroke="var(--line-strong)"
      />
      <line x1=${left} y1=${top} x2=${left} y2=${top + height} stroke="var(--line-strong)" />
      <text
        x=${left + width / 2}
        y=${H - 8}
        text-anchor="middle"
        font-size="11"
        fill="var(--text-soft)"
      >
        Pace (gradual → sudden)
      </text>
      <text
        x="12"
        y=${top + height / 2}
        text-anchor="middle"
        font-size="11"
        fill="var(--text-soft)"
        transform=${`rotate(-90 12 ${top + height / 2})`}
      >
        Interaction (quiet → heavy)
      </text>
      <text
        x=${left + width - 4}
        y=${top + height - 6}
        text-anchor="end"
        font-size="9.5"
        fill="var(--text-soft)"
        opacity="0.7"
      >
        sudden-death risk
      </text>
      <text
        x=${left + 4}
        y=${top + 12}
        text-anchor="start"
        font-size="9.5"
        fill="var(--text-soft)"
        opacity="0.7"
      >
        grindy / controlling
      </text>
      ${decks.map((d) => {
        const label = d.commanderLabel || d.name,
          px = x(d.pace),
          py = y(d.scores.disruption);
        return svg`<circle cx=${px} cy=${py} r="7" fill=${d.color} stroke="var(--bg-main)" stroke-width="1.5"/>
        <text x=${px} y=${py - 11} text-anchor="middle" font-size="10.5" fill="var(--text-primary)">${label.length > 14 ? label.slice(0, 13) + "…" : label}</text>`;
      })}
    </svg>
    ${
      risks.length
        ? html`<div class="comparison-risks">
            ${risks.map((risk) => html`<div class="comparison-risk">${risk}</div>`)}
          </div>`
        : html`<div class="comparison-no-risks">
            No major pace/interaction mismatches detected — this pod's decks share a broadly similar
            rhythm.
          </div>`
    }
    <details class="comparison-explanation">
      <summary>How did we build this?</summary>
      <div>
        Spark parity doesn't guarantee a close game — two decks can share a Spark score while having
        a completely different relationship to time. Pace blends Speed with how SUDDENLY a deck's
        win condition resolves once it's online (an infinite combo can end the game in one turn with
        no warning; a mill or slow-drain plan telegraphs over many turns) — it's a different
        question from Speed alone, which only measures how fast a deck gets its engine running.
        Interaction reuses the Disruption score directly. The callouts above flag three specific
        shapes of mismatch: one deck ending the game suddenly while others are still developing, two
        or more decks both running heavy interaction (a long, low-agency night for whoever's caught
        between them), and a specific low-interaction deck sharing a table with another deck's heavy
        disruption with no way to respond.
      </div>
    </details>`;
}

export function miniRadar(d: ComparisonDeck): TemplateResult {
  const cx = 140,
    cy = 103,
    radius = 70,
    n = AXES.length;
  const angle = (i: number): number => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, frac: number): [number, number] => [
    cx + Math.cos(angle(i)) * radius * frac,
    cy + Math.sin(angle(i)) * radius * frac,
  ];
  const shape = AXES.map((ax, i) => point(i, Math.max(d.scores[ax.key] / 10, 0.04)));
  return html`<svg
    viewBox="0 0 280 216"
    width="100%"
    class="comparison-mini-radar"
    role="img"
    aria-label=${`${d.name}: ${AXES.map((a) => a.mini + " " + d.scores[a.key].toFixed(1)).join(", ")}`}
  >
    ${[1, 2, 3, 4, 5].map((level) => svg`<polygon fill="none" stroke="rgba(240,233,220,0.12)" stroke-width="1" points=${AXES.map((_, i) => point(i, level / 5).join(",")).join(" ")}/>`)}
    ${AXES.map((_, i) => {
      const [x, y] = point(i, 1);
      return svg`<line stroke="rgba(240,233,220,0.12)" stroke-width="1" x1=${cx} y1=${cy} x2=${x} y2=${y}/>`;
    })}
    <polygon
      fill=${`${d.color}44`}
      stroke=${d.color}
      stroke-width="2"
      points=${shape.map((p) => p.join(",")).join(" ")}
    />
    ${shape.map(([x, y]) => svg`<circle fill=${d.color} cx=${x} cy=${y} r="3"/>`)}
    ${AXES.map((axis, i) => {
      const [vx, vy] = point(i, 1),
        cos = Math.cos(angle(i)),
        sin = Math.sin(angle(i));
      let x = vx,
        anchor = "middle",
        valueY: number,
        labelY: number;
      if (sin < -0.9) {
        valueY = vy - 8;
        labelY = vy - 21;
      } else if (sin > 0.5) {
        valueY = vy + 16;
        labelY = vy + 29;
      } else {
        anchor = cos > 0 ? "start" : "end";
        x = vx + (cos > 0 ? 10 : -10);
        valueY = vy;
        labelY = vy + 13;
      }
      return svg`<text fill="var(--text-primary)" font-size="13" font-weight="700" text-anchor=${anchor} x=${x.toFixed(1)} y=${valueY.toFixed(1)}>${d.scores[axis.key].toFixed(1)}</text>
        <text fill="var(--text-soft)" font-size="10.5" text-anchor=${anchor} x=${x.toFixed(1)} y=${labelY.toFixed(1)}>${axis.mini}</text>`;
    })}
  </svg>`;
}
