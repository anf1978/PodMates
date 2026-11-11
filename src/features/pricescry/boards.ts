// The Signals tab's report boards: the prediction scoreboard (shadow-report.json, from pricescry-shadow.mjs) and the
// cheap-pick watch (cheapwatch-report.json, from pricescry-cheapwatch.mjs). Neither changes Movers or Ledger numbers.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { fmtYen } from "../../services/price-data";
import { cardLink } from "./radar";

type Row = Record<string, number | string | undefined>;
interface Report {
  status?: string;
  reason?: string;
  day?: string;
  events?: number;
  scoredEvents?: number;
}
interface ShadowReport extends Report {
  byType?: Record<string, Record<number, Row | undefined> | undefined>;
  recent?: {
    n: string;
    day?: string;
    set?: string;
    cands?: number;
    top?: { n: string; r7?: number | null }[];
  }[];
}
interface CheapwatchReport extends Report {
  targets?: string[];
  rows?: Row[];
  moving?: Row[];
  watching?: {
    n: string;
    day?: string;
    set?: string;
    src?: string;
    picks?: { n: string; from: number; now?: number | null }[];
  }[];
  hitCards?: Row[];
}

const LINK_NAMES: Record<string, string> = {
  any: "All linked cards",
  top5: "Top 5 picks only",
  named: "Card is named by the new card",
  tribal: "Creature-type links",
  mechanic: "Shared mechanics",
  enabler: "New commander fits their colours",
};
const VERDICT_WORDS: Record<string, string> = {
  "too early": "Too early to say",
  "beats ordinary cards": "Beating ordinary cards",
  "no edge": "No better than ordinary cards",
  inconclusive: "Too close to call",
};
const MOODS: Record<string, string> = {
  collecting: "ps-b-wait",
  promising: "ps-b-good",
  "not working yet": "ps-b-bad",
  inconclusive: "ps-b-wait",
};
const pct = (x: unknown): string =>
  x == null || !Number.isFinite(x as number) ? "–" : Math.round((x as number) * 100) + "%";
const upper = (set: unknown): string => (set ? " · " + String(set).toUpperCase() : "");
const isRecord = (rep: unknown): rep is object => !!rep && typeof rep === "object";
const sep = <T>(items: readonly T[], by: string, view: (item: T) => unknown) =>
  items.map((item, i) => html`${i ? by : nothing}${view(item)}`);

function header(title: string, rep: Report, status: string): TemplateResult {
  return html`<div class="ps-board-h">
      ${title} <span class=${"ps-badge " + (MOODS[status] || "ps-b-wait")}>${status}</span>
    </div>
    <div class="ps-board-r">${rep.reason || ""}</div>
    <div class="ps-board-n">
      ${`${Number(rep.events || 0).toLocaleString()} new cards logged · ${Number(rep.scoredEvents || 0).toLocaleString()} old enough to score · as of ${rep.day || ""}`}
    </div>`;
}

export function scoreboard(input: unknown): TemplateResult | typeof nothing {
  if (!isRecord(input)) return nothing;
  const rep = input as ShadowReport,
    status = String(rep.status || "collecting");
  const h = rep.byType && rep.byType.any && rep.byType.any[7] ? 7 : 3;
  const rows = Object.keys(LINK_NAMES).flatMap((t) => {
    const r = rep.byType && rep.byType[t] && rep.byType[t]![h];
    return r
      ? [
          html`<tr>
            <td>${LINK_NAMES[t]}</td>
            <td>${VERDICT_WORDS[r.verdict as string] || r.verdict}</td>
            <td>${pct(r.hit25)}</td>
            <td>${pct(r.control25)}</td>
            <td>${`${Number(r.n).toLocaleString()} cards, ${r.events} new`}</td>
          </tr>`,
        ]
      : [];
  });
  const recent = (rep.recent || []).map((e) => {
    const picks = sep(
      e.top || [],
      ", ",
      (c) =>
        html`${cardLink(c.n)}${c.r7 == null ? nothing : html` <small>${"(" + (c.r7 >= 0 ? "+" : "") + Math.round(c.r7 * 100) + "% after 7 days)"}</small>`}`,
    );
    return html`<div class="ps-board-ev">
      <strong>${e.n}</strong> <small>${(e.day || "") + upper(e.set)}</small>
      <div>${`${e.cands} cards linked${picks.length ? ". Top: " : ""}`}${picks}</div>
    </div>`;
  });
  return html`<div class="ps-board">
    ${header("Prediction scoreboard", rep, status)}
    ${
      rows.length
        ? html`<div class="ps-tablewrap">
            <table class="ps-table">
              <thead>
                <tr>
                  <th>${`Kind of link (after ${h} days)`}</th>
                  <th>Verdict</th>
                  <th>Rose 25%+</th>
                  <th>Ordinary cards</th>
                  <th>Tested</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>`
        : nothing
    }
    ${
      recent.length
        ? html`<details class="ps-board-more">
            <summary>Latest cards written down</summary>
            ${recent}
          </details>`
        : nothing
    }
    <div class="ps-note">
      How this works: when a new card appears, the tool writes down which existing cards it thinks
      could rise, with today's price. Days later it checks what they did against ordinary cards of
      the same price. Nothing on the Movers or Ledger tabs is changed by this until a kind of link
      has proved itself.
    </div>
  </div>`;
}

