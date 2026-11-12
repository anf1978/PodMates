// Mana production, worked out from a card's text. One copy used by BOTH the card-database build
// (pipelines/card-db/build-card-db.mjs computes each card's `pm`/`rt`) and the engine (src/engine/mana.ts falls back
// to it for a database built before those fields existed). mana-production.test.ts pins its output.
// Node runs this file directly: erasable TypeScript only (see ./pricescry.ts).
//
// Scryfall has no "what mana does this make" field that separates real mana
// abilities from Treasure/token makers, and no "one-shot ritual" concept at
// all, so both are worked out from a card's type line and rules text.
//
// analyzeManaFace(typeLine, oracleText) returns the colors a single card face
// can add, split into two groups:
//   sustained - a permanent ability it can use again and again
//               (lands, rocks, dorks, Signets, Wild Growth-style Auras)
//   oneShot   - mana it makes only once (instants/sorceries like Dark Ritual,
//               or "sacrifice this" / "exile from hand" abilities like Lotus
//               Petal and the Spirit Guides)
// Colors come back in WUBRGC order. "Any color" becomes WUBRG, "any type"
// adds C. Only real mana abilities count: Treasure/Spawn/Powerstone makers,
// abilities granted to other permanents ("quoted" text), reminder text, and
// mana doublers all correctly produce nothing.
export const MANA_ORDER = "WUBRGC";

export function canonManaColors(colorSet: Set<string>): string {
  let out = "";
  for (const c of MANA_ORDER) if (colorSet.has(c)) out += c;
  return out;
}

export interface ManaFace {
  sustained: string;
  oneShot: string;
}

export function analyzeManaFace(typeLine: unknown, oracleText: unknown): ManaFace {
  const tl = String(typeLine || "").toLowerCase();
  const isLand = /\bland\b/.test(tl);
  const isSpell = /\b(instant|sorcery)\b/.test(tl);
  const isAura = /\baura\b/.test(tl);
  let text = String(oracleText || "");
  // Reminder text in (parentheses) explains rules; it is not the card's own
  // ability -- except on lands, where "({T}: Add {G}.)" can be the only place
  // the ability is written.
  if (!isLand) text = text.replace(/\([^)]*\)/g, "");
  // Text in "quotes" is an ability granted to a token or another permanent.
  text = text.replace(/["\u201C][^"\u201D]*["\u201D]/g, "");

  const sustained = new Set<string>(),
    oneShot = new Set<string>();
  const oneShotCost = /sacrifice (this|it)\b|exile (this card|it) from your hand/i;
  const ANY_COLOR =
    /\bany (one )?(color|type)\b|any combination of colors|different colors|of that color|chosen color|any of (those|the exiled card's|the|this [a-z]+'s) colors?|each color among/i;

  const absorb = (clause: string, set: Set<string>) => {
    const symRe = /\{([WUBRGC])\}|\{([WUBRG])\/([WUBRG])\}/g;
    let m: RegExpExecArray | null;
    while ((m = symRe.exec(clause))) {
      if (m[1]) set.add(m[1]);
      else {
        set.add(m[2] as string);
        set.add(m[3] as string);
      }
    }
    if (ANY_COLOR.test(clause)) {
      for (const c of "WUBRG") set.add(c);
      if (/\bany type\b/i.test(clause)) set.add("C");
    }
  };

  for (const line of text.split("\n")) {
    const addRe = /\badd\s+([^.]*)/gi;
    let m: RegExpExecArray | null;
    if (isSpell) {
      while ((m = addRe.exec(line))) absorb(m[1] as string, oneShot);
      continue;
    }
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const cost = line.slice(0, colon),
        effect = line.slice(colon + 1);
      const target = oneShotCost.test(cost) ? oneShot : sustained;
      while ((m = addRe.exec(effect))) absorb(m[1] as string, target);
    } else if (isAura) {
      // Wild Growth / Utopia Sprawl / Fertile Ground: the Aura adds mana when
      // the enchanted land is tapped.
      const aura = /enchanted [a-z]+ is tapped for mana[^.]*?\badds?\s+([^.]*)/i.exec(line);
      if (aura) absorb(aura[1] as string, sustained);
    }
  }
  // Basic land types carry an intrinsic mana ability (Dryad Arbor, Jasconian
  // Isle, Snow-Covered basics, "Forest Dryad"...). Skipped on combined
  // "A // B" type lines, where the subtype could belong to the other face.
  if (isLand && !tl.includes("//")) {
    const dash = tl.indexOf("\u2014");
    const sub = dash === -1 ? "" : tl.slice(dash + 1);
    if (/\bplains\b/.test(sub)) sustained.add("W");
    if (/\bisland\b/.test(sub)) sustained.add("U");
    if (/\bswamp\b/.test(sub)) sustained.add("B");
    if (/\bmountain\b/.test(sub)) sustained.add("R");
    if (/\bforest\b/.test(sub)) sustained.add("G");
  }
  return { sustained: canonManaColors(sustained), oneShot: canonManaColors(oneShot) };
}

// Combines one or more faces of a card into the two values the database
// stores: pm = colors it can produce, rt = 1 if that production is one-shot only.
// A card that has BOTH a sustained and a one-shot ability (Crystal Vein) counts
// as a normal source of its sustained colors.
export function combineManaFaces(faceResults: readonly ManaFace[]): { pm: string; rt: 0 | 1 } {
  const s = new Set<string>(),
    o = new Set<string>();
  for (const r of faceResults) {
    for (const c of r.sustained) s.add(c);
    for (const c of r.oneShot) o.add(c);
  }
  if (s.size) return { pm: canonManaColors(s), rt: 0 };
  if (o.size) return { pm: canonManaColors(o), rt: 1 };
  return { pm: "", rt: 0 };
}
