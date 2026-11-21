import { describe, expect, it } from "vitest";
import { colourFilter, filtersFor, stretch } from "./enhance";

// A 21×7 grey strip: mid-grey background, a dark bar (columns 4–6) and a light bar (columns 14–16).
const W = 21,
  H = 7;
const strip = Array.from({ length: W * H }, (_, i) => {
  const x = i % W;
  return x >= 4 && x <= 6 ? 40 : x >= 14 && x <= 16 ? 220 : 128;
});
const column = (pixels: ArrayLike<number>, x: number) => pixels[3 * W + x];

describe("photo clean-up", () => {
  it("stretches grey levels to the full range", () => {
    expect([...stretch([50, 100, 150])]).toEqual([0, 128, 255]);
    expect([...stretch([90, 90])]).toEqual([0, 0]);
  });

  it("black filter keeps dark letters and drops light ones", () => {
    const out = colourFilter(strip, W, H, "black");
    expect(column(out, 5)).toBe(0);
    expect(column(out, 15)).toBe(255);
    expect(column(out, 10)).toBe(255);
  });

  it("white filter keeps light letters, drawn dark, and drops dark ones", () => {
    const out = colourFilter(strip, W, H, "white");
    expect(column(out, 15)).toBe(0);
    expect(column(out, 5)).toBe(255);
    expect(column(out, 10)).toBe(255);
  });

  it("mixed runs both filters", () => {
    expect(filtersFor("black")).toEqual(["black"]);
    expect(filtersFor("white")).toEqual(["white"]);
    expect(filtersFor("mixed")).toEqual(["black", "white"]);
  });
});
