// PodMates deck sync — fetches a player's public deck list from Archidekt
// or Moxfield on their behalf. Runs server-side (not in the browser)
// because neither site reliably allows a request made directly from
// another website: Moxfield's API sits behind Cloudflare bot protection,
// and Archidekt (while more openly tolerant of third-party use) doesn't
// guarantee browser-to-browser access either.
//
// Called as: /.netlify/functions/sync-decks?source=archidekt&username=NAME
//        or: /.netlify/functions/sync-decks?source=moxfield&username=NAME

const PODMATES_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

exports.handler = async function (event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const { source, username } = event.queryStringParameters || {};

  if (!source || !username) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing "source" or "username" parameter.' }) };
  }

  try {
    if (source === 'archidekt') return await fetchArchidekt(username, cors);
    if (source === 'moxfield') return await fetchMoxfield(username, cors);
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'source must be "archidekt" or "moxfield".' }) };
  } catch (err) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Unexpected failure: ' + err.message }) };
  }
};

async function fetchArchidekt(username, cors) {
  const url = `https://archidekt.com/api/decks/cards/?owner=${encodeURIComponent(username)}&ownerexact=true&pageSize=100`;
  const res = await fetch(url, { headers: { 'User-Agent': PODMATES_USER_AGENT, 'Accept': 'application/json' } });
  const text = await res.text();

  if (!res.ok) {
    return { statusCode: res.status, headers: cors, body: JSON.stringify({ error: `Archidekt returned an error (status ${res.status}).`, raw: text.slice(0, 400) }) };
  }
  let data;
  try { data = JSON.parse(text); } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Archidekt did not return JSON -- the response may have changed shape.', raw: text.slice(0, 400) }) };
  }

  const list = data.results || data.decks || (Array.isArray(data) ? data : []);
  const decks = list.map(d => ({
    id: d.id, name: d.name || 'Untitled deck',
    format: (d.deckFormat && d.deckFormat.name) || d.format || null,
    updatedAt: d.updatedAt || d.modified || d.createdAt || null,
    url: `https://archidekt.com/decks/${d.id}`,
  }));
  return { statusCode: 200, headers: cors, body: JSON.stringify({ source: 'archidekt', username, decks, foundCount: decks.length }) };
}

async function fetchMoxfield(username, cors) {
  const url = `https://api.moxfield.com/v2/users/${encodeURIComponent(username)}/decks?pageSize=100`;
  const res = await fetch(url, { headers: { 'User-Agent': PODMATES_USER_AGENT, 'Accept': 'application/json' } });
  const text = await res.text();

  if (!res.ok) {
    return { statusCode: res.status, headers: cors, body: JSON.stringify({ error: `Moxfield returned an error (status ${res.status}). This may be their bot-protection blocking a server-side request rather than a problem with the username.`, raw: text.slice(0, 400) }) };
  }
  let data;
  try { data = JSON.parse(text); } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Moxfield did not return JSON -- most likely their bot-protection page rather than real data. This is a known limitation, not a bug in your username.', raw: text.slice(0, 300) }) };
  }

  const decks = (data.data || []).map(d => ({
    id: d.publicId, name: d.name || 'Untitled deck', format: d.format || null,
    updatedAt: d.lastUpdatedAtUtc || null,
    url: d.publicUrl || `https://www.moxfield.com/decks/${d.publicId}`,
  }));
  return { statusCode: 200, headers: cors, body: JSON.stringify({ source: 'moxfield', username, decks, foundCount: decks.length }) };
}
