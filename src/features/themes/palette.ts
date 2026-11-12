// PodMates colour themes: the theme list and the colour maths that turns a theme into values for
// the shared CSS colour variables. Pure (no DOM), so the pre-paint script, the Display settings
// tray and the tests share one copy. The page stays dark in every theme; every text colour is
// pushed (by buildTheme) to a safe contrast on every background it can sit on, and auditThemes()
// re-checks all themes (theme.test.ts requires it to stay empty).

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type ThemeKind = "Classic" | "Guild" | "Triome" | "Four colours" | "Five colours";

export interface Theme {
  id: string;
  name: string;
  /** Mana colours in display order; empty for Classic (the stylesheet's own values). */
  colors: string;
  kind: ThemeKind;
  /** Overrides the colour-name subtitle. */
  sub?: string;
  /** Triome land the theme is also named after. */
  land?: string;
}

/** CSS custom property → value. */
export type ThemeValues = Record<string, string>;

const ACC: Record<string, string> = {
  W: "#F3EBCB",
  U: "#62B0F2",
  B: "#B49AE0",
  R: "#F5667B",
  G: "#66C45F",
}; // bright, readable on dark
const HUE: Record<string, number> = { W: 42, U: 218, B: 272, R: 350, G: 130 }; // tint of the dark backgrounds
export const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};
const PRI = ["R", "U", "G", "B", "W"]; // which colour leads when a theme has several
/** Dark label colour used on accent-filled buttons. */
export const ON_ACCENT = "#1A1208";
/** Browser chrome colour of the Classic theme (matches the `theme-color` meta tag). */
export const CLASSIC_BG = "#0F0C0A";

export const THEMES: readonly Theme[] = [
  { id: "classic", name: "Classic PodMates", sub: "Gold & teal", colors: "", kind: "Classic" },
  // guilds
  { id: "azorius", name: "Azorius", colors: "WU", kind: "Guild" },
  { id: "dimir", name: "Dimir", colors: "UB", kind: "Guild" },
  { id: "rakdos", name: "Rakdos", colors: "BR", kind: "Guild" },
  { id: "gruul", name: "Gruul", colors: "RG", kind: "Guild" },
  { id: "selesnya", name: "Selesnya", colors: "GW", kind: "Guild" },
  { id: "orzhov", name: "Orzhov", colors: "WB", kind: "Guild" },
  { id: "izzet", name: "Izzet", colors: "UR", kind: "Guild" },
  { id: "golgari", name: "Golgari", colors: "BG", kind: "Guild" },
  { id: "boros", name: "Boros", colors: "RW", kind: "Guild" },
  { id: "simic", name: "Simic", colors: "GU", kind: "Guild" },
  // shards (triomes from Streets of New Capenna)
  { id: "bant", name: "Bant", colors: "GWU", land: "Spara's Headquarters", kind: "Triome" },
  { id: "esper", name: "Esper", colors: "WUB", land: "Raffine's Tower", kind: "Triome" },
  { id: "grixis", name: "Grixis", colors: "UBR", land: "Xander's Lounge", kind: "Triome" },
  { id: "jund", name: "Jund", colors: "BRG", land: "Ziatora's Proving Ground", kind: "Triome" },
  { id: "naya", name: "Naya", colors: "RGW", land: "Jetmir's Garden", kind: "Triome" },
  // wedges (triomes from Ikoria)
  { id: "abzan", name: "Abzan", colors: "WBG", land: "Indatha Triome", kind: "Triome" },
  { id: "jeskai", name: "Jeskai", colors: "URW", land: "Raugrin Triome", kind: "Triome" },
  { id: "sultai", name: "Sultai", colors: "BGU", land: "Zagoth Triome", kind: "Triome" },
  { id: "mardu", name: "Mardu", colors: "RWB", land: "Savai Triome", kind: "Triome" },
  { id: "temur", name: "Temur", colors: "GUR", land: "Ketria Triome", kind: "Triome" },
  // four colours
  { id: "yoretiller", name: "Yore-Tiller", colors: "WUBR", kind: "Four colours" },
  { id: "glinteye", name: "Glint-Eye", colors: "UBRG", kind: "Four colours" },
  { id: "dunebrood", name: "Dune-Brood", colors: "BRGW", kind: "Four colours" },
  { id: "inktreader", name: "Ink-Treader", colors: "RGWU", kind: "Four colours" },
  { id: "witchmaw", name: "Witch-Maw", colors: "GWUB", kind: "Four colours" },
  // five
  { id: "wubrg", name: "WUBRG", sub: "All five colours", colors: "WUBRG", kind: "Five colours" },
];

