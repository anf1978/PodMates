// Supplies Impact's ports: the current chart, the deck library gate and card search.
import { mount } from "../features/impact";
import { loadDeckLibrary, searchLoadedCards } from "../services/card-data";
import { currentChart } from "../services/current-chart";

mount({
  analysis: () => {
    const { agg, scores, commandSpark } = currentChart();
    return agg && scores ? { agg, scores, spark: commandSpark as number } : null;
  },
  loadLibrary: () => loadDeckLibrary(),
  search: (query, limit) => searchLoadedCards(query, limit),
});
