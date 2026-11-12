// Radar tab: upcoming sets, cards read from leaked pictures and spoiler chatter (radar.json, from pricescry-radar.mjs).
import { html, nothing } from "../../ui/html";
import { fetchPriceData, priceMarket } from "../../services/price-data";
import { errorMessage, errorStatus, nav, paint, psBody } from "./dom";
import { psState } from "./state";

interface Radar {
  day?: string;
  sets?: {
    name: string;
    code?: string;
    releaseDate?: string;
    cards?: number;
    newest?: { n: string }[];
  }[];
  found?: {
    n: string;
    type?: string;
    day?: string;
    url?: string;
    picks?: { n: string; t?: string; p0?: number }[];
  }[];
  reddit?: {
    posts?: {
      url: string;
      title: string;
      kind?: string;
      flair?: string;
      created: string;
      score?: number;
    }[];
    note?: string;
  };
  reading?: { note?: string };
}

export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const h = Math.max(0, Math.round((now - t) / 3600000));
  return h < 1 ? "just now" : h < 48 ? h + "h ago" : Math.round(h / 24) + "d ago";
}
// The name stays one text run: surrounding whitespace in this inline button moves the line by a fraction of a pixel.
// prettier-ignore
export const cardLink = (n: string) =>
  html`<button type="button" class="ps-link" data-ps-card=${n} @click=${() => void nav.openCard(n)}>${n}</button>`;
const join = <T>(items: readonly T[], sep: string, view: (item: T) => unknown) =>
  items.map((item, i) => html`${i ? sep : nothing}${view(item)}`);
const usd = (cents: number): string =>
  (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
const note = (text: string) => html`<div class="ps-note">${text}</div>`;

export async function renderRadar(): Promise<void> {
  const body = psBody();
  if (!body) return;
  if (!priceMarket.index && !(await nav.loadIndex())) return;
  psState.rec = null;
  paint(body, note("Loading…"));
  let rd: Radar;
  try {
    rd = (psState.radar as Radar | null) || (await fetchPriceData<Radar>("radar.json"));
    psState.radar = rd;
  } catch (e) {
    paint(
      body,
      note(
        errorStatus(e) === 404
          ? "The radar has not run yet. It appears after the next daily run that includes the radar step."
          : "Couldn't load the radar (" + errorMessage(e) + ").",
      ),
    );
    return;
  }
  const sets = (rd.sets || []).map(
    (s) =>
      html`<div class="ps-radar-set">
        <div>
          <strong>${s.name}</strong>
          <small
            >${`${String(s.code || "").toUpperCase()} · releases ${s.releaseDate || "?"} · ${Number(s.cards || 0).toLocaleString()} cards listed so far`}</small
          >
        </div>
        ${
          (s.newest || []).length
            ? html`<div class="ps-radar-new">${join(s.newest!, ", ", (c) => cardLink(c.n))}</div>`
            : note("No new previews in the last 7 days.")
        }
      </div>`,
  );
  const found = (rd.found || []).map(
    (f) =>
      html`<div class="ps-radar-found">
        <div>
          <strong>${f.n}</strong>
          <small
            >${`${f.type || ""} · ${f.day || ""}`}${f.url ? html` · <a href=${f.url} target="_blank" rel="noopener noreferrer">source</a>` : nothing}</small
          >
        </div>
        <div>
          ${
            (f.picks || []).length
              ? html`Could lift:
                ${join(f.picks!.slice(0, 8), ", ", (c) => html`${cardLink(c.n)} <small>${`${c.t || ""}${c.p0 ? ", " + usd(c.p0) : ""}`}</small>`)}`
              : html`<small>No linked cards worth $2 or more.</small>`
          }
        </div>
      </div>`,
  );
  const posts = ((rd.reddit && rd.reddit.posts) || []).slice(0, 20).map(
    (p) =>
      html`<div class="ps-radar-post">
        <a href=${p.url} target="_blank" rel="noopener noreferrer">${p.title}</a>
        <small
          >${p.kind === "leak" ? html`<span class="ps-badge ps-b-wait">leak</span> ` : nothing}${`${p.flair || ""} · ${ago(p.created)} · ${Number(p.score || 0).toLocaleString()} points`}</small
        >
      </div>`,
  );
  const rs = rd.reddit || {},
    rg = rd.reading || {};
  paint(
    body,
    html`<div class="ps-board">
      <div class="ps-board-h">Spoiler radar <small>${"as of " + (rd.day || "")}</small></div>
      <div class="ps-board-h2">Upcoming sets</div>
      ${sets.length ? sets : note("No upcoming sets are listed on Scryfall right now.")}
      <div class="ps-board-h2">Cards read from leaked pictures</div>
      ${found.length ? found : note(rg.note || "None yet.")}
      <div class="ps-board-h2">Chatter on Reddit</div>
      ${posts.length ? posts : note(rs.note || "Nothing to show.")}
      <div class="ps-note">
        Everything here is rumour until the card is on Scryfall. Cards from leaks are written into
        the prediction scoreboard too, so the tool learns whether leaks are worth acting on.
        Information only, not financial advice.
      </div>
    </div>`,
  );
}
