// Temporary ports to the inline deck library and the page's card DB; no cloud shim access.
import { mount } from "./index";
import type { ImpactPorts } from "./runtime";
import { searchLoadedCards } from "../../cards/legacy-globals";
import { currentChart } from "../../services/current-chart";

declare const loadDeckLibrary: ImpactPorts["loadLibrary"];

mount({
  analysis: () => {
    const { agg, scores, commandSpark } = currentChart();
    return agg && scores ? { agg, scores, spark: commandSpark as number } : null;
  },
  loadLibrary: () => loadDeckLibrary(),
  search: (query, limit) => searchLoadedCards(query, limit),
});
