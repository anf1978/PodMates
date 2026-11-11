// Movers tab: the biggest 7/30-day risers and fallers from movers.json.
import { html, nothing } from "../../ui/html";
import {
  dayIndex,
  fetchPriceData,
  fmtPct,
  fmtYen,
  priceMarket,
  yen,
} from "../../services/price-data";
import { errorMessage, nav, paint, psBody } from "./dom";
import { psState, type MoverRow, type Movers } from "./state";

function moverRow(r: MoverRow, day: number) {
  const fx = priceMarket.fx;
  const price = fx ? fmtYen(yen(r.now, "usdjpy", fx, day)) : "$" + (r.now / 100).toFixed(2);
  return html`<button
    type="button"
    class="ps-mover"
    data-ps-card=${r.n}
    @click=${() => void nav.openCard(r.n)}
  >
    <span class="ps-mover-name"
      >${r.n}${r.shops ? html`<small class="ps-shops">${`${r.shops} of ${r.of} shops agree`}</small>` : nothing}</span
    ><span>${price}</span><b class=${r.pct > 0 ? "ps-up" : "ps-down"}>${fmtPct(r.pct)}</b>
  </button>`;
}

export async function renderMovers(): Promise<void> {
  const body = psBody();
  if (!body) return;
  if (!priceMarket.index && !(await nav.loadIndex())) return;
  psState.rec = null;
  paint(body, html`<div class="ps-note">Loading…</div>`);
  try {
    psState.movers = psState.movers || (await fetchPriceData<Movers>("movers.json"));
  } catch (e) {
    paint(
      body,
      html`<div class="ps-note">${`Couldn't load the movers list (${errorMessage(e)}).`}</div>`,
    );
    return;
  }
  const mv = psState.movers,
    w = mv.windows[psState.moverWindow] || { up: [], down: [], considered: 0 };
  const list = psState.moverDir === "up" ? w.up : w.down;
  const day = dayIndex(mv.day);
  const chip = (attr: "mw" | "md", value: string, label: string) => {
    const on = attr === "mw" ? psState.moverWindow === value : psState.moverDir === value;
    const pick = (): void => {
      if (attr === "mw") psState.moverWindow = value;
      else psState.moverDir = value;
      void renderMovers();
    };
    return attr === "mw"
      ? html`<button type="button" data-ps-mw=${value} class=${on ? "on" : ""} @click=${pick}>
          ${label}
        </button>`
      : html`<button type="button" data-ps-md=${value} class=${on ? "on" : ""} @click=${pick}>
          ${label}
        </button>`;
  };
  const empty =
    w.considered === 0
      ? `Not enough history for a ${psState.moverWindow}-day comparison yet. Collection began ${priceMarket.index!.firstDay}.`
      : "Nothing moved in that direction.";
  const how =
    (mv.v ?? 0) >= 2
      ? "The middle price across shops (TCGplayer, Cardmarket, Card Kingdom, Manapool) for each card's cheapest non-foil printing. A card is listed only when at least two shops show the move, so one shop's thin-stock spike cannot appear. Cards over $2 only."
      : "US-market price of each card's cheapest non-foil printing, cards over $2 only. Big moves on thin trading can be noise: open a card to see its chart before acting.";
  paint(
    body,
    html` <div class="ps-range">
        ${chip("mw", "7", "7 days")}${chip("mw", "30", "30 days")}
        <span class="ps-gap"></span>${chip("md", "up", "Rising")}${chip("md", "down", "Falling")}
      </div>
      ${list.length ? list.map((r) => moverRow(r, day)) : html`<div class="ps-note">${empty}</div>`}
      <div class="ps-note ps-note-gap">
        ${how + " Open a card to see its chart before acting."}
      </div>`,
  );
}
