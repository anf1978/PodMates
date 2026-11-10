// The one modal/overlay system. Every popup layer (the shared `.tad-overlay` dialogs,
// stacked card-art/deck-summary layers, the full-screen PriceScry screen and the
// suggestions sheet) opens through openModal(), which owns Escape, the focus trap,
// focus restore, scroll lock and stacking. Looks come only from the CSS classes or
// inline styles the caller passes, so moving a popup here never changes its pixels.

export type DismissReason = "escape" | "backdrop";

export interface ModalOptions {
  /** Class list of the full-screen layer. Defaults to the shared `tad-overlay`. */
  overlayClass?: string;
  overlayId?: string;
  /** Inline CSS for a layer that is styled inline rather than by a class. */
  overlayStyle?: string;
  /** Class list of the dialog box inside the layer; `null` makes the layer itself the dialog. */
  modalClass?: string | null;
  modalId?: string;
  /** Inline CSS for the dialog box (e.g. `max-width:460px`). */
  modalStyle?: string;
  /** ARIA role of the dialog; `null` when the caller's own markup supplies one. */
  role?: "dialog" | "alertdialog" | null;
  /** Accessible name when no visible heading labels the dialog. */
  label?: string;
  /**
   * Runs for Escape and backdrop clicks instead of a plain close(), so a layer can do
   * what its own Close button does (stop polling, refresh what it covered, ...).
   */
  onDismiss?: (reason: DismissReason, modal: ModalHandle) => void;
  /** Whether a click on the layer outside the dialog dismisses it. Default true. */
  dismissOnBackdrop?: boolean;
  /** Whether the page behind stops scrolling while this layer is open. Default true. */
  lockScroll?: boolean;
  /** Where the layer is appended. Defaults to `document.body`. */
  parent?: HTMLElement;
}

export interface ModalHandle {
  readonly overlay: HTMLElement;
  /** The dialog box (the layer itself when `modalClass` is `null`). */
  readonly dialog: HTMLElement;
  readonly isOpen: boolean;
  /** Removes the layer now, without running `onDismiss`. */
  close(): void;
  /** What Escape and backdrop clicks do: `onDismiss`, or close() when there is none. */
  dismiss(reason: DismissReason): void;
}

interface Entry {
  handle: ModalHandle;
  options: ModalOptions;
  /** Where focus returns, nearest first: the opener, then whatever its own layer would restore. */
  restoreChain: HTMLElement[];
  open: boolean;
}

interface ScrollLock {
  body: HTMLElement;
  overflow: string;
  paddingRight: string;
}

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable]:not([contenteditable=false])",
  "[tabindex]",
].join(",");

const stack: Entry[] = [];
const observedParents = new WeakSet<Node>();
const listeningDocuments = new WeakSet<Document>();
let scrollLock: ScrollLock | null = null;

/** Opens a layer on top of any already open, and returns its handle. */
export function openModal(options: ModalOptions = {}): ModalHandle {
  prune();
  const parent = options.parent ?? document.body;
  const doc = parent.ownerDocument;
  listen(doc);
  observe(parent);

  const overlay = doc.createElement("div");
  overlay.className = options.overlayClass ?? "tad-overlay";
  if (options.overlayId) overlay.id = options.overlayId;
  if (options.overlayStyle) overlay.style.cssText = options.overlayStyle;

  let dialog = overlay;
  if (options.modalClass !== null) {
    dialog = doc.createElement("div");
    dialog.className = options.modalClass ?? "tad-modal";
    overlay.appendChild(dialog);
  }
  if (options.modalId) dialog.id = options.modalId;
  if (options.modalStyle && dialog !== overlay) dialog.style.cssText = options.modalStyle;
  const role = options.role === undefined ? "dialog" : options.role;
  if (role) {
    dialog.setAttribute("role", role);
    dialog.setAttribute("aria-modal", "true");
  }
  if (options.label) dialog.setAttribute("aria-label", options.label);

  const active = activeElement(doc);
  const owner = active ? stack.find((e) => e.open && e.handle.overlay.contains(active)) : undefined;
  const entry: Entry = {
    options,
    restoreChain: active ? [active, ...(owner?.restoreChain ?? [])] : [],
    open: true,
    handle: {
      overlay,
      dialog,
      get isOpen() {
        return entry.open;
      },
      close() {
        if (!entry.open) return;
        overlay.remove();
        finish(entry);
      },
      dismiss(reason) {
        if (!entry.open) return;
        if (options.onDismiss) options.onDismiss(reason, entry.handle);
        else entry.handle.close();
      },
    },
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && options.dismissOnBackdrop !== false) {
      entry.handle.dismiss("backdrop");
    }
  });

  stack.push(entry);
  parent.appendChild(overlay);
  updateScrollLock(doc);
  focusInto(dialog);
  return entry.handle;
}

