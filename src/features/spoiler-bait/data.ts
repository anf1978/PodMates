// Scryfall and recorded-signal card sources; cloud votes are handled by the controller.
import { fetchScryfallJson } from "../../services/scryfall";
import { reportError } from "../../services/report-error";
import { cardKey, WINDOW_DAYS, type SpoilerCard } from "./state";

export interface Signal {
  type: string;
  day: number;
  n: string;
  rarity?: string;
  setName?: string;
  set?: string;
  preview?: { s?: string };
}
const DAY = 86400000;
const EPOCH = Date.UTC(2020, 0, 1);
let cache: { at: number; cards: SpoilerCard[] } | null = null;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string => (typeof value === "string" ? value : "");
function data(value: unknown): Record<string, unknown>[] {
  const rows = record(value).data;
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object"))
    throw new Error("Invalid Scryfall card list");
  return rows.map(record);
}
export function signalCards(signals: readonly Signal[], today: string): SpoilerCard[] {
  const index = Math.round((Date.parse(today.slice(0, 10)) - EPOCH) / DAY);
  const seen = new Set<string>();
  const image = (name: string, version: string): string =>
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${version}`;
  return signals
    .filter((signal) => signal.type === "new_card" && signal.day >= index - WINDOW_DAYS)
    .sort((a, b) => b.day - a.day)
    .flatMap((signal) => {
      const key = cardKey(signal.n);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [
        {
          key,
          n: signal.n,
          rarity: signal.rarity || "",
          setName: signal.setName || signal.set || "",
          date: new Date(EPOCH + signal.day * DAY).toISOString().slice(0, 10),
          via: signal.preview?.s || "",
          img: image(signal.n, "normal"),
          thumb: image(signal.n, "small"),
        },
      ];
    });
}
export async function fetchSpoilers(): Promise<SpoilerCard[]> {
  if (cache && Date.now() - cache.at < 30 * 60000) return cache.cards;
  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const query = `(is:spoiler or date>=${since}) -is:reprint game:paper`;
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=spoiled&dir=desc&unique=cards`;
  const cards: SpoilerCard[] = [],
    seen = new Set<string>();
  for (let page = 0; page < 3 && url; page++) {
    const result = await fetchScryfallJson(url, undefined, {
      allowNotFound: true,
      userTriggered: true,
    });
    if (!result) break;
    for (const card of data(result)) {
      const preview = record(card.preview),
        when = text(preview.previewed_at);
      if ((when || text(card.released_at)) < since) continue;
      const name = text(card.name),
        key = cardKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const front = Array.isArray(card.card_faces) ? record(card.card_faces[0]) : {};
      const face = record(card.image_uris || front.image_uris);
      cards.push({
        key,
        n: name,
        rarity: text(card.rarity),
        setName: text(card.set_name),
        date: when || text(card.released_at),
        via: text(preview.source),
        img: text(face.normal) || text(face.small),
        thumb: text(face.small) || text(face.normal),
      });
    }
    const list = record(result);
    url = list.has_more ? text(list.next_page) : "";
  }
  cache = { at: Date.now(), cards };
  return cards;
}
export async function enrichRarities(cards: SpoilerCard[]): Promise<void> {
  const need = cards.filter((card) => !card.rarity);
  try {
    for (let i = 0; i < need.length; i += 75) {
      const chunk = need.slice(i, i + 75);
      const result = await fetchScryfallJson("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((card) => ({ name: card.n })) }),
      });
      const byName = new Map(
        data(result).map((card) => [text(card.name).toLowerCase(), text(card.rarity)]),
      );
      for (const card of chunk) {
        const rarity =
          byName.get(card.n.toLowerCase()) || byName.get(card.n.split(" // ")[0].toLowerCase());
        if (rarity) card.rarity = rarity;
      }
    }
  } catch (error) {
    // Rarity is optional: keep unknown cards in the queue when enrichment is unavailable.
    reportError(error, { operation: "card-art" });
  }
}
