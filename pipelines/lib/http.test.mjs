import { afterEach, expect, it, vi } from "vitest";
import { getJson } from "./http.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("identifies traffic and waits before retrying transient failures", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 429 }))
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(Response.json({ cards: [] }));
  vi.stubGlobal("fetch", fetch);
  const request = getJson("https://example.invalid/cards", { userAgent: "PodMates-test" });
  await vi.advanceTimersByTimeAsync(1499);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(3000);
  await expect(request).resolves.toEqual({ cards: [] });
  expect(fetch).toHaveBeenLastCalledWith("https://example.invalid/cards", {
    headers: { "User-Agent": "PodMates-test", Accept: "application/json" },
  });
});

it("limits retries and honors a provider-specific delay", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementation(
    async () =>
      new Response("", {
        status: 429,
        headers: { "Retry-After": "5" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const request = getJson("https://example.invalid/commander", {
    userAgent: "PodMates-test",
    tries: 2,
    retryDelay: (_attempt, response) => Number(response.headers.get("Retry-After")) * 1000,
  });
  const rejection = expect(request).rejects.toThrow(/Gave up after 2 attempts/);
  await vi.advanceTimersByTimeAsync(4999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  await rejection;
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("distinguishes a missing record from refusal and malformed JSON without retrying", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 404 }))
    .mockResolvedValueOnce(new Response("", { status: 403 }))
    .mockResolvedValueOnce(new Response("{broken", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const options = { userAgent: "PodMates-test" };
  await expect(getJson("https://example.invalid/missing", options)).resolves.toBeNull();
  await expect(getJson("https://example.invalid/refused", options)).rejects.toThrow(/HTTP 403/);
  await expect(getJson("https://example.invalid/broken", options)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(3);
});
