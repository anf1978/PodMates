// Safety net: a scrolling dialog that has no Close of its own gets a pinned one.
import { closeTryADeckModal } from "./tad-modal";

const watched = new WeakSet<Element>();

function ensure(modal: HTMLElement): void {
  try {
    if (modal.querySelector(".tad-close")) return;
    const buttons = Array.from(modal.querySelectorAll("button"));
    if (buttons.some((b) => /^\s*(?:close|done|back)\b/i.test(b.textContent || ""))) return;
    if (modal.scrollHeight <= modal.clientHeight + 4) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tad-close";
    b.textContent = "Close ×";
    b.addEventListener("click", () => closeTryADeckModal());
    modal.insertBefore(b, modal.firstChild);
  } catch {
    // Best effort only.
  }
}

function watch(overlay: Element): void {
  const modal = overlay.querySelector<HTMLElement>(".tad-modal");
  if (!modal || watched.has(modal)) return;
  watched.add(modal);
  new MutationObserver(() => ensure(modal)).observe(modal, { childList: true });
  setTimeout(() => ensure(modal), 0);
  setTimeout(() => ensure(modal), 600);
}

/** Watches the page for base dialogs (`.tad-overlay`) and pins a Close on long ones. */
export function installStickyCloseNet(root: HTMLElement = document.body): void {
  new MutationObserver((mutations) => {
    for (const m of mutations)
      m.addedNodes.forEach((n) => {
        if (n instanceof Element && n.classList.contains("tad-overlay")) watch(n);
      });
  }).observe(root, { childList: true });
}
