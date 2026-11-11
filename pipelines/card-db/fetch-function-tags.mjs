// pipelines/card-db/fetch-function-tags.mjs
// Pulls Scryfall Tagger function tags (otag:) for the few precise tags the app uses and writes a small JSON file:
//   { "blink": ["ghostway", ...], "extra-combat": [...] }   (front-face names, lower case, sorted)
// Usage: node fetch-function-tags.mjs function-tags.json
// To add a tag the app should know about, add it to TAGS here AND read it in index.html (IX_TAGS).
import { writeFileSync } from "fs";
import { getJson, sleep } from "../lib/http.mjs";

const OUT = process.argv[2] || "function-tags.json";
const TAGS = ["blink", "extra-combat"];

const out = {};
for (const tag of TAGS) {
  let url =
    "https://api.scryfall.com/cards/search?q=" +
    encodeURIComponent("otag:" + tag + " f:commander") +
    "&unique=cards";
  const names = new Set();
  while (url) {
    const j = await getJson(url, { userAgent: "PodMates-weekly/1.0" });
    if (!j) break;
    j.data.forEach((c) => names.add(String(c.name).split("//")[0].trim().toLowerCase()));
    url = j.has_more ? j.next_page : null;
    await sleep(120); // be polite to Scryfall
  }
  out[tag] = [...names].sort();
  console.log(tag, out[tag].length);
}
writeFileSync(OUT, JSON.stringify(out));
