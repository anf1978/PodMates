import { expect, it } from "vitest";
import { battleEntry } from "./state";

const battle = {
  podId: "p",
  gatheringId: "g",
  gatheringTitle: "Friday",
  participants: [{ uid: "u1", displayName: "Ann" }],
} as never;

it("records which saved deck each seat played, when it is known", () => {
  const entry = battleEntry(
    battle,
    [
      {
        commanderLabel: "Atraxa",
        uid: "u1",
        commandSpark: 5,
        style: "Midrange",
        deckRef: { uid: "u1", id: "d1" },
      },
      { commanderLabel: "Kraum", uid: "u2", commandSpark: 6, style: "Combo" },
    ],
    1000,
  );
  expect(entry.decks).toEqual([
    {
      commander: "Atraxa",
      player: "",
      uid: "u1",
      spark: "5.0",
      style: "Midrange",
      deckRef: { uid: "u1", id: "d1" },
    },
    { commander: "Kraum", player: "", uid: "u2", spark: "6.0", style: "Combo" },
  ]);
});
