import type { CardRecord } from "../cards/tuple.ts";
import { analyzeManaFace, combineManaFaces } from "../shared/mana-production.ts";

// ---- Mana production: read from the database, derive from text if absent ----
// The card database now stores two fields per card, computed at build time by
// pipelines/card-db/build-card-db.mjs using the logic in src/shared/mana-production.ts:
//   pm - colors of mana the card can make ("" if none), e.g. "WG"
//   rt - true when that mana is one-shot only (rituals, Lotus Petal...)
// Cards from a database built before those fields existed have neither, so
// the same logic runs here on the card's own text instead. Either way the
// result has the same shape.

export interface ManaProduction {
  colors: string;
  any: boolean;
  produces: boolean;
  ritual: boolean;
}

export function deriveManaProduction(card: CardRecord): ManaProduction {
  let pm: string, rt: boolean;
  if (typeof card.pm === "string") {
    pm = card.pm;
    rt = !!card.rt;
  } else {
    const r = combineManaFaces([analyzeManaFace(card.t, card.o)]);
    pm = r.pm;
    rt = !!r.rt;
  }
  // "any color" is already expanded to WUBRG inside pm, so there is no
  // separate any-color flag to carry around.
  return { colors: pm, any: false, produces: pm.length > 0, ritual: pm.length > 0 && rt };
}
