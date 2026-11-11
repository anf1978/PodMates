// Typed messages between otherwise independent feature boundaries.
import type { PodDoc, PodMember, WithId } from "./cloud/types";
import type { Gathering } from "./cloud/gatherings";
import type { Lot, TradeDraft } from "./trade-ledger";

type AppEvents = {
  "trades:purchase": TradeDraft;
  "trades:mark": string;
  "trades:sell": { id: string; index?: number };
  "trades:remove-sale": { id: string; index: number };
  "trades:remove-lot": string;
  "trades:export": readonly Lot[];
  "profile:open": { welcome?: boolean };
  "auth:open": undefined;
  "gatherings:sample": undefined;
  "gatherings:open": { podId: string; id: string };
  "gatherings:host": { pod: WithId<PodDoc>; members: PodMember[] };
  "gatherings:paint": {
    area: HTMLElement;
    gatherings: (Gathering & { podId: string; podName: string })[];
    uid: string | null;
  };
  "profile:pod": WithId<PodDoc>;
  "profile:player": { uid: string; name: string; podId: string };
  "spoilers:open": WithId<PodDoc>;
  "pods:active": string | null;
  "pods:navigate": undefined;
  "pods:refresh": undefined;
  "pods:membership": undefined;
  "pods:open": { pod: WithId<PodDoc>; pods: WithId<PodDoc>[] };
  "pricescry:open": undefined;
  "pricescry:tab": "search" | "movers" | "signals" | "bait" | "radar" | "ledger";
  /** Deck Chart is charting these commanders (the portraits above the radar). */
  "chart:commanders": readonly string[];
  /** The radar was drawn; its #impactChart mount point is in the page. */
  "chart:radar": { readonly deckCardNames: string[] };
};

const events = new EventTarget();

export function emit<K extends keyof AppEvents>(name: K, detail: AppEvents[K]): void {
  events.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof AppEvents>(
  name: K,
  listener: (detail: AppEvents[K]) => void,
): () => void {
  const receive = (event: Event): void => listener((event as CustomEvent<AppEvents[K]>).detail);
  events.addEventListener(name, receive);
  return () => events.removeEventListener(name, receive);
}
