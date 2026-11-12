// PriceScry price logic and the lazy screen lifecycle, without network or Firebase traffic.
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emit } from "../../services/events";
import { priceMarket, type Printing, type PriceRecord } from "../../services/price-data";
import { configurePriceScry, mount, requestPriceScryAccess, type PriceScryPorts } from "./index";
import {
  buildChart,
  defaultPrinting,
  pctChange,
  psState,
  recentSpoilers,
  seriesFor,
  signalsByDay,
  type Signal,
} from "./state";

vi.mock("../../services/cloud/session", () => ({ getCurrentUser: () => null }));

const printing = (id: string, pr: Printing["pr"]): Printing => ({
  id,
  s: "s",
  sn: "Set",
  cn: "1",
  pr,
});

describe("price logic", () => {
  it("prefers back-filled MTGJSON series and falls back to Scryfall", () => {
    const p = printing("a", { u: [[1, 100]], xtrn: [[0, 90]], ef: [[1, 50]], xkbf: [[0, 5]] });
    expect(seriesFor(p, "nonfoil", "us")).toEqual([[0, 90]]);
    expect(seriesFor(p, "foil", "eu")).toEqual([[1, 50]]);
    expect(seriesFor(p, "foil", "ckBuy")).toEqual([[0, 5]]);
    expect(seriesFor(p, "etched", "eu")).toBeUndefined();
  });
  it("opens a card on its cheapest priced non-foil printing", () => {
    const rec: PriceRecord = {
      n: "X",
      p: [
        printing("dear", { u: [[0, 500]] }),
        printing("cheap", { u: [[0, 100]] }),
        printing("foil", { uf: [[0, 1]] }),
      ],
    };
    expect(defaultPrinting(rec)).toEqual({ id: "cheap", finish: "nonfoil" });
    expect(defaultPrinting({ n: "Y", p: [printing("f", { uf: [[0, 1]] })] })).toEqual({
      id: "f",
      finish: "foil",
    });
  });
  it("samples at most ~300 points and converts to yen when rates exist", () => {
    const rec: PriceRecord = {
      n: "X",
      p: [
        printing("a", {
          u: [
            [0, 100],
            [900, 200],
          ],
        }),
      ],
    };
    const fx = { pairs: { usdjpy: [[0, 1_500_000]] as [number, number][] } };
    const model = buildChart(rec, rec.p[0]!, "nonfoil", "all", 1000, fx);
    expect(model.haveFx).toBe(true);
    expect(model.lines[0]!.pts.length).toBeLessThanOrEqual(302);
    expect(model.lines[0]!.pts.at(-1)).toEqual({ day: 1000, v: 300, raw: 200 });
    const usd = buildChart(rec, rec.p[0]!, "nonfoil", "30", 1000, null);
    expect(usd.startDay).toBe(971);
    expect(usd.lines[0]!.pts[0]!.v).toBe(2);
    expect(
      pctChange(
        [
          [0, 100],
          [995, 150],
        ],
        1000,
        7,
      ),
    ).toBe(50);
    expect(pctChange([[995, 150]], 1000, 30)).toBeNull();
  });
  it("groups the last 30 days of signals and de-duplicates recent spoilers", () => {
    const signals: Signal[] = [
      { type: "new_card", n: "A", day: 100 },
      { type: "new_card", n: "A", day: 99 },
      { type: "legality", n: "B", day: 100 },
      { type: "new_printing", n: "C", day: 60 },
      { type: "new_card", n: "Old", day: 85 },
    ];
    expect([...signalsByDay(signals, "all", 100).keys()]).toEqual([100, 99, 85]);
    expect(
      signalsByDay(signals, "bans", 100)
        .get(100)!
        .map((e) => e.n),
    ).toEqual(["B"]);
    expect(recentSpoilers(signals, 100).map((e) => [e.n, e.day])).toEqual([["A", 100]]);
  });
});

describe("screen lifecycle", () => {
  const ports = {
    renderLedger: vi.fn(async (host: HTMLElement) => {
      host.textContent = "ledger";
    }),
    renderBait: vi.fn(async () => undefined),
    wireSearch: vi.fn(),
    findCard: vi.fn(() => null),
  } satisfies PriceScryPorts;
  beforeEach(() => {
    configurePriceScry(ports);
    mount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("index.json")
          ? new Response(JSON.stringify({ day: "2026-11-10", firstDay: "2026-08-01", cards: 1234 }))
          : new Response("", { status: 404 }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    document.body.replaceChildren();
    priceMarket.index = null;
  });

  it("asks for the password first and rejects a wrong one", async () => {
    await requestPriceScryAccess();
    const input = document.querySelector<HTMLInputElement>("#psPwInput")!;
    expect(input).not.toBeNull();
    expect(document.getElementById("pricescryOverlay")).toBeNull();
    input.value = "not it";
    document.querySelector<HTMLButtonElement>("#psPwGo")!.click();
    await vi.waitFor(() =>
      expect(document.getElementById("psPwStatus")!.textContent).toBe("That isn't the password."),
    );
  });

  it("opens straight away once unlocked this session and switches tabs on trade events", async () => {
    sessionStorage.setItem("pricescryUnlocked", "1");
    emit("pricescry:open", undefined);
    await vi.waitFor(() =>
      expect(document.getElementById("psAsOf")!.textContent).toBe(
        "Prices as of 2026-11-10 · history since 2026-08-01 · 1,234 cards",
      ),
    );
    await vi.waitFor(() => expect(ports.wireSearch).toHaveBeenCalled());
    expect(psState.tab).toBe("search");
    emit("pricescry:tab", "ledger");
    await vi.waitFor(() => expect(document.getElementById("psBody")!.textContent).toBe("ledger"));
    expect(document.querySelector('[data-ps-tab="ledger"]')!.classList.contains("on")).toBe(true);
    document.getElementById("psClose")!.click();
    expect(document.getElementById("pricescryOverlay")).toBeNull();
  });
});
