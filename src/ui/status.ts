// Inline status lines (`.status`, red with `.err`) under forms and panels.

/** Shows `message` in a status line; does nothing when the element is missing. */
export function setStatusText(
  el: HTMLElement | null | undefined,
  message: string,
  isError?: unknown,
): void {
  if (!el) return;
  el.textContent = message;
  el.className = "status" + (isError ? " err" : "");
}
