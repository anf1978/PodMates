// Escaped purchase, price-check, sale and confirmation templates; no DOM side effects.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { PM_LIMITS as L } from "../../services/cloud/limits";
import type { TradeSale } from "../../services/cloud/types";
import { lotMetrics, sellNet, signedYen, TAGS, type Lot, type Purchase } from "./state";

const field = (
  id: string,
  label: string,
  value: string | number,
  mode = "",
  placeholder = "",
  max?: number,
) => html`
  <label class="ps-flabel" for=${id}>${label}</label
  ><input
    id=${id}
    class="ps-input trades-input"
    inputmode=${mode || nothing}
    maxlength=${max ?? nothing}
    .value=${String(value)}
    placeholder=${placeholder || nothing}
  />
`;

function footer(prefix: string, label = "Save"): TemplateResult {
  return html`<div id=${prefix + "Status"} class="status trades-status"></div>
    <div class="row trades-actions">
      <button id=${prefix + "Cancel"} class="ghost">Cancel</button
      ><button id=${prefix + "Save"}>${label}</button>
    </div>`;
}

export function purchaseView(v: Purchase, lot: Lot | undefined): TemplateResult {
  const sold = lot ? lotMetrics(lot, null).sold : 0;
  const subtitle = lot
    ? sold
      ? `${sold} already sold: you can't set "how many" below that. Sales are edited from the trade's list.`
      : "Fix anything that was entered wrongly."
    : `Record cards you bought${v.paper ? " (pretend money)" : ""}. You can record the sale later.`;
  return html`<h2 class="trades-title">
      ${lot ? "Edit trade" : v.paper ? "Paper trade" : "Add a trade"}
    </h2>
    <p class="tad-sub trades-sub">${subtitle}</p>
    <label class="ps-flabel" for="psTfCard">Card</label
    ><input
      id="psTfCard"
      class="ps-input trades-input"
      maxlength=${L.tradeCard}
      autocomplete="off"
      .value=${v.card}
      placeholder="Start typing a card name"
    />
    <div id="psTfHits"></div>
    <label class="ps-flabel"
      ><input type="checkbox" id="psTfPaper" .checked=${v.paper} /> Paper trade (pretend
      money)</label
    >
    <div class="ps-frow">
      <div>${field("psTfQty", "How many", v.qty, "numeric")}</div>
      <div>${field("psTfYen", "Price each (¥)", v.yen, "numeric", "e.g. 1200")}</div>
    </div>
    <div class="ps-frow">
      <div>${field("psTfDate", "Bought on", v.date)}</div>
      <div>${field("psTfExtra", "Extra cost (¥, total)", v.extra, "numeric")}</div>
    </div>
    <div class="ps-frow">
      <div>
        <label class="ps-flabel" for="psTfFinish">Version</label
        ><select id="psTfFinish" class="ps-input trades-input">
          ${(
            [
              ["", "Not sure / any"],
              ["nonfoil", "Non-foil"],
              ["foil", "Foil"],
              ["etched", "Etched foil"],
            ] as const
          ).map(
            ([k, label]) => html`<option value=${k} ?selected=${v.finish === k}>${label}</option>`,
          )}
        </select>
      </div>
      <div>
        ${field("psTfShop", "Shop (optional)", v.shop, "", "Hareruya, Card Rush...", L.tradeShop)}
      </div>
    </div>
    <label class="ps-flabel" for="psTfTag">Why (optional)</label
    ><select id="psTfTag" class="ps-input trades-input">
      ${(["", "riser", "spoiler", "other"] as const).map((k) => html`<option value=${k} ?selected=${v.tag === k}>${TAGS[k]}</option>`)}
    </select>
    <input
      id="psTfNote"
      class="ps-input trades-input"
      maxlength=${L.tradeNote}
      .value=${v.note}
      placeholder="Note: the thesis in a line"
    />
    ${footer("psTf")}`;
}

export function markView(lot: Lot, today: string): TemplateResult {
  return html`<h2 class="trades-title">My price check</h2>
    <p class="tad-sub trades-sub">
      ${`${lot.card}: the price you would really expect to get for one in Japan today (for example the going rate on Mercari). Leave it empty to go back to the shops-abroad estimate.`}
    </p>
    <div class="ps-frow">
      <div>${field("psMfYen", "Price each (¥)", lot.markYen ?? "", "numeric", "e.g. 1800")}</div>
      <div>${field("psMfDate", "Seen on", lot.markDate || today)}</div>
    </div>
    ${footer("psMf")}`;
}

export function saleView(
  lot: Lot,
  sale: TradeSale,
  editing: boolean,
  maxQty: number,
): TemplateResult {
  const m = lotMetrics(lot, null);
  return html`<h2 class="trades-title">${editing ? "Edit sale" : "Record a sale"}</h2>
    <p class="tad-sub trades-sub">
      ${`${lot.card}: ${maxQty} ${editing ? "available for this sale" : "left"}, bought at ¥${Math.round(m.basisPer).toLocaleString()} each (all costs in).`}
    </p>
    <div class="ps-frow">
      <div>${field("psSfQty", "How many sold", sale.qty, "numeric")}</div>
      <div>
        ${field("psSfYen", "Sale price each (¥)", Number.isNaN(sale.yen) ? "" : sale.yen, "numeric")}
      </div>
    </div>
    <div class="ps-frow">
      <div>${field("psSfDate", "Sold on", sale.date)}</div>
      <div>${field("psSfFee", "Mercari fee (%)", sale.feePct, "decimal")}</div>
    </div>
    <div class="ps-frow">
      <div>${field("psSfShip", "Shipping (¥)", sale.shipYen, "numeric")}</div>
      <div>${field("psSfPack", "Packing (¥)", sale.packYen, "numeric")}</div>
    </div>
    <div id="psSfPreview" class="ps-note"></div>
    ${footer("psSf", "Save sale")}`;
}

export function previewView(sale: TradeSale, basisPer: number): TemplateResult | typeof nothing {
  if (!(sale.qty >= 1 && sale.yen > 0 && sale.feePct >= 0)) return nothing;
  const net = sellNet(sale),
    profit = net - sale.qty * basisPer;
  return html`You would receive <b>${"¥" + Math.round(net).toLocaleString()}</b> after fees and
    shipping: a profit of <b class=${profit >= 0 ? "ps-up" : "ps-down"}>${signedYen(profit)}</b>.`;
}

export function confirmationView(message: string, label: string): TemplateResult {
  return html`<p class="trades-confirm">${message}</p>
    <div class="row trades-actions">
      <button id="actionConfirmCancelBtn" class="ghost">No</button
      ><button id="actionConfirmOkBtn">${label}</button>
    </div>`;
}
