// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeAllModals } from "../../ui/modal";
import {
  chartedDeck,
  fillDeckForm,
  setChartedDeck,
  setSampleInForm,
} from "../../services/deck-form";
import { mount } from "./index";

vi.mock("../../services/cloud/linked-decks", () => ({ fetchDeckByLink: vi.fn() }));

const list = () => document.querySelector<HTMLTextAreaElement>("#decklistInput")!;
const clear = () => document.getElementById("clearBtn")!.click();
const dialog = () => document.getElementById("tadOverlay");

beforeEach(() => {
  document.body.innerHTML = `
    <textarea id="decklistInput"></textarea>
    <input id="commanderInput" /><input id="playerInput" /><input id="deckNameInput" />
    <button id="clearBtn"></button>
    <div id="deckLinkSyncOption"></div><div id="status"></div><div id="deckMgmtStatus"></div>
    <div id="notFoundBox"></div><div id="resultsSection"></div>`;
  fillDeckForm({ decklist: "" });
  mount();
});
afterEach(() => closeAllModals());

describe("Clear", () => {
  it("clears an empty form, a saved deck or an untouched precon at once", () => {
    clear();
    expect(dialog()).toBeNull();
    fillDeckForm({ decklist: "1 Sol Ring" });
    setChartedDeck({ uid: "u", id: "d", name: "Saved" });
    clear();
    expect(dialog()).toBeNull();
    expect(list().value).toBe("");
    fillDeckForm({ decklist: "1 Sol Ring" });
    setSampleInForm(true);
    clear();
    expect(dialog()).toBeNull();
    expect(list().value).toBe("");
  });

  it("asks before throwing away an unsaved deck, and Keep it keeps it", () => {
    fillDeckForm({ decklist: "1 Sol Ring", commander: "Atraxa" });
    clear();
    expect(dialog()?.textContent).toContain("This deck hasn't been saved. Clear it anyway?");
    document.getElementById("actionConfirmCancelBtn")!.click();
    expect(dialog()).toBeNull();
    expect(list().value).toBe("1 Sol Ring");
    clear();
    document.getElementById("actionConfirmOkBtn")!.click();
    expect(list().value).toBe("");
    expect(chartedDeck()).toBeNull();
  });

  it("treats an edited saved deck or precon as unsaved", () => {
    fillDeckForm({ decklist: "1 Sol Ring" });
    setChartedDeck({ uid: "u", id: "d", name: "Saved" });
    list().value = "1 Sol Ring\n1 Opt";
    list().dispatchEvent(new Event("input"));
    clear();
    expect(dialog()).not.toBeNull();
    closeAllModals();
    fillDeckForm({ decklist: "1 Sol Ring" });
    setSampleInForm(true);
    list().dispatchEvent(new Event("input"));
    clear();
    expect(dialog()).not.toBeNull();
  });
});
