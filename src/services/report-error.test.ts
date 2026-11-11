// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installGlobalErrorHandlers, reportError, reportOperation } from "./report-error";
import * as toast from "../ui/toast";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(toast, "showToast");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it.each([
  [new Error("password and private deck"), "error"],
  [new TypeError("https://private.example/?token=secret"), "network-or-type"],
  [{ code: "permission-denied", message: "users/private" }, "permission-denied"],
  [{ code: "auth/anything-private", email: "private@example.test" }, "authentication"],
  [{ code: "secret-code" }, "unknown"],
  ["secret rejection", "unknown"],
  [null, "unknown"],
  [
    Object.defineProperty({}, "code", {
      get() {
        throw new Error("private");
      },
    }),
    "unknown",
  ],
])("normalizes safely without logging the original payload (%#)", (err, kind) => {
  reportError(err, { operation: "cloud" });
  expect(console.error).toHaveBeenCalledExactlyOnceWith(`[PodMates] cloud failed (${kind}).`);
  expect(toast.showToast).not.toHaveBeenCalled();
});

it("logs once across boundaries, and only toasts once when a user action encounters it", () => {
  const err = new Error("<img src=x onerror=alert(1)>");
  reportError(err, { operation: "cloud" });
  reportError(err, { operation: "cloud", userTriggered: true });
  reportError(err, { operation: "unhandled-rejection" });
  reportError(err, { operation: "cloud", userTriggered: true });
  expect(console.error).toHaveBeenCalledOnce();
  expect(toast.showToast).toHaveBeenCalledExactlyOnceWith(
    "Something went wrong. Please try again.",
  );
  expect(document.getElementById("podmatesToast")?.textContent).toBe(
    "Something went wrong. Please try again.",
  );
  expect(document.querySelector("img")).toBeNull();
  expect(document.getElementById("podmatesToast")?.getAttribute("role")).toBe("status");
  expect(document.getElementById("podmatesToast")?.getAttribute("aria-live")).toBe("polite");
});

it("deduplicates primitive rejections briefly without hiding a later failure", () => {
  reportError("primitive failure", { operation: "cloud", userTriggered: true });
  reportError("primitive failure", { operation: "unhandled-rejection" });
  expect(console.error).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(1001);
  reportError("primitive failure", { operation: "cloud", userTriggered: true });
  expect(console.error).toHaveBeenCalledTimes(2);
  expect(toast.showToast).toHaveBeenCalledTimes(2);
});

it("preserves warning severity for an optional recoverable failure", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  reportError(new TypeError("private URL"), {
    operation: "offline-cache",
    severity: "warning",
  });
  expect(warn).toHaveBeenCalledExactlyOnceWith(
    "[PodMates] offline-cache failed (network-or-type).",
  );
  expect(console.error).not.toHaveBeenCalled();
  expect(toast.showToast).not.toHaveBeenCalled();
});

it("installs both global hooks once, deduplicates caught errors and leaves defaults alone", () => {
  const target = new EventTarget() as Window;
  const add = vi.spyOn(target, "addEventListener");
  installGlobalErrorHandlers(target);
  installGlobalErrorHandlers(target);
  expect(add).toHaveBeenCalledTimes(2);
  const err = new Error("private details");
  reportError(err, { operation: "cloud", userTriggered: true });
  const error = new ErrorEvent("error", { error: err, cancelable: true });
  expect(target.dispatchEvent(error)).toBe(true);
  const rejection = Object.assign(new Event("unhandledrejection", { cancelable: true }), {
    reason: err,
  });
  expect(target.dispatchEvent(rejection)).toBe(true);
  expect(console.error).toHaveBeenCalledOnce();
  expect(toast.showToast).toHaveBeenCalledOnce();
  target.dispatchEvent(
    Object.assign(new Event("unhandledrejection"), { reason: new Error("another") }),
  );
  expect(console.error).toHaveBeenLastCalledWith("[PodMates] unhandled-rejection failed (error).");
  const opaque = new ErrorEvent("error");
  target.dispatchEvent(opaque);
  expect(console.error).toHaveBeenLastCalledWith("[PodMates] global-error failed (unknown).");
  expect(toast.showToast).toHaveBeenCalledOnce();
});

it("keeps typed arguments, success values and the exact rejection through nested boundaries", async () => {
  const success = reportOperation(async (id: number) => ({ id }), { operation: "cloud" });
  await expect(success(42)).resolves.toEqual({ id: 42 });
  const err = new Error("private");
  const failure = reportOperation(
    async () => {
      throw err;
    },
    { operation: "cloud" },
  );
  const action = reportOperation(failure, { operation: "cloud", userTriggered: true });
  await expect(action()).rejects.toBe(err);
  expect(console.error).toHaveBeenCalledOnce();
  expect(toast.showToast).toHaveBeenCalledOnce();
});
