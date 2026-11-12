// Public API of the colour-theme feature: the Display settings tray. The saved theme and text
// size are applied before first paint by prepaint.ts (inlined in <head>), not from here.
import "./themes.css";
import { render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { applyTextSize, applyTheme, currentTextSize, currentTheme, TEXT_SIZES } from "./apply";
import { findTheme } from "./palette";
import { displaySettingsView, type DisplayActions } from "./view";

/** Renders the Display settings tray into `container`; choices apply at once and are saved per device. */
export function mount(container: HTMLElement | null): void {
  if (!container) return;
  const actions: DisplayActions = {
    chooseTheme(id) {
      applyTheme(id);
      draw();
      const t = findTheme(id);
      if (t) showToast(`${t.name} colours applied.`);
    },
    chooseSize(id) {
      applyTextSize(id);
      draw();
      const z = TEXT_SIZES.find((x) => x.id === currentTextSize());
      if (z) showToast(`Text size: ${z.label}.`);
    },
  };
  function draw(): void {
    render(displaySettingsView(currentTheme(), currentTextSize(), actions), container!);
  }
  draw();
}
