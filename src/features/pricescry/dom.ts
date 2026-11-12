// Screen DOM helpers. Every PriceScry view replaces its host's content wholesale, as the inline screen did:
// the Ledger and Spoiler Bait ports also replace #psBody's children, so no lit part may persist on the host.
import { render, type TemplateResult } from "../../ui/html";
import { PriceDataError } from "../../services/price-data";

export function paint(host: Element, view: TemplateResult | string): void {
  const fragment = document.createDocumentFragment();
  render(view, fragment);
  host.replaceChildren(fragment);
}
export function psBody(): HTMLElement | null {
  return document.getElementById("psBody");
}
export function overlay(): HTMLElement | null {
  return document.getElementById("pricescryOverlay");
}
/** Navigation the screen registers, so tab views can open a card and a card can go back without import cycles. */
export const nav: {
  setTab(tab: string): Promise<void>;
  openCard(name: string): Promise<void>;
  loadIndex(): Promise<boolean>;
} = {
  setTab: () => Promise.resolve(),
  openCard: () => Promise.resolve(),
  loadIndex: () => Promise.resolve(false),
};
export const errorStatus = (error: unknown): number | undefined =>
  error instanceof PriceDataError ? error.status : undefined;
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
