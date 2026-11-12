// Real form writes and immutable lot transitions, without Firebase or network traffic.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { closeTryADeckModal } from "../../ui/tad-modal";
import { cardFromTuple } from "../../cards/tuple";
import { PM_LIMITS } from "../../services/cloud/limits";
import type { TradeInput, TradeSale } from "../../services/cloud/types";
import type { TradesPorts } from "./runtime";
import {
  COSTS,
  lotMetrics,
  markError,
  purchaseError,
  purchaseValues,
  saleError,
  toInt,
  withSale,
  type Lot,
} from "./state";
import { tradesCsv } from "./csv";
import {
  mount,
  openTradeForm,
  openMarkForm,
  openSellForm,
  confirmRemoveSale,
  confirmDeleteLot,
} from "./index";

const mocks = vi.hoisted(() => ({
  save: vi.fn<(trade: TradeInput) => Promise<string>>(),
  delete: vi.fn<(id: string) => Promise<void>>(),
  report: vi.fn(),
}));
vi.mock("../../services/cloud/trades", () => ({
  saveTrade: mocks.save,
  deleteTrade: mocks.delete,
}));
vi.mock("../../services/report-error", () => ({ reportError: mocks.report }));

const sale: TradeSale = { qty: 1, yen: 1800, ...COSTS, date: "2026-10-09" };
const lot: Lot = {
  id: "lot",
  card: "Sol Ring",
  key: "sol ring",
  finish: "foil",
  paper: true,
  qty: 3,
  buyYen: 1200,
  buyExtraYen: 60,
  buyDate: "2026-10-01",
  shop: "Shop",
  tag: "spoiler",
  note: "A thesis",
  sells: [sale],
  markYen: 1800,
  markDate: "2026-10-09",
  createdAt: 1,
  updatedAt: 2,
};
let runtime: TradesPorts;
const el = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;
const click = (id: string): void => el(id).click();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue("lot");
  mocks.delete.mockResolvedValue();
  runtime = {
    lots: () => [lot],
    mark: () => 1800,
    currentYen: vi.fn().mockResolvedValue(1800),
    nameKey: (card) => card.toLowerCase(),
    refresh: vi.fn(),
    wireSearch: vi.fn(),
  };
  mount(runtime);
});
afterEach(() => {
  closeTryADeckModal();
  document.body.replaceChildren();
});

it("keeps rounded yen parsing, purchase limits and the sold-quantity floor", () => {
  const v = purchaseValues({ lot }, "2026-11-11");
  expect(toInt(" ¥1,200.6 ")).toBe(1201);
  expect(toInt("not yen")).toBeNaN();
  expect(purchaseError(v, 1)).toBeNull();
  expect(purchaseError({ ...v, qty: 1 }, 2)).toContain("already recorded as sold");
  expect(purchaseError({ ...v, yen: PM_LIMITS.tradeYenMax + 1 }, 1)).toContain("Price each");
  expect(markError(null, "ignored")).toBeNull();
  expect(markError(1800, "bad")).toContain("Date:");
});

it("retains fee rounding, extra-cost basis, sale edits and closed-position accounting", () => {
  expect(lotMetrics(lot, 1800)).toMatchObject({
    basisPer: 1220,
    sold: 1,
    openQty: 2,
    realized: 140,
    net: 2980,
    unreal: 540,
    closed: false,
  });
  const edited = withSale(lot, { ...sale, qty: 3 }, 0);
  expect(edited.sells).toEqual([{ ...sale, qty: 3 }]);
  expect(lot.sells).toEqual([sale]);
  expect(lotMetrics(edited, null)).toMatchObject({
    realized: 940,
    closed: true,
    openQty: 0,
    days: 8,
  });
  expect(saleError({ ...sale, qty: 3 }, 2, 1, false)).toBe("How many sold: 1 to 2.");
  expect(saleError(sale, 3, PM_LIMITS.tradeSells, false)).toContain("maximum number");
  expect(saleError(sale, 3, PM_LIMITS.tradeSells, true)).toBeNull();
});

it("preserves CSV column order, quoted text and partial-sale profit", () => {
  const csv = tradesCsv([{ ...lot, card: 'Card, "quoted"', note: "line one\nline two" }]);
  expect(csv).toBe(
    "card,type,version,qty,buy_price_each_yen,extra_cost_yen,bought_on,shop,reason,note,sold_qty,last_sale_on,realised_profit_yen,open_qty\n" +
      '"Card, ""quoted""",paper,foil,3,1200,60,2026-10-01,Shop,Spoiler play,"line one\nline two",1,2026-10-09,140,2\n',
  );
});

