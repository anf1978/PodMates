// Trade dialog lifecycle and repository actions; Ledger navigation is supplied through ports.
import "./trades.css";
import { html, render, type TemplateResult } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { saveTrade, deleteTrade } from "../../services/cloud/trades";
import type { TradeInput, TradeSale } from "../../services/cloud/types";
import { reportError } from "../../services/report-error";
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
  type TradeOptions,
} from "./state";
import { confirmationView, markView, previewView, purchaseView, saleView } from "./view";

let ports: TradesPorts;

export function mount(runtime: TradesPorts): void {
  ports = runtime;
}

const today = (): string => new Date().toISOString().slice(0, 10);
const input = (modal: HTMLElement, id: string): HTMLInputElement =>
  modal.querySelector<HTMLInputElement>(`#${id}`)!;
const value = (modal: HTMLElement, id: string): string =>
  modal.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!.value.trim();
const findLot = (id: string): Lot | undefined => ports.lots().find((l) => l.id === id);

function dialog(view: TemplateResult): HTMLElement {
  const { modal } = openTadOverlay({
    modalClass: "tad-modal trades-modal",
    modalStyle: "max-width:460px",
  });
  render(html`<button class="tad-close" id="tadCloseBtn">Close ×</button>${view}`, modal);
  modal.querySelector("#tadCloseBtn")!.addEventListener("click", closeTryADeckModal);
  return modal;
}

function status(modal: HTMLElement, prefix: string, message: string, error = true): void {
  const el = modal.querySelector<HTMLElement>(`#${prefix}Status`)!;
  el.className = error ? "status err trades-status" : "status trades-status";
  el.textContent = message;
}

function tradeInput(lot: Lot): TradeInput {
  return { ...lot, sells: (lot.sells || []).map((s) => ({ ...s })) };
}

function bindSave(
  modal: HTMLElement,
  prefix: string,
  read: () => { error: string | null; data: TradeInput; success: string },
  showSaving = true,
): void {
  modal.querySelector(`#${prefix}Cancel`)!.addEventListener("click", closeTryADeckModal);
  const button = modal.querySelector<HTMLButtonElement>(`#${prefix}Save`)!;
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const result = read();
    if (result.error) {
      status(modal, prefix, result.error);
      return;
    }
    button.disabled = true;
    if (showSaving) status(modal, prefix, "Saving…", false);
    try {
      await saveTrade(result.data);
      // A late request must not dismiss a different dialog opened in the meantime.
      if (modal.isConnected) closeTryADeckModal();
      showToast(result.success);
      ports.refresh();
    } catch (error) {
      reportError(error, { operation: "cloud" });
      button.disabled = false;
      status(
        modal,
        prefix,
        "Could not save: " + (error instanceof Error ? error.message : String(error)),
      );
    }
  });
}

export function openTradeForm(opts: TradeOptions): void {
  const lot = opts.lot,
    v = purchaseValues(opts, today());
  const sold = lot ? lotMetrics(lot, null).sold : 0;
  const modal = dialog(purchaseView(v, lot));
  modal.querySelector<HTMLSelectElement>("#psTfFinish")!.value = v.finish;
  modal.querySelector<HTMLSelectElement>("#psTfTag")!.value = v.tag;
  const card = input(modal, "psTfCard"),
    hits = modal.querySelector<HTMLElement>("#psTfHits")!;
  let chosen = v.card;
  card.addEventListener("input", () => {
    chosen = "";
  });
  ports.wireSearch({
    input: card,
    results: hits,
    limit: 5,
    rowAttr: "data-pick",
    clearOnPick: false,
    showType: false,
    onPick: async (c) => {
      chosen = c.n;
      card.value = chosen;
      hits.replaceChildren();
      const yenInput = input(modal, "psTfYen");
      if (!lot && input(modal, "psTfPaper").checked && !yenInput.value) {
        const selected = chosen;
        const yen = await ports.currentYen(selected);
        if (modal.isConnected && card.value === selected && !yenInput.value && yen != null)
          yenInput.value = String(Math.round(yen));
      }
    },
  });
  bindSave(modal, "psTf", () => {
    const values = {
      ...v,
      card: chosen || card.value.trim(),
      qty: toInt(value(modal, "psTfQty")),
      yen: toInt(value(modal, "psTfYen")),
      extra: toInt(value(modal, "psTfExtra")),
      date: value(modal, "psTfDate"),
    };
    return {
      error: purchaseError(values, sold),
      data: {
        ...(lot ? tradeInput(lot) : {}),
        card: values.card,
        key: ports.nameKey(values.card),
        finish: value(modal, "psTfFinish"),
        paper: input(modal, "psTfPaper").checked,
        qty: values.qty,
        buyYen: values.yen,
        buyExtraYen: values.extra,
        buyDate: values.date,
        shop: value(modal, "psTfShop"),
        tag: value(modal, "psTfTag"),
        note: value(modal, "psTfNote"),
        sells: lot ? (lot.sells || []).map((s) => ({ ...s })) : [],
      },
      success: lot ? "Trade updated." : "Trade saved.",
    };
  });
}

