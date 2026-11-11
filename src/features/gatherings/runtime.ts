// Explicit ports to comparison, the current battle and the saved-deck picker (src/app/gatherings.ts).
export interface ChartDeck {
  uid?: string | null;
  color?: string;
}
export interface BattleContext {
  podId: string;
  gatheringId: string;
  gatheringTitle: string;
  ignoreChronicleId: string | null;
  isHost: boolean;
  hostName: string;
  participants: { uid: string; displayName: string }[];
}
export interface GatheringRuntime {
  ready(): boolean;
  library(): Promise<readonly { decklist: string; flavorName: string; commander: string }[]>;
  analyze(list: string, player: string, commander: string): ChartDeck | null;
  colors: readonly string[];
  results(decks: ChartDeck[], context: BattleContext | null): void;
  refreshPods(): void;
  confirm(
    message: string,
    label: string,
    action: () => void | Promise<void>,
    cancel?: () => void,
    cancelLabel?: string,
  ): void;
  pickDeck(target: {
    gatheringSeat: {
      podId: string;
      gatheringId: string;
      seatIndex: number;
      seatUid: string | null;
      seatIsGuest: boolean;
      seatDisplayName: string;
    };
  }): void;
}

let runtime: GatheringRuntime | undefined;
export function configureGatherings(value: GatheringRuntime): void {
  runtime = value;
}
export function gatheringRuntime(): GatheringRuntime {
  if (!runtime) throw new Error("Gatherings runtime is not configured");
  return runtime;
}
