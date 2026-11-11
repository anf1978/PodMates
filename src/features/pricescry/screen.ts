// The full-screen PriceScry shell: tabs, the price index, Search and card navigation.
import { html, nothing } from "../../ui/html";
import { closeModal, openModal } from "../../ui/modal";
import { selectTab, tabsByAttribute } from "../../ui/tabs";
import { closeTryADeckModal } from "../../ui/tad-modal";
import {
  fetchPriceData,
  nameKey,
  priceMarket,
  shardPath,
  type FxData,
  type PriceIndex,
  type Shard,
} from "../../services/price-data";
import { renderCard } from "./card";
import { errorMessage, errorStatus, nav, overlay, paint, psBody } from "./dom";
import { renderMovers } from "./movers";
import { renderRadar } from "./radar";
import { runtime } from "./runtime";
import { renderBait, renderSignals } from "./signals";
import { defaultPrinting, psState, type Tab } from "./state";

const TABS: [Tab, string][] = [
  ["search", "Search"],
  ["movers", "Movers"],
  ["signals", "Signals"],
  ["bait", "Spoiler Bait"],
  ["radar", "Radar"],
  ["ledger", "Ledger"],
];

export function closePriceScry(): void {
  closeModal(overlay());
}

export function openPriceScry(): void {
  closePriceScry();
  closeTryADeckModal();
  // A full, opaque screen: only Close or Escape leaves it, never a stray click.
  const o = openModal({
    overlayClass: "ps-overlay",
    overlayId: "pricescryOverlay",
    modalClass: null,
    label: "PriceScry",
    dismissOnBackdrop: false,
    onDismiss: closePriceScry,
  }).overlay;
  paint(
    o,
    html`<div class="ps-wrap">
      <div class="ps-head">
        <div class="ps-title">PriceScry</div>
        <button class="ghost" id="psClose" @click=${closePriceScry}>Close ×</button>
      </div>
      <div id="psAsOf" class="ps-asof">Loading…</div>
      <div class="ps-tabs">
        ${TABS.map(([tab, label]) => html`<button data-ps-tab=${tab} class=${tab === "search" ? "on" : nothing} @click=${() => void setTab(tab)}>${label}</button>`)}
      </div>
      <div id="psBody"></div>
      <div class="ps-foot">
        Information only, not financial advice. Prices come from Scryfall and MTGJSON (TCGplayer,
        Cardmarket, Card Kingdom, Manapool), shown in yen at the day's exchange rate, and refresh
        once a day. History starts on the first day the data was collected, plus about 90 days
        back-filled from MTGJSON. Japanese shop prices are being added.
      </div>
    </div>`,
  );
  psState.q = "";
  psState.origin = null;
  void loadIndex().then(() => setTab("search"));
}

function highlight(tab: Tab): void {
  selectTab(
    tabsByAttribute(document.querySelectorAll("#pricescryOverlay [data-ps-tab]"), "data-ps-tab"),
    tab,
    {
      activeClass: "on",
    },
  );
}

export function setTab(tab: Tab): Promise<void> {
  psState.tab = tab;
  highlight(tab);
  if (tab === "search") return Promise.resolve(renderSearch());
  if (tab === "signals") return renderSignals();
  if (tab === "bait") return renderBait();
  if (tab === "radar") return renderRadar();
  if (tab === "ledger") {
    const body = psBody();
    if (!body) return Promise.resolve();
    psState.rec = null;
    return runtime().renderLedger(body);
  }
  return renderMovers();
}

