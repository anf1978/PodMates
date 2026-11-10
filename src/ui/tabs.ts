// Tab bars: exactly one tab is active; its button gets the active class and its panel
// (if it has one) is shown, every other panel hidden.

export interface Tab<K extends string = string> {
  key: K;
  button?: Element | null;
  panel?: HTMLElement | null;
}

export interface SelectTabOptions {
  /** Class marking the active button. Default `active`. */
  activeClass?: string;
  /** `display` value of the shown panel. Default `block`. */
  panelDisplay?: string;
}

export function selectTab<K extends string>(
  tabs: readonly Tab<K>[],
  active: K,
  { activeClass = "active", panelDisplay = "block" }: SelectTabOptions = {},
): void {
  for (const tab of tabs) {
    const on = tab.key === active;
    if (tab.panel) tab.panel.style.display = on ? panelDisplay : "none";
    tab.button?.classList.toggle(activeClass, on);
  }
}

/** Tabs whose key is stored on each button, e.g. `data-ps-tab="search"`. */
export function tabsByAttribute(buttons: Iterable<Element>, attribute: string): Tab[] {
  return Array.from(buttons, (button) => ({ key: button.getAttribute(attribute) ?? "", button }));
}
