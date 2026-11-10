// The positional card tuple published by .github/scripts/build-card-db.mjs, plus the
// only named accessors allowed to read it -- nothing else may index a tuple directly.
// Positions are append-only: never reorder or reuse one, and keep the length guards so
// cards from an older publication keep reporting `undefined` for fields added later.

/**
 * `[name, typeLine, oracleText, manaCost, colorIdentity, manaValue, pips, rarity,
 * producedMana, oneShotMana, power, toughness, notCommanderLegal, loyalty,
 * backOracleText, backTypeLine]`.
 */
export type CardTuple = [
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  string,
  string?,
  number?,
  string?,
  string?,
  number?,
  string?,
  string?,
  string?,
];

/** A decoded card, as the engine, the lookup indexes and every UI panel see it. */
export interface CardRecord {
  /** Name. */
  n: string;
  /** Type line. */
  t: string;
  /** Oracle text. */
  o: string;
  /** Mana cost string. */
  c: string;
  /** Color identity. */
  ci: string;
  /** Mana value. */
  m: number;
  /** Pip encoding. */
  p: string;
  /** Rarity. */
  r: string;
  /** Colors of mana the card can produce ("" if none). */
  pm?: string | undefined;
  /** True when that mana is one-shot only (rituals, Lotus Petal, Spirit Guides). */
  rt?: boolean | undefined;
  /** Printed power as text ("0", "4", "*", "1+*"); "" for non-creatures. */
  pw?: string | undefined;
  /** Printed toughness, same encoding as `pw`. */
  tg?: string | undefined;
  /** True when the card is not legal in Commander. */
  x?: boolean | undefined;
  /** Starting loyalty as text; "" for anything that is not a planeswalker. */
  ly?: string | undefined;
  /** Oracle text of the second face ("" otherwise). */
  ob?: string | undefined;
  /** Type line of that second face ("" otherwise). */
  bt?: string | undefined;
  /** Game Changer. */
  g: boolean;
  /** Banned in Commander. */
  b: boolean;
}

export const cardName = (tuple: CardTuple): string => tuple[0];
export const typeLine = (tuple: CardTuple): string => tuple[1];
export const oracleText = (tuple: CardTuple): string => tuple[2];
export const manaCost = (tuple: CardTuple): string => tuple[3];
export const colorIdentity = (tuple: CardTuple): string => tuple[4];
export const manaValue = (tuple: CardTuple): number => tuple[5];
export const pips = (tuple: CardTuple): string => tuple[6];
export const rarity = (tuple: CardTuple): string => tuple[7];

// Fields added after the first publications: absent means "unknown", not "" or false.
export const producedMana = (tuple: CardTuple): string | undefined =>
  tuple.length > 8 ? tuple[8] || "" : undefined;
export const oneShotMana = (tuple: CardTuple): boolean | undefined =>
  tuple.length > 9 ? tuple[9] === 1 : undefined;
export const power = (tuple: CardTuple): string | undefined =>
  tuple.length > 10 ? tuple[10] : undefined;
export const toughness = (tuple: CardTuple): string | undefined =>
  tuple.length > 11 ? tuple[11] : undefined;
export const notCommanderLegal = (tuple: CardTuple): boolean | undefined =>
  tuple.length > 12 ? tuple[12] === 1 : undefined;
export const loyalty = (tuple: CardTuple): string | undefined =>
  tuple.length > 13 ? tuple[13] : undefined;
export const backOracleText = (tuple: CardTuple): string | undefined =>
  tuple.length > 14 ? tuple[14] : undefined;
export const backTypeLine = (tuple: CardTuple): string | undefined =>
  tuple.length > 15 ? tuple[15] : undefined;

/** Maps one tuple onto the decoded record shape the rest of the app reads. */
export function cardFromTuple(
  tuple: CardTuple,
  flags: { gameChanger: boolean; banned: boolean },
): CardRecord {
  return {
    n: cardName(tuple),
    t: typeLine(tuple),
    o: oracleText(tuple),
    c: manaCost(tuple),
    ci: colorIdentity(tuple),
    m: manaValue(tuple),
    p: pips(tuple),
    r: rarity(tuple),
    pm: producedMana(tuple),
    rt: oneShotMana(tuple),
    pw: power(tuple),
    tg: toughness(tuple),
    x: notCommanderLegal(tuple),
    ly: loyalty(tuple),
    ob: backOracleText(tuple),
    bt: backTypeLine(tuple),
    g: flags.gameChanger,
    b: flags.banned,
  };
}
