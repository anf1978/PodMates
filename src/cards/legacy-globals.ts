// Strangler shim: publishes the extracted card modules on `window` under exactly the
// names the inline legacy scripts in index.html still call, so moving the code out of
// the HTML changed nothing. Add no behaviour here; delete it with the last caller.

import { fuzzyFindCard, getCard, levenshtein, matchDecklist } from "./lookup.ts";
import { parseDecklist, parseDecklistLine } from "./parse-decklist.ts";

declare global {
  interface Window {
    parseDecklistLine: typeof parseDecklistLine;
    parseDecklist: typeof parseDecklist;
    levenshtein: typeof levenshtein;
    fuzzyFindCard: typeof fuzzyFindCard;
    getCard: typeof getCard;
    matchDecklist: typeof matchDecklist;
  }
}

window.parseDecklistLine = parseDecklistLine;
window.parseDecklist = parseDecklist;
window.levenshtein = levenshtein;
window.fuzzyFindCard = fuzzyFindCard;
window.getCard = getCard;
window.matchDecklist = matchDecklist;
