// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckLog } from "../../services/cloud/deck-log";
import { emit } from "../../services/events";
import { mount, type DeckLogFeature } from "./index";
import { cardLine, changeSummary, firstCharted, formatDate, winRate } from "./state";

const fake = vi.hoisted(() => ({
  user: { uid: "u1", isAnonymous: false } as { uid: string; isAnonymous: boolean } | null,
  charted: { uid: "u1", id: "d1", name: "Atraxa (Ann)" } as {
    uid: string;
    id: string;
    name: string;
  } | null,
  record: vi.fn(),
  load: vi.fn(),
  wins: vi.fn(),
  note: vi.fn(),
  report: vi.fn(),
}));
vi.mock("../../services/cloud/session", () => ({ getCurrentUser: () => fake.user }));
vi.mock("../../services/deck-form", () => ({ chartedDeck: () => fake.charted }));
vi.mock("../../services/report-error", () => ({ reportError: fake.report }));
vi.mock("../../services/cloud/deck-log", () => ({
  recordDeckChart: fake.record,
  loadDeckLog: fake.load,
  changeDeckWins: fake.wins,
  setDeckChangeNote: fake.note,
}));

const NOW = new Date(2026, 10, 14, 12).getTime();
const log = (
  extra: Partial<DeckLog["deck"]> = {},
  battles = { exact: 2, approximate: 1 },
): DeckLog => ({
  ref: { uid: "u1", id: "d1" },
  deck: {
    key: "Atraxa (Ann)",
    commander: "Atraxa",
    player: "Ann",
    list: "1 Sol Ring",
    deckName: "Atraxa (Ann)",
    savedAt: 1,
    firstSavedAt: new Date(2026, 10, 1).getTime(),
    chartCount: 4,
    podViewCount: 2,
    lastChartedAt: NOW - 2 * 3600000,
    lastChartedBy: "Bo",
    wins: 1,
    ...extra,
  },
  changes: [
    {
      id: "c1",
      at: new Date(2026, 10, 10).getTime(),
      added: ["1 Mana Crypt", "2 Island"],
      removed: ["1 <b>Bad</b> Card"],
      sparkBefore: 5.2,
      sparkAfter: 5.6,
      note: "faster",
    },
  ],
  battles,
});

let panel: HTMLElement;
let feature: DeckLogFeature;
const area = () => panel.querySelector<HTMLElement>("#deckLogArea")!;
const text = () => area().textContent?.replace(/\s+/g, " ").trim() || "";
const rows = () =>
  [...area().querySelectorAll(".dlog-row")].map((r) =>
    [...r.children].map((c) => c.textContent?.trim()),
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fake.user = { uid: "u1", isAnonymous: false };
  fake.charted = { uid: "u1", id: "d1", name: "Atraxa (Ann)" };
  fake.record.mockResolvedValue(undefined);
  fake.load.mockResolvedValue(log());
  document.body.innerHTML = `<div class="panel" id="deckLogPanel" hidden><details class="panel-collapsible">
    <summary class="panel-toggle">Deck Log</summary><div id="deckLogArea"></div></details></div>`;
  panel = document.getElementById("deckLogPanel")!;
  feature?.destroy();
  feature = mount(panel);
});