const CHEAP_GROUPS: Record<string, string> = {
  all: "All cheap picks",
  top5: "Top 5 per new card",
  tribal: "Creature-type links",
  mechanic: "Shared mechanics",
  enabler: "New commander fits colours",
};
const y = (v: unknown): string => (v == null ? "–" : fmtYen(v as number));

// Old cards under 150 yen that a new card might lift, scored 14/30/45/60 days later against ordinary cheap cards.
export function cheapwatch(input: unknown): TemplateResult | typeof nothing {
  if (!isRecord(input)) return nothing;
  const rep = input as CheapwatchReport,
    status = String(rep.status || "collecting");
  const targets = Array.isArray(rep.targets) ? rep.targets : [],
    target = targets[2] || targets[0];
  const rows = (Array.isArray(rep.rows) ? rep.rows : []).filter((r) => r.target === target);
  const horizons = [...new Set(rows.map((r) => r.horizon as number))].sort((a, b) => a - b),
    h = horizons.includes(30) ? 30 : horizons[0];
  const tbl = Object.keys(CHEAP_GROUPS).flatMap((g) => {
    const r = rows.find((x) => x.group === g && x.horizon === h);
    return r
      ? [
          html`<tr>
            <td>${CHEAP_GROUPS[g]}</td>
            <td>${Number(r.hits)}</td>
            <td>${Number(r.expected).toFixed(1)}</td>
            <td>${Number(r.picks).toLocaleString()}</td>
            <td>${Number(r.sets)}</td>
          </tr>`,
        ]
      : [];
  });
  // Inline markup keeps the inter-element spaces single text runs, as the inline screen rendered them.
  const moving = (rep.moving || []).slice(0, 15).map(
    // prettier-ignore
    (m) => html`<div class="ps-board-ev">${cardLink(String(m.n))} <strong>${`${y(m.from)} → ${y(m.now)}`}</strong> <small>${`(×${Number(m.ratio)})`}</small><div><small>${`linked to ${m.newCard}${upper(m.set)} · ${m.day || ""} · ${m.type || ""} link, pick #${Number(m.rank)}`}</small></div></div>`,
  );
  const watching = (rep.watching || []).map(
    (w) =>
      html`<div class="ps-board-ev">
        <strong>${w.n}</strong>
        <small
          >${`${w.day || ""}${upper(w.set)}${w.src === "pasted" ? " · pasted leak" : ""}`}</small
        >
        <div>
          ${sep(w.picks || [], " · ", (p) => html`${cardLink(p.n)} <small>${`${y(p.from)}${p.now != null && p.now !== Math.round(p.from) ? " → " + y(p.now) : ""}`}</small>`)}
        </div>
      </div>`,
  );
  const hits = (rep.hitCards || []).slice(0, 15).map(
    (c) =>
      html`<div class="ps-board-ev">
        ${cardLink(String(c.n))} <strong>${`${y(c.from)} → ${y(c.to)}`}</strong>
        <small>${`within ${Number(c.h)} days · linked to ${c.newCard}${upper(c.set)}`}</small>
      </div>`,
  );
  return html`<div class="ps-board">
    ${header("Cheap-pick watch", rep, status)}
    ${
      tbl.length
        ? html`<div class="ps-tablewrap">
            <table class="ps-table">
              <thead>
                <tr>
                  <th>${`${target || ""}, after ${h} days`}</th>
                  <th>Hits</th>
                  <th>Ordinary cheap cards would give</th>
                  <th>Picks</th>
                  <th>Releases</th>
                </tr>
              </thead>
              <tbody>
                ${tbl}
              </tbody>
            </table>
          </div>`
        : nothing
    }
    ${
      moving.length
        ? html`<details class="ps-board-more" open>
            <summary>Moving now: cheap picks up 1.5x or more since their new card appeared</summary>
            ${moving}
          </details>`
        : nothing
    }
    ${
      watching.length
        ? html`<details class="ps-board-more">
            <summary>Being watched (latest new cards and their cheap picks)</summary>
            ${watching}
          </details>`
        : nothing
    }
    ${
      hits.length
        ? html`<details class="ps-board-more">
            <summary>Picks that reached a target</summary>
            ${hits}
          </details>`
        : nothing
    }
    <div class="ps-note">
      How this works: when a new card appears, the tool writes down old cards under 150 yen that it
      might lift, with that day's price. After 14, 30, 45 and 60 days it checks whether they stayed
      at the target for three days in a row, compared with ordinary cheap cards at the same price. A
      verdict needs at least 5 releases, because cards from one set count as one event. Prices are
      shop-consensus prices, not what a buyer pays in Japan. To add a leaked card before release,
      paste it into pricescry-spoilers.txt in the repository. Information, not financial advice.
    </div>
  </div>`;
}
