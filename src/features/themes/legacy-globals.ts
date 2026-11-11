// Temporary bridge: the profile adapter (src/features/profile/legacy-globals.ts) still reaches the
// Display settings tray through this page-global name, because features never import each other.
import { mount } from "./index";

const legacy = {
  // TODO(p3-6): pass the tray to the profile runtime port without a global once shims go.
  renderDisplaySettings: (container: HTMLElement | null): void => mount(container),
};
type ThemesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ThemesLegacy {}
}
Object.assign(window, legacy);
