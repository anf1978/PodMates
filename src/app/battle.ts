// The battle on the MyPods tab: the decks charted together (Pod Comparison) and, when they came
// from a Gathering, the battle context Chronicles logs against. Gatherings, Chronicles,
// Comparison and the mode switch share it here. No side effects on import.
import type { ComparisonDeck, ComparisonView } from "../features/comparison";
import type { ChronicleBattle } from "../features/chronicles/state";
import { renderMatchLog } from "../features/chronicles";

let context: ChronicleBattle | null = null;
let decks: ComparisonDeck[] | null = null;
let view: ComparisonView | null = null;

/** Set right before the results show; null whenever they have no Gathering behind them. */
export const battleContext = (): ChronicleBattle | null => context;
export function setBattleContext(value: ChronicleBattle | null): void {
  context = value;
}

/** The decks the Pod Comparison shows, or null when nothing has been compared yet. */
export const podDecks = (): ComparisonDeck[] | null => decks;
export function clearPodDecks(): void {
  decks = null;
}

/** Comparison registers its mounted view (src/app/comparison.ts). */
export function provideComparisonView(value: ComparisonView): void {
  view = value;
}

/** Shows decks in the Pod Comparison, strongest first, and refreshes the journal under it. */
export function showPodResults(results: ComparisonDeck[]): { avgSpark: number; spread: number } {
  if (!view) throw new Error("Pod Comparison is not mounted.");
  results.sort((a, b) => b.commandSpark - a.commandSpark);
  decks = results;
  const summary = view.show(decks);
  renderMatchLog();
  return summary;
}
