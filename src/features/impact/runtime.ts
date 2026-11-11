// Ports for the current chart, the deck library and the shared ranked card search (src/app/impact.ts).
import type { CardRecord } from "../../cards/tuple";
import type { ChartAnalysis } from "./state";

export interface ImpactPorts {
  analysis(): ChartAnalysis | null;
  loadLibrary(): Promise<void>;
  search(query: string, limit: number): CardRecord[];
}