/** Every variable a theme may set; applying a theme clears all of them first. */
export const THEME_VARS = [
  "--bg-main",
  "--bg-panel",
  "--bg-panel-raised",
  "--bg-slot",
  "--text-primary",
  "--text-soft",
  "--text-dim",
  "--gold",
  "--gold-bright",
  "--cyan",
  "--cyan-dim",
  "--bronze",
  "--wine",
  "--wine-bright",
  "--line",
  "--line-strong",
  "--slot-border",
  "--slot-border-hi",
  "--medium-bg",
  "--gold-rgb",
  "--cyan-rgb",
  "--glow-a-rgb",
  "--glow-b-rgb",
  "--bronze-dark",
] as const;

// ---- colour maths ----
type Rgb = [number, number, number];
function hex2rgb(h: string): Rgb {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgb2hex(r: number[]): string {
  return (
    "#" +
    r
      .map((v) => {
        v = Math.max(0, Math.min(255, Math.round(v)));
        return (v < 16 ? "0" : "") + v.toString(16);
      })
      .join("")
      .toUpperCase()
  );
}
function rgb2hsl(c: Rgb): Rgb {
  const r = c[0] / 255,
    g = c[1] / 255,
    b = c[2] / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  let h = 0,
    s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function hsl2hex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return rgb2hex([f(0), f(8), f(4)]);
}
function lum(hex: string): number {
  const c = hex2rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
/** WCAG contrast ratio of two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string): number {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// Nudge a colour's lightness (keeping hue and saturation) until it reaches `min` contrast on every background given.
function ensure(fg: string, bgs: string[], min: number): string {
  const hsl = rgb2hsl(hex2rgb(fg));
  let cur = fg,
    n = 0;
  const worst = (c: string): number => {
    let w = 99;
    bgs.forEach((b) => {
      w = Math.min(w, contrastRatio(c, b));
    });
    return w;
  };
  while (worst(cur) < min && hsl[2] < 98 && n++ < 80) {
    hsl[2] += 1;
    cur = hsl2hex(hsl[0], hsl[1], hsl[2]);
  }
  return cur;
}
// Accent colours also carry dark button labels, so keep them light enough for that too.
function ensureAccent(fg: string, bgs: string[]): string {
  let c = ensure(fg, bgs, 5.5),
    n = 0;
  const hsl = rgb2hsl(hex2rgb(c));
  while (contrastRatio(c, ON_ACCENT) < 4.5 && hsl[2] < 98 && n++ < 80) {
    hsl[2] += 1;
    c = hsl2hex(hsl[0], hsl[1], hsl[2]);
  }
  return c;
}
function rgbs(hex: string): string {
  return hex2rgb(hex).join(",");
}

export function findTheme(id: string | null | undefined): Theme | null {
  return THEMES.find((t) => t.id === id) ?? null;
}
function order(colors: string): string[] {
  return colors.split("").sort((a, b) => PRI.indexOf(a) - PRI.indexOf(b));
}

/** Turns a theme into a full set of values for the colour variables (null = Classic). */
export function buildTheme(t: Theme | null): ThemeValues | null {
  if (!t || !t.colors) return null; // classic = the stylesheet's own values
  const cols = order(t.colors),
    five = cols.length === 5;
  const p = cols[0]!,
    s = cols[1]!,
    q = cols[2] || cols[1]!,
    h = five ? 36 : HUE[p]!;
  const sat = five ? 7 : 27;
  const bgMain = hsl2hex(h, sat, 5.5),
    bgPanel = hsl2hex(h, sat - 2, 8.5),
    bgRaised = hsl2hex(h, sat - 3, 11.5),
    bgSlot = hsl2hex(h, sat, 6.8);
  const bgs = [bgMain, bgPanel, bgRaised, bgSlot];
  const textP = ensure(hsl2hex(h, 28, 92), bgs, 12),
    textS = ensure(hsl2hex(h, 16, 72), bgs, 7.5),
    textD = ensure(hsl2hex(h, 12, 58), bgs, 4.8);
  let a1 = five ? "#F2C94C" : ACC[p]!,
    a2 = five ? "#C58AE0" : ACC[s]!;
  a1 = ensureAccent(a1, bgs);
  a2 = ensure(a2, bgs, 5.5);
  const a1h = rgb2hsl(hex2rgb(a1)),
    a2h = rgb2hsl(hex2rgb(a2)),
    qh = rgb2hsl(hex2rgb(five ? "#62B0F2" : ACC[q]!));
  const goldBright = ensureAccent(
    hsl2hex(a1h[0], Math.min(100, a1h[1]), Math.min(92, a1h[2] + 9)),
    bgs,
  );
  const bronze = hsl2hex(a1h[0], Math.max(35, a1h[1] * 0.7), 38);
  const wine = hsl2hex(qh[0], 38, 24),
    wineBright = ensure(hsl2hex(qh[0], Math.max(40, qh[1] * 0.6), 62), bgs, 5);
  return {
    "--bg-main": bgMain,
    "--bg-panel": bgPanel,
    "--bg-panel-raised": bgRaised,
    "--bg-slot": bgSlot,
    "--text-primary": textP,
    "--text-soft": textS,
    "--text-dim": textD,
    "--gold": a1,
    "--gold-bright": goldBright,
    "--cyan": a2,
    "--cyan-dim": hsl2hex(a2h[0], a2h[1] * 0.7, 40),
    "--bronze": bronze,
    "--wine": wine,
    "--wine-bright": wineBright,
    "--line": "rgba(" + rgbs(a1) + ",0.2)",
    "--line-strong": "rgba(" + rgbs(a1) + ",0.5)",
    "--slot-border": hsl2hex(h, 16, 21),
    "--slot-border-hi": hsl2hex(h, 18, 33),
    "--medium-bg": "rgba(" + rgbs(a1) + ",0.18)",
    "--gold-rgb": rgbs(a1),
    "--cyan-rgb": rgbs(a2),
    "--glow-a-rgb": rgbs(bronze),
    "--glow-b-rgb": rgbs(wine),
    "--bronze-dark": hsl2hex(a1h[0], 45, 17),
  };
}

const AUDIT_BACKGROUNDS = ["--bg-main", "--bg-panel", "--bg-panel-raised", "--bg-slot"];
const AUDIT_TEXT: [string, number][] = [
  ["--text-primary", 12],
  ["--text-soft", 7],
  ["--text-dim", 4.5],
  ["--gold", 5.5],
  ["--gold-bright", 5.5],
  ["--cyan", 5.5],
  ["--wine-bright", 4.5],
];

/** Every text/background pair that matters, for every theme. Returns the failures (empty = all good). */
export function auditThemes(): string[] {
  const bad: string[] = [];
  THEMES.forEach((t) => {
    const v = buildTheme(t);
    if (!v) return;
    AUDIT_BACKGROUNDS.forEach((b) => {
      AUDIT_TEXT.forEach(([fg, min]) => {
        const r = contrastRatio(v[fg]!, v[b]!);
        if (r < min) bad.push(t.id + ": " + fg + " on " + b + " = " + r.toFixed(2));
      });
    });
    ["--gold", "--gold-bright"].forEach((a) => {
      const r = contrastRatio(ON_ACCENT, v[a]!);
      if (r < 4.5) bad.push(t.id + ": button label on " + a + " = " + r.toFixed(2));
    });
  });
  return bad;
}
