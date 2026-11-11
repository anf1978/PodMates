import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

it("allows total loads over 30 seconds while progress continues, then reports a genuine stall", () => {
  vi.useFakeTimers();
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = html.indexOf("// Only real dataset/worker progress");
  const source = html.slice(start, html.indexOf("</script>", start));
  const boot: Pick<Window, "__dbReady" | "__dbWatchdogFired" | "__dbProgress" | "__dbLoadPct"> = {};
  const message = { textContent: "", innerHTML: "", className: "" };
  const fill = { classList: { remove: vi.fn(), add: vi.fn() }, style: { width: "" } };
  runInNewContext(source, {
    window: boot,
    Date,
    setInterval,
    clearInterval,
    document: { getElementById: (id: string) => (id === "dbStatus" ? message : fill) },
  });
  vi.advanceTimersByTime(25_000);
  boot.__dbProgress?.("Parsing", 65);
  vi.advanceTimersByTime(25_000);
  expect(boot.__dbWatchdogFired).toBe(false);
  expect(message.textContent).toBe("Parsing");
  expect(fill.style.width).toBe("65%");
  vi.advanceTimersByTime(5_000);
  expect(boot.__dbWatchdogFired).toBe(true);
  expect(message.innerHTML).toContain("stalled for 30 seconds");
  boot.__dbProgress?.("Too late", 95);
  expect(fill.style.width).toBe("100%");
  expect(vi.getTimerCount()).toBe(0);
});
