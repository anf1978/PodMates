// The tray watcher must not leak subscriptions or fallback intervals after replacement.
// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { watchTray } from "./watch";
const fake = vi.hoisted(() => ({ watch: vi.fn() }));
vi.mock("../../services/cloud/gatherings", () => ({ watchGathering: fake.watch }));
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  vi.resetAllMocks();
});

it("falls back once even when subscription failure is synchronous and cleans up on close", () => {
  vi.useFakeTimers();
  const off = vi.fn(),
    update = vi.fn();
  fake.watch.mockImplementation((_pod, _id, _data, failure) => {
    failure(new Error("offline"));
    return off;
  });
  const content = document.createElement("div");
  document.body.append(content);
  const stop = watchTray("pod", "g", content, update);
  expect(off).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(8000);
  expect(update).toHaveBeenCalledTimes(1);
  content.dataset.confirming = "1";
  vi.advanceTimersByTime(8000);
  expect(update).toHaveBeenCalledTimes(1);
  stop();
  stop();
  vi.advanceTimersByTime(16000);
  expect(update).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
