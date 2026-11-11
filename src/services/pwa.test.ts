// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it.each(["rejection", "synchronous-throw"] as const)(
  "reports registration %s without a toast and continues online",
  async (kind) => {
    vi.useFakeTimers();
    vi.stubEnv("PROD", true);
    const privateError = new TypeError("https://private.example/sw.js");
    const register = vi.fn(() => {
      if (kind === "synchronous-throw") throw privateError;
      return Promise.reject(privateError);
    });
    vi.stubGlobal("navigator", {
      serviceWorker: Object.assign(new EventTarget(), { register }),
    });
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { prepareOffline } = await import("./pwa");
    await expect(prepareOffline()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "[PodMates] offline-cache failed (network-or-type).",
    );
    expect(document.getElementById("podmatesToast")).toBeNull();
  },
);

it("continues online after a broken installation instead of blocking the database", async () => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn(() => new Promise(() => {})),
  });
  vi.stubGlobal("navigator", { serviceWorker });
  const error = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { prepareOffline } = await import("./pwa");
  const first = prepareOffline();
  expect(prepareOffline()).toBe(first);
  await vi.advanceTimersByTimeAsync(5000);
  await expect(first).resolves.toBeUndefined();
  expect(error).toHaveBeenCalledExactlyOnceWith("[PodMates] offline-cache failed (error).");
  expect(document.getElementById("podmatesToast")).toBeNull();
  error.mockRestore();
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

it("reports an installation failure once and stops waiting", async () => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const registration = Object.assign(new EventTarget(), { installing });
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue(registration),
  });
  vi.stubGlobal("navigator", { serviceWorker });
  const error = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { prepareOffline } = await import("./pwa");
  const ready = prepareOffline();
  await vi.advanceTimersByTimeAsync(0);
  registration.dispatchEvent(new Event("updatefound"));
  installing.state = "redundant";
  installing.dispatchEvent(new Event("statechange"));
  await expect(ready).resolves.toBeUndefined();
  await vi.advanceTimersByTimeAsync(5000);
  expect(error).toHaveBeenCalledOnce();
  expect(document.getElementById("podmatesToast")).toBeNull();
});

it("reports an update action failure with one safe toast instead of throwing", async () => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  const waiting = {
    postMessage: vi.fn(() => {
      throw new Error("private worker detail");
    }),
  };
  const registration = Object.assign(new EventTarget(), { waiting });
  vi.stubGlobal("navigator", {
    serviceWorker: Object.assign(new EventTarget(), {
      controller: {},
      register: vi.fn().mockResolvedValue(registration),
    }),
  });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { prepareOffline } = await import("./pwa");
  await prepareOffline();
  await vi.waitFor(() => expect(document.getElementById("pmUpdate")).not.toBeNull());
  document.querySelector<HTMLButtonElement>("#pmUpdate button")!.click();
  expect(error).toHaveBeenCalledExactlyOnceWith("[PodMates] app-update failed (error).");
  expect(document.getElementById("podmatesToast")?.textContent).toBe(
    "Something went wrong. Please try again.",
  );
});
