// Typed messages between otherwise independent feature boundaries.
import type { PodDoc, PodMember, WithId } from "./cloud/types";

type AppEvents = {
  "profile:open": { welcome?: boolean };
  "auth:open": undefined;
  "gatherings:sample": undefined;
  "gatherings:host": { pod: WithId<PodDoc>; members: PodMember[] };
  "profile:pod": WithId<PodDoc>;
  "profile:player": { uid: string; name: string; podId: string };
  "spoilers:open": WithId<PodDoc>;
  "pods:active": string | null;
  "pods:navigate": undefined;
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
