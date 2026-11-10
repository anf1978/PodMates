// users/{uid}/trades: the private PriceScry trade ledger. A trade is a LOT of cards bought together
// plus any sales of them. Everything is validated here, so a bad value is refused with a plain
// message rather than stored.
import { collection, db, deleteDoc, doc, getDocs, setDoc } from "./firebase";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { clampText, countDocs, requireText } from "./shared";
import type { TradeDoc, TradeInput, TradeSale, WithId } from "./types";

export const tradesCol = (uid: string) => collection(db, "users", uid, "trades");

export function cleanTrade(t: TradeInput): Omit<TradeDoc, "createdAt" | "updatedAt"> {
  const L = PM_LIMITS;
  const intIn = (v: unknown, lo: number, hi: number, label: string): number => {
    if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi)
      throw new Error(`${label} must be a whole number from ${lo} to ${hi}.`);
    return v as number;
  };
  const dateIn = (v: unknown, label: string): string => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
      throw new Error(`${label} must be a date like 2026-10-09.`);
    return v;
  };
  const card = requireText(String(t.card || "").trim(), L.tradeCard, "Card name");
  if (!card) throw new Error("A trade needs a card name.");
  const qty = intIn(t.qty, 1, L.tradeQtyMax, "How many");
  const sells: TradeSale[] = (t.sells || []).map((s, i) => {
    const feePct = Number(s.feePct);
    if (!(feePct >= 0 && feePct <= 30))
      throw new Error("Sale fee must be a percentage from 0 to 30.");
    return {
      qty: intIn(s.qty, 1, qty, `Sale ${i + 1} quantity`),
      yen: intIn(s.yen, 1, L.tradeYenMax, `Sale ${i + 1} price`),
      feePct,
      shipYen: intIn(s.shipYen, 0, L.tradeYenMax, "Shipping"),
      packYen: intIn(s.packYen, 0, L.tradeYenMax, "Packing"),
      date: dateIn(s.date, `Sale ${i + 1} date`),
    };
  });
  if (sells.length > L.tradeSells)
    throw new Error(`A trade can have at most ${L.tradeSells} sales recorded.`);
  if (sells.reduce((a, s) => a + s.qty, 0) > qty)
    throw new Error("More cards are recorded as sold than were bought.");
  const noMark = t.markYen == null || t.markYen === "";
  return {
    card,
    key: clampText(String(t.key || "").toLowerCase(), L.tradeCard),
    finish: (["", "nonfoil", "foil", "etched"].includes(t.finish as string)
      ? t.finish
      : "") as TradeDoc["finish"],
    paper: !!t.paper,
    qty,
    buyYen: intIn(t.buyYen, 1, L.tradeYenMax, "Price each"),
    buyExtraYen: intIn(t.buyExtraYen || 0, 0, L.tradeYenMax, "Extra cost"),
    buyDate: dateIn(t.buyDate, "Bought-on date"),
    shop: requireText(String(t.shop || "").trim(), L.tradeShop, "Shop"),
    tag: (["", "riser", "spoiler", "other"].includes(t.tag as string)
      ? t.tag
      : "") as TradeDoc["tag"],
    note: requireText(String(t.note || "").trim(), L.tradeNote, "Note"),
    sells,
    markYen: noMark ? null : intIn(t.markYen, 1, L.tradeYenMax, "Your price check"),
    markDate: noMark ? "" : dateIn(t.markDate, "Price-check date"),
  };
}

export async function saveTrade(t: TradeInput): Promise<string> {
  const user = requireUser();
  const clean = cleanTrade(t),
    col = tradesCol(user.uid);
  const ref = t.id ? doc(db, "users", user.uid, "trades", String(t.id)) : doc(col);
  if (!t.id && PM_LIMITS.maxTrades) {
    const have = await countDocs(col);
    if (have >= PM_LIMITS.maxTrades)
      throw new Error(
        `You've reached the limit of ${PM_LIMITS.maxTrades} trades. Delete old ones to make room.`,
      );
  }
  await setDoc(ref, { ...clean, createdAt: t.createdAt || Date.now(), updatedAt: Date.now() });
  return ref.id;
}

export async function loadTrades(): Promise<Array<WithId<TradeDoc>>> {
  const user = requireUser();
  const snap = await getDocs(tradesCol(user.uid));
  const out: Array<WithId<TradeDoc>> = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as TradeDoc) }));
  return out.sort((a, b) =>
    a.buyDate < b.buyDate
      ? 1
      : a.buyDate > b.buyDate
        ? -1
        : (b.createdAt || 0) - (a.createdAt || 0),
  );
}

export async function deleteTrade(id: unknown): Promise<void> {
  const user = requireUser();
  await deleteDoc(doc(db, "users", user.uid, "trades", String(id)));
}