/** Closes the layer whose overlay element is `overlay`; removes unmanaged elements as before. */
export function closeModal(overlay: Element | null | undefined): void {
  if (!overlay) return;
  const entry = stack.find((e) => e.handle.overlay === overlay);
  if (entry) entry.handle.close();
  else overlay.remove();
}

/** The open layers, bottom first. */
export function openModals(): readonly ModalHandle[] {
  prune();
  return stack.map((e) => e.handle);
}

/** Closes every open layer, top first. */
export function closeAllModals(): void {
  for (const entry of [...stack].reverse()) entry.handle.close();
}

function finish(entry: Entry) {
  if (!entry.open) return;
  entry.open = false;
  const index = stack.indexOf(entry);
  if (index >= 0) stack.splice(index, 1);
  const doc = entry.handle.overlay.ownerDocument;
  updateScrollLock(doc);
  const active = activeElement(doc);
  const focusLost = !active || !active.isConnected || entry.handle.overlay.contains(active);
  if (!focusLost) return;
  const target = entry.restoreChain.find((el) => el.isConnected);
  target?.focus({ preventScroll: true });
}

// Legacy code still removes some layers directly (`overlay.remove()`); catch those so
// focus, scroll lock and the stack stay right.
function prune() {
  for (const entry of [...stack]) {
    if (!entry.handle.overlay.isConnected) finish(entry);
  }
}

function observe(parent: HTMLElement) {
  if (observedParents.has(parent)) return;
  observedParents.add(parent);
  new MutationObserver(prune).observe(parent, { childList: true });
}

function listen(doc: Document) {
  if (listeningDocuments.has(doc)) return;
  listeningDocuments.add(doc);
  doc.addEventListener("keydown", onKeydown);
}

function onKeydown(event: KeyboardEvent) {
  prune();
  const top = stack[stack.length - 1];
  if (!top || event.defaultPrevented) return;
  if (event.key === "Escape" && !event.isComposing) {
    event.preventDefault();
    top.handle.dismiss("escape");
  } else if (event.key === "Tab") {
    trapTab(event, top.handle);
  }
}

function trapTab(event: KeyboardEvent, handle: ModalHandle) {
  const doc = handle.overlay.ownerDocument;
  const items = focusableIn(handle.overlay);
  const active = activeElement(doc);
  const inside = !!active && handle.overlay.contains(active);
  if (items.length === 0) {
    event.preventDefault();
    handle.dialog.focus({ preventScroll: true });
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && (!inside || active === first || active === handle.dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.closest("[hidden],[inert]") &&
      (typeof el.checkVisibility !== "function" || el.checkVisibility()),
  );
}

function focusInto(dialog: HTMLElement) {
  if (!dialog.hasAttribute("tabindex")) {
    dialog.tabIndex = -1;
    // The box itself only holds focus until the first Tab; it never showed a ring before.
    dialog.style.outline = "none";
  }
  dialog.focus({ preventScroll: true });
}

function activeElement(doc: Document): HTMLElement | null {
  const active = doc.activeElement;
  const view = doc.defaultView;
  if (!view || !(active instanceof view.HTMLElement) || active === doc.body) return null;
  return active;
}

function updateScrollLock(doc: Document) {
  const wanted = stack.some((e) => e.open && e.options.lockScroll !== false);
  if (wanted && !scrollLock) {
    const body = doc.body;
    const view = doc.defaultView;
    scrollLock = { body, overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    // Keep the page behind exactly where it was when its scrollbar disappears.
    const scrollbar = view ? view.innerWidth - doc.documentElement.clientWidth : 0;
    if (view && scrollbar > 0) {
      const padding = parseFloat(view.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${padding + scrollbar}px`;
    }
    body.style.overflow = "hidden";
  } else if (!wanted && scrollLock) {
    scrollLock.body.style.overflow = scrollLock.overflow;
    scrollLock.body.style.paddingRight = scrollLock.paddingRight;
    scrollLock = null;
  }
}
