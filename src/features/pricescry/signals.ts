// Signals and Spoiler Bait tabs. Signals are captured daily from Scryfall (pricescry-lib.mjs, SIGNAL_FORMATS): new
// cards, reprints, bans and unbans, Game Changers changes and EDHREC rank jumps. Unlike prices they cannot be looked
// up after the fact, so they are recorded from the first day.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { dayIndex, fetchPriceData, isoFromDay, priceMarket } from "../../services/price-data";
import { cheapwatch, scoreboard } from "./boards";
import { errorMessage, errorStatus, nav, paint, psBody } from "./dom";
import { runtime } from "./runtime";
import { psState, recentSpoilers, signalsByDay, type Signal } from "./state";

const LEGAL_WORD: Record<string, string> = {
  l: "legal",
  n: "not legal",
  b: "banned",
  r: "restricted",
  s: "suspended",
};
const FORMAT_NAME: Record<string, string> = {
  commander: "Commander",
  standard: "Standard",
  pioneer: "Pioneer",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  pauper: "Pauper",
  brawl: "Brawl",
};
const CHIPS = [
  ["all", "All"],
  ["reprints", "Reprints"],
  ["bans", "Bans & legality"],
  ["newcards", "New cards"],
  ["demand", "Demand"],
];
const note = (text: string) => html`<div class="ps-note">${text}</div>`;
const word = (map: Record<string, string>, key: unknown): string =>
  map[key as string] || String(key);

/** Card picture by name: Scryfall answers with the image itself, so spoilers work before we hold a printing id. */
export function imageByName(name: string, version = "small"): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(String(name || ""))}&format=image&version=${version}`;
}

export function signalText(e: Signal): TemplateResult | string {
  const set = e.setName || e.set || "";
  switch (e.type) {
    case "new_card":
      return html`<strong>New card:</strong
        >${` ${e.n} (${set}${e.releases ? ", releases " + e.releases : ""})`}${e.preview && e.preview.s ? html` <small>${"previewed by " + e.preview.s}</small>` : nothing}`;
    case "new_printing":
      return html`<strong>Reprint:</strong
        >${` ${e.n} in ${set}${e.releases ? " (" + e.releases + ")" : ""}`}
        <small>more supply, which usually weighs on the price</small>`;
    case "legality":
      return html`<strong>${word(FORMAT_NAME, e.format) + ":"}</strong
        >${` ${e.n} went from ${word(LEGAL_WORD, e.from)} to `}<strong
          >${word(LEGAL_WORD, e.to)}</strong
        >`;
    case "game_changer":
      return html`<strong>Game Changers list:</strong>${` ${e.n} ${e.to ? "added" : "removed"}`}`;
    case "rank_jump":
      return html`<strong>Rising demand:</strong
        >${` ${e.n} EDHREC rank #${Number(e.from).toLocaleString()} to #${Number(e.to).toLocaleString()}`}`;
    default:
      return e.n;
  }
}

// A missing spoiler picture becomes a name tile; a missing signal thumbnail just disappears.
function imageFailed(event: Event): void {
  const img = event.target as HTMLImageElement;
  if (img.classList.contains("ps-sig-thumb")) {
    img.remove();
    return;
  }
  const fb = document.createElement("div");
  fb.className = "ps-spoil-fallback";
  fb.textContent = img.getAttribute("alt") || "No picture yet";
  img.replaceWith(fb);
}
const open = (n: string) => () => void nav.openCard(n);

function spoilerStrip(signals: readonly Signal[], today: number): TemplateResult {
  const items = recentSpoilers(signals, today);
  if (!items.length)
    return html`<div class="ps-spoil">
      <div class="ps-board-h">Spoilers, last 10 days</div>
      ${note("No new cards recorded in the last 10 days.")}
    </div>`;
  const shown = items.slice(0, 40);
  const tiles = shown.map(
    (e) =>
      html`<button
        type="button"
        class="ps-spoil-tile"
        data-ps-card=${e.n}
        title=${e.n}
        @click=${open(e.n)}
      >
        <img
          data-ps-img="1"
          loading="lazy"
          alt=${e.n}
          src=${imageByName(e.n, "small")}
          @error=${imageFailed}
        />
        <div class="ps-spoil-name">${e.n}</div>
        <div class="ps-spoil-meta">
          ${e.setName || e.set || ""}<br />${isoFromDay(e.day)}${e.preview && e.preview.s ? html`<br />${"via " + e.preview.s}` : nothing}
        </div>
      </button>`,
  );
  const count = `${items.length} new card${items.length === 1 ? "" : "s"}${items.length > shown.length ? ", newest " + shown.length + " shown" : ""}. Tap one for its price history.`;
  return html`<div class="ps-spoil">
    <div class="ps-board-h">
      Spoilers, last 10 days <span class="ps-note ps-note-inline">${count}</span>
    </div>
    <div class="ps-spoil-row">${tiles}</div>
  </div>`;
}

// Cached reports render synchronously, as the inline screen did: an extra await here lets the modal's focus
// trap run while "Loading…" is showing, which scrolls the screen back to the top after a filter tap.
function loadReport(
  key: "shadow" | "cheap",
  path: string,
  [title, noun, step]: [string, string, string],
  view: (rep: unknown) => unknown,
): unknown {
  const failed = (e: unknown) => {
    const why =
      errorStatus(e) === 404
        ? `Not started yet. It appears after the next daily run that includes the ${step} step.`
        : `Couldn't load the ${noun} (${errorMessage(e)}).`;
    return html`<div class="ps-board">
      <div class="ps-board-h">${title}</div>
      ${note(why)}
    </div>`;
  };
  if (psState[key]) return view(psState[key]);
  return fetchPriceData<unknown>(path).then((rep) => view((psState[key] = rep)), failed);
}

