// PriceScry remains inline until R13; it supplies its data explicitly at the boundary.
import { connect, mount, type MountOptions } from "./index";

connect();
const legacy = {
  // TODO(p3-6): the unmoved PriceScry bait tab still calls sbMount.
  sbMount: (host: HTMLElement, options: MountOptions): Promise<void> => mount(host, options).ready,
};
type SpoilerBaitLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends SpoilerBaitLegacy {}
}
Object.assign(window, legacy);
