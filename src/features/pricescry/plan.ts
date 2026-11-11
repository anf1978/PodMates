// Trade planner on every card page. planTrade is a copy of planTrade in pipelines/pricescry/pricescry-study.mjs
// (KEEP IN SYNC; plan.test.ts compares the two). You supply the chance the card reaches the target; the planner
// turns it into a decision made BEFORE buying: the most to pay, the target, where to review and how much to risk,
// all after Mercari costs.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { toInt } from "../../services/trade-ledger";
import type { PriceRecord } from "../../services/price-data";
import { recentReprints } from "./state";

export interface PlanInput {
  priceYen: number;
  refYen: number;
  pHit: number;
  hitMult?: number;
  missReturn?: number;
  bankrollYen?: number | null;
}

export function planTrade(o: PlanInput) {
  const p = {
    hitMult: 2,
    missReturn: -0.1,
    margin: 0.1,
    stopPct: 0.3,
    days: 14,
    kellyFraction: 0.25,
    maxStakePct: 0.05,
    feePct: 10,
    shipYen: 230,
    packYen: 30,
    bankrollYen: null as number | null,
    ...o,
  };
  const E = p.priceYen,
    T = p.refYen * p.hitMult;
  // What lands in your hands from one sale, and profit as a share of what you paid.
  const netYen = (sale: number): number =>
    sale - Math.floor((sale * p.feePct) / 100) - p.shipYen - p.packYen;
  const fr = (entry: number, sale: number): number => (netYen(sale) - entry) / entry;
  const hitF = fr(E, T),
    missF = fr(E, E * (1 + p.missReturn));
  const ev = (entry: number): number =>
    p.pHit * fr(entry, T) + (1 - p.pHit) * fr(entry, entry * (1 + p.missReturn));
  // The highest price at which the expected return still clears the margin.
  let maxEntryYen: number | null = null;
  for (let k = 0; k <= 600; k++) {
    const entry = T * Math.pow(0.995, k);
    if (entry < 1) break;
    if (ev(entry) >= p.margin) {
      maxEntryYen = Math.floor(entry / 10) * 10;
      break;
    }
  }
  const breakEvenP = hitF > missF ? Math.min(1, Math.max(0, -missF / (hitF - missF))) : null;
  const evNow = ev(E);
  const verdict =
    evNow >= p.margin ? "buy" : maxEntryYen !== null && E > maxEntryYen ? "too_high" : "pass";
  let stakePct = 0;
  // No stake unless the plan says buy: a thin or negative edge gets nothing. Kelly: share of money to risk.
  if (verdict === "buy" && hitF > 0) {
    const l = Math.max(0, -missF),
      f = l > 0 ? p.pHit / l - (1 - p.pHit) / hitF : Infinity;
    stakePct = f > 0 ? Math.min(p.maxStakePct, p.kellyFraction * f) : 0;
  }
  const stakeYen = p.bankrollYen ? Math.floor(p.bankrollYen * stakePct) : null;
  return {
    entryYen: E,
    targetYen: Math.round(T),
    stopYen: Math.round(E * (1 - p.stopPct)),
    days: p.days,
    netIfHitYen: Math.round(netYen(T) - E),
    netIfMissYen: Math.round(netYen(E * (1 + p.missReturn)) - E),
    hitPct: hitF,
    missPct: missF,
    ev: evNow,
    evYen: Math.round(evNow * E),
    breakEvenP,
    maxEntryYen,
    verdict,
    stakePct,
    stakeYen,
    cards: stakeYen != null ? Math.floor(stakeYen / E) : null,
  };
}

export interface PlanFields {
  chance: string;
  mult: string;
  miss: string;
  ref: string;
  now: string;
  bank: string;
}
const note = (text: string): TemplateResult => html`<div class="ps-note">${text}</div>`;

export function planOutput(rec: PriceRecord, f: PlanFields): TemplateResult {
  const chance = Number(f.chance),
    mult = Number(f.mult),
    miss = Number(f.miss);
  const ref = toInt(f.ref),
    now = toInt(f.now),
    bank = toInt(f.bank);
  if (!(chance >= 0 && chance <= 100)) return note("Chance: a number from 0 to 100.");
  if (!(mult >= 1.1 && mult <= 20))
    return note("Target: a multiple of the pre-news price, from 1.1 to 20.");
  if (!(miss >= -90 && miss <= 50)) return note("If it misses: a percentage from -90 to 50.");
  if (!(ref > 0 && now > 0))
    return note("Enter the prices in yen (the exchange rate may not be loaded yet).");
  const pl = planTrade({
    priceYen: now,
    refYen: ref,
    pHit: chance / 100,
    hitMult: mult,
    missReturn: miss / 100,
    bankrollYen: bank > 0 ? bank : null,
  });
  const y = (v: number): string => "¥" + Math.abs(Math.round(v)).toLocaleString("en-US"),
    sg = (v: number): string => (v >= 0 ? "+" : "−") + y(v),
    pc = (v: number): string => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(0) + "%";
  const reprints = recentReprints(rec);
  const head =
    pl.verdict === "buy"
      ? html`<b class="ps-up">${`Worth buying at ${y(now)}`}</b>`
      : pl.verdict === "too_high"
        ? html`<b class="ps-down"
            >${`Not at ${y(now)}. Only if you can pay ${y(pl.maxEntryYen!)} or less.`}</b
          >`
        : html`<b class="ps-down">Pass: at this chance the costs never pay off.</b>`;
  const sets = reprints.map((e) => e.setName || e.set).join(", ");
  return html`<div class="ps-planout">
    ${
      reprints.length
        ? html`<div class="ps-warn">
            ${`Caution: this card got a new printing in the last 90 days (${sets}). More supply usually weighs on the price.`}
          </div>`
        : nothing
    }
    <div>${head}</div>
    <div class="ps-lotline">
      ${`If it hits (sells at ${y(pl.targetYen)}): `}<b class="ps-up">${sg(pl.netIfHitYen)}</b
      >${` (${pc(pl.hitPct)}) after fees and shipping.`}
    </div>
    <div class="ps-lotline">
      ${`If it misses (ends ${miss >= 0 ? "+" : "−"}${Math.abs(miss)}%): `}<b class="ps-down"
        >${sg(pl.netIfMissYen)}</b
      >${` (${pc(pl.missPct)}). Costs make a miss hurt more than the price move alone.`}
    </div>
    <div class="ps-lotline">
      Expected:
      <b class=${pl.ev >= 0 ? "ps-up" : "ps-down"}>${sg(pl.evYen)}</b
      >${` (${pc(pl.ev)}) per card. You need about `}<b
        >${pl.breakEvenP == null ? "—" : Math.round(pl.breakEvenP * 100) + "%"}</b
      >
      chance just to break even.
    </div>
    <div class="ps-lotline">
      Plan: list at <b>${y(pl.targetYen)}</b>; review if it falls to
      <b>${y(pl.stopYen)}</b>${`; sell by day ${pl.days} either way.`}
    </div>
    <div class="ps-lotline">
      ${
        pl.verdict === "buy"
          ? html`Stake: up to
              <b>${(pl.stakePct * 100).toFixed(1) + "%"}</b
              >${` of your bankroll${pl.stakeYen != null ? ` (about ${y(pl.stakeYen)}, ${pl.cards} card${pl.cards === 1 ? "" : "s"})` : ""}. Cards from the same news move together, so count them as one bet.`}`
          : "No stake: the edge is too thin."
      }
    </div>
    <div class="ps-lotline">
      <i
        >Your chance is the weak link. If you have no reason for a number, the honest figure is
        low.</i
      >
    </div>
  </div>`;
}
