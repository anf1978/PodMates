// One deck, one row. Linking a deck from Archidekt/Moxfield keeps a hidden "mirror" copy (its id
// starts with "linked-") so podmates can see it. If the same person then charts and saves that deck
// as well, the two are really one deck and should be listed once: the charted-and-saved one. This
// hides the mirror in the lists (Load a Deck, Build Table, player profiles) when the SAME owner has a
// saved deck with the same commander and mostly the same cards. Nothing is deleted: the link itself,
// its re-sync and the mirror all stay, and if the saved deck is ever removed the linked one shows again.
import { searchNorm } from "../cards/search";

export interface DuplicateCandidate {
  commander?: string;
  list?: string;
  docId?: string;
  ownerUid?: string | null;
  /** Set on a kept deck whose linked mirror was hidden: the site it is linked to. */
  linkedVia?: string;
}

interface Probe {
  commander?: string;
  list?: string;
  _names?: Set<string>;
}

function deckCardNames(listText: string | undefined): Set<string> {
  const out = new Set<string>();
  String(listText || "")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*(?:\d+\s*x?\s+)?(.+?)\s*$/i);
      if (!m) return;
      let n = m[1]!
        .replace(/\s*[([].*$/, "")
        .replace(/\s*\*[A-Za-z]+\*\s*$/, "")
        .replace(/^(commander|sideboard|maybeboard|deck|companion)\s*:?\s*$/i, "");
      n = searchNorm(n);
      if (n) out.add(n);
    });
  return out;
}

/** Which site a linked deck came from, from its mirror id ("linked-moxfield-123" -> "Moxfield"). */
export function linkedSite(docId: unknown): string {
  const m = String(docId || "").match(/^linked-([a-z]+)-/i);
  if (!m) return "";
  const site = m[1]!.toLowerCase();
  return site === "moxfield" ? "Moxfield" : site === "archidekt" ? "Archidekt" : m[1]!;
}

export function isLinkedMirror(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    typeof (e as DuplicateCandidate).docId === "string" &&
    (e as DuplicateCandidate).docId!.indexOf("linked-") === 0
  );
}

function sameDeck(a: Probe, b: Probe): boolean {
  const ca = searchNorm(a.commander || ""),
    cb = searchNorm(b.commander || "");
  if (ca && cb && ca !== cb) return false;
  if (!a._names) a._names = deckCardNames(a.list);
  if (!b._names) b._names = deckCardNames(b.list);
  const A = a._names,
    B = b._names;
  if (!A.size || !B.size) return false;
  let shared = 0;
  A.forEach((n) => {
    if (B.has(n)) shared++;
  });
  return shared / Math.min(A.size, B.size) >= (ca && cb ? 0.7 : 0.85);
}

/** The list without duplicate mirrors. Kept decks get `linkedVia` set (and stale marks cleared). */
export function dropLinkedDuplicates<T>(items: T[]): T[] {
  const entries = items.filter((e): e is T & DuplicateCandidate => !!e && typeof e === "object");
  entries.forEach((e) => delete e.linkedVia);
  const byOwner = new Map<string, (T & DuplicateCandidate)[]>();
  entries.forEach((e) => {
    const o = e.ownerUid || "me";
    if (!byOwner.has(o)) byOwner.set(o, []);
    byOwner.get(o)!.push(e);
  });
  const drop = new Set<unknown>();
  byOwner.forEach((group) => {
    const saved = group.filter((e) => !isLinkedMirror(e));
    if (!saved.length) return;
    group.filter(isLinkedMirror).forEach((m) => {
      const probe = { commander: m.commander, list: m.list };
      const twin = saved.find((sv) => sameDeck(probe, { commander: sv.commander, list: sv.list }));
      if (twin) {
        drop.add(m);
        // The kept deck remembers it is linked.
        if (!twin.linkedVia) twin.linkedVia = linkedSite(m.docId);
      }
    });
  });
  return items.filter((e) => !drop.has(e));
}
