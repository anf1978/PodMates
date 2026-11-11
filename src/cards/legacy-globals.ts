// Strangler shim: publishes the extracted card modules on `window` under exactly the
// names the inline legacy scripts in index.html still call, so moving the code out of
// the HTML changed nothing. Add no behaviour here; delete it with the last caller.

import { fuzzyFindCard, matchDecklist } from "./lookup.ts";
import { parseDecklist } from "./parse-decklist.ts";

declare global {
  interface Window {
    parseDecklist: typeof parseDecklist;
    fuzzyFindCard: typeof fuzzyFindCard;
    matchDecklist: typeof matchDecklist;
  }
}

window.parseDecklist = parseDecklist;
window.fuzzyFindCard = fuzzyFindCard;
window.matchDecklist = matchDecklist;