/** Loads the day's index (and, in the background, exchange rates); false after showing why it failed. */
export async function loadIndex(): Promise<boolean> {
  const asOf = document.getElementById("psAsOf");
  try {
    const ix = (priceMarket.index = await fetchPriceData<PriceIndex>("index.json"));
    if (asOf)
      asOf.textContent = `Prices as of ${ix.day} · history since ${ix.firstDay} · ${Number(ix.cards).toLocaleString()} cards`;
    fetchPriceData<FxData>("fx.json")
      .then((f) => {
        priceMarket.fx = f;
      })
      .catch(() => {
        priceMarket.fx = null;
      });
    return true;
  } catch (e) {
    priceMarket.index = null;
    if (asOf) asOf.textContent = "";
    const body = psBody();
    if (body)
      paint(
        body,
        html`<div class="ps-note">
          ${
            errorStatus(e) === 404
              ? html`PriceScry's data hasn't been published yet. In GitHub, open the Actions tab,
                  choose <strong>PriceScry Daily Snapshot</strong> and press
                  <strong>Run workflow</strong>. After it finishes, reopen this screen.`
              : `Couldn't load the price data (${errorMessage(e)}). Check your connection and try again.`
          }
        </div>`,
      );
    return false;
  }
}

function renderSearch(): void {
  const body = psBody();
  if (!body) return;
  if (!priceMarket.index) {
    void loadIndex().then((ok) => {
      if (ok) renderSearch();
    });
    return;
  }
  if (psState.rec) {
    renderCard(backToOrigin);
    return;
  }
  paint(
    body,
    html`<input
        id="psSearch"
        class="ps-input"
        type="text"
        placeholder="Search any card…"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <div id="psResults"></div>
      <div class="ps-note ps-search-note">
        Type a card name, then pick it to see its price history. Cards are tracked from the day data
        collection began; older history isn't available from the free sources.
      </div>`,
  );
  const input = body.querySelector<HTMLInputElement>("#psSearch")!,
    results = body.querySelector<HTMLElement>("#psResults")!;
  runtime().wireSearch({
    input,
    results,
    limit: 8,
    rowAttr: "data-ps-card",
    clearOnPick: false,
    onPick: (c) => void openCard(c.n),
  });
  input.addEventListener("input", () => {
    psState.q = input.value;
  });
  // No keyboard pops up when coming back to a list.
  if (psState.q) {
    input.value = psState.q;
    input.dispatchEvent(new Event("input"));
  } else input.focus();
}

// Back from a card goes to where you were: the same tab, the same filters (kept in psState) and scroll position.
async function backToOrigin(): Promise<void> {
  const o = psState.origin || { tab: "search" as Tab, top: 0 };
  psState.rec = null;
  psState.origin = null;
  try {
    await setTab(o.tab);
  } catch {
    /* the tab shows its own message */
  }
  const ov = overlay();
  if (ov) ov.scrollTop = o.top || 0;
}

const backButton = html`<button class="ghost" id="psBack" @click=${() => void backToOrigin()}>
  ← Back
</button>`;
const noData = (name: string) =>
  html`${backButton}
    <h2 class="ps-card-title">${name}</h2>
    <div class="ps-note">
      No price data for this card yet. It may not have a paper price on Scryfall.
    </div>`;

export async function openCard(name: string): Promise<void> {
  const body = psBody();
  if (!body) return;
  if (!psState.rec) {
    const ov = overlay();
    psState.origin = { tab: psState.tab || "search", top: ov ? ov.scrollTop : 0 };
  }
  highlight(psState.origin ? psState.origin.tab : "search");
  paint(body, html`<div class="ps-note">${`Loading ${name}…`}</div>`);
  const key = nameKey(name);
  try {
    const shard = await fetchPriceData<Shard>(shardPath(key));
    const rec = shard.cards && shard.cards[key];
    if (!rec) {
      paint(body, noData(name));
      return;
    }
    psState.rec = rec;
    const start = defaultPrinting(rec);
    psState.printingId = start.id;
    psState.finish = start.finish;
    renderCard(backToOrigin);
  } catch (e) {
    // A missing shard file means no card in it has a price record yet: same as "no data", not an error.
    paint(
      body,
      errorStatus(e) === 404
        ? noData(name)
        : html`${backButton}
            <div class="ps-note">${`Couldn't load ${name} (${errorMessage(e)}).`}</div>`,
    );
  }
}

nav.setTab = (tab) => setTab(tab as Tab);
nav.openCard = openCard;
nav.loadIndex = loadIndex;
