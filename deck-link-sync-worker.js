// PodMates deck-link sync -- Cloudflare Worker.
// Given a pasted Archidekt or Moxfield deck LINK, fetches that one
// specific deck's full card list and returns it as plain decklist text
// PodMates can drop straight into its analyzer, plus the detected
// commander(s) separately.
//
// This replaces an earlier "list all of a user's decks by username"
// approach -- neither site has a documented, reliable API for that (see
// build notes), while fetching one specific deck by its own ID is
// consistently documented and confirmed working on both platforms.
//
// Called as: https://YOUR-WORKER-URL/?deckUrl=<url-encoded deck link>

const PODMATES_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://anf1978.github.io",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  Vary: "Origin",
};
const ALLOWED_ORIGINS = new Set([
  "https://anf1978.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403);
    const response = await handleRequest(request);
    const headers = new Headers(response.headers);
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    return new Response(response.body, { status: response.status, headers });
  },
};

async function handleRequest(request) {
  if (!["GET", "OPTIONS"].includes(request.method)) {
    const response = json({ error: "Method not allowed." }, 405);
    response.headers.set("Allow", "GET, OPTIONS");
    return response;
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.url.length > 4096) return json({ error: "Request URL too long." }, 414);

  const url = new URL(request.url);
  const deckUrl = url.searchParams.get("deckUrl");
  if (!deckUrl) {
    return json({ error: 'Missing "deckUrl" parameter.' }, 400);
  }

  const parsed = parseDeckUrl(deckUrl);
  if (!parsed) {
    return json(
      {
        error:
          "That doesn\u2019t look like an Archidekt or Moxfield deck link. Expecting something like archidekt.com/decks/12345 or moxfield.com/decks/AbCdEf.",
      },
      400,
    );
  }

  try {
    if (parsed.platform === "archidekt") return await fetchArchidektDeck(parsed.id, deckUrl);
    return await fetchMoxfieldDeck(parsed.id, deckUrl);
  } catch (err) {
    return json({ error: "Unexpected failure: " + err.message }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: CORS_HEADERS });
}

function parseDeckUrl(raw) {
  if (raw.length > 2048) return null;
  let u;
  try {
    u = new URL(raw);
  } catch (e) {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "archidekt.com") {
    const m = u.pathname.match(/^\/decks\/(\d{1,20})(?:\/[^/]*)?\/?$/);
    if (m) return { platform: "archidekt", id: m[1] };
  }
  if (host === "moxfield.com") {
    const m = u.pathname.match(/^\/decks\/([A-Za-z0-9_-]{1,100})\/?$/);
    if (m) return { platform: "moxfield", id: m[1] };
  }
  return null;
}

async function readUpstream(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": PODMATES_USER_AGENT, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (Number(res.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await res.body?.cancel();
    throw new Error("Deck response exceeds the 2 MiB limit.");
  }
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("Deck response exceeds the 2 MiB limit.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  return { res, text };
}

async function fetchArchidektDeck(id, originalUrl) {
  const apiUrl = `https://archidekt.com/api/decks/${id}/`;
  const { res, text } = await readUpstream(apiUrl);

  if (!res.ok) {
    return json(
      {
        error: `Archidekt returned an error (status ${res.status}) for this deck link. It may be private, or the ID may be wrong.`,
        raw: text.slice(0, 400),
      },
      res.status,
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return json(
      { error: "Archidekt did not return JSON for this deck.", raw: text.slice(0, 400) },
      502,
    );
  }

  const cards = Array.isArray(data.cards) ? data.cards : [];
  if (!cards.length) {
    return json(
      {
        error:
          "Archidekt returned a deck with no readable card list -- the response shape may have changed.",
        raw: text.slice(0, 500),
      },
      502,
    );
  }

  const lines = [];
  const commanders = [];
  for (const c of cards) {
    const name = c.card?.oracleCard?.name || c.card?.name || c.name;
    if (!name) continue;
    const qty = c.quantity || 1;
    const categories = (c.categories || []).map((x) => String(x).toLowerCase());
    if (categories.includes("commander")) commanders.push(name);
    lines.push(`${qty} ${name}`);
  }

  if (!lines.length) {
    return json(
      {
        error:
          "Could not read any card names from this Archidekt deck -- the response shape may have changed.",
        raw: text.slice(0, 500),
      },
      502,
    );
  }

  return json({
    platform: "archidekt",
    deckId: id,
    url: originalUrl,
    name: data.name || "Untitled deck",
    commander: commanders.join(" / "),
    decklistText: lines.join("\n"),
    cardCount: lines.length,
  });
}

async function fetchMoxfieldDeck(id, originalUrl) {
  const apiUrl = `https://api.moxfield.com/v2/decks/all/${id}`;
  const { res, text } = await readUpstream(apiUrl);

  if (!res.ok) {
    return json(
      {
        error: `Moxfield returned an error (status ${res.status}) for this deck link. This may be their bot-protection blocking a server-side request, or the deck may be private, or the ID may be wrong.`,
        raw: text.slice(0, 400),
      },
      res.status,
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return json(
      {
        error:
          "Moxfield did not return JSON for this deck -- most likely their bot-protection page rather than real data.",
        raw: text.slice(0, 300),
      },
      502,
    );
  }

  // Confirmed via live diagnostics: Moxfield does NOT nest these under a
  // "boards" wrapper (an earlier, reasonable-looking guess that turned out
  // wrong) -- mainboard/commanders/etc. are separate top-level fields, each
  // an object keyed by a card UUID.
  const lines = [];
  const commanders = [];

  function readBoard(board, isCommanderBoard) {
    if (!board) return;
    for (const entry of Object.values(board)) {
      const name = entry.card?.name;
      if (!name) continue;
      const qty = entry.quantity || 1;
      if (isCommanderBoard) commanders.push(name);
      else lines.push(`${qty} ${name}`);
    }
  }

  readBoard(data.mainboard, false);
  readBoard(data.commanders, true);

  if (!lines.length) {
    // Structural diagnostics rather than a bigger wall of raw text -- this
    // tells us directly what shape the response actually has (top-level
    // keys, and a sample entry from mainboard if one exists) instead of
    // needing to eyeball a JSON dump to find the same information.
    const topLevelKeys = Object.keys(data);
    const mainboardKeys = data.mainboard ? Object.keys(data.mainboard) : [];
    const sampleCardEntry = mainboardKeys.length ? data.mainboard[mainboardKeys[0]] : null;
    return json(
      {
        error:
          "Could not read any card names from this Moxfield deck -- the response shape may have changed, or the deck may be empty.",
        diagnostics: { topLevelKeys, mainboardEntryCount: mainboardKeys.length, sampleCardEntry },
        raw: text.slice(0, 2000),
      },
      502,
    );
  }

  return json({
    platform: "moxfield",
    deckId: id,
    url: originalUrl,
    name: data.name || "Untitled deck",
    commander: commanders.join(" / "),
    decklistText: lines.join("\n"),
    cardCount: lines.length,
  });
}
