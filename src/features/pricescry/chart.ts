// The card page's price chart (SVG) and its touch/hover readout.
import { html, nothing, render, styleMap, svg, type TemplateResult } from "../../ui/html";
import { fmtYen, isoFromDay, priceMarket, valueAt, yen } from "../../services/price-data";
import type { ChartModel } from "./state";

const PAD = { l: 50, r: 10, t: 10, b: 24 };
const money = (v: number, haveFx: boolean): string => (haveFx ? fmtYen(v) : "$" + v.toFixed(2));

export function chartView(
  model: ChartModel,
  width: number,
  height: number,
): TemplateResult | typeof nothing {
  const { lines, startDay, endDay, haveFx } = model;
  const vals = lines.flatMap((l) => l.pts.map((p) => p.v).filter((v): v is number => v != null));
  if (!vals.length) return nothing;
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  if (hi === lo) {
    hi = lo * 1.05 + 1;
    lo = Math.max(0, lo * 0.95 - 1);
  }
  const padY = (hi - lo) * 0.08;
  lo = Math.max(0, lo - padY);
  hi = hi + padY;
  const X = (d: number): number =>
    PAD.l + ((d - startDay) / Math.max(1, endDay - startDay)) * (width - PAD.l - PAD.r);
  const Y = (v: number): number => PAD.t + (1 - (v - lo) / (hi - lo)) * (height - PAD.t - PAD.b);
  const grid = [0, 1, 2, 3].map((i) => {
    const y = Y(lo + ((hi - lo) * i) / 3).toFixed(1);
    return svg`<line x1=${PAD.l} x2=${width - PAD.r} y1=${y} y2=${y} stroke="var(--line)" stroke-width="1"></line><text x=${PAD.l - 6} y=${(Number(y) + 3).toFixed(1)} text-anchor="end" font-size="10" fill="var(--text-dim)">${money(lo + ((hi - lo) * i) / 3, haveFx)}</text>`;
  });
  const dates = [0, 1, 2].map((i) => {
    const d = startDay + Math.round(((endDay - startDay) * i) / 2);
    const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
    return svg`<text x=${X(d).toFixed(1)} y=${height - 6} text-anchor=${anchor} font-size="10" fill="var(--text-dim)">${isoFromDay(d)}</text>`;
  });
  const paths = lines.map((l) => {
    const d = l.pts
      .filter((p) => p.v != null)
      .map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)},${Y(p.v!).toFixed(1)}`)
      .join("");
    return svg`<path d=${d} fill="none" stroke=${l.color} stroke-width="2" stroke-dasharray=${l.dashed ? "5 4" : nothing}></path>`;
  });
  // The cursor's display is toggled by the pointer handler.
  return html`<svg
    id="psChartSvg"
    class="ps-chart"
    viewBox=${`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    role="img"
    aria-label="Price history chart"
  >
    ${grid}${dates}${paths}
    <line
      id="psCursor"
      x1="0"
      x2="0"
      y1=${PAD.t}
      y2=${height - PAD.b}
      stroke="var(--text-soft)"
      stroke-width="1"
      style="display:none"
    ></line>
  </svg>`;
}

function readout(model: ChartModel, day: number): TemplateResult {
  const { lines, haveFx } = model;
  const parts = lines.map((l, i) => {
    const raw = valueAt(l.series, day);
    const v =
      raw == null
        ? null
        : l.native === "JPY"
          ? raw
          : haveFx
            ? yen(raw, l.pair!, priceMarket.fx, day)
            : raw / 100;
    const text = `${l.label.split(" (")[0]} ${v == null ? "—" : money(v, haveFx)}`;
    return html`${i ? " · " : nothing}<span style=${styleMap({ color: l.color })}>${text}</span>`;
  });
  return html`<strong>${isoFromDay(day)}</strong> · ${parts}`;
}

/** Wires the pointer readout; the readout starts with its hint text. */
export function attachChart(root: HTMLElement, model: ChartModel, width: number): void {
  const svgEl = root.querySelector<SVGSVGElement>("#psChartSvg"),
    out = root.querySelector<HTMLElement>("#psReadout"),
    cur = root.querySelector<SVGLineElement>("#psCursor");
  if (!out) return;
  render("Touch the chart to read a day's prices.", out);
  if (!svgEl || !cur) return;
  const { startDay, endDay } = model;
  const move = (clientX: number): void => {
    const r = svgEl.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * width;
    const frac = Math.min(1, Math.max(0, (x - PAD.l) / (width - PAD.l - PAD.r)));
    const day = startDay + Math.round(frac * (endDay - startDay));
    cur.setAttribute("x1", (PAD.l + frac * (width - PAD.l - PAD.r)).toFixed(1));
    cur.setAttribute("x2", cur.getAttribute("x1")!);
    cur.style.display = "";
    render(readout(model, day), out);
  };
  svgEl.addEventListener("pointermove", (e) => move(e.clientX));
  svgEl.addEventListener("pointerdown", (e) => move(e.clientX));
}
