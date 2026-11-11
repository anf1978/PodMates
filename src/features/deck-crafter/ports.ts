// Temporary ports to unmoved page orchestration; no feature-to-feature imports.
import type { CardRecord } from "../../cards/tuple";

export interface SearchOptions {
  commanderCard?: { ci: string; n?: string };
  preferCommanders?: boolean;
}

export interface CrafterPorts {
  ready(): boolean;
  findCard(name: string): CardRecord | undefined;
  rankingsReady(): boolean;
  search(query: string, limit: number, options?: SearchOptions | null): Promise<CardRecord[]>;
  confirm(message: string, label: string, yes: () => void, no: () => void): void;
  resetDeckName(): void;
  saveDeck(): void;
  setSingleMode(): void;
  chart(): Promise<void>;
}
