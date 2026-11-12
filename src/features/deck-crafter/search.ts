// Typed adaptation of the legacy shared picker: same ranking, touch handling and scroll anchoring.
import { html, nothing, render } from "../../ui/html";
import { reportError } from "../../services/report-error";
import type { CardRecord } from "../../cards/tuple";
import type { CrafterPorts, SearchOptions } from "./ports";

function anchored(input: HTMLInputElement, change: () => void): void {
  const before = input.getBoundingClientRect().top;
  change();
  const delta = input.getBoundingClientRect().top - before;
  if (!delta) return;
  let el = input.parentElement;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) {
      el.scrollTop += delta;
      return;
    }
    el = el.parentElement;
  }
  window.scrollBy(0, delta);
}

function highlighted(name: string, query: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'");
  const q = query.trim();
  const i = q.length >= 2 ? normalize(name).indexOf(normalize(q)) : -1;
  return i < 0
    ? name
    : html`${name.slice(0, i)}<mark>${name.slice(i, i + q.length)}</mark>${name.slice(i + q.length)}`;
}

export function wireSearch(
  input: HTMLInputElement,
  results: HTMLElement,
  ports: CrafterPorts,
  options: () => SearchOptions | null,
  onPick: (card: CardRecord) => void,
  flash: (card: CardRecord) => string,
  commanderPicker = false,
): () => void {
  results.classList.add("pm-sr");
  if (results.nextElementSibling !== input) input.before(results);
  for (const [key, value] of Object.entries({
    autocomplete: "off",
    autocorrect: "off",
    autocapitalize: "off",
    spellcheck: "false",
  }))
    input.setAttribute(key, value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let signature: string | null = null;
  let disposed = false;
  function show(content: Parameters<typeof render>[0], next: string | null): void {
    if (signature === next) return;
    signature = next;
    anchored(input, () => render(content, results));
  }
  async function search(): Promise<void> {
    const current = ++generation;
    const q = input.value;
    if (q.trim().length < 2) {
      show(nothing, "");
      return;
    }
    if (!ports.rankingsReady()) show(html`<div class="pm-sr-note">Loading...</div>`, "loading");
    const opts = options();
    try {
      const cards = await ports.search(q, 5, opts);
      if (disposed || current !== generation || input.value !== q || !input.isConnected) return;
      if (!cards.length) {
        let message = "No card found. Check the spelling, or try fewer letters.";
        if (!commanderPicker && opts?.commanderCard && (await ports.search(q, 1)).length) {
          message = `No cards in ${opts.commanderCard.n}'s colors match that. Untick the filter below to see all cards.`;
        }
        if (disposed || current !== generation || input.value !== q || !input.isConnected) return;
        show(html`<div class="pm-sr-note">${message}</div>`, `empty:${message}`);
        return;
      }
      show(
        html`${cards.map((card, i) => html`<button type="button" class=${`pm-sr-row${i === 0 ? " pm-sr-best" : ""}`} data-pm-card=${card.n}><span class="pm-sr-name">${highlighted(card.n, q)}</span>${card.t ? html`<small>${card.t.split("—")[0].trim()}</small>` : nothing}</button>`).reverse()}`,
        `${q.trim().toLowerCase()}|${cards.map((c) => c.n).join("|")}`,
      );
    } catch (error) {
      reportError(error, { operation: "deck-crafter" });
      if (!disposed && current === generation && input.isConnected) {
        show(
          html`<div class="pm-sr-note">Could not load card rankings. Try reloading.</div>`,
          "load-error",
        );
      }
    }
  }
  const listeners = new AbortController();
  const on = (target: HTMLElement, event: string, handler: EventListener) =>
    target.addEventListener(event, handler, { signal: listeners.signal });
  on(input, "input", () => {
    clearTimeout(timer);
    clearTimeout(flashTimer);
    timer = setTimeout(search, 70);
  });
  on(input, "focus", () => {
    if (input.value.trim().length >= 2 && !results.firstElementChild) {
      signature = null;
      void search();
    }
  });
  function choose(name: string | null): void {
    if (!name) return;
    const card = ports.findCard(name);
    if (!card) return;
    clearTimeout(timer);
    onPick(card);
    input.value = "";
    signature = null;
    const message = flash(card);
    anchored(input, () =>
      render(message ? html`<div class="pm-sr-flash">${message}</div>` : nothing, results),
    );
    if (message) {
      signature = "flash";
      flashTimer = setTimeout(() => {
        if (results.firstElementChild?.classList.contains("pm-sr-flash")) {
          signature = null;
          anchored(input, () => render(nothing, results));
        }
      }, 1600);
    }
  }
  let down: { name: string | null; x: number; y: number } | null = null;
  let lastAct = 0;
  const row = (event: Event) =>
    event.target instanceof Element ? event.target.closest("[data-pm-card]") : null;
  on(results, "pointerdown", (event) => {
    const pointer = event as PointerEvent;
    const button = row(event);
    down = button
      ? { name: button.getAttribute("data-pm-card"), x: pointer.clientX, y: pointer.clientY }
      : null;
  });
  on(results, "pointerup", (event) => {
    if (!down) return;
    const pointer = event as PointerEvent;
    const previous = down;
    down = null;
    if (Math.abs(pointer.clientX - previous.x) > 12 || Math.abs(pointer.clientY - previous.y) > 12)
      return;
    lastAct = Date.now();
    event.preventDefault();
    choose(previous.name);
  });
  on(results, "pointercancel", () => {
    down = null;
  });
  on(results, "mousedown", (event) => event.preventDefault());
  on(results, "click", (event) => {
    if (Date.now() - lastAct >= 700) choose(row(event)?.getAttribute("data-pm-card") || null);
  });
  on(input, "keydown", (event) => {
    if ((event as KeyboardEvent).key !== "Enter") return;
    const best = results.querySelector(".pm-sr-best");
    if (best) {
      event.preventDefault();
      choose(best.getAttribute("data-pm-card"));
    }
  });
  return () => {
    disposed = true;
    generation++;
    clearTimeout(timer);
    clearTimeout(flashTimer);
    listeners.abort();
  };
}