export function openMarkForm(lotId: string): void {
  const lot = findLot(lotId);
  if (!lot) return;
  const modal = dialog(markView(lot, today()));
  bindSave(
    modal,
    "psMf",
    () => {
      const raw = value(modal, "psMfYen"),
        yen = raw === "" ? null : toInt(raw);
      const date = value(modal, "psMfDate");
      return {
        error: markError(yen, date),
        data: { ...tradeInput(lot), markYen: yen, markDate: yen == null ? "" : date },
        success: yen == null ? "Price check removed." : "Price check saved.",
      };
    },
    false,
  );
}

export function openSellForm(lotId: string, editIdx?: number): void {
  const lot = findLot(lotId);
  if (!lot) return;
  const m = lotMetrics(lot, null),
    ed = editIdx != null ? lot.sells?.[editIdx] : undefined;
  const maxQty = m.openQty + (ed ? ed.qty : 0),
    mark = ports.mark(lotId);
  const sale: TradeSale = ed || {
    qty: m.openQty,
    yen: mark != null ? Math.round(mark) : NaN,
    ...COSTS,
    date: today(),
  };
  const modal = dialog(saleView(lot, sale, !!ed, maxQty));
  const read = (): TradeSale => ({
    qty: toInt(value(modal, "psSfQty")),
    yen: toInt(value(modal, "psSfYen")),
    feePct: Number(value(modal, "psSfFee")),
    shipYen: toInt(value(modal, "psSfShip")),
    packYen: toInt(value(modal, "psSfPack")),
    date: value(modal, "psSfDate"),
  });
  const preview = (): void => {
    render(previewView(read(), m.basisPer), modal.querySelector<HTMLElement>("#psSfPreview")!);
  };
  ["psSfQty", "psSfYen", "psSfFee", "psSfShip", "psSfPack"].forEach((id) =>
    input(modal, id).addEventListener("input", preview),
  );
  preview();
  bindSave(modal, "psSf", () => {
    const sale = read();
    return {
      error: saleError(sale, maxQty, (lot.sells || []).length, !!ed),
      data: tradeInput(withSale(lot, sale, ed ? editIdx : undefined)),
      success: ed ? "Sale updated." : "Sale recorded.",
    };
  });
}

function confirm(
  message: string,
  label: string,
  action: () => Promise<void>,
  success: string,
  failure: string,
): void {
  const { modal } = openTadOverlay({ modalClass: "tad-modal trades-modal" });
  render(confirmationView(message, label), modal);
  modal.querySelector("#actionConfirmCancelBtn")!.addEventListener("click", closeTryADeckModal);
  modal.querySelector("#actionConfirmOkBtn")!.addEventListener("click", async () => {
    closeTryADeckModal();
    try {
      await action();
      showToast(success);
      ports.refresh();
    } catch (error) {
      reportError(error, { operation: "cloud" });
      showToast(failure + (error instanceof Error ? error.message : String(error)));
    }
  });
}

export function confirmRemoveSale(lotId: string, idx: number): void {
  const lot = findLot(lotId),
    sale = lot?.sells?.[idx];
  if (!lot || !sale) return;
  confirm(
    `Remove the sale of ${sale.qty} × ${lot.card} on ${sale.date}? The cards go back to being open. Are you sure?`,
    "Yes, remove",
    async () => {
      await saveTrade({
        ...tradeInput(lot),
        sells: lot.sells.filter((_, i) => i !== idx).map((s) => ({ ...s })),
      });
    },
    "Sale removed.",
    "Could not save: ",
  );
}

export function confirmDeleteLot(lotId: string): void {
  const lot = findLot(lotId);
  if (!lot) return;
  confirm(
    `Delete this ${lot.paper ? "paper " : ""}trade of ${lot.qty} × ${lot.card}? It disappears from your records and stats, and this can't be undone. Are you sure?`,
    "Yes, delete",
    () => deleteTrade(lotId),
    "Trade deleted.",
    "Could not delete: ",
  );
}
