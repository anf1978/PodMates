// Card art, fetched on demand from Scryfall and never stored. Scryfall sets CORS headers for every
// request, so the browser calls it directly. URLs are cached in memory for this page load only:
// art changes with reprints, so a stale persisted URL would be worse than asking again.
import { fetchScryfallJson } from "./scryfall";

export type CardImageSize = "small" | "normal" | "large" | "art_crop" | "png";

interface ScryfallFace {
  name?: string;
  image_uris?: Partial<Record<CardImageSize, string>>;
}

export interface ScryfallCard extends ScryfallFace {
  card_faces?: ScryfallFace[];
}

/** Read-only lookups that ignore case and surrounding whitespace in the requested name. */
export interface CardImageMap {
  get(name: string): string | undefined;
  getOther(name: string): string | undefined;
}

const imageCache = new Map<string, string | null>();
const otherFaceCache = new Map<string, string | null>();

function normalizeName(name: string | undefined): string {
  return (name || "").trim().toLowerCase();
}

function pick(uris: ScryfallFace["image_uris"], size: CardImageSize): string | null {
  return (uris && (uris[size] || uris.normal)) || null;
}

/**
 * Picks the image for the face that was actually asked for (a transform commander looked up by
 * its back face), then the card's own art, then the front face.
 */
export function imageUrlForName(
  card: ScryfallCard,
  requestedName: string,
  size: CardImageSize = "normal",
): string | null {
  const requested = normalizeName(requestedName);
  if (Array.isArray(card.card_faces)) {
    const face = card.card_faces.find((f) => normalizeName(f.name) === requested);
    if (face && face.image_uris) return pick(face.image_uris, size);
  }
  if (card.image_uris) return pick(card.image_uris, size);
  const front = Array.isArray(card.card_faces) ? card.card_faces[0] : undefined;
  if (front && front.image_uris) return pick(front.image_uris, size);
  return null;
}

/**
 * For a genuinely two-sided card (each face has its own image) returns [this face, other face].
 * Single-image cards (split, adventure, flip) have no other face, so they never get a flip button.
 */
export function facePair(
  card: ScryfallCard,
  requestedName: string,
  size: CardImageSize = "normal",
): [string | null, string | null] {
  const url = imageUrlForName(card, requestedName, size);
  const faces = card.card_faces;
  if (card.image_uris || !Array.isArray(faces) || faces.length !== 2) return [url, null];
  if (!faces.every((f) => f && f.image_uris)) return [url, null];
  const requested = normalizeName(requestedName);
  let index = faces.findIndex((f) => normalizeName(f.name) === requested);
  if (index < 0) index = 0;
  return [url, pick(faces[1 - index].image_uris, size)];
}

/** One card's image URL, or null when Scryfall has none. Failures are reported, then cached as null. */
export async function fetchCardImageUrl(
  cardName: string,
  size: CardImageSize = "normal",
  userTriggered = false,
): Promise<string | null> {
  const key = cardName + "|" + size;
  if (imageCache.has(key)) return imageCache.get(key) ?? null;
  const lookup = async (name: string) =>
    (await fetchScryfallJson(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
      undefined,
      { allowNotFound: true, userTriggered },
    )) as ScryfallCard | null;
  try {
    let card = await lookup(cardName);
    // Scryfall's combined "A // B" name does not always resolve exactly; the front face does.
    if (!card && cardName.includes("//")) card = await lookup(cardName.split("//")[0].trim());
    if (!card) {
      imageCache.set(key, null);
      return null;
    }
    const [url, other] = facePair(card, cardName, size);
    otherFaceCache.set(key, other);
    imageCache.set(key, url);
    return url;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

/** The other face of a two-sided card already fetched by fetchCardImageUrl. */
export function cachedOtherFaceUrl(cardName: string, size: CardImageSize = "normal") {
  return otherFaceCache.get(cardName + "|" + size) ?? null;
}

/**
 * Many cards at once through /cards/collection (at most 75 names per request, sent in parallel).
 * Each requested name is matched against the card's own name or a face name rather than trusting
 * Scryfall to echo it exactly; unmatched "A // B" names get one retry under their front face.
 */
export async function fetchCardImagesBatch(
  cardNames: string[],
  size: CardImageSize = "normal",
): Promise<{ urlMap: CardImageMap; notFound: string[] }> {
  const urls = new Map<string, string>();
  const others = new Map<string, string>();

  async function attempt(names: string[]): Promise<string[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < names.length; i += 75) chunks.push(names.slice(i, i + 75));
    const failed: string[] = [];
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const data = (await fetchScryfallJson(
            "https://api.scryfall.com/cards/collection",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
            },
            { userTriggered: true },
          )) as { data?: ScryfallCard[] } | null;
          const results = (data && data.data) || [];
          for (const name of chunk) {
            const requested = normalizeName(name);
            const match = results.find(
              (c) =>
                normalizeName(c.name) === requested ||
                (Array.isArray(c.card_faces) &&
                  c.card_faces.some((f) => normalizeName(f.name) === requested)),
            );
            const [url, other] = match ? facePair(match, name, size) : [null, null];
            if (!url) {
              failed.push(name);
              continue;
            }
            urls.set(requested, url);
            if (other) others.set(requested, other);
          }
        } catch {
          failed.push(...chunk);
        }
      }),
    );
    return failed;
  }

  const missing = await attempt([...new Set(cardNames)]);
  const splitNames = missing.filter((n) => n.includes("//"));
  const notFound = missing.filter((n) => !n.includes("//"));
  if (splitNames.length) {
    const fronts = splitNames.map((n) => n.split("//")[0].trim());
    await attempt(fronts);
    splitNames.forEach((full, i) => {
      const front = normalizeName(fronts[i]);
      const url = urls.get(front);
      if (!url) {
        notFound.push(full);
        return;
      }
      urls.set(normalizeName(full), url);
      const other = others.get(front);
      if (other) others.set(normalizeName(full), other);
    });
  }

  return {
    urlMap: {
      get: (name) => urls.get(normalizeName(name)),
      getOther: (name) => others.get(normalizeName(name)),
    },
    notFound,
  };
}
