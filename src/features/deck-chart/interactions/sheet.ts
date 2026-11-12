// The "Cards you could add" bottom sheet, opened from the Synergy panel's button. It loads the
// community-list knowledge on first use (showing the shared info dialog meanwhile), then
// searches the whole card database for additions. Display only.

import { cardNameLink } from "../../../ui/card-name.ts";
import { html, nothing, render } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { closeModal, openModal } from "../../../ui/modal.ts";
import { closeTryADeckModal, openTadOverlay } from "../../../ui/tad-modal.ts";
import { knowBadge } from "./knowledge.ts";
import { buildInteractionSuggestions, type SuggestionResult } from "./suggestions.ts";
import type {
  InteractionData,
  IxPick,
  IxSuggestion,
  Knowledge,
  SuggestionContext,
} from "./types.ts";

/** What the sheet needs from the page. */
export interface SuggestionPorts {
  data(): InteractionData;
  /** Loads KNOW_JSON once; rejects when the dataset cannot be fetched. */
  loadKnowledge(): Promise<void>;
  knowledge(): Knowledge;
  /** The chart's bracket band key ("1-2", "3", ...) and Game Changers already in the deck. */
  bracket(): { key: string | undefined; held: number };
}

let current: SuggestionContext | null = null;

/** Called whenever the Synergy panel is drawn; null when the deck had no packages. */
export function setSuggestionContext(ctx: SuggestionContext | null): void {
  current = ctx;
}

/** Game Changer note for a suggested card. Warns when adding it would push the deck up a bracket. */
function gcNote(bracket: { key: string | undefined; held: number }): TemplateResult {
  const { key, held } = bracket;
  const warn = (txt: string) =>
    html` <span class="ix-gc-warn" title="Game Changer">${"⚠ " + txt}</span>`;
  if (key === "1-2") return warn("Game Changer: adding it lifts this deck to Bracket 3");
  if (key === "3" && held >= 3)
    return warn("Game Changer: would be your 4th, over the Bracket 3 limit of 3");
  return html` <span class="ix-gc">(Game Changer)</span>`;
}

function pickRow(c: IxPick, knowledge: Knowledge, gc: () => TemplateResult): TemplateResult {
  const badge = knowBadge(knowledge, c.n);
  const why = "– " + c.why + (c.m ? ", MV " + c.m : "");
  // prettier-ignore
  return html`<div class="ix-pick"><span aria-hidden="true" class="ix-pick-plus">+</span><span>${cardNameLink(c.n)}${badge ? html` <span class="ix-badge" title=${badge.reason}>${badge.text}</span>` : nothing}${c.g ? gc() : nothing} <span class="ix-pick-why">${why}</span></span></div>`;
}

function itemTemplate(
  it: IxSuggestion,
  ix: number,
  items: IxSuggestion[],
  inDeck: ReadonlySet<string>,
  knowledge: Knowledge,
  gc: () => TemplateResult,
): TemplateResult {
  const isCard = inDeck.has(
    String(it.title)
      .replace(/ \(commander\)$/, "")
      .toLowerCase(),
  );
  const tag = it.tag || (isCard ? "In your deck" : "Your deck’s plan");
  const sub = isCard ? "whenever " + it.sub : it.sub;
  const dimHead =
    it.dim && !items.slice(0, ix).some((x) => x.dim)
      ? html`<div class="ix-dim-head">
          <div class="ix-dim-title">New dimension</div>
          <div class="ix-dim-sub">
            Directions your deck is already leaning toward. Optional: these add a new angle rather
            than fix something.
          </div>
        </div>`
      : nothing;
  return html`${dimHead}
    <div class="ix-item">
      <div class=${it.dim ? "ix-band ix-band-dim" : "ix-band"}>
        <div class="ix-band-tag">${tag}</div>
        <div class="ix-band-title">${it.title}</div>
        <div class="ix-band-sub">${sub}</div>
      </div>
      <div class="ix-groups">
        ${it.groups.map(
          (g) =>
            html`<div class="ix-group">
              <div class="ix-group-label">${"Add: " + g.label}</div>
              ${g.list.map((c) => pickRow(c, knowledge, gc))}
            </div>`,
        )}
      </div>
    </div>`;
}

export function sheetTemplate(
  data: SuggestionResult,
  inDeck: ReadonlySet<string>,
  knowledge: Knowledge,
  bracket: { key: string | undefined; held: number },
): TemplateResult {
  const gc = () => gcNote(bracket);
  const body = data.items.length
    ? data.items.map((it, ix) => itemTemplate(it, ix, data.items, inDeck, knowledge, gc))
    : html`<div class="ix-empty">No clear additions found for this deck's main interactions.</div>`;
  return html`<div role="dialog" aria-label="Cards you could add" class="ix-sheet">
    <div class="ix-sheet-head">
      <div class="ix-sheet-title">Cards you could add</div>
      <button type="button" id="ixSugClose" class="ix-sheet-close">Close</button>
    </div>
    ${body}
    <div class="ix-sheet-foot">
      Searched from the full card list: inside your commander's colours, not banned, not already in
      the deck. Cards that rank high on community best-of lists come first (★), then cheaper cards.
      Ideas, not instructions.
    </div>
  </div>`;
}

export async function showSuggestions(ports: SuggestionPorts): Promise<void> {
  if (!current) return;
  const { overlay, modal } = openTadOverlay({ modalStyle: "max-width:460px" });
  // prettier-ignore
  render(html`<button class="tad-close" id="tadCloseBtn">Close ×</button><h2>Cards you could add</h2><p class="ix-loading">Loading...</p>`, modal);
  modal.querySelector("#tadCloseBtn")?.addEventListener("click", closeTryADeckModal);
  try {
    await ports.loadKnowledge();
  } catch (e) {
    console.error(e);
    const note = modal.querySelector("p");
    if (overlay.isConnected && note)
      note.textContent =
        "Could not load suggestions: " + (e instanceof Error ? e.message : String(e));
    return;
  }
  const ctx = current;
  if (!overlay.isConnected || !ctx) return;
  closeTryADeckModal();
  const knowledge = ports.knowledge();
  let data: SuggestionResult;
  try {
    data = buildInteractionSuggestions(ports.data(), knowledge, ctx);
  } catch {
    data = { items: [], identity: "" };
  }
  closeModal(document.getElementById("ixSugOverlay"));
  // A bottom sheet; its inner box carries the dialog role and name.
  const sheet = openModal({
    overlayClass: "ix-sheet-overlay",
    overlayId: "ixSugOverlay",
    modalClass: null,
    role: null,
  });
  const inDeck = new Set((ctx.matched || []).map((m) => String(m.card.n).toLowerCase()));
  render(sheetTemplate(data, inDeck, knowledge, ports.bracket()), sheet.overlay);
  sheet.overlay.querySelector("#ixSugClose")?.addEventListener("click", () => sheet.close());
}
