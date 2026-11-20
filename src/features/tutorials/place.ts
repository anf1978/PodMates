// Keeping the tutorial card and what it explains both on screen: scroll the explained control into view
// (again after the page's own scrolling, such as the jump to new chart results), and put the card at the
// top of the screen when the control sits in the lower half. Also copies real button icons into the card.

/** How long the page's own smooth scrolls (chart results, Try a Deck) take to finish. */
export const SETTLE_MS = 450;

/** Card at the top when the control is in the lower half of the screen, else at the bottom. */
export function placeCard(host: HTMLElement, el: Element | null): void {
  if (!el || !el.isConnected) {
    host.classList.remove("tut-top");
    return;
  }
  const rect = el.getBoundingClientRect();
  const middle = rect.top + rect.height / 2;
  host.classList.toggle("tut-top", middle > window.innerHeight / 2);
}

/** Scrolls `el` to the middle of the screen now and once more after the page settles, then places the
 * card. Returns a cancel function for the pending re-scroll. */
export function bringIntoView(host: HTMLElement, el: HTMLElement): () => void {
  const scroll = (behavior: ScrollBehavior) => el.scrollIntoView?.({ behavior, block: "center" });
  scroll("smooth");
  placeCard(host, el);
  const timer = setTimeout(() => {
    if (!el.isConnected) return;
    const rect = el.getBoundingClientRect();
    const offScreen = rect.bottom < 0 || rect.top > window.innerHeight;
    // Something else scrolled the page meanwhile: bring the control back.
    if (offScreen || rect.top < 0 || rect.bottom > window.innerHeight) scroll("smooth");
    placeCard(host, el);
  }, SETTLE_MS);
  return () => clearTimeout(timer);
}

/** Makes room in an open dialog's overlay for a tip card shown on top of it: the overlay keeps the
 * card's height free (top or bottom, wherever the card sits), so the dialog fits beside the card and none
 * of its buttons sit under it. Clears the room on `previous` when the overlay changes or `overlay` is
 * null. Returns the overlay now holding room. */
export function makeRoom(
  host: HTMLElement,
  previous: HTMLElement | null,
  overlay: HTMLElement | null,
): HTMLElement | null {
  if (previous && previous !== overlay) {
    previous.classList.remove("tut-room", "tut-room-top");
    previous.style.removeProperty("--tut-room");
  }
  const card = host.firstElementChild;
  if (!overlay || !card) return null;
  // Dynamic: the card's height depends on its text and the screen width.
  overlay.style.setProperty(
    "--tut-room",
    `${Math.ceil(card.getBoundingClientRect().height) + 12}px`,
  );
  overlay.classList.add("tut-room");
  overlay.classList.toggle("tut-room-top", host.classList.contains("tut-top"));
  return overlay;
}

/** Fills each `.tut-icon[data-from]` slot with a copy of that control's icon (its SVG, or its text). */
export function fillIcons(root: HTMLElement): void {
  for (const slot of root.querySelectorAll<HTMLElement>(".tut-icon[data-from]")) {
    const source = document.querySelector(slot.dataset.from || "");
    const svg = source?.matches("svg") ? source : source?.querySelector("svg");
    if (svg) {
      const copy = svg.cloneNode(true) as Element;
      copy.removeAttribute("id");
      copy.setAttribute("aria-hidden", "true");
      slot.replaceChildren(copy);
    } else slot.textContent = source?.textContent?.trim().slice(0, 2) || "";
  }
}
