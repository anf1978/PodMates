// Public comparison mount and render lifecycle; ports bridge the remaining inline datasets.
import "./comparison.css";
import { render, nothing } from "../../ui/html";
import { balanceView } from "./balance-view";
import { miniRadar, paceView } from "./charts";
import { showDeckDetail, type DetailPorts } from "./detail";
import { tableState, type ComparisonDeck, type TableState } from "./state";
import { axisView, miniCardView, rankView, shellView, summaryView } from "./view";
export type { ComparisonDeck };

export interface ComparisonView {
  show(decks: readonly ComparisonDeck[]): { avgSpark: number; spread: number };
  destroy(): void;
}
export function mount(host: HTMLElement, ports: DetailPorts): ComparisonView {
  render(shellView(), host);
  let state: TableState | null = null,
    disposed = false;
  const area = (id: string): HTMLElement => host.querySelector<HTMLElement>(`#${id}`)!;
  function open(index: number): void {
    const snapshot = state,
      deck = snapshot?.decks[index];
    if (deck) void showDeckDetail(deck, ports, () => !disposed && state === snapshot);
  }
  return {
    show(decks) {
      state = tableState(decks);
      render(summaryView(state.decks), area("podSummaryBanner"));
      area("podSummaryBanner").hidden = false;
      render(balanceView(state), area("podBalanceArea"));
      render(rankView(state, open), area("podRankArea"));
      render(axisView(state.decks), area("podAxisArea"));
      render(paceView(state.decks), area("paceRadarArea"));
      render(
        state.decks.map((deck) => miniCardView(deck, miniRadar(deck))),
        area("podChartsArea"),
      );
      host.hidden = false;
      host.style.display = "block";
      host.scrollIntoView({ behavior: "smooth", block: "start" });
      return { avgSpark: state.avgSpark, spread: state.spread };
    },
    destroy() {
      disposed = true;
      state = null;
      render(nothing, host);
    },
  };
}