it("saves a paper purchase directly through the repository, then refreshes Ledger", async () => {
  openTradeForm({ card: "Sol Ring", paper: true, finish: "foil", yen: 1200 });
  el("psTfDate").value = "2026-10-09";
  click("psTfSave");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledOnce());
  expect(mocks.save).toHaveBeenCalledWith({
    card: "Sol Ring",
    key: "sol ring",
    finish: "foil",
    paper: true,
    qty: 1,
    buyYen: 1200,
    buyExtraYen: 0,
    buyDate: "2026-10-09",
    shop: "",
    tag: "",
    note: "",
    sells: [],
  });
  expect(document.getElementById("tadOverlay")).toBeNull();
});

it("rejects a purchase below sold quantity and preserves existing sales on edit", async () => {
  openTradeForm({ lot });
  el("psTfQty").value = "0";
  click("psTfSave");
  expect(mocks.save).not.toHaveBeenCalled();
  el("psTfQty").value = "4";
  click("psTfSave");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledOnce());
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: lot.id,
      qty: 4,
      sells: lot.sells,
      markYen: 1800,
      createdAt: 1,
    }),
  );
});

it("edits a sale in place and clears the local mark without requiring a date", async () => {
  openSellForm("lot", 0);
  el("psSfQty").value = "3";
  click("psSfSave");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sells: [{ ...sale, qty: 3 }],
    }),
  );
  openMarkForm("lot");
  el("psMfYen").value = "";
  el("psMfDate").value = "not a date";
  click("psMfSave");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledTimes(2));
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      markYen: null,
      markDate: "",
      sells: [sale],
    }),
  );
});

it("requires confirmation for removal/deletion and returns sold cards to open", async () => {
  confirmDeleteLot("lot");
  click("actionConfirmCancelBtn");
  expect(mocks.delete).not.toHaveBeenCalled();
  confirmRemoveSale("lot", 0);
  click("actionConfirmOkBtn");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ id: "lot", sells: [] }));
  confirmDeleteLot("lot");
  click("actionConfirmOkBtn");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledTimes(2));
  expect(mocks.delete).toHaveBeenCalledWith("lot");
});

it("reports write failures, preserves input and permits retry without a false refresh", async () => {
  const error = new Error("Permission denied");
  mocks.save.mockRejectedValueOnce(error);
  openTradeForm({ card: "<img src=x onerror=alert(1)>", yen: 1200 });
  expect(document.querySelector(".trades-modal img")).toBeNull();
  click("psTfSave");
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledWith(error, { operation: "cloud" }));
  expect(el("psTfStatus").textContent).toBe("Could not save: Permission denied");
  expect(el("psTfSave").disabled).toBe(false);
  expect(el("psTfCard").value).toBe("<img src=x onerror=alert(1)>");
  expect(runtime.refresh).not.toHaveBeenCalled();
  click("psTfSave");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledOnce());
});

it("does not fill a newly opened purchase from an older card-price lookup", async () => {
  let resolve!: (value: number) => void;
  runtime.currentYen = () =>
    new Promise<number>((done) => {
      resolve = done;
    });
  openTradeForm({ paper: true });
  const options = vi.mocked(runtime.wireSearch).mock.calls[0][0];
  const pending = options.onPick(
    cardFromTuple(["Sol Ring", "Artifact", "", "{1}", "", 1, "", "u"], {
      gameChanger: false,
      banned: false,
    }),
  );
  closeTryADeckModal();
  openTradeForm({ paper: true });
  resolve(1800);
  await pending;
  expect(el("psTfYen").value).toBe("");
});

it("does not dismiss a replacement dialog when a previous save finishes", async () => {
  let resolve!: (value: string) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  openTradeForm({ card: "Sol Ring", yen: 1200 });
  click("psTfSave");
  closeTryADeckModal();
  openMarkForm("lot");
  const replacement = document.getElementById("tadOverlay");
  resolve("lot");
  await vi.waitFor(() => expect(runtime.refresh).toHaveBeenCalledOnce());
  expect(document.getElementById("tadOverlay")).toBe(replacement);
});
