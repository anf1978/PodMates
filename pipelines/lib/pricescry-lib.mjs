// PriceScry pipeline helpers (snapshot, fx, movers, study...). The helpers the page also needs come from src/shared/pricescry.ts.
//
// DATA MODEL
//   Prices are stored as CHANGE POINTS, not a value per day: a series like
//   [[1740,120],[1745,150]] means "120 from day 1740, 150 from day 1745 until it
//   changes again". Prices move slowly, so this keeps years of history small.
//   Days are whole days since 2020-01-01 (UTC). Prices are integers: USD/EUR in
//   cents, MTGO tix in hundredths, yen in yen. A null value means "no price".
//
//   Cards are grouped into 512 shard files by a hash of the card name, so the
//   page only downloads the small file holding the card being viewed.
//
// The name key, shard hash, day numbers, change-point lookup and consensus price live in
// src/shared/pricescry.ts, one copy shared with the page (Node runs it with built-in type stripping).
// Changing the hash or SHARDS makes every published shard unreachable.
import { valueAt, consensusAt } from "../../src/shared/pricescry.ts";
export {
  EPOCH_MS,
  SHARDS,
  dayIndex,
  isoFromDayIndex,
  nameKey,
  fnv1a,
  shardOf,
  shardFile,
  valueAt,
  makeEurUsd,
  sourceValuesAt,
  consensusAt,
} from "../../src/shared/pricescry.ts";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// "12.34" -> 1234. Missing or unparseable -> null.
export function toInt(str, scale = 100) {
  if (str == null || str === "") return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? Math.round(n * scale) : null;
}

// ---- change-point series -------------------------------------------------
export function applyPoint(series, day, value) {
  if (!series.length) {
    if (value !== null) series.push([day, value]);
    return;
  }
  const last = series[series.length - 1];
  if (last[0] === day) {
    last[1] = value;
    return;
  } // a re-run on the same day just overwrites
  if (last[1] !== value) series.push([day, value]);
}
// Scryfall price field -> short series key
export const PRICE_KEYS = {
  usd: "u",
  usd_foil: "uf",
  usd_etched: "ue",
  eur: "e",
  eur_foil: "ef",
  tix: "t",
};
export const PRICE_SCALE = {
  usd: 100,
  usd_foil: 100,
  usd_etched: 100,
  eur: 100,
  eur_foil: 100,
  tix: 100,
};

export function updatePrinting(existing, src, day) {
  const p = existing || { id: src.id, pr: {} };
  p.s = src.set;
  p.sn = src.set_name;
  p.cn = src.collector_number;
  p.r = src.released_at;
  p.rar = src.rarity;
  p.f = src.finishes || [];
  if (src.promo) p.pm = 1;
  if (src.preview && src.preview.previewed_at && !p.pv)
    p.pv = { d: src.preview.previewed_at, s: src.preview.source || null }; // Scryfall's own record of when and where a card was officially previewed
  for (const [field, key] of Object.entries(PRICE_KEYS)) {
    const v = toInt(src.prices && src.prices[field], PRICE_SCALE[field]);
    if (!p.pr[key]) p.pr[key] = [];
    applyPoint(p.pr[key], day, v);
  }
  p.l = day; // last day this printing was seen in the bulk file
  for (const k of Object.keys(p.pr)) if (!p.pr[k].length) delete p.pr[k]; // never store empty series
  return p;
}

// The "market" price of a card on a day: its cheapest non-foil USD printing
// (falling back to cheapest foil). Used for movers and headline numbers.
export function marketUsdAt(rec, day) {
  let best;
  for (const p of rec.p) {
    const v = p.pr.u && valueAt(p.pr.u, day);
    if (v != null && (best === undefined || v < best)) best = v;
  }
  if (best !== undefined) return best;
  for (const p of rec.p) {
    const v = p.pr.uf && valueAt(p.pr.uf, day);
    if (v != null && (best === undefined || v < best)) best = v;
  }
  return best;
}
export function firstPriceDay(rec) {
  let first;
  for (const p of rec.p)
    for (const k of ["u", "uf"]) {
      const s = p.pr[k];
      if (s && s.length && (first === undefined || s[0][0] < first)) first = s[0][0];
    }
  return first;
}

