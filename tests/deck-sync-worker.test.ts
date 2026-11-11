import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../deck-link-sync-worker.js";

const origin = "https://anf1978.github.io";
function request(deckUrl: string, method = "GET", from = origin) {
  return new Request(`https://sync.example/?deckUrl=${encodeURIComponent(deckUrl)}`, {
    method,
    headers: { Origin: from },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("deck-sync request boundary", () => {
  it.each([
    "https://archidekt.com.evil.example/decks/123",
    "http://archidekt.com/decks/123",
    "https://archidekt.com:8443/decks/123",
    "https://user:pass@archidekt.com/decks/123",
    "https://archidekt.com/not-decks/123",
    "https://moxfield.com/decks/abc/extra",
    "javascript:alert(1)",
    "https://moxfield.com/decks/" + "a".repeat(2050),
  ])("rejects unsupported URLs without fetching: %s", async (url) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await worker.fetch(request(url))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects disallowed methods and origins, and limits preflight", async () => {
    expect((await worker.fetch(request("https://archidekt.com/decks/123", "POST"))).status).toBe(
      405,
    );
    expect(
      (
        await worker.fetch(
          request("https://archidekt.com/decks/123", "GET", "https://evil.example"),
        )
      ).status,
    ).toBe(403);
    const response = await worker.fetch(request("", "OPTIONS"));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it.each([
    [
      "https://archidekt.com/decks/123/title",
      "https://archidekt.com/api/decks/123/",
      { cards: [{ quantity: 1, card: { oracleCard: { name: "Sol Ring" } } }] },
    ],
    [
      "https://www.moxfield.com/decks/abc_-",
      "https://api.moxfield.com/v2/decks/all/abc_-",
      { mainboard: { one: { quantity: 1, card: { name: "Sol Ring" } } } },
    ],
  ])("fetches only the fixed upstream for %s", async (url, upstream, data) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(data));
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(request(url));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ decklistText: "1 Sol Ring" });
    expect(fetch).toHaveBeenCalledWith(
      upstream,
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({ "User-Agent": expect.any(String) }),
      }),
    );
  });

  it.each([true, false])("bounds upstream responses (declared length: %s)", async (declared) => {
    const response = new Response("x".repeat(2 * 1024 * 1024 + 1), {
      headers: declared ? { "content-length": String(2 * 1024 * 1024 + 1) } : {},
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const result = await worker.fetch(request("https://archidekt.com/decks/123"));
    expect(result.status).toBe(502);
    expect(await result.json()).toMatchObject({ error: expect.stringContaining("2 MiB") });
  });
});
