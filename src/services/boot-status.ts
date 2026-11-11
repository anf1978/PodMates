// The card-database loading bar under the header (#dbStatus message, #dbLoadFill bar) and its
// stall watchdog. Only real dataset/worker progress resets the 30-second watchdog; once the
// database is ready or the watchdog has fired, later progress no longer touches the bar.
import { html, render, type TemplateResult } from "../ui/html";

export type BootMessage = string | TemplateResult;

const STALL_MS = 30_000;

let ready = false;
let stalled = false;
let percentShown = 8;
let lastProgress = Date.now();

const message = () => document.getElementById("dbStatus");
const fill = () => document.getElementById("dbLoadFill");

const rendered = new WeakSet<Element>();

function show(text: BootMessage): void {
  const el = message();
  if (!el) return;
  // The first message replaces the page's static "Loading card database…" text.
  if (!rendered.has(el)) {
    el.replaceChildren();
    rendered.add(el);
  }
  render(text, el);
}

const CAUSES =
  " a browser without the decompression feature this needs (try updating, or use a recent " +
  "Chrome/Safari), or the file was truncated when downloading (it should be about ";
const TRY =
  "Try: re-download the full file · open in a desktop browser · close other tabs · " +
  "use Wi‑Fi and wait a full minute on a fresh load.";
const stallMessage = html`Database loading stalled for 30 seconds on this device.<br /><br /><strong
    >Common causes on phones:</strong
  >${CAUSES}<strong>2.5&nbsp;MB</strong>).<br /><br />${TRY}`;

/** Starts the stall watchdog (once, at boot); returns a stop function for tests. */
export function startBootWatchdog(): () => void {
  lastProgress = Date.now();
  const watchdog = setInterval(() => {
    if (ready || stalled) {
      clearInterval(watchdog);
    } else if (Date.now() - lastProgress >= STALL_MS) {
      stalled = true;
      clearInterval(watchdog);
      const bar = fill();
      if (bar) {
        bar.classList.remove("indeterminate");
        bar.classList.add("err");
        bar.style.width = "100%";
      }
      const el = message();
      if (el) el.className = "db-load-msg err";
      show(stallMessage);
    }
  }, 1000);
  return () => clearInterval(watchdog);
}

/** Real progress: resets the watchdog and, when given, shows the message and advances the bar. */
export function bootProgress(text?: string, percent?: number): void {
  if (ready || stalled) return;
  lastProgress = Date.now();
  if (text) show(text);
  if (typeof percent === "number") percentShown = Math.max(percentShown, percent);
  const bar = fill();
  if (bar) {
    bar.classList.remove("indeterminate");
    bar.style.width = `${percentShown}%`;
  }
}

/** A dataset fetch started or finished: the first 8–20% of the bar. */
export function datasetProgress(name: string, completed: number, total: number): void {
  if (ready || stalled) return;
  bootProgress(`Loading ${name}... (${completed}/${total} datasets)`, 8 + (completed / total) * 12);
}

/** Sets the bar's final or intermediate state ('' keeps loading, 'ok' ready, 'err' failed). */
export function setBootStatus(state: "" | "ok" | "err", text: BootMessage): void {
  if (!state) bootProgress();
  if (state === "ok") ready = true;
  if (state === "err") stalled = true;
  const el = message();
  if (el) el.className = "db-load-msg" + (state === "err" ? " err" : state === "ok" ? " ok" : "");
  show(text);
  const bar = fill();
  if (bar) {
    bar.classList.remove("indeterminate");
    if (state === "ok") {
      bar.classList.add("done");
      bar.style.width = "100%";
    } else if (state === "err") {
      bar.classList.add("err");
      bar.style.width = "100%";
    }
  }
}
