// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeAllModals, closeModal, openModal, openModals } from "./modal.ts";

function button(label: string, parent: HTMLElement = document.body) {
  const el = document.createElement("button");
  el.textContent = label;
  parent.appendChild(el);
  return el;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

afterEach(() => {
  closeAllModals();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("openModal", () => {
  it("builds the shared overlay markup and moves focus into the dialog", () => {
    const opener = button("Open");
    opener.focus();
    const modal = openModal({ overlayId: "tadOverlay", modalStyle: "max-width:460px" });

    expect(modal.overlay.className).toBe("tad-overlay");
    expect(modal.overlay.id).toBe("tadOverlay");
    expect(modal.dialog.className).toBe("tad-modal");
    expect(modal.dialog.style.maxWidth).toBe("460px");
    expect(modal.dialog.getAttribute("role")).toBe("dialog");
    expect(modal.dialog.getAttribute("aria-modal")).toBe("true");
    expect(modal.overlay.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(modal.dialog);
  });

  it("can make the layer itself the dialog", () => {
    const modal = openModal({ overlayClass: "ps-overlay", modalClass: null, label: "PriceScry" });
    expect(modal.dialog).toBe(modal.overlay);
    expect(modal.overlay.children).toHaveLength(0);
    expect(modal.overlay.getAttribute("aria-label")).toBe("PriceScry");
  });
});

describe("dismissal", () => {
  it("Escape closes the layer and restores focus to its opener", () => {
    const opener = button("Open");
    opener.focus();
    const modal = openModal();

    const event = press("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(modal.isOpen).toBe(false);
    expect(modal.overlay.isConnected).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("Escape and backdrop clicks run onDismiss instead of closing directly", () => {
    const onDismiss = vi.fn();
    const modal = openModal({ onDismiss });

    press("Escape");
    modal.overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    modal.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onDismiss.mock.calls.map(([reason]) => reason)).toEqual(["escape", "backdrop"]);
    expect(modal.isOpen).toBe(true);
  });

  it("ignores backdrop clicks when asked to", () => {
    const modal = openModal({ dismissOnBackdrop: false });
    modal.overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.isOpen).toBe(true);
  });

  it("does nothing on Escape when no layer is open", () => {
    expect(press("Escape").defaultPrevented).toBe(false);
  });
});

describe("focus trap", () => {
  it("wraps Tab and Shift+Tab inside the top layer", () => {
    button("Page");
    const modal = openModal();
    const first = button("First", modal.dialog);
    button("Middle", modal.dialog);
    const last = button("Last", modal.dialog);

    last.focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(press("Tab", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("pulls focus back in when it has escaped the layer", () => {
    const outside = button("Page");
    const modal = openModal();
    const first = button("First", modal.dialog);
    button("Last", modal.dialog);

    outside.focus();
    press("Tab");
    expect(document.activeElement).toBe(first);
  });

  it("lets Tab move normally between inner controls", () => {
    const modal = openModal();
    const first = button("First", modal.dialog);
    button("Last", modal.dialog);
    first.focus();
    expect(press("Tab").defaultPrevented).toBe(false);
  });
});

describe("stacking", () => {
  it("Escape closes only the top layer, then the one below", () => {
    const opener = button("Open");
    opener.focus();
    const base = openModal({ overlayId: "tadOverlay" });
    const inner = button("Card name", base.dialog);
    inner.focus();
    const stacked = openModal({ overlayClass: "tad-overlay tad-stacked-overlay" });

    expect(openModals()).toEqual([base, stacked]);
    press("Escape");
    expect(stacked.isOpen).toBe(false);
    expect(base.isOpen).toBe(true);
    expect(document.activeElement).toBe(inner);

    press("Escape");
    expect(base.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("restores focus past a parent layer that closed first", () => {
    const opener = button("Open");
    opener.focus();
    const base = openModal();
    button("Card name", base.dialog).focus();
    const stacked = openModal();

    base.close();
    expect(document.activeElement).toBe(stacked.dialog);
    stacked.close();
    expect(document.activeElement).toBe(opener);
  });

  it("notices layers that legacy code removes directly", async () => {
    const opener = button("Open");
    opener.focus();
    const modal = openModal();
    modal.overlay.remove();
    await Promise.resolve();

    expect(modal.isOpen).toBe(false);
    expect(openModals()).toEqual([]);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });

  it("closeModal closes managed layers and removes unmanaged elements", () => {
    const modal = openModal();
    closeModal(modal.overlay);
    expect(modal.isOpen).toBe(false);

    const stray = document.createElement("div");
    document.body.appendChild(stray);
    closeModal(stray);
    expect(stray.isConnected).toBe(false);
    expect(() => closeModal(null)).not.toThrow();
  });
});

describe("scroll lock", () => {
  it("locks the page while any locking layer is open and restores the old value", () => {
    document.body.style.overflow = "auto";
    const base = openModal();
    expect(document.body.style.overflow).toBe("hidden");
    const sheet = openModal({ lockScroll: false });
    const stacked = openModal();

    stacked.close();
    expect(document.body.style.overflow).toBe("hidden");
    base.close();
    expect(document.body.style.overflow).toBe("auto");
    sheet.close();
    expect(document.body.style.overflow).toBe("auto");
  });
});
