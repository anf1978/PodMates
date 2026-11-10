import type { CardRecord } from "../cards/tuple.ts";

/** Whether a card can actually be played in Commander (not banned, not an Un-card or game piece). */
export function ixUsable(c: CardRecord): boolean {
  if (c.b) return false;
  if (c.x === true) return false;
  const t = String(c.t || ""),
    o = String(c.o || "");
  if (
    /\b(?:stickers?|attraction|contraption|scheme|plane|phenomenon|vanguard|conspiracy|hero|dungeon|emblem|token)\b/i.test(
      t,
    )
  )
    return false;
  if (
    /\{TK\}|\{\u00BD\}|\{\u221E\}|\{100\}|\{1000000\}|\bunfinity\b|\bsticker|\battraction\b|\bcontraption\b|\bplaytest\b|\bflip a coin\b|\bheads\b|\bsilver\b/i.test(
      o,
    )
  )
    return false;
  if (c.x === undefined && /^(?:special|bonus)$/.test(c.r)) return false;
  return true;
}
