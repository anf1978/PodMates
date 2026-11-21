// Photo clean-up before OCR, on grey pixels only (no DOM). Each photo is read more than once and the names
// found are combined: once with its contrast stretched (as before), then once per name colour through a
// filter that keeps only letters of that colour. The black filter keeps strokes darker than their
// surroundings; the white filter keeps strokes lighter than theirs and draws them dark (the OCR engine
// prefers dark text). Each filter drops the other colour's text and frames, so names the busy first pass
// missed can show up. Measured gains on generated card photos: change doc 046.

/** The name colour of the cards in a photo; "mixed" runs both filters. */
export type TextColour = "black" | "white" | "mixed";

/** Which colour filters a choice runs, after the plain pass. */
export const filtersFor = (colour: TextColour): ("black" | "white")[] =>
  colour === "mixed" ? ["black", "white"] : [colour];

/** Stretches grey levels to the full 0–255 range (the original, single-pass clean-up). */
export function stretch(gray: ArrayLike<number>): Uint8ClampedArray {
  let min = 255,
    max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = Math.max(max - min, 1);
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = Math.round(((gray[i] - min) / range) * 255);
  return out;
}

/** How far a stroke must stand out from its neighbourhood's average grey to count as a letter. */
const STANDOUT = 12;

/** Black letters on white, keeping only strokes of `colour` (local-mean threshold over a window that
 * scales with the image, about a letter's height on a card photo). */
export function colourFilter(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  colour: "black" | "white",
): Uint8ClampedArray {
  const radius = Math.max(6, Math.round(Math.max(width, height) / 110));
  const stride = width + 1;
  // Summed-area table, so each pixel's neighbourhood average costs four lookups.
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius),
      y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(width, x + radius + 1);
      const total =
        sums[y1 * stride + x1] -
        sums[y0 * stride + x1] -
        sums[y1 * stride + x0] +
        sums[y0 * stride + x0];
      const mean = total / ((x1 - x0) * (y1 - y0));
      const v = gray[y * width + x];
      const letter = colour === "black" ? v < mean - STANDOUT : v > mean + STANDOUT;
      out[y * width + x] = letter ? 0 : 255;
    }
  }
  return out;
}
