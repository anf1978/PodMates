import { writeFileSync } from "node:fs";
import { getJson, sleep } from "../lib/http.mjs";
import { isMain } from "../lib/cli.mjs";

const TAGS = [
  "ramp",
  "mana-dork",
  "card-advantage",
  "removal",
  "sweeper",
  "tutor",
  "recursion",
  "sacrifice-outlet",
  "token-generator",
  "blink",
  "cost-reducer",
  "anthem",
  "lord",
  "extra-combat",
  "haste-enabler",
  "repeatable-token-generator",
  "untapper",
  "mana-doubler",
  "trigger-doubler",
];

/** Research export: preserve full printed names, unlike the weekly app's front-face lists.
 * @param {string[]} tags
 */
export async function collectTags(tags = TAGS) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const tag of tags) {
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`otag:${tag} f:commander`)}&unique=cards`;
    const names = [];
    while (url) {
      const page = await getJson(url, { userAgent: "PodMates-tagfetch/1.0" });
      await sleep(120);
      if (!page) {
        console.warn(`${tag}: HTTP 404 (tag may not exist)`);
        break;
      }
      if (
        !Array.isArray(page.data) ||
        page.data.some((card) => typeof card.name !== "string") ||
        (page.has_more && typeof page.next_page !== "string")
      ) {
        throw new Error(`Invalid Scryfall tag page: ${tag}`);
      }
      names.push(...page.data.map((card) => card.name));
      url = page.has_more ? page.next_page : null;
    }
    out[tag] = names;
    console.log(tag, names.length);
  }
  return out;
}

if (isMain(import.meta.url)) {
  writeFileSync(process.argv[2] || "scryfall-tags.json", JSON.stringify(await collectTags()));
}
