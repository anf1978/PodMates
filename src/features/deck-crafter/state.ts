// Deck Crafter's local state and pure transitions; no DOM, storage or cloud access.
import { parseDecklist } from "../../cards/parse-decklist";
import type { CardRecord } from "../../cards/tuple";
import { PM_LIMITS } from "../../services/cloud/limits";

export interface Draft {
  cards: Record<string, number>;
  commander: string | null;
  player: string;
}

export interface CrafterState extends Draft {
  filterByIdentity: boolean;
  addingPartner: boolean;
}

export function createState(): CrafterState {
  return { cards: {}, commander: null, player: "", filterByIdentity: true, addingPartner: false };
}

export function commanderNames(commander: string | null): string[] {
  return String(commander || "")
    .split(/(?<!\/) \/ (?!\/)/)
    .map((n) => n.trim())
    .filter(Boolean);
}

export function identityCard(
  state: Draft,
  findCard: (name: string) => CardRecord | undefined,
): { ci: string } | null {
  const cards = commanderNames(state.commander)
    .map(findCard)
    .filter((c) => c !== undefined);
  return cards.length
    ? { ci: [...new Set(cards.flatMap((c) => (c.ci || "").split("")))].join("") }
    : null;
}

export function fitsIdentity(card: { ci: string }, commander: { ci: string } | null): boolean {
  if (!commander) return true;
  const colors = new Set((commander.ci || "").split(""));
  return (card.ci || "").split("").every((color) => colors.has(color));
}

export function fromDecklist(raw: string, commander: string, player: string): Draft | null {
  if (!raw.trim()) return null;
  const { entries } = parseDecklist(raw.trim());
  if (!entries.length) return null;
  const cards: Record<string, number> = {};
  for (const entry of entries) cards[entry.name] = (cards[entry.name] || 0) + entry.qty;
  return { cards, commander: commander.trim() || null, player: player.trim() };
}

export function restore(
  state: CrafterState,
  draft: Draft | null,
  current: Draft | null,
  player: string,
): boolean {
  const restored = !!(draft && Object.keys(draft.cards).length);
  const source = restored ? draft! : current;
  state.cards = { ...(source?.cards || {}) };
  state.commander = source?.commander || null;
  state.player = source?.player || player;
  state.addingPartner = false;
  for (const name of commanderNames(state.commander)) {
    if (!state.cards[name]) state.cards[name] = 1;
  }
  return restored;
}

export function setCommander(state: CrafterState, name: string | null): void {
  for (const old of commanderNames(state.commander)) {
    if (old !== name && state.cards[old] === 1) delete state.cards[old];
  }
  state.commander = name || null;
  state.addingPartner = false;
  if (name && !state.cards[name]) state.cards[name] = 1;
}

export function addPartner(state: CrafterState, name: string): void {
  const names = commanderNames(state.commander);
  if (!names.length || !name || name === names[0]) return;
  if (names[1] && names[1] !== name && state.cards[names[1]] === 1) delete state.cards[names[1]];
  state.commander = `${names[0]} / ${name}`;
  if (!state.cards[name]) state.cards[name] = 1;
  state.addingPartner = false;
}

export function removeCommander(state: CrafterState, index: number): void {
  const names = commanderNames(state.commander);
  const gone = names[index];
  if (!gone) return;
  if (state.cards[gone] === 1) delete state.cards[gone];
  names.splice(index, 1);
  state.commander = names.length ? names.join(" / ") : null;
  state.addingPartner = false;
}

export function addCard(state: CrafterState, name: string): boolean {
  if (!state.cards[name] && Object.keys(state.cards).length >= PM_LIMITS.builderMaxCards)
    return false;
  state.cards[name] = Math.min((state.cards[name] || 0) + 1, PM_LIMITS.builderMaxQty);
  return true;
}

export function setQuantity(state: CrafterState, name: string, value: string): void {
  const qty = Math.min(PM_LIMITS.builderMaxQty, Math.max(0, parseInt(value, 10) || 0));
  if (qty === 0) delete state.cards[name];
  else state.cards[name] = qty;
}

export function deckText(state: Draft): string {
  return Object.entries(state.cards)
    .map(([name, qty]) => `${qty} ${name}`)
    .join("\n");
}

export function pairing(cards: (CardRecord | undefined)[]): { canPair: boolean; pairOk: boolean } {
  const text = (c: CardRecord | undefined) => c?.o || "";
  const type = (c: CardRecord | undefined) => c?.t || "";
  const partner =
    /\bpartner\b|\bfriends forever\b|\bchoose a background\b|\bdoctor's companion\b|\bbackground\b/i;
  return {
    canPair: cards.length < 2 && cards.some((c) => c && partner.test(`${text(c)} ${type(c)}`)),
    pairOk:
      cards.length < 2 ||
      cards.some((c) => !c) ||
      cards.every((c) => /\bpartner\b/i.test(text(c))) ||
      cards.every((c) => /friends forever/i.test(text(c))) ||
      (cards.some((c) => /choose a background/i.test(text(c))) &&
        cards.some((c) => /\bbackground\b/i.test(type(c)))) ||
      (cards.some((c) => /doctor's companion/i.test(text(c))) &&
        cards.some((c) => /\bdoctor\b/i.test(type(c)))),
  };
}