// ---- MTGJSON price sources ---------------------------------------------------------------
// MTGJSON publishes prices per card printing (keyed by its own uuid) from several shops. They are stored on
// each printing under short keys: "x" + provider + kind + finish, e.g. "xtrn" = TCGplayer, retail, normal.
//   provider: t = TCGplayer (USD), c = Cardmarket (EUR), k = Card Kingdom (USD), m = Manapool (USD)
//   kind:     r = retail (what the shop sells at), b = buylist (what the shop pays: Card Kingdom only)
//   finish:   n = normal, f = foil, e = etched
// Prices are integer cents of the provider's own currency, like the Scryfall series.
export const MJ_PROVIDERS = { tcgplayer: "t", cardmarket: "c", cardkingdom: "k", manapool: "m" };
export const MJ_FINISH = { normal: "n", foil: "f", etched: "e" };
export const MJ_KINDS = { retail: "r", buylist: "b" };
export function mjKey(provider, kind, finish) {
  const p = MJ_PROVIDERS[provider],
    k = MJ_KINDS[kind],
    f = MJ_FINISH[finish];
  return p && k && f ? `x${p}${k}${f}` : null;
}

// Bad-price guard. Real data has absurd one-off prices (a Manapool price of $211,667 on a card whose other
// sources say $250, a Card Kingdom $149,999.99). For each retail finish and day, with at least THREE shops pricing
// a card, a shop's price is dropped when it sits more than 5x above or below the MIDDLE price of all the shops AND
// the gap is worth caring about (at least $5): on bulk cards, shops legitimately differ by 5x over a few cents
// (price floors, rounding), and dropping those would only throw data away. With fewer than three shops there is
// nothing to judge by, so nothing is dropped. Cardmarket is in euros, so it is converted to dollars (eurUsd)
// for the comparison only.
export function guardRetail(pricesByProvider, eurUsd = 1.1, factor = 5, minGapUsd = 5) {
  // pricesByProvider: { tcgplayer: 12.5, cardmarket: 11.0, ... } for ONE finish on ONE day -> returns the providers to drop
  const usd = {};
  for (const [p, v] of Object.entries(pricesByProvider))
    if (typeof v === "number" && v > 0) usd[p] = p === "cardmarket" ? v * eurUsd : v;
  const vals = Object.values(usd).sort((a, b) => a - b);
  if (vals.length < 3) return [];
  const mid =
    vals.length % 2
      ? vals[vals.length >> 1]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
  return Object.keys(usd).filter(
    (p) => (usd[p] > mid * factor || usd[p] < mid / factor) && Math.abs(usd[p] - mid) >= minGapUsd,
  );
}

// ---- consensus price across shops -------------------------------------------------------------
// consensusAt / sourceValuesAt / makeEurUsd (the middle price across shops) are in src/shared/pricescry.ts.
export const hasMjSeries = (rec) =>
  rec.p.some((p) => Object.keys(p.pr).some((k) => k.startsWith("x")));
// The one function the movers list, the study engine and the riser engine read a card's price through.
export function marketCentsAt(rec, day, eurUsd) {
  if (!hasMjSeries(rec)) return marketUsdAt(rec, day);
  const c = consensusAt(rec, day, eurUsd);
  return c ? c.price : undefined;
}
export function firstDayAnySource(rec) {
  // earliest day any retail shop price exists for this card
  let first;
  for (const p of rec.p)
    for (const [k, s] of Object.entries(p.pr)) {
      if (!s.length) continue;
      if (
        !(k.startsWith("x")
          ? /^x[tckm]r/.test(k)
          : k === "u" || k === "uf" || k === "e" || k === "ef")
      )
        continue;
      if (first === undefined || s[0][0] < first) first = s[0][0];
    }
  return first;
}

// ---- signals: things that change around a card besides its price ----------------------------
// Captured every day from Scryfall's bulk file and kept as change points on each card, plus a running log of events:
//   new_card      a card appears that was not there yesterday (a spoiler or a new release)
//   new_printing  an existing card gets another printing (a reprint, which adds supply)
//   legality      a format changes the card's status (banned, unbanned, no longer legal...)
//   game_changer  the card is added to or removed from Commander's Game Changers list
//   rank_jump     the card's EDHREC popularity rank improves sharply in a day
// Most of this CANNOT be recovered later, which is why it is recorded from the first day.
export const SIGNAL_FORMATS = [
  "commander",
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "brawl",
];
export const LEGAL_CODE = {
  legal: "l",
  not_legal: "n",
  banned: "b",
  restricted: "r",
  suspended: "s",
};
export const LEGAL_WORD = {
  l: "legal",
  n: "not legal",
  b: "banned",
  r: "restricted",
  s: "suspended",
};
export const RANK_JUMP = { ratio: 0.6, minGain: 300 }; // rank must reach 60% of yesterday's number or better, and gain at least 300 places
export const SIGNAL_KEEP_DAYS = 400;
