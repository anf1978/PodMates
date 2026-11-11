import { afterEach, expect, it, vi } from "vitest";
import { collectTags } from "./scryfall-tags.mjs";

afterEach(() => vi.unstubAllGlobals());

it("preserves full names and page order in the research artifact", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        data: [{ name: "Front // Back" }],
        has_more: true,
        next_page: "https://api.scryfall.com/cards/search?page=2",
      }),
    )
    .mockResolvedValueOnce(Response.json({ data: [{ name: "Sol Ring" }], has_more: false }));
  vi.stubGlobal("fetch", fetch);
  expect(await collectTags(["ramp"])).toEqual({ ramp: ["Front // Back", "Sol Ring"] });
  expect(fetch.mock.calls[0][1].headers["User-Agent"]).toBe("PodMates-tagfetch/1.0");
  expect(fetch.mock.calls[1][0]).toContain("page=2");
});

it("fails on malformed data or refusal instead of writing partial success", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{}] })));
  await expect(collectTags(["ramp"])).rejects.toThrow("Invalid Scryfall");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
  await expect(collectTags(["ramp"])).rejects.toThrow("HTTP 403");
});
