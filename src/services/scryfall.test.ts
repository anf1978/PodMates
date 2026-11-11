import { afterEach, expect, it, vi } from "vitest";
import { fetchScryfallJson } from "./scryfall";
import { reportError } from "./report-error";

vi.mock("./report-error", () => ({ reportError: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("reports HTTP, network and malformed JSON failures and preserves rejection", async () => {
  const offline = new TypeError("Failed to fetch");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const result of [
    () => Promise.resolve(new Response("", { status: 503 })),
    () => Promise.reject(offline),
    () => Promise.resolve(new Response("{")),
  ]) {
    fetchMock.mockImplementationOnce(result);
    await expect(
      fetchScryfallJson("https://api.scryfall.com/cards/collection", undefined, {
        userTriggered: true,
      }),
    ).rejects.toBeInstanceOf(Error);
  }
  expect(reportError).toHaveBeenCalledTimes(3);
  expect(reportError).toHaveBeenCalledWith(offline, {
    operation: "card-art",
    userTriggered: true,
  });
});

it("keeps a no-match lookup distinct from an unavailable service", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
  await expect(
    fetchScryfallJson("https://api.scryfall.com/cards/named", undefined, {
      allowNotFound: true,
    }),
  ).resolves.toBeNull();
  expect(reportError).not.toHaveBeenCalled();
  await expect(fetchScryfallJson("https://api.scryfall.com/cards/collection")).rejects.toThrow(
    "Scryfall answered 404",
  );
  expect(reportError).toHaveBeenCalledOnce();
});
