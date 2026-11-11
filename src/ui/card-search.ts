// One look and one behaviour for card search boxes. Matches appear in a list directly ABOVE the
// box, best match nearest it. A tap is taken from the press itself (pointerdown), so a list that
// refreshes a moment later can never swallow it, and the box keeps focus (keyboard stays up).
// Ranking and the card DB are supplied by the caller; this file only knows names and type lines.
import { html, nothing, render } from "./html";

export interface SearchCard {
  n: string;
  t?: string;
}

export interface CardSearchSource<C extends SearchCard> {
  /** True once rankings are loaded; until then the list says "Loading...". */
  loaded(): boolean;
  /** Loads the rankings (the shared deck library); rejects when they cannot load. */
  ready(): Promise<void>;
  search(query: string, limit: number): C[];
  find(name: string): C | null | undefined;
  onLoadError?(error: unknown): void;
}

export interface CardSearchOptions<C extends SearchCard> {
  input: HTMLInputElement;
  results: HTMLElement;
  source: CardSearchSource<C>;
  onPick(card: C): unknown;
  limit?: number;
  minChars?: number;
  /** Attribute that carries each row's card name. */
  rowAttr?: string;
  /** False keeps the typed text and list after a pick. */
  clearOnPick?: boolean;
  showType?: boolean;
  /** Plain-text confirmation shown briefly after a pick that clears the box. */
  flash?(card: C): string;
}

/** Keeps the box where it is on screen while the list above it appears or disappears. */
export function keepInputInPlace(input: HTMLElement, change: () => void): void {
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
  try {
    window.scrollBy(0, delta);
  } catch {
    /* fine */
  }
}

/** Gold highlight of what was typed inside a name, when it can be located plainly. */
export function highlightName(name: string, query: string) {
  const fold = (s: string) => s.toLowerCase().replace(/[‘’ʼ´`]/g, "'");
  const q = String(query || "").trim();
  const i = q.length >= 2 ? fold(name).indexOf(fold(q)) : -1;
  return i < 0
    ? name
    : html`${name.slice(0, i)}<mark>${name.slice(i, i + q.length)}</mark>${name.slice(i + q.length)}`;
}

const note = (text: string) => html`<div class="pm-sr-note">${text}</div>`;

export function wireCardSearch<C extends SearchCard>(options: CardSearchOptions<C>): void {
  const { input, results, source } = options;
  const limit = options.limit || 5,
    minChars = options.minChars || 2,
    attr = options.rowAttr || "data-pm-card";
  results.classList.add("pm-sr");
  if (results.nextElementSibling !== input && input.parentNode) input.before(results);
  for (const name of ["autocomplete", "autocorrect", "autocapitalize"])
    input.setAttribute(name, "off");
  input.setAttribute("spellcheck", "false");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSig: string | null = null;
  let generation = 0;
  // Rendered into a fresh fragment each time: callers may clear `results` themselves after a pick.
  const paint = (content: unknown) =>
    keepInputInPlace(input, () => {
      const fragment = document.createDocumentFragment();
      render(content, fragment);
      results.replaceChildren(fragment);
    });
  const show = (content: unknown, sig: string) => {
    if (sig === lastSig) return; // identical list: never disturb a tap in progress
    lastSig = sig;
    paint(content);
  };
  const rows = (cards: C[], q: string) => {
    const showType = options.showType !== false;
    return cards
      .map((c, i) => {
        const type = showType
          ? String(c.t || "")
              .split("—")[0]
              .trim()
          : "";
        return html`<button type="button" class=${i === 0 ? "pm-sr-row pm-sr-best" : "pm-sr-row"}>
          <span class="pm-sr-name">${highlightName(c.n, q)}</span
          >${type ? html`<small>${type}</small>` : nothing}
        </button>`;
      })
      .reverse();
  };

  async function update(): Promise<void> {
    const current = ++generation;
    const q = input.value;
    if (q.trim().length < minChars) return show(nothing, "");
    if (!source.loaded()) show(note("Loading..."), "loading");
    try {
      await source.ready();
    } catch (error) {
      source.onLoadError?.(error);
      if (current === generation && input.isConnected)
        show(note("Could not load card rankings. Try reloading."), "load-error");
      return;
    }
    if (current !== generation || input.value !== q || !input.isConnected) return;
    const cards = source.search(q, limit);
    if (!cards.length) {
      const msg = "No card found. Check the spelling, or try fewer letters.";
      return show(note(msg), "empty:" + msg);
    }
    const sig = q.trim().toLowerCase() + "|" + cards.map((c) => c.n).join("|");
    if (sig === lastSig) return;
    show(rows(cards, q), sig);
    // The name attribute is configurable, so it is set after rendering (best match is last).
    const buttons = results.querySelectorAll(".pm-sr-row");
    buttons.forEach((b, i) => b.setAttribute(attr, cards[buttons.length - 1 - i].n));
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    clearTimeout(flashTimer);
    timer = setTimeout(update, 70);
  });
  input.addEventListener("focus", () => {
    if (input.value.trim().length >= minChars && !results.firstElementChild) {
      lastSig = null;
      void update();
    }
  });
  const choose = (name: string | null) => {
    const card = source.find(String(name));
    if (!card) return;
    clearTimeout(timer);
    options.onPick(card);
    if (options.clearOnPick === false) return;
    input.value = "";
    lastSig = null;
    const message = options.flash ? options.flash(card) : "";
    paint(message ? html`<div class="pm-sr-flash">${message}</div>` : nothing);
    if (!message) return;
    lastSig = "flash";
    flashTimer = setTimeout(() => {
      if (results.firstElementChild?.classList.contains("pm-sr-flash")) {
        lastSig = null;
        paint(nothing);
      }
    }, 1600);
  };

  // Taps are read from the press itself (name captured at pointerdown), ignoring slides/scrolls.
  let down: { name: string | null; x: number; y: number } | null = null;
  let lastAct = 0;
  const row = (e: Event) => (e.target instanceof Element ? e.target.closest(`[${attr}]`) : null);
  results.addEventListener("pointerdown", (e) => {
    const r = row(e);
    down = r ? { name: r.getAttribute(attr), x: e.clientX, y: e.clientY } : null;
  });
  results.addEventListener("pointerup", (e) => {
    if (!down) return;
    const d = down;
    down = null;
    if (Math.abs(e.clientX - d.x) > 12 || Math.abs(e.clientY - d.y) > 12) return;
    lastAct = Date.now();
    e.preventDefault();
    choose(d.name);
  });
  results.addEventListener("pointercancel", () => {
    down = null;
  });
  results.addEventListener("mousedown", (e) => e.preventDefault()); // keep the box focused
  results.addEventListener("click", (e) => {
    // keyboards / browsers without pointer events
    const r = row(e);
    if (!r || Date.now() - lastAct < 700) return;
    choose(r.getAttribute(attr));
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return; // Enter takes the best match
    const best = results.querySelector(".pm-sr-best");
    if (best) {
      e.preventDefault();
      choose(best.getAttribute(attr));
    }
  });
}
