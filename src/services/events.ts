// Typed messages between otherwise independent feature boundaries.
type AppEvents = {
  "profile:open": { welcome?: boolean };
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
