// Temporary ports to unmoved chart state and the page's card DB; no cloud shim access.
import { mount, mountImpactChart } from "./index";
import type { ChartAnalysis } from "./state";
import type { ImpactPorts } from "./runtime";
import { searchLoadedCards } from "../../cards/legacy-globals";

declare const currentAgg: ChartAnalysis["agg"] | null;
declare const currentScores: ChartAnalysis["scores"] | null;
declare const currentCommandSpark: number;
declare const loadDeckLibrary: ImpactPorts["loadLibrary"];

mount({
  analysis: () =>
    currentAgg && currentScores
      ? { agg: currentAgg, scores: currentScores, spark: currentCommandSpark }
      : null,
  loadLibrary: () => loadDeckLibrary(),
  search: (query, limit) => searchLoadedCards(query, limit),
});

const legacy = {
  // TODO(p3-6): the unmoved radar renderer still mounts the Impact caption.
  mountImpactChart,
};
type ImpactLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ImpactLegacy {}
}
Object.assign(window, legacy);
