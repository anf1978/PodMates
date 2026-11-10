// Small transient confirmation banner. It reuses the modal look but never blocks the
// page, because sign-in/out and save confirmations are information, not decisions.

const TOAST_ID = "podmatesToast";
const hideTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Shows `message` in the shared `.pm-toast` banner for `durationMs` (default 6 s). */
export function showToast(message: string, durationMs = 6000): void {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "pm-toast";
    document.body.appendChild(toast);
  }
  const el = toast;
  el.textContent = message;
  // Reflow between removing and re-adding the class so a second message arriving
  // before the first faded out restarts the transition instead of being a no-op.
  el.classList.remove("pm-toast-show");
  void el.offsetWidth;
  el.classList.add("pm-toast-show");
  clearTimeout(hideTimers.get(el));
  hideTimers.set(
    el,
    setTimeout(() => el.classList.remove("pm-toast-show"), durationMs),
  );
}
