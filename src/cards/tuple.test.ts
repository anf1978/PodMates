import { expect, it } from "vitest";
import {
  backOracleText,
  backTypeLine,
  cardFromTuple,
  cardName,
  colorIdentity,
  loyalty,
  manaCost,
  manaValue,
  notCommanderLegal,
  oneShotMana,
  oracleText,
  pips,
  power,
  producedMana,
  rarity,
  toughness,
  typeLine,
  type CardTuple,
} from "./tuple.ts";

const full: CardTuple = [
  "Front // Back",
  "Creature",
  "front",
  "{G}",
  "G",
  1,
  "G",
  "rare",
  "G",
  1,
  "*",
  "2",
  1,
  "3",
  "back",
  "Land",
];
const legacy: CardTuple = ["Old", "Artifact", "", "{2}", "", 2, "", "common"];

it("reads every position of a complete tuple by name", () => {
  expect([
    cardName(full),
    typeLine(full),
    oracleText(full),
    manaCost(full),
    colorIdentity(full),
    manaValue(full),
    pips(full),
    rarity(full),
    producedMana(full),
    oneShotMana(full),
    power(full),
    toughness(full),
    notCommanderLegal(full),
    loyalty(full),
    backOracleText(full),
    backTypeLine(full),
  ]).toEqual([
    "Front // Back",
    "Creature",
    "front",
    "{G}",
    "G",
    1,
    "G",
    "rare",
    "G",
    true,
    "*",
    "2",
    true,
    "3",
    "back",
    "Land",
  ]);
});

it("reports fields a shorter publication never carried as undefined", () => {
  expect(cardName(legacy)).toBe("Old");
  for (const accessor of [
    producedMana,
    oneShotMana,
    power,
    toughness,
    notCommanderLegal,
    loyalty,
    backOracleText,
    backTypeLine,
  ]) {
    expect(accessor(legacy)).toBeUndefined();
  }
});

it("normalises an absent produced-mana string and non-1 flag values", () => {
  const blank: CardTuple = ["Blank", "", "", "", "", 0, "", "", "", 0, "", "", 0];
  expect(producedMana(blank)).toBe("");
  expect(oneShotMana(blank)).toBe(false);
  expect(notCommanderLegal(blank)).toBe(false);
});

it("builds the decoded record, carrying the Game Changer and banned flags", () => {
  expect(cardFromTuple(full, { gameChanger: true, banned: false })).toEqual({
    n: "Front // Back",
    t: "Creature",
    o: "front",
    c: "{G}",
    ci: "G",
    m: 1,
    p: "G",
    r: "rare",
    pm: "G",
    rt: true,
    pw: "*",
    tg: "2",
    x: true,
    ly: "3",
    ob: "back",
    bt: "Land",
    g: true,
    b: false,
  });
  const old = cardFromTuple(legacy, { gameChanger: false, banned: true });
  expect(old).toMatchObject({ n: "Old", g: false, b: true });
  for (const key of ["pm", "rt", "pw", "tg", "x", "ly", "ob", "bt"]) {
    expect(old).toHaveProperty(key, undefined);
  }
});
