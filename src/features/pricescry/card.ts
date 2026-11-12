// The card page: printing/finish pickers, chart, current prices, trade planner and facts.
import { html, nothing, styleMap, type TemplateResult } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { getCurrentUser } from "../../services/cloud/session";
import { emit } from "../../services/events";
import { toInt, type TradeDraft } from "../../services/trade-ledger";
import {
  dayIndex,
  fetchPriceData,
  fmtPct,
  fmtYen,
  isoFromDay,
  priceMarket,
  valueAt,
  yen,
  type Printing,
  type PriceRecord,
} from "../../services/price-data";
import { attachChart, chartView } from "./chart";
import { planOutput } from "./plan";
import { paint, psBody } from "./dom";
import { runtime } from "./runtime";
import {
  FINISH_LABEL,
  buildChart,
  pctChange,
  psState,
  seriesFor,
  type Finish,
  type Signal,
} from "./state";

// Card picture for a printing, from Scryfall's image server (the printing's id is Scryfall's own id).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function artUrl(id: string): string {
  const t = String(id || "");
  return UUID.test(t) ? `https://cards.scryfall.io/normal/front/${t[0]}/${t[1]}/${t}.jpg` : "";
}
const upDown = (v: number | null): string => (v! > 0 ? "ps-up" : v! < 0 ? "ps-down" : "");
const CHART_W = 340;
const RANGES = [
  ["30", "30d"],
  ["90", "90d"],
  ["365", "1y"],
  ["all", "All"],
] as const;

function printingOption(p: Printing, selected: boolean, endDay: number): TemplateResult {
  const sNf = seriesFor(p, "nonfoil", "us"),
    v = sNf ? valueAt(sNf, endDay) : null;
  const fx = priceMarket.fx,
    price =
      v != null
        ? " · " + (fx ? fmtYen(yen(v, "usdjpy", fx, endDay)) : "$" + (v / 100).toFixed(2))
        : "";
  const text = `${String(p.s).toUpperCase()} · ${p.sn} #${p.cn} (${String(p.r || "").slice(0, 4)})${price}`;
  return html`<option value=${p.id} ?selected=${selected}>${text}</option>`;
}

