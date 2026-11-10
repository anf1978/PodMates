// Turns pasted decklists into quantity/name entries: plain lists, Moxfield and
// Archidekt exports, set codes, collector numbers, foil markers and section headers.
// Pure text handling -- it never touches the card database, the DOM or the network.

export interface DeckEntry {
  qty: number;
  name: string;
}

export interface ParsedDecklist {
  entries: DeckEntry[];
  commanderNames: string[];
}

export function parseDecklistLine(line: string): DeckEntry | null {
  let text = line.trim();
  if (!text) return null;

  // Skip section headers like "Deck:", "Sideboard:", "Commander:", "Maybeboard:"
  if (/^(deck|sideboard|commander|maybeboard)s?:?\s*$/i.test(text)) return null;

  // Extract quantity prefix: "1 ", "1x ", "2X "
  let qty = 1;
  const qtyMatch = text.match(/^(\d+)\s*[xX]?\s+(.+)$/);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10) || 1;
    text = qtyMatch[2];
  }

  // Strip trailing annotations -- foil/condition markers ("*F*"), bracketed
  // set info ("[LTC]"), and set code + collector number ("(LTC) 123") --
  // repeatedly, from the true end of the string inward, until a full pass
  // changes nothing. This must run in a loop rather than once each: the set
  // code + collector number pattern only matches when it's the LAST thing
  // on the line, but Moxfield (and others) put the foil marker AFTER the
  // collector number -- "As Foretold (WHO) 805 *F*" -- so stripping the set
  // code first (the original, buggy order) simply doesn't match at all,
  // leaving "(WHO) 805" stuck to the card name and guaranteeing every
  // fuzzy-match attempt fails. Peeling one real trailing annotation off per
  // loop, in whatever order they actually appear, handles that case and any
  // other stacking without needing to special-case Moxfield specifically.
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text.replace(/\s*\*[^*]*\*\s*$/, "");
    text = text.replace(/\s*\[[^\]]+\]\s*$/, "");
    text = text.replace(/\s*\([A-Za-z0-9]{2,6}\)\s*\S*$/, "");
    if (text === before) break;
  }

  text = text.trim();
  if (!text) return null;

  return { qty, name: text };
}

export function parseDecklist(rawText: string): ParsedDecklist {
  const lines = rawText.split(/\r?\n/);
  const entries: DeckEntry[] = [];
  let inCommanderSection = false;
  const commanderNames: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^commanders?:?\s*$/i.test(trimmed)) {
      inCommanderSection = true;
      continue;
    }
    if (/^(deck|sideboard|maybeboard|mainboard)s?:?\s*$/i.test(trimmed)) {
      inCommanderSection = false;
      continue;
    }
    const parsed = parseDecklistLine(line);
    if (parsed) {
      entries.push(parsed);
      if (inCommanderSection) commanderNames.push(parsed.name);
    }
  }
  // Fallback: if no explicit Commander section, look for a single-copy legendary later
  return { entries, commanderNames };
}