export async function renderSignals(): Promise<void> {
  const body = psBody();
  if (!body) return;
  if (!priceMarket.index && !(await nav.loadIndex())) return;
  psState.rec = null;
  paint(body, note("Loading…"));
  try {
    psState.signals = psState.signals || (await fetchPriceData<Signal[]>("signals.json.gz"));
  } catch (e) {
    paint(
      body,
      note(
        errorStatus(e) === 404
          ? "No signals recorded yet. They start appearing from the second daily run, once there is a yesterday to compare with."
          : `Couldn't load the signals (${errorMessage(e)}).`,
      ),
    );
    return;
  }
  const today = dayIndex(priceMarket.index!.day);
  const days = [...signalsByDay(psState.signals, psState.signalType, today).entries()].slice(0, 30);
  const list = days.map(
    ([d, es]) =>
      html`<div class="ps-sigday">${isoFromDay(d)}</div>
        ${es
          .slice(0, 60)
          .map(
            (e) =>
              html`<button type="button" class="ps-signal" data-ps-card=${e.n} @click=${open(e.n)}>
                ${e.type === "new_card" ? html`<img class="ps-sig-thumb" data-ps-img="1" loading="lazy" alt="" src=${imageByName(e.n, "small")} @error=${imageFailed} />` : nothing}${signalText(e)}<span
                  class="ps-clear"
                ></span>
              </button>`,
          )}${es.length > 60 ? note(`…and ${es.length - 60} more that day.`) : nothing}`,
  );
  const boardOrPending = loadReport(
    "shadow",
    "shadow-report.json",
    ["Prediction scoreboard", "scoreboard", "shadow-prediction"],
    scoreboard,
  );
  const board = boardOrPending instanceof Promise ? await boardOrPending : boardOrPending;
  const cheapOrPending = loadReport(
    "cheap",
    "cheapwatch-report.json",
    ["Cheap-pick watch", "cheap-pick watch", "cheap-pick watch"],
    cheapwatch,
  );
  const cheap = cheapOrPending instanceof Promise ? await cheapOrPending : cheapOrPending;
  const chips = CHIPS.map(
    ([k, l]) =>
      html`<button
        type="button"
        data-ps-sig=${k}
        class=${psState.signalType === k ? "on" : ""}
        @click=${() => {
          psState.signalType = k!;
          void renderSignals();
        }}
      >
        ${l}
      </button>`,
  );
  paint(
    body,
    html`${spoilerStrip(psState.signals, today)}${board}${cheap}
      <div class="ps-range">${chips}</div>
      ${list.length ? list : note("Nothing in the last 30 days for this filter.")}
      <div class="ps-note ps-note-gap">
        Recorded every day from Scryfall: new cards and reprints, bans and unbans, Game Changers
        list changes, and sharp rises in EDHREC popularity. Tap one to see the card's price history.
      </div>`,
  );
}

export async function renderBait(): Promise<void> {
  const body = psBody();
  if (!body) return;
  if (!priceMarket.index && !(await nav.loadIndex())) return;
  psState.rec = null;
  paint(body, note("Loading…"));
  try {
    psState.signals = psState.signals || (await fetchPriceData<Signal[]>("signals.json.gz"));
  } catch {
    psState.signals = [];
  }
  paint(body, html`<div id="sbHost"></div>`);
  void runtime().renderBait(body.querySelector<HTMLElement>("#sbHost")!, {
    signals: psState.signals,
    day: priceMarket.index!.day,
    onOpen: (n) => void nav.openCard(n),
  });
}
