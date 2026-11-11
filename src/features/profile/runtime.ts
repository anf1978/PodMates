// Temporary ports to unmoved chart, display and account UI; no feature-to-feature imports.
import type { EngineContext } from "../../engine";
import type { CardRecord } from "../../cards/tuple";
import type { LookupIndexes } from "../../cards/lookup";
import type { ProfileDeck } from "./state";

export interface ProfileRuntime {
  open: (options?: { stacked?: boolean; id?: string; modalStyle?: string }) => HTMLElement;
  close: () => void;
  confirm: (message: string, action: () => Promise<void>) => void;
  ready: () => boolean;
  context: () => EngineContext;
  cards: () => CardRecord[];
  indexes: () => LookupIndexes;
  safeUrl: (raw: unknown) => string;
  buildTable: () => Promise<void>;
  displaySettings: (area: HTMLElement) => void;
  /** The account guard: false (and the sign-up prompt shown) when signed out. */
  requireAccount: (what: string) => boolean;
  priceScry: () => void;
  chartDeck: (deck: ProfileDeck) => Promise<void>;
  podId: () => string | null;
}

let runtime: ProfileRuntime;
export function configureProfile(value: ProfileRuntime): void {
  runtime = value;
}
export function profileRuntime(): ProfileRuntime {
  return runtime;
}
