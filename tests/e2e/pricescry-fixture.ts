// Local PriceScry data so the screen renders every tab without contacting the pricescry-data branch.
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";

const DAY = 2505; // 2026-11-10, days since 2020-01-01
const ART = "0000579f-7b35-4ed3-b44c-db2a538066fe";
const series = (...points: [number, number][]): [number, number][] =>
  points.map(([offset, value]) => [DAY + offset, value]);

export const priceIndex = { day: "2026-11-10", firstDay: "2026-08-01", cards: 1234 };
const fx = {
  pairs: { usdjpy: series([-200, 1_500_000]), eurjpy: series([-200, 1_650_000]) },
};
const solRing = {
  n: "Sol Ring",
  rs: 0,
  gc: 1,
  er: 5,
  ers: series([-60, 9], [0, 5]),
  p: [
    {
      id: ART,
      s: "cmm",
      sn: "Commander Masters",
      cn: "1",
      r: "2023-08-04",
      pr: {
        u: series([-100, 150], [-20, 160], [-5, 180]),
        e: series([-100, 120]),
        uf: series([-100, 500]),
        xkrn: series([-100, 210]),
        xkbn: series([-100, 105]),
        xmrn: series([-40, 175]),
      },
    },
    {
      id: "not-a-uuid",
      s: "c21",
      sn: "Commander 2021",
      cn: "263",
      r: "2021-04-23",
      pr: { u: series([-100, 130]) },
    },
  ],
  jp: [{ shop: "Hareruya", lang: "jp", finish: "nonfoil", s: series([-30, 300]) }],
};
const movers = {
  day: priceIndex.day,
  v: 2,
  windows: {
    "7": {
      up: [{ n: "Sol Ring", now: 180, pct: 12.5, shops: 3, of: 4 }],
      down: [{ n: "Arcane Signet", now: 90, pct: -8 }],
      considered: 10,
    },
    "30": { up: [], down: [], considered: 0 },
  },
};
const signals = [
  {
    type: "new_card",
    n: "Fresh Spoiler",
    k: "fresh spoiler",
    day: DAY,
    set: "tst",
    setName: "Test Set",
    releases: "2026-12-01",
    preview: { s: "A Previewer" },
  },
  {
    type: "new_printing",
    n: "Sol Ring",
    k: "sol ring",
    day: DAY - 2,
    set: "tst",
    setName: "Test Set",
  },
  { type: "legality", n: "Mana Crypt", day: DAY - 3, format: "commander", from: "l", to: "b" },
  { type: "game_changer", n: "Rhystic Study", day: DAY - 4, to: 1 },
  { type: "rank_jump", n: "Arcane Signet", day: DAY - 5, from: 900, to: 40 },
];
const shadow = {
  status: "promising",
  reason: "Linked cards beat ordinary ones.",
  day: priceIndex.day,
  events: 12,
  scoredEvents: 8,
  byType: {
    any: { 7: { verdict: "beats ordinary cards", hit25: 0.3, control25: 0.1, n: 1200, events: 8 } },
  },
  recent: [
    {
      n: "Fresh Spoiler",
      day: priceIndex.day,
      set: "tst",
      cands: 4,
      top: [{ n: "Sol Ring", r7: 0.12 }],
    },
  ],
};
const cheapwatch = {
  status: "collecting",
  reason: "Needs five releases.",
  day: priceIndex.day,
  events: 3,
  scoredEvents: 1,
  targets: ["1.5x", "2x", "3x"],
  rows: [{ target: "3x", horizon: 30, group: "all", hits: 2, expected: 0.4, picks: 120, sets: 1 }],
  moving: [
    {
      n: "Sol Ring",
      from: 100,
      now: 180,
      ratio: 1.8,
      newCard: "Fresh Spoiler",
      set: "tst",
      day: priceIndex.day,
      type: "tribal",
      rank: 2,
    },
  ],
  watching: [
    {
      n: "Fresh Spoiler",
      day: priceIndex.day,
      set: "tst",
      src: "pasted",
      picks: [{ n: "Sol Ring", from: 100, now: 120 }],
    },
  ],
  hitCards: [{ n: "Sol Ring", from: 100, to: 300, h: 14, newCard: "Fresh Spoiler", set: "tst" }],
};
const radar = {
  day: priceIndex.day,
  sets: [
    {
      name: "Test Set",
      code: "tst",
      releaseDate: "2026-12-01",
      cards: 42,
      newest: [{ n: "Fresh Spoiler" }],
    },
  ],
  found: [
    {
      n: "Leaked Card",
      type: "Creature",
      day: priceIndex.day,
      url: "https://example.com/leak",
      picks: [{ n: "Sol Ring", t: "tribal", p0: 250 }],
    },
  ],
  reddit: {
    posts: [
      {
        url: "https://example.com/post",
        title: "Spoiler <talk>",
        kind: "leak",
        flair: "Spoiler",
        created: "2026-11-10T00:00:00Z",
        score: 321,
      },
    ],
  },
  reading: {},
};

const files: Record<string, unknown> = {
  "index.json": priceIndex,
  "fx.json": fx,
  "movers.json": movers,
  "signals.json.gz": signals,
  "shadow-report.json": shadow,
  "cheapwatch-report.json": cheapwatch,
  "radar.json": radar,
};

/** Serves the fixture for every pricescry-data path; `cards/*.json.gz` shards all hold Sol Ring. */
export async function routePriceData(page: Page): Promise<void> {
  await page.route(
    "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/**",
    (route) => {
      const path = new URL(route.request().url()).pathname.split("/pricescry-data/")[1] ?? "";
      const data = path.startsWith("cards/") ? { cards: { "sol ring": solRing } } : files[path];
      if (data === undefined) return route.fulfill({ status: 404, body: "" });
      const body = JSON.stringify(data);
      return path.endsWith(".gz")
        ? route.fulfill({ contentType: "application/octet-stream", body: gzipSync(body) })
        : route.fulfill({ contentType: "application/json", body });
    },
  );
}

/** Opens PriceScry the way a person does: My Profile → View PriceScry, already unlocked for this session. */
export async function openPriceScry(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.setItem("pricescryUnlocked", "1"));
  // The account bar's profile button is visually hidden until sign-in; click it the way auth-profile.spec does.
  await page.locator("#authProfileBtn").evaluate((button: HTMLButtonElement) => button.click());
  await page.locator("#profilePriceScryBtn").click();
}
