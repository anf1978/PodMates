// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { radarChartSvg, type RadarChartInput } from "./radar-chart.ts";

const AXES = [
  { key: "speed", label: "Speed" },
  { key: "consistency", label: "Consistency" },
  { key: "versatility", label: "Versatility" },
  { key: "disruption", label: "Disruption" },
  { key: "powerLevel", label: "Power Level" },
];
const SCORES = { speed: 6.2, consistency: 7.45, versatility: 5, disruption: 0, powerLevel: 9.9 };

function chart(overrides: Partial<RadarChartInput> = {}) {
  const markup = radarChartSvg({
    axes: AXES,
    scores: SCORES,
    percentile: (key) => (key === "disruption" ? null : 42),
    boxWidth: 560,
    ...overrides,
  });
  return new DOMParser().parseFromString(markup, "text/html").querySelector("svg")!;
}

const texts = (svg: Element, cls: string) =>
  Array.from(svg.querySelectorAll(`text.${cls}`), (t) => t.textContent);

describe("radarChartSvg", () => {
  it("draws grid, clickable axis labels, values and percentiles", () => {
    const svg = chart();
    expect(svg.getAttribute("viewBox")).toBe("0 0 680 560");
    expect(svg.querySelectorAll("polygon.grid-ring")).toHaveLength(5);
    expect(svg.querySelectorAll("line.grid-spoke")).toHaveLength(5);
    expect(texts(svg, "axis-label")).toEqual(AXES.map((a) => `${a.label} ⓘ`));
    expect(
      Array.from(svg.querySelectorAll(".axis-label-clickable"), (t) =>
        t.getAttribute("data-explain"),
      ),
    ).toEqual(AXES.map((a) => a.key));
    expect(texts(svg, "axis-value")).toEqual(["6.2", "7.5", "5.0", "0.0", "9.9"]);
    // No percentile line for an axis without reference data.
    expect(texts(svg, "axis-percentile")).toEqual(Array(4).fill("42nd pct."));
  });

  it("puts the first axis straight up and keeps a visible dot for a zero score", () => {
    const svg = chart();
    const speed = svg.querySelector("text.axis-label")!;
    expect(speed.getAttribute("text-anchor")).toBe("middle");
    expect(Number(speed.getAttribute("y"))).toBeLessThan(280);
    const points = svg.querySelectorAll("circle.deck-point");
    expect(points).toHaveLength(5);
    const zero = points[3]!;
    expect(
      Math.hypot(Number(zero.getAttribute("cx")) - 340, Number(zero.getAttribute("cy")) - 280),
    ).toBeCloseTo(6);
  });

  it("sizes text from the real width on narrow screens", () => {
    const wide = chart();
    const narrow = chart({ boxWidth: 320 });
    expect(wide.querySelector("text.axis-label")!.getAttribute("style")).toBeNull();
    const fontSize = parseFloat(
      narrow.querySelector("text.axis-label")!.getAttribute("style")!.replace("font-size:", ""),
    );
    // At least ~12px on screen once the 680-unit viewBox is shrunk to 320px.
    expect((fontSize * 320) / 680).toBeGreaterThan(11);
  });

  it("leaves the numbers to the plain list when text is enlarged on a narrow screen", () => {
    expect(texts(chart({ boxWidth: 320, textZoom: 1.3 }), "axis-value")).toEqual([]);
    expect(texts(chart({ boxWidth: 560, textZoom: 1.3 }), "axis-value")).toHaveLength(5);
  });

  it("keeps the exact desktop markup", () => {
    expect(
      radarChartSvg({ axes: AXES, scores: SCORES, percentile: () => 87, boxWidth: 560 }),
    ).toMatchSnapshot();
  });
});
