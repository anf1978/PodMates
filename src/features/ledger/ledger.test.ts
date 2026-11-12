// Ledger aggregation and asynchronous tab/account handoff, without Firebase traffic.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mount, type LedgerPorts, type LedgerView } from "./index";
import { ledgerStats, shownLots } from "./state";
import { ledgerSnapshot, type Lot } from "../../services/trade-ledger";
const mocks = vi.hoisted(() => ({
  user: { uid: "account", isAnonymous: false } as { uid: string; isAnonymous: boolean } | null,
  load: vi.fn<() => Promise<Lot[]>>(),
  report: vi.fn(),
}));
vi.mock("../../services/cloud/session", () => ({ getCurrentUser: () => mocks.user }));
vi.mock("../../services/cloud/trades", () => ({ loadTrades: mocks.load }));
vi.mock("../../services/report-error", () => ({ reportError: mocks.report }));
const lot: Lot = {
  id: "lot",
  card: "<Sol Ring>",
  key: "sol ring",
  finish: "foil",
  paper: false,
  qty: 3,
  buyYen: 1200,
  buyExtraYen: 60,
  buyDate: "2026-10-01",
  shop: "Shop",
  tag: "spoiler",
  note: "A thesis",
  sells: [{ qty: 1, yen: 1800, feePct: 10, shipYen: 230, packYen: 30, date: "2026-10-09" }],
  markYen: 1800,
  markDate: "2026-10-09",
  createdAt: 1,
  updatedAt: 2,
};
let view: LedgerView | undefined, host: HTMLElement, ports: LedgerPorts;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { uid: "account", isAnonymous: false };
  mocks.load.mockResolvedValue([lot]);
  ledgerSnapshot.lots = null;
  ledgerSnapshot.marks = {};
  host = document.createElement("div");
  document.body.append(host);
  ports = {
    currentYen: vi.fn().mockResolvedValue(1600),
    actions: {
      add: vi.fn(),
      edit: vi.fn(),
      mark: vi.fn(),
      sell: vi.fn(),
      removeSale: vi.fn(),
      removeLot: vi.fn(),
      export: vi.fn(),
    },
  };
});
afterEach(() => {
  view?.destroy();
  document.body.replaceChildren();
});
const tick = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

it("separates filters, partial sales, closed expectancy and missing marks", () => {
  const closed: Lot = { ...lot, id: "closed", paper: true, qty: 1 };
  const unknown: Lot = { ...lot, id: "unknown", sells: [], markYen: null };
  expect(shownLots([lot, closed], "real")).toEqual([lot]);
  expect(shownLots([lot, closed], "paper")).toEqual([closed]);
  const st = ledgerStats([lot, closed, unknown], { lot: 1800 });
  expect(st.totalRealized).toBe(240);
  expect(st.closedN).toBe(1);
  expect(st.winRate).toBe(1);
  expect(st.expectancyYen).toBe(100);
  expect(st.openCost).toBe(6100);
  expect(st.unrealized).toBe(540);
  expect(st.unmarked).toBe(1);
  expect(ledgerStats([]).expectancyYen).toBeNull();
});
it("renders own marks, escaped lot names and routes filter/edit/export actions", async () => {
  view = mount(host, ports);
  await view.ready;
  expect(host.querySelector("sol")).toBeNull();
  expect(host.textContent).toContain("<Sol Ring>");
  expect(host.textContent).toContain("Using your price check: ¥1,800");
  expect(ledgerSnapshot.marks.lot).toBe(1800);
  host.querySelector<HTMLButtonElement>("[data-ps-edit]")!.click();
  expect(ports.actions.edit).toHaveBeenCalledWith(lot);
  host.querySelector<HTMLButtonElement>("#psExportTrades")!.click();
  expect(ports.actions.export).toHaveBeenCalledWith([lot]);
  host.querySelector<HTMLButtonElement>('[data-ps-lf="paper"]')!.click();
  await tick();
  expect(host.querySelectorAll(".ps-lot")).toHaveLength(0);
  expect(host.textContent).toContain("None open.");
  host.querySelector<HTMLButtonElement>('[data-ps-lf="all"]')!.click();
  await tick();
});
it("does not paint or publish prices after the tab is replaced or the account changes", async () => {
  let release!: (value: number | null) => void;
  ports.currentYen = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  view = mount(host, ports);
  await tick();
  host.replaceChildren(document.createTextNode("Another tab"));
  release(1800);
  await view.ready;
  expect(host.textContent).toBe("Another tab");
  expect(ledgerSnapshot.lots).toBeNull();
  view.destroy();
  view = mount(host, ports);
  await tick();
  mocks.user = { uid: "different", isAnonymous: false };
  release(1800);
  await view.ready;
  expect(host.textContent).not.toContain("<Sol Ring>");
  expect(ledgerSnapshot.lots).toBeNull();
});
it("shows sign-in and repository failures explicitly", async () => {
  mocks.user = null;
  view = mount(host, ports);
  await view.ready;
  expect(mocks.load).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Sign in to keep a trade ledger.");
  view.destroy();
  mocks.user = { uid: "account", isAnonymous: false };
  mocks.load.mockRejectedValueOnce(new Error("offline"));
  view = mount(host, ports);
  await view.ready;
  expect(host.textContent).toContain("Couldn't load your ledger (offline).");
  expect(mocks.report).toHaveBeenCalledOnce();
});