function facts(rec: PriceRecord, printing: Printing, endDay: number): TemplateResult {
  const ix = priceMarket.index!;
  const years = rec.p
    .map((p) => p.r)
    .filter((r): r is string => !!r)
    .sort();
  const latestP = [...rec.p].sort((a, b) => (a.r! < b.r! ? 1 : -1))[0];
  const daysSince =
    latestP && latestP.r
      ? Math.max(
          0,
          Math.round((new Date(ix.day).getTime() - new Date(latestP.r).getTime()) / 86400000),
        )
      : null;
  const recent =
    latestP && latestP.r
      ? `; most recent ${latestP.r} (${String(latestP.s).toUpperCase()})${daysSince != null ? `, ${daysSince} days ago` : ""}`
      : "";
  const b = seriesFor(printing, psState.finish, "ckBuy"),
    r = seriesFor(printing, psState.finish, "ck");
  const bn = b ? valueAt(b, endDay) : null,
    rn = r ? valueAt(r, endDay) : null;
  const rankFrom =
    rec.ers && rec.ers.length > 1 && rec.ers[0]![1] != null
      ? `, from #${Number(rec.ers[0]![1]).toLocaleString()} on ${isoFromDay(rec.ers[0]![0])}`
      : "";
  return html`<ul class="ps-facts">
    <li>
      ${
        rec.rs
          ? html`On the <strong>Reserved List</strong>: Wizards has said it will not reprint these
              cards in paper.`
          : "Not on the Reserved List, so reprints are possible."
      }
    </li>
    <li>
      Printed in
      <strong>${rec.p.length}</strong
      >${` printing${rec.p.length === 1 ? "" : "s"}${years.length ? `, first in ${years[0]!.slice(0, 4)}` : ""}${recent}.`}
    </li>
    ${
      rec.er
        ? html`<li>
            EDHREC popularity rank:
            <strong>${"#" + Number(rec.er).toLocaleString()}</strong>${rankFrom + "."}
          </li>`
        : nothing
    }
    ${
      bn && rn
        ? html`<li>
            Card Kingdom (US) pays about <strong>${Math.round((bn / rn) * 100) + "%"}</strong> of
            its own selling price when it buys, a floor for resale value and a gauge of demand.
          </li>`
        : nothing
    }
    <li>
      ${`History for this card began ${ix.firstDay}. Older history isn't available from Scryfall.`}
    </li>
  </ul>`;
}

function planFields() {
  const v = (id: string): string => (document.getElementById(id) as HTMLInputElement).value;
  return {
    chance: v("psPlChance"),
    mult: v("psPlMult"),
    miss: v("psPlMiss"),
    ref: v("psPlRef"),
    now: v("psPlNow"),
    bank: v("psPlBank"),
  };
}
function signedIn(): boolean {
  const user = getCurrentUser();
  if (!user || user.isAnonymous) {
    showToast("Sign in to keep a trade ledger.");
    return false;
  }
  return true;
}
const buy = (draft: TradeDraft): void => {
  if (signedIn()) emit("trades:purchase", draft);
};

export function renderCard(back: () => void): void {
  const body = psBody(),
    rec = psState.rec;
  if (!body || !rec) return;
  const ix = priceMarket.index!,
    endDay = dayIndex(ix.day),
    fx = priceMarket.fx;
  const printing = rec.p.find((p) => p.id === psState.printingId) || rec.p[0]!;
  const finishes = (["nonfoil", "foil", "etched"] as Finish[]).filter(
    (f) => seriesFor(printing, f, "us") || seriesFor(printing, f, "eu"),
  );
  if (!finishes.includes(psState.finish)) psState.finish = finishes[0] || "nonfoil";
  const model = buildChart(rec, printing, psState.finish, psState.range, endDay, fx);
  const usSeries = seriesFor(printing, psState.finish, "us") || [];
  const nowUsd = valueAt(usSeries, endDay),
    nowJpy = yen(nowUsd, "usdjpy", fx, endDay);
  const euSeries = seriesFor(printing, psState.finish, "eu");
  const eurNow = euSeries ? valueAt(euSeries, endDay) : null,
    eurJpy = yen(eurNow, "eurjpy", fx, endDay);
  const all = model.lines.flatMap((l) =>
    l.pts.map((p) => p.v).filter((v): v is number => v != null),
  );
  const hi = all.length ? Math.max(...all) : null,
    lo = all.length ? Math.min(...all) : null;
  const cmdCard = runtime().findCard(String(rec.n).toLowerCase());
  const badges = [
    rec.rs ? "Reserved List" : "",
    rec.gc || (cmdCard && cmdCard.g) ? "Game Changer" : "",
    cmdCard && cmdCard.b ? "Banned in Commander" : "",
  ].filter(Boolean);
  const printings = [...rec.p].sort((a, b) => (a.r! < b.r! ? 1 : -1));
  const pc7 = pctChange(usSeries, endDay, 7),
    pc30 = pctChange(usSeries, endDay, 30);
  const ageDays = model.lines.length ? endDay - model.startDay + 1 : 0;
  const art = artUrl(printing.id);
  const refYen = nowJpy != null ? String(Math.round(nowJpy)) : "";
  const range = model.haveFx
    ? fmtYen(hi) + " / " + fmtYen(lo)
    : "$" + hi?.toFixed(2) + " / $" + lo?.toFixed(2);
  const usNow = nowUsd == null ? "—" : fx ? fmtYen(nowJpy) : "$" + (nowUsd / 100).toFixed(2);
  const euNow = eurNow == null ? "—" : fx ? fmtYen(eurJpy) : "€" + (eurNow / 100).toFixed(2);
  const planRefresh = (): void => {
    const o = document.getElementById("psPlOut");
    if (o) paint(o, planOutput(rec, planFields()));
  };
  const rerender = (): void => renderCard(back);

  paint(
    body,
    html` <div class="ps-card-actions">
        <button class="ghost" id="psBack" @click=${back}>← Back</button
        ><span class="ps-spacer"></span
        ><button
          class="ghost"
          id="psPaperBuy"
          @click=${() => buy({ card: rec.n, paper: true, finish: psState.finish, yen: nowJpy })}
        >
          Paper-buy this</button
        ><button
          class="ghost"
          id="psRealBuy"
          @click=${() => buy({ card: rec.n, paper: false, finish: psState.finish })}
        >
          I bought this
        </button>
      </div>
      <h2 class="ps-card-title">${rec.n}</h2>
      <div class="ps-badges">${badges.map((b) => html`<span class="ps-badge">${b}</span>`)}</div>
      ${
        art
          ? html`<div class="ps-art-wrap">
              <img
                class="ps-art"
                id="psArt"
                src=${art}
                alt=${`${rec.n}, ${String(printing.s).toUpperCase()} #${printing.cn}`}
                @error=${(e: Event) => ((e.target as HTMLElement).parentElement!.style.display = "none")}
              />
              <div class="ps-note ps-art-note">
                Card image: Scryfall. The picture follows the printing you pick below.
              </div>
            </div>`
          : nothing
      }
      <div class="ps-controls">
        <select
          id="psPrinting"
          aria-label="Printing"
          @change=${(e: Event) => {
            psState.printingId = (e.target as HTMLSelectElement).value;
            rerender();
          }}
        >
          ${printings.map((p) => printingOption(p, p.id === printing.id, endDay))}
        </select>
        <select
          id="psFinish"
          aria-label="Finish"
          @change=${(e: Event) => {
            psState.finish = (e.target as HTMLSelectElement).value as Finish;
            rerender();
          }}
        >
          ${finishes.map((f) => html`<option value=${f} ?selected=${f === psState.finish}>${FINISH_LABEL[f]}</option>`)}
        </select>
      </div>
      ${
        model.lines.length
          ? html`<div class="ps-range">
                ${RANGES.map(
                  ([v, l]) =>
                    html`<button
                      type="button"
                      data-ps-range=${v}
                      class=${psState.range === v ? "on" : ""}
                      @click=${() => {
                        psState.range = v;
                        rerender();
                      }}
                    >
                      ${l}
                    </button>`,
                )}
              </div>
              ${chartView(model, CHART_W, 190)}
              <div id="psReadout" class="ps-readout"></div>
              <div class="ps-legend">
                ${model.lines.map((l) => html`<span><i style=${styleMap({ background: l.color })}></i>${l.label}</span>`)}
              </div>
              ${model.haveFx ? nothing : html`<div class="ps-note">Yen exchange rates aren't available yet, so prices are shown in dollars.</div>`}`
          : html`<div class="ps-note">No price history for this printing and finish yet.</div>`
      }
      <div class="ps-stats">
        <div class="ps-stat">
          <small>US market now</small
          ><b>${usNow}</b
          >${nowUsd != null && fx ? html`<span>${"$" + (nowUsd / 100).toFixed(2)}</span>` : nothing}
        </div>
        <div class="ps-stat">
          <small>EU market now</small
          ><b>${euNow}</b
          >${eurNow != null && fx ? html`<span>${"€" + (eurNow / 100).toFixed(2)}</span>` : nothing}
        </div>
        <div class="ps-stat">
          <small>7-day / 30-day</small
          ><b
            ><span class=${upDown(pc7)}>${fmtPct(pc7)}</span> ·
            <span class=${upDown(pc30)}>${fmtPct(pc30)}</span></b
          ><span>${ageDays < 8 ? "needs more history" : "US market"}</span>
        </div>
        <div class="ps-stat">
          <small>High / low in range</small><b>${hi == null ? "—" : range}</b>
        </div>
      </div>
      <details class="ps-plan" id="psPlan" @toggle=${planRefresh} @input=${planRefresh}>
        <summary>Plan a trade (buy limit, target, exit, stake)</summary>
        <div class="ps-frow">
          <div>
            <label class="ps-flabel">Chance it reaches the target (%)</label
            ><input id="psPlChance" class="ps-input" inputmode="decimal" value="33" />
          </div>
          <div>
            <label class="ps-flabel">Target (× pre-news price)</label
            ><input id="psPlMult" class="ps-input" inputmode="decimal" value="2" />
          </div>
        </div>
        <div class="ps-frow">
          <div>
            <label class="ps-flabel">If it misses, ends about (%)</label
            ><input id="psPlMiss" class="ps-input" inputmode="decimal" value="-10" />
          </div>
          <div>
            <label class="ps-flabel">Price before the news (¥)</label
            ><input id="psPlRef" class="ps-input" inputmode="numeric" value=${refYen} />
          </div>
        </div>
        <div class="ps-frow">
          <div>
            <label class="ps-flabel">Price you would pay now (¥)</label
            ><input id="psPlNow" class="ps-input" inputmode="numeric" value=${refYen} />
          </div>
          <div>
            <label class="ps-flabel">Your bankroll (¥, optional)</label
            ><input id="psPlBank" class="ps-input" inputmode="numeric" value="" />
          </div>
        </div>
        <div id="psPlOut"></div>
        <button
          type="button"
          class="ghost ps-plan-paper"
          id="psPlPaper"
          @click=${() => {
            const y = toInt(planFields().now);
            buy({
              card: rec.n,
              paper: true,
              finish: psState.finish,
              yen: y > 0 ? y : nowJpy,
              tag: "other",
            });
          }}
        >
          Paper-buy at this price
        </button>
      </details>
      ${facts(rec, printing, endDay)}`,
  );
  planRefresh();
  if (!psState.signals)
    fetchPriceData<Signal[]>("signals.json.gz")
      .then((sg) => {
        psState.signals = sg;
        planRefresh();
      })
      .catch(() => {
        /* signals only exist from the second daily run; the planner works without them */
      });
  attachChart(body, model, CHART_W);
}
