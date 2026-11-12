// Ports for the Ledger lots, price lookup and the shared ranked card picker (src/app/trades.ts).
import type { CardRecord } from "../../cards/tuple";
import type { Lot } from "./state";

export interface TradesPorts {
  lots(): readonly Lot[];
  mark(id: string): number | null | undefined;
  currentYen(card: string): Promise<number | null>;
  nameKey(card: string): string;
  refresh(): void;
  wireSearch(options: {
    input: HTMLInputElement;
    results: HTMLElement;
    limit: number;
    rowAttr: string;
    clearOnPick: boolean;
    showType: boolean;
    onPick(card: CardRecord): Promise<void>;
  }): void;
}
