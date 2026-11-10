// Icon-button tooltips. Each tip is appended to document.body and positioned with
// getBoundingClientRect, so no container (e.g. .panel's overflow:hidden) can clip it.
// Mouse hover, keyboard focus and touch long-press share one show/hide pair.

const TOOLTIP_TARGETS = [
  ".icon-btn[data-tooltip]:not([data-tooltip-wired])",
  ".icon-checkbox-label[data-tooltip]:not([data-tooltip-wired])",
  ".has-tooltip[data-tooltip]:not([data-tooltip-wired])",
].join(", ");
const LONG_PRESS_MS = 450;
const TOUCH_HIDE_DELAY_MS = 1400;
const guardedDocuments = new WeakSet<Document>();

/**
 * Wires a tooltip to every not-yet-wired `[data-tooltip]` icon control in `scope`.
 * Safe to call again after re-rendering: `data-tooltip-wired` stops double wiring.
 */
export function setupIconTooltips(scope: ParentNode = document): void {
  const doc = scope instanceof Document ? scope : (scope as Node).ownerDocument!;
  guardLongPressClick(doc);
  scope.querySelectorAll<HTMLElement>(TOOLTIP_TARGETS).forEach((btn) => {
    btn.setAttribute("data-tooltip-wired", "1");
    const tip = doc.createElement("span");
    tip.className = "icon-tooltip";
    tip.textContent = btn.getAttribute("data-tooltip");
    doc.body.appendChild(tip);

    const showTip = () => {
      const rect = btn.getBoundingClientRect();
      tip.style.left = rect.left + rect.width / 2 + "px";
      tip.style.top = rect.top - 8 + "px";
      tip.style.transform = "translate(-50%, -100%)";
      tip.classList.add("show");
    };
    const hideTip = () => tip.classList.remove("show");

    btn.addEventListener("mouseenter", showTip);
    btn.addEventListener("mouseleave", hideTip);
    btn.addEventListener("focus", showTip);
    btn.addEventListener("blur", hideTip);
    // Most of these buttons open a modal without the mouse leaving them; hide at once.
    btn.addEventListener("click", hideTip);

    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    btn.addEventListener(
      "touchstart",
      () => {
        pressTimer = setTimeout(() => {
          showTip();
          btn.classList.add("suppress-next-click");
        }, LONG_PRESS_MS);
      },
      { passive: true },
    );
    const endPress = () => {
      clearTimeout(pressTimer);
      if (tip.classList.contains("show")) setTimeout(hideTip, TOUCH_HIDE_DELAY_MS);
    };
    btn.addEventListener("touchend", endPress);
    btn.addEventListener("touchcancel", endPress);
  });
}

// A long-press that showed a tooltip must not also activate the control.
function guardLongPressClick(doc: Document) {
  if (guardedDocuments.has(doc)) return;
  guardedDocuments.add(doc);
  doc.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const btn = target?.closest(
        ".icon-btn.suppress-next-click, .icon-checkbox-label.suppress-next-click",
      );
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      btn.classList.remove("suppress-next-click");
    },
    true,
  );
}
