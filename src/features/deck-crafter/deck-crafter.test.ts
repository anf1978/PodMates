// State contracts preserved by the extraction: draft precedence, commanders and bounded edits.
import { describe, expect, it } from "vitest";
import {
  addCard,
  addPartner,
  createState,
  fitsIdentity,
  fromDecklist,
  identityCard,
  removeCommander,
  restore,
  setCommander,
  setQuantity,
} from "./state";
import { PM_LIMITS } from "../../services/cloud/limits";
import type { CardRecord } from "../../cards/tuple";

describe("Deck Crafter", () => {
  it("prefers an unfinished draft over Deck Chart and keeps Start New empty", () => {
    const state = createState();
    const current = fromDecklist("2 Forest (M21) 274 *F*", "Old commander", "Alex");
    const draft = { cards: { Island: 3 }, commander: "Draft commander", player: "" };
    expect(restore(state, draft, current, "Alex")).toBe(true);
    expect(state.cards).toEqual({ Island: 3, "Draft commander": 1 });
    expect(state.player).toBe("Alex");
    expect(restore(state, null, null, "Alex")).toBe(false);
    expect(state.cards).toEqual({});
    expect(state.commander).toBeNull();
    expect(current?.cards).toEqual({ Forest: 2 });
  });

  it("keeps a commander in the deck, replaces partners, and does not erase extra copies", () => {
    const state = createState();
    setCommander(state, "First");
    addPartner(state, "Second");
    addPartner(state, "Third");
    expect(state.cards).toEqual({ First: 1, Third: 1 });
    expect(state.commander).toBe("First / Third");
    addPartner(state, "First");
    expect(state.commander).toBe("First / Third");
    state.cards.First = 2;
    removeCommander(state, 0);
    expect(state.commander).toBe("Third");
    expect(state.cards).toEqual({ First: 2, Third: 1 });
    setCommander(state, "New");
    expect(state.cards).toEqual({ First: 2, New: 1 });
  });

  it("unions partner identities, allows colorless cards and flags outside colors", () => {
    const state = createState();
    state.commander = "Front // Back / Partner";
    const card = (ci: string): CardRecord => ({
      n: "",
      t: "",
      o: "",
      c: "",
      ci,
      m: 0,
      p: "",
      r: "",
      g: false,
      b: false,
    });
    const cards = new Map([
      ["Front // Back", card("WU")],
      ["Partner", card("BR")],
    ]);
    const identity = identityCard(state, (name) => cards.get(name));
    expect(identity?.ci).toBe("WUBR");
    expect(fitsIdentity(card(""), identity)).toBe(true);
    expect(fitsIdentity(card("UB"), identity)).toBe(true);
    expect(fitsIdentity(card("G"), identity)).toBe(false);
  });

  it("bounds added cards and quantities while still allowing edits at capacity", () => {
    const state = createState();
    state.cards = Object.fromEntries(
      Array.from({ length: PM_LIMITS.builderMaxCards }, (_, i) => [`Card ${i}`, 1]),
    );
    expect(addCard(state, "New card")).toBe(false);
    expect(addCard(state, "Card 0")).toBe(true);
    expect(state.cards["Card 0"]).toBe(2);
    setQuantity(state, "Card 0", "999");
    expect(state.cards["Card 0"]).toBe(PM_LIMITS.builderMaxQty);
    setQuantity(state, "Card 0", "invalid");
    expect(state.cards).not.toHaveProperty("Card 0");
  });
});
