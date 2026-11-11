// Mounted controls, repository contracts and cleanup with mocked service boundaries.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emit } from "../../services/events";
import type { SpoilerCard } from "./state";

const fake = vi.hoisted(() => ({
  user: { uid: "u1" } as { uid: string } | null,
  cards: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  board: vi.fn(),
  report: vi.fn(),
}));
vi.mock("../../services/cloud/session", () => ({ getCurrentUser: () => fake.user }));
vi.mock("../../services/cloud/spoiler-votes", () => ({
  loadSpoilerVotes: fake.load,
  setSpoilerVote: fake.save,
  clearSpoilerVote: fake.clear,
  loadPodSpoilerVotes: fake.board,
}));
vi.mock("../../services/report-error", () => ({ reportError: fake.report }));
vi.mock("./data", async (original) => ({
  ...(await original<typeof import("./data")>()),
  fetchSpoilers: fake.cards,
}));
import { connect, mount, type SpoilerBaitView } from "./index";

let view: SpoilerBaitView | undefined;
let host: HTMLElement;
const cards: SpoilerCard[] = [
  { key: "relic", n: "Relic <script>", setName: "Set", rarity: "rare", img: "/relic.png" },
  { key: "dragon", n: "Dragon", setName: "Set", rarity: "mythic", img: "/dragon.png" },
];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  fake.user = { uid: "u1" };
  fake.cards.mockResolvedValue(cards);
  fake.load.mockResolvedValue([]);
  fake.save.mockResolvedValue(undefined);
  fake.clear.mockResolvedValue(undefined);
  fake.board.mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  view?.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function click(selector: string): void {
  const element = host.querySelector<HTMLElement>(selector);
  expect(element, selector).not.toBeNull();
  element!.click();
}
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(150);
}
it("votes by keyboard/buttons, undoes, moves and unsorts while escaping names", async () => {
  view = mount(host, { podId: "pod" });
  await view.ready;
  expect(host.querySelector(".sb-name")?.textContent).toBe("Relic <script>");
  expect(host.querySelector("script")).toBeNull();
  host.querySelector("#sbTop")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  await settle();
  expect(fake.save).toHaveBeenLastCalledWith(
    { key: "relic", n: "Relic <script>", setName: "Set" },
    "like",
  );
  expect(host.querySelector(".sb-name")?.textContent).toBe("Dragon");
  click("#sbUndo");
  await settle();
  expect(fake.clear).toHaveBeenCalledWith("relic");
  expect(host.querySelector(".sb-name")?.textContent).toBe("Relic <script>");
  click("#sbPass");
  await settle();
  click('[data-sb-tab="binned"]');
  click('[data-sb-move="relic"]');
  await settle();
  click('[data-sb-tab="liked"]');
  expect(host.querySelector(".sb-tile-name")?.textContent).toBe("Relic <script>");
  click('[data-sb-reset="relic"]');
  await settle();
  click('[data-sb-tab="swipe"]');
  expect(host.querySelector(".sb-name")?.textContent).toBe("Relic <script>");
});
it("persists rarity selection and retains the hidden-card explanation on remount", async () => {
  view = mount(host);
  await view.ready;
  click('[data-sb-rar="rare"]');
  click('[data-sb-rar="mythic"]');
  expect(host.textContent).toContain("2 unsorted cards are hidden");
  view = mount(host);
  await view.ready;
  expect(host.textContent).toContain("2 unsorted cards are hidden");
  click("[data-sb-rar-all]");
  expect(host.querySelector(".sb-name")?.textContent).toBe("Relic <script>");
});
it("uses PriceScry signals and current pod events, and opens price history from Bangers", async () => {
  const disconnect = connect();
  const open = vi.fn();
  const day = Math.round((Date.parse("2026-11-11") - Date.UTC(2020, 0, 1)) / 86400000);
  try {
    emit("pods:active", "current-pod");
    view = mount(host, {
      mode: "ps",
      day: "2026-11-11",
      onOpen: open,
      signals: [{ type: "new_card", n: "Signal Relic", day, rarity: "rare" }],
    });
    await view.ready;
    expect(fake.cards).not.toHaveBeenCalled();
    expect(host.querySelector(".sb-name")?.textContent).toBe("Signal Relic");
    click("#sbLike");
    await settle();
    click('[data-sb-tab="liked"]');
    click("[data-sb-open]");
    expect(open).toHaveBeenCalledWith("Signal Relic");
    click('[data-sb-tab="board"]');
    await settle();
    expect(fake.board).toHaveBeenCalledWith("current-pod");
    expect(host.textContent).toContain("Nobody in the pod");
  } finally {
    disconnect();
  }
});
it("reports a rejected write without changing the existing optimistic-vote contract", async () => {
  const error = new Error("offline");
  fake.save.mockRejectedValueOnce(error);
  view = mount(host);
  await view.ready;
  click("#sbLike");
  await settle();
  expect(fake.report).toHaveBeenCalledWith(error, { operation: "cloud" });
  click('[data-sb-tab="liked"]');
  expect(host.querySelector(".sb-tile-name")?.textContent).toBe("Relic <script>");
});
it("retires pending loads and global drag listeners when replaced or dismissed", async () => {
  let release!: (value: SpoilerCard[]) => void;
  fake.cards.mockReturnValueOnce(
    new Promise<SpoilerCard[]>((resolve) => {
      release = resolve;
    }),
  );
  const previous = mount(host);
  view = mount(host);
  await view.ready;
  release([{ key: "stale", n: "Stale", setName: "" }]);
  await previous.ready;
  expect(host.textContent).not.toContain("Stale");
  const top = host.querySelector<HTMLElement>("#sbTop")!;
  top.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, clientX: 100, button: 0 }));
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 80 }));
  const transform = top.style.transform;
  view.destroy();
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: -100 }));
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(top.style.transform).toBe(transform);
  expect(fake.save).not.toHaveBeenCalled();
});
it("shows the sign-in gate without loading data and prevents writes after an account switch", async () => {
  fake.user = null;
  view = mount(host);
  await view.ready;
  expect(host.textContent).toContain("Sign in to your PodMates account");
  expect(fake.cards).not.toHaveBeenCalled();
  fake.user = { uid: "u1" };
  view = mount(host);
  await view.ready;
  fake.user = { uid: "u2" };
  click("#sbLike");
  expect(host.textContent).toContain("Sign in to your PodMates account");
  expect(fake.save).not.toHaveBeenCalled();
});