describe("panel", () => {
  it("counts the chart, then shows the owner's log under the panel header", async () => {
    await feature.refresh();
    expect(panel.hidden).toBe(false);
    expect(fake.record).toHaveBeenCalledWith({ uid: "u1", id: "d1" });
    expect(fake.load).toHaveBeenCalledWith({ uid: "u1", id: "d1" });
    expect(rows()).toEqual([
      ["First Charted", "1 Nov 2026"],
      ["Charted by you", "4"],
      ["Viewed by podmates", "2"],
      ["Last charted", "2 h ago by Bo"],
      ["Battles", "3 (1 approximate)"],
      ["Wins", "1 · 33% win rate"],
    ]);
    const entry = area().querySelector<HTMLDetailsElement>("details.dlog-change")!;
    expect(entry.open).toBe(false); // collapsed by default
    expect(entry.querySelector("summary")!.textContent).toContain("10 Nov 2026");
    expect(entry.querySelector("summary")!.textContent).toContain("+3 −1 · Spark 5.2 → 5.6");
    expect(entry.querySelectorAll(".kp-chip-have")).toHaveLength(2);
    expect(entry.querySelector(".kp-chip-miss")!.textContent).toContain("<b>Bad</b> Card");
    expect(entry.querySelector("b")).toBeNull(); // card names are text, never markup
    expect(entry.querySelector(".dlog-note")!.textContent).toBe("faster");
  });

  it("runs on every finished chart", async () => {
    emit("chart:done", undefined);
    await vi.runAllTimersAsync();
    expect(fake.record).toHaveBeenCalledOnce();
    expect(text()).toContain("Atraxa (Ann)");
  });

  it("explains itself for signed-out visitors and unsaved decks, without writing", async () => {
    fake.user = null;
    await feature.refresh();
    expect(text()).toContain("Sign in and save this deck");
    fake.user = { uid: "u1", isAnonymous: false };
    fake.charted = null;
    await feature.refresh();
    expect(text()).toContain("Deck Log follows saved decks");
    expect(fake.record).not.toHaveBeenCalled();
  });

  it("says when the deck's log can't be read", async () => {
    fake.load.mockResolvedValue(null);
    await feature.refresh();
    expect(text()).toContain("isn't available");
  });

  it("lets only the owner change wins, and never below zero", async () => {
    fake.wins.mockResolvedValue(2);
    await feature.refresh();
    area().querySelector<HTMLButtonElement>("#deckLogWinBtn")!.click();
    await vi.runAllTimersAsync();
    expect(fake.wins).toHaveBeenCalledWith({ uid: "u1", id: "d1" }, 1);
    expect(rows()[5]).toEqual(["Wins", "2 · 67% win rate"]);
    fake.load.mockResolvedValue(log({ wins: 0 }, { exact: 0, approximate: 0 }));
    await feature.refresh();
    expect(area().querySelector<HTMLButtonElement>("#deckLogUndoWinBtn")!.disabled).toBe(true);
    expect(rows()[5]).toEqual(["Wins", "0"]);
  });

  it("shows podmates the log without owner controls", async () => {
    fake.user = { uid: "u2", isAnonymous: false };
    await feature.refresh();
    expect(rows()[1]).toEqual(["Charted by its owner", "4"]);
    expect(area().querySelector("#deckLogWinBtn")).toBeNull();
    expect(area().querySelector(".dlog-note-btn")).toBeNull();
  });

  it("edits a change note", async () => {
    fake.note.mockResolvedValue(undefined);
    await feature.refresh();
    area().querySelector<HTMLButtonElement>(".dlog-note-btn")!.click();
    const form = area().querySelector<HTMLFormElement>(".dlog-note-form")!;
    expect(area().querySelector<HTMLDetailsElement>("details.dlog-change")!.open).toBe(true);
    form.querySelector<HTMLInputElement>("input")!.value = "  swapped removal  ";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.runAllTimersAsync();
    expect(fake.note).toHaveBeenCalledWith({ uid: "u1", id: "d1" }, "c1", "  swapped removal  ");
    expect(area().querySelector(".dlog-note")!.textContent).toBe("swapped removal");
    expect(area().querySelector(".dlog-note-form")).toBeNull();
  });

  it("ignores a slower, older load", async () => {
    let release!: (value: DeckLog) => void;
    fake.load.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const first = feature.refresh();
    fake.charted = { uid: "u1", id: "d2", name: "Second" };
    fake.load.mockResolvedValueOnce(log({ deckName: "Second" }));
    await feature.refresh();
    release(log({ deckName: "First" }));
    await first;
    expect(area().querySelector(".dlog-title")!.textContent).toBe("Second");
  });
});

describe("state helpers", () => {
  it("formats dates, rates, card lines and change summaries", () => {
    expect(formatDate(new Date(2026, 0, 5).getTime())).toBe("5 Jan 2026");
    expect(winRate(1, 2)).toBeNull();
    expect(winRate(2, 3)).toBe("67%");
    expect(winRate(5, 3)).toBe("100%");
    expect(cardLine("12 Relentless Rats")).toEqual({ qty: 12, name: "Relentless Rats" });
    expect(cardLine("Sol Ring")).toEqual({ qty: 1, name: "Sol Ring" });
    expect(firstCharted({})).toBe("Before Deck Logs");
    expect(
      changeSummary({ added: ["2 Island"], removed: [], sparkBefore: null, sparkAfter: 6 }),
    ).toBe("+2 −0 · Spark – → 6.0");
  });
});
