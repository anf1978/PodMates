// Ledger totals, lot rows and sale controls retain the original PriceScry DOM/classes.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { TAGS, signedYen, type Lot } from "../../services/trade-ledger";
import { FILTERS, FINISH_NAMES, pct, type Filter, type Stats } from "./state";
export interface Actions {
  filter(value: Filter): void;
  add(): void;
  edit(lot: Lot): void;
  mark(id: string): void;
  sell(id: string, index?: number): void;
  removeSale(id: string, index: number): void;
  removeLot(id: string): void;
  export(): void;
}
const color = (value: number | null): string =>
  value != null && value > 0 ? "ps-up" : value != null && value < 0 ? "ps-down" : "";
const yen = (value: number | null): string =>
  value == null ? "—" : "¥" + Math.round(value).toLocaleString();
export const note = (text: string): TemplateResult => html`<div class="ps-note">${text}</div>`;
function sales(lot: Lot, actions: Actions): TemplateResult[] {
  return (lot.sells || []).map(
    (s, i) =>
      html`<div class="ps-lotline ps-sale">
        ${`Sold ${s.qty} × ¥${Math.round(s.yen).toLocaleString()} on ${s.date}`}
        <button
          type="button"
          class="ps-mini"
          data-ps-saleedit=${`${lot.id}:${i}`}
          @click=${() => actions.sell(lot.id, i)}
        >
          Edit</button
        ><button
          type="button"
          class="ps-mini"
          data-ps-saledel=${`${lot.id}:${i}`}
          @click=${() => actions.removeSale(lot.id, i)}
        >
          Remove
        </button>
      </div>`,
  );
}
function buttons(lot: Lot, open: boolean, a: Actions): TemplateResult {
  return html`<div class="ps-lotbtns">
    ${open ? html`<button type="button" data-ps-sell=${lot.id} @click=${() => a.sell(lot.id)}>Sell</button><button type="button" class="ghost" data-ps-mark=${lot.id} @click=${() => a.mark(lot.id)}>My price</button>` : nothing}<button
      type="button"
      class="ghost"
      data-ps-edit=${lot.id}
      @click=${() => a.edit(lot)}
    >
      Edit</button
    ><button
      type="button"
      class="ghost"
      data-ps-lotdel=${lot.id}
      @click=${() => a.removeLot(lot.id)}
    >
      Delete
    </button>
  </div>`;
}
function priceNote(lot: Lot, ref: number | null | undefined): string {
  return lot.markYen != null
    ? `Using your price check: ¥${Math.round(lot.markYen).toLocaleString()} on ${lot.markDate}${ref != null ? ` (shops abroad say about ¥${Math.round(ref).toLocaleString()})` : ""}`
    : ref != null
      ? "Using the shops-abroad price converted to yen. Japanese prices can differ: add your own price check for a truer figure."
      : "No price found for this card yet. Add your own price check.";
}
function openRow(
  { lot, m }: Stats["rows"][number],
  refs: Record<string, number | null>,
  a: Actions,
): TemplateResult {
  return html`<div class="ps-lot">
    <div>
      <b>${lot.card}</b
      >${lot.paper ? html` <span class="ps-badge">paper</span>` : nothing}${lot.tag ? html` <small class="ps-tag">${TAGS[lot.tag] || ""}</small>` : nothing}
    </div>
    <div class="ps-lotline">
      ${`${m.openQty} × ¥${Math.round(m.basisPer).toLocaleString()} bought ${lot.buyDate}${lot.shop ? " at " + lot.shop : ""}${lot.finish ? " · " + FINISH_NAMES[lot.finish] : ""}`}
    </div>
    <div class="ps-lotline">
      Worth if sold today (net): <b>${yen(m.net)}</b>
      <span class=${color(m.unreal)}>${signedYen(m.unreal)}</span>
    </div>
    <div class="ps-lotline"><small>${priceNote(lot, refs[lot.id])}</small></div>
    ${lot.note ? html`<div class="ps-lotline"><i>${lot.note}</i></div>` : nothing}${sales(lot, a)}${buttons(lot, true, a)}
  </div>`;
}
function closedRow({ lot, m }: Stats["rows"][number], a: Actions): TemplateResult {
  return html`<div class="ps-lot">
    <div>
      <b>${lot.card}</b>${lot.paper ? html` <span class="ps-badge">paper</span>` : nothing}
      <span class=${m.realized > 0 ? "ps-up" : "ps-down"}>${signedYen(m.realized)}</span>
      <small>${"(" + pct(m.soldCost ? m.realized / m.soldCost : null) + ")"}</small>
    </div>
    <div class="ps-lotline">
      ${`${lot.qty} × ¥${Math.round(m.basisPer).toLocaleString()} in, held ${m.days} day${m.days === 1 ? "" : "s"}, closed ${m.lastSell}${lot.finish ? " · " + FINISH_NAMES[lot.finish] : ""}`}
    </div>
    ${lot.note ? html`<div class="ps-lotline"><i>${lot.note}</i></div>` : nothing}${sales(lot, a)}${buttons(lot, false, a)}
  </div>`;
}
function totals(st: Stats): TemplateResult {
  return html`<div class="ps-stats">
    <div class="ps-stat">
      <small>Realised profit</small
      ><b class=${color(st.totalRealized)}>${signedYen(st.totalRealized)}</b
      ><span>after fees and shipping</span>
    </div>
    <div class="ps-stat">
      <small>Win rate</small><b>${st.winRate == null ? "—" : Math.round(st.winRate * 100) + "%"}</b
      ><span
        >${st.closedN ? `${st.wins} of ${st.closedN} closed trades` : "no closed trades yet"}</span
      >
    </div>
    <div class="ps-stat">
      <small>Average win / loss</small><b>${yen(st.avgWin) + " / " + yen(st.avgLoss)}</b>
    </div>
    <div class="ps-stat">
      <small>Expectancy per trade</small
      ><b class=${color(st.expectancyYen)}>${signedYen(st.expectancyYen)}</b
      ><span>${st.expectancyPct == null ? "" : pct(st.expectancyPct) + " of money in"}</span>
    </div>
    <div class="ps-stat">
      <small>Open positions</small><b>${st.openN}</b><span>${yen(st.openCost) + " in"}</span>
    </div>
    <div class="ps-stat">
      <small>Unrealised (if sold today, after costs)</small
      ><b class=${color(st.unrealized)}>${signedYen(st.unrealized)}</b
      >${st.unmarked ? html`<span>${st.unmarked + " without a current price"}</span>` : nothing}
    </div>
  </div>`;
}
export function ledgerView(
  st: Stats,
  filter: Filter,
  refs: Record<string, number | null>,
  a: Actions,
): TemplateResult {
  const open = st.rows.filter((r) => r.m.openQty > 0),
    closed = st.rows
      .filter((r) => r.m.closed)
      .sort((a, b) => (a.m.lastSell! < b.m.lastSell! ? 1 : -1));
  const reasons = (["riser", "spoiler", "other", ""] as const).flatMap((tag) => {
    const rows = closed.filter((r) => (r.lot.tag || "") === tag);
    if (!rows.length) return [];
    const wins = rows.filter((r) => r.m.realized > 0).length,
      total = rows.reduce((sum, r) => sum + r.m.realized, 0);
    return [
      html`<div class="ps-lotline">
        <b>${TAGS[tag]}</b
        >${`: ${rows.length} closed, ${Math.round((wins / rows.length) * 100)}% won, ${signedYen(total)} in total, ${signedYen(total / rows.length)} per trade`}
      </div>`,
    ];
  });
  return html`<div class="ps-range">
      ${FILTERS.map(([key, label]) => html`<button type="button" data-ps-lf=${key} class=${filter === key ? "on" : ""} @click=${() => a.filter(key)}>${label}</button>`)}<span
        class="ledger-spacer"
      ></span
      ><button type="button" class="ghost" id="psExportTrades" @click=${a.export}>Export</button
      ><button type="button" id="psAddTrade" @click=${a.add}>+ Add trade</button>
    </div>
    ${totals(st)}${
      reasons.length
        ? html`<div class="ps-sigday">By reason</div>
            <div class="ps-lot">${reasons}</div>`
        : nothing
    }
    <div class="ps-sigday">Open positions</div>
    ${open.length ? open.map((r) => openRow(r, refs, a)) : note("None open. Add a real purchase, or a paper trade to test an idea with no money at risk.")}
    <div class="ps-sigday">Closed trades</div>
    ${closed.length ? closed.map((r) => closedRow(r, a)) : note("None yet.")}
    <div class="ps-note ledger-cost-note">
      Profit is counted after Mercari's 10% fee, ¥230 shipping and ¥30 packing per sale (editable
      when you record a sale), plus any extra cost of buying. Open positions are valued at what they
      would net if sold today. Paper trades use pretend money.
    </div>`;
}
