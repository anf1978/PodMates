// Pre-paint entry. Not a module at runtime: scripts/theme-prepaint.mjs bundles this file into a
// classic IIFE and inlines it as <script id="theme-script"> in <head> (dev server and build), so
// the saved colour theme and text size are in place before the page is drawn (no colour flash).
// Keep it small: it blocks first paint. Nothing here may touch window globals.

import { applyTextSize, applyTheme, savedTextSize, savedTheme } from "./apply";

try {
  applyTheme(savedTheme(), true);
} catch {
  /* the stylesheet defaults stand */
}
try {
  applyTextSize(savedTextSize(), true);
} catch {
  /* normal size stands */
}
