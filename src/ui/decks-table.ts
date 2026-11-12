// The saved-decks comparison table shared by Build Table and My Profile. Sorting is a chain, like a
// spreadsheet: tap a column to add it as the next sort level (the first tap replaces the default
// sort), tap a column already in the chain to flip its direction, Clear starts over.
import { html, nothing, render } from "./html";

export interface DecksTableColumn {
  key: string;
  label: string;
  numeric: boolean;
  pct?: boolean;
}

export const DECKS_TABLE_COLUMNS: readonly DecksTableColumn[] = [
  { key: "commander", label: "Commander", numeric: false },
  { key: "player", label: "Player", numeric: false },
  { key: "speed", label: "Speed", numeric: true },
  { key: "consistency", label: "Consistency", numeric: true },
  { key: "versatility", label: "Versatility", numeric: true },
  { key: "disruption", label: "Disruption", numeric: true },
  { key: "powerLevel", label: "Power", numeric: true },
  { key: "commandSpark", label: "Spark", numeric: true },
  { key: "pctPrecon", label: "Precon %", numeric: true, pct: true },
  { key: "pctTuned", label: "Tuned %", numeric: true, pct: true },
  { key: "pctCedh", label: "cEDH %", numeric: true, pct: true },
  { key: "bracket", label: "Bracket", numeric: false },
];

export type DecksTableRow = unknown;
type Dir = "asc" | "desc";
interface SortLevel {
  key: string;
  dir: Dir;
}
interface TableState {
  rows: readonly DecksTableRow[];
  chain: SortLevel[];
  touched: boolean;
  summary: string;
}

const defaultChain = (): SortLevel[] => [{ key: "commandSpark", dir: "desc" }];
const flip = (dir: Dir): Dir => (dir === "asc" ? "desc" : "asc");
const labelOf = (key: string) => DECKS_TABLE_COLUMNS.find((c) => c.key === key)?.label || key;
const cell = (row: DecksTableRow, key: string) => (row as Record<string, unknown>)[key];

const filled = new WeakSet<HTMLElement>();

/**
 * Shows `rows` in `area` with the default sort. `summary` names the reference set behind the
 * tier percentages. An empty list clears the area.
 */
export function showDecksTable(
  area: HTMLElement,
  rows: readonly DecksTableRow[],
  summary: string,
): void {
  // The area may hold markup from before this module drew it; start from empty once.
  if (!filled.has(area)) {
    area.replaceChildren();
    filled.add(area);
  }
  if (!rows.length) {
    render(nothing, area);
    return;
  }
  draw(area, { rows, chain: defaultChain(), touched: false, summary });
}

/** Clears a table area (also when this module never drew in it). */
export function clearDecksTable(area: HTMLElement): void {
  showDecksTable(area, [], "");
}

function sortBy(state: TableState, key: string): void {
  const at = state.chain.findIndex((c) => c.key === key);
  if (at >= 0) {
    state.chain[at]!.dir = flip(state.chain[at]!.dir);
    state.touched = true;
  } else {
    const col = DECKS_TABLE_COLUMNS.find((c) => c.key === key);
    const entry: SortLevel = { key, dir: col && col.numeric ? "desc" : "asc" };
    if (!state.touched) {
      state.chain = [entry];
      state.touched = true;
    } else state.chain.push(entry);
  }
}

function sorted(state: TableState): DecksTableRow[] {
  return [...state.rows].sort((a, b) => {
    for (const { key, dir } of state.chain) {
      const av = cell(a, key),
        bv = cell(b, key);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      if (cmp) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

function display(col: DecksTableColumn, val: unknown): string {
  if (col.pct) return val == null ? "–" : `${Number(val)}%`;
  return col.numeric ? Number(val).toFixed(1) : String(val);
}

function draw(area: HTMLElement, state: TableState): void {
  const { chain } = state;
  const redraw = () => draw(area, state);
  const header = DECKS_TABLE_COLUMNS.map((col) => {
    const at = chain.findIndex((c) => c.key === col.key);
    const arrow = at >= 0 ? (chain[at]!.dir === "asc" ? " ▲" : " ▼") : "";
    return html`<th
      class=${col.numeric ? "num" : ""}
      data-sort-key=${col.key}
      @click=${() => {
        sortBy(state, col.key);
        redraw();
      }}
    >
      ${col.label + arrow}${at >= 0 && chain.length > 1 ? html`<sup>${` ${at + 1}`}</sup>` : nothing}
    </th>`;
  });
  const body = sorted(state).map(
    (row) =>
      html`<tr>
        ${DECKS_TABLE_COLUMNS.map(
          (col) =>
            html`<td class=${col.numeric ? "num" : ""}>${display(col, cell(row, col.key))}</td>`,
        )}
      </tr>`,
  );
  const last = chain.length - 1;
  render(
    html`<div class="decks-table-chain">
        Sorted by:
        ${chain.map(
          (c, i) =>
            html`<strong>${labelOf(c.key)}</strong>${
                (c.dir === "asc" ? " ▲" : " ▼") + (i < last ? " → " : "  ")
              }`,
        )}<button
          type="button"
          class="ghost decks-table-clear"
          @click=${() => {
            state.chain = defaultChain();
            state.touched = false;
            redraw();
          }}
        >
          Clear</button
        ><span class="decks-table-hint"
          >Tap more columns to sort within ties, like a spreadsheet. Tap a sorted column again to
          flip it.</span
        >
      </div>
      <div class="decks-table-scroll">
        <table class="decks-table">
          <thead>
            <tr>
              ${header}
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
      <div class="decks-table-note">
        ${`Precon %, Tuned % and cEDH % show where each deck's Spark sits within the PodMates reference decks of that tier: the share of those decks it scores above (${state.summary}). A deck at 50% in a tier is level with that tier's middle deck.`}
      </div>`,
    area,
  );
}
