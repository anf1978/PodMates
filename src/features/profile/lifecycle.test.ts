// Real profile controllers render escaped data and call repositories, never the legacy cloud shim.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEngineContext } from "../../engine";
import { buildLookupIndexes } from "../../cards/lookup";
import { configureProfile, mount, showProfileModal } from "./index";
import { emit } from "../../services/events";
import { openPlayerProfileOverlay, openPodProfileOverlay } from "./public-view";
import { updateMyDisplayName } from "../../services/cloud/profile";
import { addLinkedDeck } from "../../services/cloud/linked-decks";
import { updateMyProfileLinks } from "../../services/cloud/users";
import { loadAllDecks } from "../../services/cloud/decks";

const user = vi.hoisted(() => ({
  uid: "u",
  isAnonymous: false,
  email: "a@example.test",
  displayName: "Alex",
  providers: ["password"],
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => user,
  describeUser: () => user,
  isCloudReady: () => true,
}));
vi.mock("../../services/cloud/decks", () => ({
  loadAllDecks: vi.fn(async () => ({})),
  loadPodmateDecksRaw: vi.fn(async () => ({})),
  saveDeck: vi.fn(),
  deleteDeck: vi.fn(),
}));
vi.mock("../../services/cloud/linked-decks", () => ({
  loadLinkedDecks: vi.fn(async () => []),
  addLinkedDeck: vi.fn(),
  refreshLinkedDeck: vi.fn(),
  removeLinkedDeck: vi.fn(),
}));
vi.mock("../../services/cloud/profile", () => ({ updateMyDisplayName: vi.fn() }));
vi.mock("../../services/cloud/users", () => ({
  getMyRawUserDoc: vi.fn(async () => null),
  updateMyProfileLinks: vi.fn(),
}));
vi.mock("../../services/cloud/auth", () => ({ resetPassword: vi.fn() }));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));
vi.mock("../../ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("./public-view", () => ({
  renderPlayerProfileContent: vi.fn(),
  openPlayerProfileOverlay: vi.fn(),
  openPodProfileOverlay: vi.fn(),
}));

let modal: HTMLElement;
it("routes pod and member navigation to public profiles without legacy globals", () => {
  mount();
  const pod = {
    id: "p1",
    name: "Crew",
    leaderId: "u",
    coLeaderIds: [],
    memberIds: ["u"],
    inviteCode: "ABCDEFGH",
  };
  emit("profile:pod", pod);
  emit("profile:player", { uid: "u", name: "Alex", podId: "p1" });
  expect(openPodProfileOverlay).toHaveBeenCalledWith(pod);
  expect(openPlayerProfileOverlay).toHaveBeenCalledWith("u", "Alex", "p1");
});

beforeEach(() => {
  vi.clearAllMocks();
  modal = document.createElement("div");
  document.body.append(modal);
  configureProfile({
    open: () => modal,
    close: () => modal.remove(),
    confirm: vi.fn(),
    ready: () => false,
    context: () => createEngineContext({ cards: [], spellbook: null, winRates: [] }),
    cards: () => [],
    indexes: () => buildLookupIndexes([]),
    safeUrl: (raw) => (typeof raw === "string" && raw.startsWith("https://") ? raw : ""),
    buildTable: vi.fn(),
    displaySettings: vi.fn(),
    requireAccount: () => true,
    priceScry: vi.fn(),
    chartDeck: vi.fn(),
    podId: () => null,
  });
});
afterEach(() => {
  modal.remove();
  document.querySelectorAll(".icon-tooltip").forEach((el) => el.remove());
});
function click(id: string): void {
  modal.querySelector<HTMLElement>(`#${id}`)!.click();
}
function fill(id: string, value: string): void {
  modal.querySelector<HTMLInputElement>(`#${id}`)!.value = value;
}

it("saves display names and external links through the typed repositories", async () => {
  await showProfileModal();
  fill("profileDisplayNameInput", " New name ");
  click("profileSaveNameBtn");
  await vi.waitFor(() =>
    expect(modal.querySelector("#profileNameStatus")!.textContent).toContain("Saved"),
  );
  expect(updateMyDisplayName).toHaveBeenCalledWith("New name");
  await vi.waitFor(() => expect(modal.querySelector("#profileArchidektInput")).not.toBeNull());
  fill("profileArchidektInput", "archidekt.com/u/alex");
  fill("profileMoxfieldInput", "moxfield.com/users/alex");
  click("profileSaveLinksBtn");
  await vi.waitFor(() =>
    expect(updateMyProfileLinks).toHaveBeenCalledWith({
      archidektUrl: "archidekt.com/u/alex",
      moxfieldUrl: "moxfield.com/users/alex",
    }),
  );
});

it("shows add failures without losing the URL and restores the action button", async () => {
  vi.mocked(addLinkedDeck).mockResolvedValue({ ok: false, error: "Private deck" });
  await showProfileModal({ welcome: true });
  fill("profileDeckLinkInput", "https://moxfield.com/decks/private");
  click("profileAddDeckBtn");
  await vi.waitFor(() =>
    expect(modal.querySelector("#profileSyncStatus")!.textContent).toBe("Private deck"),
  );
  expect(modal.querySelector<HTMLInputElement>("#profileDeckLinkInput")!.value).toBe(
    "https://moxfield.com/decks/private",
  );
  expect(modal.querySelector<HTMLButtonElement>("#profileAddDeckBtn")!.disabled).toBe(false);
  expect(modal.querySelector("#profileSignInBox")).toBeNull();
  expect(modal.querySelector("#profileDeckListDetails")!.hasAttribute("open")).toBe(true);
});

it("escapes saved deck names and does not render after the dialog closes during loading", async () => {
  vi.mocked(loadAllDecks).mockResolvedValueOnce({
    "<img src=x onerror=alert(1)>": {
      list: "1 Plains",
      commander: "Commander",
      player: "Alex",
      deckName: "Deck",
      savedAt: 1,
      secret: false,
      docId: "manual",
    },
  });
  await showProfileModal({ welcome: true });
  expect(modal.querySelector(".pm-deck-name-link")!.textContent!.trim()).toBe(
    "<img src=x onerror=alert(1)>",
  );
  expect(modal.querySelector("img")).toBeNull();
  let resolve!: (decks: Awaited<ReturnType<typeof loadAllDecks>>) => void;
  vi.mocked(loadAllDecks).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = showProfileModal();
  modal.remove();
  resolve({});
  await pending;
  expect(modal.querySelector("#profileSaveNameBtn")).toBeNull();
});
