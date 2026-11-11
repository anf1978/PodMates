// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it("continues online after a broken installation instead of blocking the database", async () => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn(() => new Promise(() => {})),
  });
  vi.stubGlobal("navigator", { serviceWorker });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { prepareOffline } = await import("./pwa");
  const first = prepareOffline();
  expect(prepareOffline()).toBe(first);
  await vi.advanceTimersByTimeAsync(5000);
  await expect(first).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("continuing online"));
  warn.mockRestore();
});

it("prompts for an update without activating it and allows dismissal", async () => {
  vi.stubEnv("PROD", true);
  const waiting = { postMessage: vi.fn() };
  const registration = Object.assign(new EventTarget(), { waiting });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
  });
  vi.stubGlobal("navigator", { serviceWorker });
  const { prepareOffline } = await import("./pwa");
  await prepareOffline();
  await vi.waitFor(() =>
    expect(document.getElementById("pmUpdate")?.textContent).toContain("New version available"),
  );
  expect(waiting.postMessage).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>('[aria-label="Dismiss update"]')!.click();
  expect(document.getElementById("pmUpdate")).toBeNull();
  expect(waiting.postMessage).not.toHaveBeenCalled();
});
