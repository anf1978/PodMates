// Applies the colour theme and text size to <html>. Shared by the pre-paint script (inlined in
// <head>, so the saved choice is in place on first paint) and the Display settings tray. Both
// settings are per device (localStorage). The root's data-pm-theme / data-pm-text attributes are
// the single record of what is applied, so the two separately bundled copies agree.

import { buildTheme, CLASSIC_BG, findTheme, THEME_VARS } from "./palette";

const THEME_KEY = "podmates-theme";
const TEXT_KEY = "pm-text-scale";

export interface TextSize {
  id: string;
  label: string;
  pct: number;
}
export const TEXT_SIZES: readonly TextSize[] = [
  { id: "1", label: "Normal", pct: 100 },
  { id: "1.15", label: "Large", pct: 115 },
  { id: "1.3", label: "Larger", pct: 130 },
  { id: "1.5", label: "Largest", pct: 150 },
];

/** Applies a theme (unknown ids fall back to Classic) and, unless `silent`, saves it. */
export function applyTheme(id: string, silent = false): string {
  const t = findTheme(id) || findTheme("classic")!,
    root = document.documentElement,
    vals = buildTheme(t);
  THEME_VARS.forEach((v) => root.style.removeProperty(v));
  if (vals) Object.keys(vals).forEach((v) => root.style.setProperty(v, vals[v]!));
  root.setAttribute("data-pm-theme", t.id);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", vals ? vals["--bg-main"]! : CLASSIC_BG);
  if (!silent) {
    try {
      localStorage.setItem(THEME_KEY, t.id);
    } catch {
      /* private mode: applies for this visit only */
    }
  }
  return t.id;
}
export function savedTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) || "classic";
  } catch {
    return "classic";
  }
}
export function currentTheme(): string {
  return document.documentElement.getAttribute("data-pm-theme") || "classic";
}

// Text size: the whole page is scaled (like browser zoom, but remembered and set inside the app).
const knownSize = (id: string | null): id is string => TEXT_SIZES.some((z) => z.id === id);

/** Applies a text size (unknown ids fall back to Normal) and, unless `silent`, saves it. */
export function applyTextSize(id: string, silent = false): string {
  if (!knownSize(id)) id = "1";
  const el = document.documentElement;
  if (id === "1") el.style.removeProperty("zoom");
  else el.style.setProperty("zoom", id);
  el.setAttribute("data-pm-text", id);
  el.style.setProperty("--pm-zoom", id);
  if (!silent) {
    try {
      localStorage.setItem(TEXT_KEY, id);
    } catch {
      /* private mode: applies for this visit only */
    }
    // The inline radar redraws on this existing page event.
    window.dispatchEvent(new Event("pm-text-change"));
  }
  return id;
}
export function savedTextSize(): string {
  try {
    const v = localStorage.getItem(TEXT_KEY);
    return knownSize(v) ? v : "1";
  } catch {
    return "1";
  }
}
export function currentTextSize(): string {
  return document.documentElement.getAttribute("data-pm-text") || "1";
}
