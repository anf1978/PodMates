// One swipe surface and its owned pointer listeners; cleanup also handles mid-drag dismissal.
import type { Vote } from "./state";

export function wireSwipe(
  top: HTMLElement,
  busy: () => boolean,
  decide: (vote: Vote) => void,
): () => void {
  let sx = 0,
    dx = 0,
    drag = false,
    pointer: number | null = null;
  const like = top.querySelector<HTMLElement>(".sb-like")!;
  const pass = top.querySelector<HTMLElement>(".sb-pass")!;
  const hint = (): void => {
    like.style.opacity = String(Math.min(1, Math.max(0, -dx / 70)));
    pass.style.opacity = String(Math.min(1, Math.max(0, dx / 70)));
  };
  const remove = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  const move = (event: PointerEvent): void => {
    if (!drag || (pointer !== null && event.pointerId !== pointer)) return;
    event.preventDefault();
    dx = event.clientX - sx;
    top.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    hint();
  };
  const up = (event: PointerEvent): void => {
    if (!drag || (pointer !== null && event.pointerId !== pointer)) return;
    drag = false;
    remove();
    if (Math.abs(dx) > 70) decide(dx < 0 ? "like" : "pass");
    else {
      top.classList.add("sb-snap");
      top.style.transform = "";
      dx = 0;
      hint();
    }
  };
  const down = (event: PointerEvent): void => {
    if (busy() || event.button > 0) return;
    drag = true;
    pointer = event.pointerId;
    sx = event.clientX;
    dx = 0;
    top.classList.remove("sb-snap");
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const key = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    decide(event.key === "ArrowLeft" ? "like" : "pass");
  };
  const prevent = (event: Event): void => event.preventDefault();
  top.addEventListener("pointerdown", down);
  top.addEventListener("keydown", key);
  top.addEventListener("dragstart", prevent);
  top.addEventListener("contextmenu", prevent);
  return () => {
    drag = false;
    remove();
    top.removeEventListener("pointerdown", down);
    top.removeEventListener("keydown", key);
    top.removeEventListener("dragstart", prevent);
    top.removeEventListener("contextmenu", prevent);
  };
}
