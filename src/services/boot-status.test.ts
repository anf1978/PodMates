// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML =
    '<div class="db-load-fill indeterminate" id="dbLoadFill"></div>' +
    '<div class="db-load-msg" id="dbStatus">Loading card database…</div>';
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const message = () => document.getElementById("dbStatus")!;
const fill = () => document.getElementById("dbLoadFill")!;

it("allows total loads over 30 seconds while progress continues, then reports a genuine stall", async () => {
  const boot = await import("./boot-status");
  boot.startBootWatchdog();
  vi.advanceTimersByTime(25_000);
  boot.bootProgress("Parsing", 65);
  vi.advanceTimersByTime(25_000);
  expect(message().textContent).toBe("Parsing");
  expect(fill().style.width).toBe("65%");
  expect(fill().classList.contains("indeterminate")).toBe(false);
  vi.advanceTimersByTime(5_000);
  expect(message().textContent).toContain("stalled for 30 seconds");
  expect(message().className).toBe("db-load-msg err");
  expect(fill().classList.contains("err")).toBe(true);
  boot.bootProgress("Too late", 95);
  expect(fill().style.width).toBe("100%");
  expect(message().textContent).toContain("stalled for 30 seconds");
  expect(vi.getTimerCount()).toBe(0);
});

it("advances the bar for datasets and stops once the database is ready", async () => {
  const boot = await import("./boot-status");
  boot.datasetProgress("REFERENCE_SCORES", 1, 1);
  expect(message().textContent).toBe("Loading REFERENCE_SCORES... (1/1 datasets)");
  expect(fill().style.width).toBe("20%");
  boot.bootProgress(undefined, 12);
  expect(fill().style.width).toBe("20%");
  boot.setBootStatus("ok", "Ready — 3 cards loaded.");
  expect(message().className).toBe("db-load-msg ok");
  expect(fill().classList.contains("done")).toBe(true);
  boot.datasetProgress("KNOW_JSON", 2, 2);
  expect(message().textContent).toBe("Ready — 3 cards loaded.");
  expect(fill().style.width).toBe("100%");
});

it("renders markup messages as templates, so error text stays text", async () => {
  const boot = await import("./boot-status");
  const { html } = await import("../ui/html");
  boot.setBootStatus("err", html`<strong>Error:</strong> ${"<img src=x onerror=alert(1)>"}`);
  expect(message().querySelector("strong")?.textContent).toBe("Error:");
  expect(message().querySelector("img")).toBeNull();
  expect(message().textContent).toContain("<img src=x onerror=alert(1)>");
});
