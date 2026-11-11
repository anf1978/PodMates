// Commander Centrality grid symbols: a card-type icon per tile, or coloured mana dots for lands
// that make coloured mana. Each helper returns app-authored SVG markup built from constants.
// Copied unchanged from the inline panel.

export const CC_ICONS: Record<string, string> = {
  creature:
    '<path d="M5 19l3-3M7 13l4 4M8 16L19 5l1 1L9 17z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  instant: '<path d="M13 2L5 13h6l-1 9 9-12h-6z" fill="currentColor"/>',
  sorcery:
    '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" fill="currentColor"/>',
  artifact:
    '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  enchantment:
    '<path d="M12 3l2.6 6 6.4.6-4.8 4.3 1.5 6.3L12 16.8 6.3 20.2l1.5-6.3L3 9.6 9.4 9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  planeswalker:
    '<path d="M12 2.5l7 9.5-7 9.5L5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 8v8" stroke="currentColor" stroke-width="2"/>',
  land: '<path d="M2 20l6.5-11 4 6.5L16 10l6 10z" fill="currentColor"/>',
  battle:
    '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
};
export const CC_KIND_NAMES: Record<string, string> = {
  creature: "Creature",
  instant: "Instant",
  sorcery: "Sorcery",
  artifact: "Artifact",
  enchantment: "Enchantment",
  planeswalker: "Planeswalker",
  land: "Land (no coloured mana)",
  battle: "Battle",
};
export const CC_MANA: Record<string, [string, string]> = {
  W: ["#f4ecc8", "White"],
  U: ["#4aa3e8", "Blue"],
  B: ["#3a2f45", "Black"],
  R: ["#e0533c", "Red"],
  G: ["#3f9a4a", "Green"],
  C: ["#a8a8a8", "Colourless"],
};
export function ccKind(t: string | null | undefined): string | null {
  t = String(t || "")
    .split("//")[0]
    .split("—")[0];
  if (/Creature/.test(t)) return "creature";
  if (/Planeswalker/.test(t)) return "planeswalker";
  if (/Land/.test(t)) return "land";
  if (/Battle/.test(t)) return "battle";
  if (/Artifact/.test(t)) return "artifact";
  if (/Enchantment/.test(t)) return "enchantment";
  if (/Instant/.test(t)) return "instant";
  if (/Sorcery/.test(t)) return "sorcery";
  return null;
}
export function ccPips(pm: string): string {
  const a = [
    ...new Set(
      String(pm)
        .toUpperCase()
        .split("")
        .filter((c) => CC_MANA[c]),
    ),
  ];
  const n = a.length;
  if (!n) return "";
  const stroke = 'stroke="rgba(255,255,255,.8)" stroke-width="1.2"';
  if (n >= 5) {
    const ring = ["W", "U", "B", "R", "G"]
      .map((c, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 5,
          a1 = a0 + (2 * Math.PI) / 5;
        const x0 = 12 + 9 * Math.cos(a0),
          y0 = 12 + 9 * Math.sin(a0),
          x1 = 12 + 9 * Math.cos(a1),
          y1 = 12 + 9 * Math.sin(a1);
        return (
          '<path d="M12 12L' +
          x0.toFixed(1) +
          " " +
          y0.toFixed(1) +
          "A9 9 0 0 1 " +
          x1.toFixed(1) +
          " " +
          y1.toFixed(1) +
          'Z" fill="' +
          CC_MANA[c][0] +
          '"/>'
        );
      })
      .join("");
    return ring + '<circle cx="12" cy="12" r="9" fill="none" ' + stroke + "/>";
  }
  const pos =
    n === 1
      ? [[12, 12, 8]]
      : n === 2
        ? [
            [7.5, 12, 6.2],
            [16.5, 12, 6.2],
          ]
        : n === 3
          ? [
              [12, 7, 5.2],
              [7, 16, 5.2],
              [17, 16, 5.2],
            ]
          : [
              [7, 7, 5],
              [17, 7, 5],
              [7, 17, 5],
              [17, 17, 5],
            ];
  let out = a
    .map(
      (c, i) =>
        '<circle cx="' +
        pos[i][0] +
        '" cy="' +
        pos[i][1] +
        '" r="' +
        pos[i][2] +
        '" fill="' +
        CC_MANA[c][0] +
        '" ' +
        stroke +
        "/>",
    )
    .join("");
  if (n === 1) {
    // letter keeps red/green distinguishable without colour
    const dark = a[0] === "B" || a[0] === "U" || a[0] === "R" || a[0] === "G";
    out +=
      '<text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" font-family="sans-serif" fill="' +
      (dark ? "#fff" : "#3a2f45") +
      '">' +
      a[0] +
      "</text>";
  }
  return out;
}
export function ccTileInner(t: GlyphTile): string {
  const k = ccKind(t.t);
  if (!k) return "";
  let inner = CC_ICONS[k],
    cls = "cc-ink";
  if (k === "land") {
    const p = ccPips(t.pm);
    if (p) {
      inner = p;
      cls = "";
    }
  }
  return '<svg viewBox="0 0 24 24" class="' + cls + '" aria-hidden="true">' + inner + "</svg>";
}
export function ccTileLabel(t: GlyphTile): string {
  const k = ccKind(t.t);
  if (!k) return "";
  if (k === "land") {
    const a = [
      ...new Set(
        String(t.pm || "")
          .toUpperCase()
          .split("")
          .filter((c) => CC_MANA[c]),
      ),
    ];
    return a.length ? "Land, makes " + a.map((c) => CC_MANA[c][1].toLowerCase()).join("/") : "Land";
  }
  return CC_KIND_NAMES[k];
}

export interface GlyphTile {
  t: string;
  pm: string;
}
