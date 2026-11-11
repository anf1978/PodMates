// Temporary ports to unmoved chart state and ranked search; no cloud shim access.
import { mount, mountImpactChart } from "./index";
import type { ChartAnalysis } from "./state";
import type { ImpactPorts } from "./runtime";

declare const currentAgg: ChartAnalysis["agg"] | null;
declare const currentScores: ChartAnalysis["scores"] | null;
declare const currentCommandSpark: number;
declare const loadDeckLibrary: ImpactPorts["loadLibrary"];
declare const searchCardsByName: ImpactPorts["search"];
declare const pmInjectSearchStyles: ImpactPorts["searchStyles"];
declare const pmKeepInputInPlace: ImpactPorts["anchor"];

mount({
  analysis: () =>
    currentAgg && currentScores
      ? { agg: currentAgg, scores: currentScores, spark: currentCommandSpark }
      : null,
  loadLibrary: () => loadDeckLibrary(),
  search: (query, limit) => searchCardsByName(query, limit),
  searchStyles: () => pmInjectSearchStyles(),
  anchor: (input, change) => pmKeepInputInPlace(input, change),
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
