// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { buildLookupIndexes } from "../../cards/lookup";
import { cardFromTuple } from "../../cards/tuple";
import { closeAllModals } from "../../ui/modal";
import { mount, type Scanner } from "./index";
import { addScannedCards, matchPhotoText, sortedNames } from "./state";

const flags = { gameChanger: false, banned: false };
const cards = [
  cardFromTuple(["Sol Ring", "Artifact", "", "{1}", "", 1, "", "u"], flags),
  cardFromTuple(["Arcane Signet", "Artifact", "", "{2}", "", 2, "", "u"], flags),
  cardFromTuple(["Greater Arcane Signet", "Artifact", "", "{3}", "", 3, "", "u"], flags),
  cardFromTuple(["Opt", "Instant", "", "{U}", "U", 1, "U", "c"], flags),
];
const indexes = buildLookupIndexes(cards);
let scanner: Scanner | undefined;

afterEach(() => {
  scanner?.destroy();
  scanner = undefined;
  closeAllModals();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("matches names inside noisy OCR text longest-first, once, excluding short names and deck cards", () => {
  const text = "rules Greater  Arcane\nSignet 2/2 Sol Ring OPT Greater Arcane Signet";
  const result = matchPhotoText(
    text,
    sortedNames(cards),
    indexes.byExactName,
    [],
    new Set(["Sol Ring"]),
  );
  expect(result.map(({ card }) => card.n)).toEqual(["Greater Arcane Signet"]);
  expect(result[0].checked).toBe(true);
  expect(
    matchPhotoText(
      "SOL RING",
      sortedNames(cards),
      indexes.byExactName,
      [{ card: cards[0], checked: false }],
      new Set(),
    ),
  ).toEqual([{ card: cards[0], checked: false }]);
});

it("applies colour filtering, distinct-card capacity and copy limits at the builder handoff", () => {
  const existing = { "Sol Ring": 99 };
  const added = addScannedCards(
    [cards[0], cards[1], cards[3]],
    existing,
    (card) => card.ci !== "U",
    { builderMaxCards: 1, builderMaxQty: 99 },
  );
  expect(added).toEqual({ cards: { "Sol Ring": 99 }, added: 1, offColour: 1, full: 1 });
  expect(existing).toEqual({ "Sol Ring": 99 });
});

function setup(readPhoto: (file: Blob) => Promise<string>) {
  const input = document.createElement("input");
  input.type = "file";
  document.body.append(input);
  scanner = mount(input, {
    cards: () => cards,
    indexes: () => indexes,
    inDeck: () => new Set(),
    returnToBuilder: () => closeAllModals(),
    add: () => ({ cards: {}, added: 0, offColour: 0, full: 0, commander: null }),
    readPhoto,
  });
  scanner.open();
  return {
    scanner,
    select(files = [new File(["photo"], "cards.png")]) {
      Object.defineProperty(input, "files", { configurable: true, value: files });
      input.dispatchEvent(new Event("change"));
    },
  };
}

it("does not let an old OCR completion update a reopened scanner", async () => {
  let release!: (text: string) => void;
  const read = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        release = resolve;
      }),
  );
  const scan = setup(read);
  scan.select();
  scan.scanner.open();
  release("Sol Ring");
  await Promise.resolve();
  expect(document.querySelector("#scanCardsResultsArea")?.textContent).toBe("");
  expect(document.querySelector("#scanCardsStatus")?.textContent).toBe("");
  expect(document.querySelector<HTMLButtonElement>("#scanCardsRescanBtn")?.disabled).toBe(false);
});

it("keeps a failed photo visible as an error even if a later photo succeeds", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const read = vi
    .fn()
    .mockRejectedValueOnce(new Error("OCR unavailable"))
    .mockResolvedValueOnce("Sol Ring");
  const scan = setup(read);
  scan.select([new File(["one"], "one.png"), new File(["two"], "two.png")]);
  await vi.waitFor(() => {
    expect(document.querySelector("#scanCardsStatus")?.textContent).toBe(
      "Could not read that photo: OCR unavailable",
    );
  });
  expect(document.querySelector("#scanCardsResultsArea")?.textContent).toContain("Sol Ring");
  expect(error).toHaveBeenCalledWith("[PodMates] card-scan failed (error).");
});
