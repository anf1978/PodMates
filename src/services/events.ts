// Typed messages between otherwise independent feature boundaries.
import type { PodDoc, PodMember, WithId } from "./cloud/types";
import type { Gathering } from "./cloud/gatherings";

type AppEvents = {
  "profile:open": { welcome?: boolean };
  "auth:open": undefined;
  "gatherings:sample": undefined;
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
