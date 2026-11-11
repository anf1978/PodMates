// Temporary ports for the unmoved chart and shared ranked card picker.
import type { CardRecord } from "../../cards/tuple";
import type { ChartAnalysis } from "./state";

export interface ImpactPorts {
  analysis(): ChartAnalysis | null;
  loadLibrary(): Promise<void>;
  search(query: string, limit: number): CardRecord[];
}
