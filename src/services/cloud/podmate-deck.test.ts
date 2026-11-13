import { beforeEach, expect, it, vi } from "vitest";
import { findPodmateDeck } from "./decks";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

const { fake } = fb;
const deck = (key: string, extra = {}) => ({
  key,
  deckName: key,
  commander: "Atraxa",
  player: "Bo",
  list: "1 Sol Ring",
  savedAt: 1,
  secret: false,
  ...extra,
});

beforeEach(() => {
  fake.reset();
  fake.signIn({ uid: "u1", displayName: "Ann", email: "ann@example.com" });
  fake.seed("users/u2/decks/a", deck("Atraxa (Bo)"));
  fake.seed("users/u2/decks/b", deck("Old key", { deckName: "Renamed deck" }));
  fake.seed("users/u2/decks/c", deck("Hidden", { secret: true }));
  fake.seed("users/u2/decks/d", deck("L".repeat(200)));
});

it("finds a podmate's shared deck by the name its notice shows", async () => {
  expect(await findPodmateDeck("u2", "Atraxa (Bo)")).toMatchObject({
    key: "Atraxa (Bo)",
    deckName: "Atraxa (Bo)",
    list: "1 Sol Ring",
    docId: "a",
  });
  expect(await findPodmateDeck("u2", "Renamed deck")).toMatchObject({ key: "Old key" });
  expect(await findPodmateDeck("u2", "Old key")).toMatchObject({ deckName: "Renamed deck" });
  // Notice subjects are cut at 160 characters.
  expect(await findPodmateDeck("u2", "L".repeat(160))).toMatchObject({ docId: "d" });
});

it("never returns secret, missing or unreadable decks", async () => {
  expect(await findPodmateDeck("u2", "Hidden")).toBeNull();
  expect(await findPodmateDeck("u2", "Nope")).toBeNull();
  expect(await findPodmateDeck("", "Atraxa (Bo)")).toBeNull();
  vi.spyOn(fb, "getDocs").mockRejectedValueOnce(new Error("denied"));
  expect(await findPodmateDeck("u2", "Atraxa (Bo)")).toBeNull();
});
