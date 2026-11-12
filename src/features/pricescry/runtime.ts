// Ports to code PriceScry does not own: the Ledger and Spoiler Bait tabs, the legacy card picker and card DB.
import type { CardRecord } from "../../cards/tuple";
import type { Signal } from "./state";

export interface PriceScryPorts {
  /** Mounts the Ledger tab into the screen's body. */
  renderLedger(host: HTMLElement): Promise<void>;
  /** Mounts Spoiler Bait into the host with the screen's signals, price day and card navigation. */
  renderBait(
    host: HTMLElement,
    options: { signals: readonly Signal[]; day: string; onOpen(name: string): void },
  ): Promise<void>;
  /** The shared ranked card picker. */
  wireSearch(options: {
    input: HTMLInputElement;
    results: HTMLElement;
    limit: number;
    rowAttr: string;
    clearOnPick: boolean;
    onPick(card: CardRecord): void;
  }): void;
  /** The loaded card-DB record, for the Game Changer / banned badges; null before the DB loads. */
  findCard(name: string): { g?: unknown; b?: unknown } | null | undefined;
}

let ports: PriceScryPorts | null = null;
export function configurePriceScry(next: PriceScryPorts): void {
  ports = next;
}
export function runtime(): PriceScryPorts {
  if (!ports) throw new Error("PriceScry is not configured");
  return ports;
}
