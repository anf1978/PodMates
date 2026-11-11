// NEW DIMENSION (display only): directions the deck is already leaning toward. Three kinds,
// always tied to named cards in the deck:
//   "Feed what you make": plenty of one half of a pair (token makers) and almost none of the
//     other (ways to use tokens).
//   "Build it into a plan": the other half is there but thin; one or two more pieces make a plan.
//   "Commander pivot": the commander pays off one half but the deck has few of the other half.
// Nothing here changes a score or a classification. Moved unchanged from index.html.

import type { CardRecord } from "../../../cards/tuple.ts";
import { centralityPluralForms } from "../../../engine/centrality-fed.ts";
import { knowCard, knowQ } from "./knowledge.ts";
import { IXD_CHEAP, dimensions, ixdPl, ixdTyp, type Side } from "./dimension-table.ts";
import { ixFaceText, ixText } from "./text.ts";
import type { IxPick, IxSuggestion, Knowledge } from "./types.ts";

function ixdCount(matched: ReadonlyArray<{ card: CardRecord }>, side: Side): string[] {
  const names: string[] = [];
  for (const m of matched) {
    const c = m.card;
    try {
      if (side.test(ixText(c), c)) names.push(c.n);
    } catch {
      // a card whose text trips a reader is simply not counted
    }
  }
  return names;
}

function ixdCands(
  k: Knowledge,
  pool: readonly CardRecord[],
  side: Side,
  deckSet: ReadonlySet<string>,
): IxPick[] {
  const out: IxPick[] = [];
  for (const c of pool) {
    // only cards the community lists recognise
    if (
      (c.m || 0) > IXD_CHEAP ||
      /\bland\b/.test(ixdTyp(c)) ||
      deckSet.has(String(c.n).toLowerCase()) ||
      !knowCard(k, c.n)
    )
      continue;
    const t = ixFaceText(c);
    for (const [re, why] of side.cands) {
      let ok = false;
      try {
        ok = typeof re === "function" ? re(t, c) : re.test(t);
      } catch {
        ok = false;
      }
      if (ok) {
        out.push({ n: c.n, m: c.m || 0, why, g: c.g });
        break;
      }
    }
  }
  return out;
}

export function ixNewDimensions(
  k: Knowledge,
  blink: ReadonlySet<string>,
  matched: ReadonlyArray<{ card: CardRecord }>,
  commanders: readonly string[],
  pool: readonly CardRecord[],
): IxSuggestion[] {
  const found: Array<{ score: number; item: IxSuggestion }> = [];
  const deckSet = new Set(matched.map((m) => String(m.card.n).toLowerCase()));
  const cmdCards = (commanders || [])
    .map((n) => matched.find((m) => m.card.n === n)?.card)
    .filter((c): c is CardRecord => Boolean(c));
  const by = (a: IxPick, b: IxPick): number =>
    knowQ(k, b.n) - knowQ(k, a.n) || a.m - b.m || a.n.localeCompare(b.n);
  const eg = (arr: string[]): string => arr.slice(0, 3).join(", ");
  const safe = (fn: () => boolean): boolean => {
    try {
      return fn();
    } catch {
      return false;
    }
  };
  for (const d of dimensions(blink)) {
    const mk = ixdCount(matched, d.make),
      pa = ixdCount(matched, d.pay);
    let made: { tag: string; side: Side; label: string; sub: string } | null = null;
    // forward: lots of the maker side, few of the payoff side
    if (mk.length >= d.make.min && d.pay.cands.length) {
      if (pa.length <= 1)
        made = {
          tag: "Feed what you make",
          side: d.pay,
          label: d.mk,
          sub:
            "you run " +
            mk.length +
            " " +
            d.make.name +
            " (" +
            eg(mk) +
            ") but " +
            (pa.length ? "only " + ixdPl(d.pay, pa.length) : "no " + d.pay.name),
        };
      else if (pa.length <= d.pay.max)
        made = {
          tag: "Build it into a plan",
          side: d.pay,
          label: d.mk,
          sub:
            mk.length +
            " " +
            d.make.name +
            " and " +
            ixdPl(d.pay, pa.length) +
            " (" +
            eg(pa) +
            "): a couple more would make it a real plan",
        };
    }
    // reverse: lots of the payoff side (reanimation) and few of the enablers
    if (!made && d.reverse && pa.length >= d.pay.min && mk.length <= 1 && d.make.cands.length)
      made = {
        tag: "Feed what you make",
        side: d.make,
        label: d.mk2!,
        sub:
          "you run " +
          pa.length +
          " " +
          d.pay.name +
          " (" +
          eg(pa) +
          ") but " +
          (mk.length ? "only " + mk.length : "no") +
          " " +
          d.make.name,
      };
    // commander pivot: the commander is a payoff but the deck lacks the maker side
    if (
      !made &&
      d.make.cands.length &&
      cmdCards.length &&
      mk.length < Math.ceil(d.make.min / 2) &&
      cmdCards.some((c) => safe(() => d.pay.test(ixText(c), c) && !d.make.test(ixText(c), c)))
    ) {
      made = {
        tag: "Commander pivot",
        side: d.make,
        label: d.mk2 || "Feed it",
        sub:
          cmdCards.find((c) => safe(() => d.pay.test(ixText(c), c)))?.n +
          " " +
          d.cmd +
          ", but the deck has " +
          (mk.length ? "only " + mk.length : "no") +
          " " +
          d.make.name,
      };
    }
    if (!made) continue;
    const list = ixdCands(k, pool, made.side, deckSet).sort(by).slice(0, 5);
    if (list.length < 2) continue;
    found.push({
      score:
        (made.tag === "Commander pivot" ? 0.5 : 1) * Math.max(mk.length / (d.make.min || 1), 1),
      item: {
        title: d.label,
        sub: made.sub,
        tag: made.tag,
        dim: true,
        groups: [{ label: made.label, list }],
      },
    });
  }
  tribalDimension(k, matched, pool, deckSet, by, found);
  found.sort((a, b) => b.score - a.score);
  return found.slice(0, 2).map((f) => f.item);
}

/** Tribal: a creature type with plenty of members and no lord. */
function tribalDimension(
  k: Knowledge,
  matched: ReadonlyArray<{ card: CardRecord }>,
  pool: readonly CardRecord[],
  deckSet: ReadonlySet<string>,
  by: (a: IxPick, b: IxPick) => number,
  found: Array<{ score: number; item: IxSuggestion }>,
): void {
  try {
    const counts = new Map<string, number>();
    for (const m of matched) {
      const t = String(m.card.t || "");
      if (!/creature/i.test(t.split("—")[0]!) || t.indexOf("—") < 0) continue;
      for (const s of t.split("—")[1]!.trim().split(/\s+/))
        if (s && s !== "Human") counts.set(s, (counts.get(s) || 0) + 1);
    }
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    const tribe = !top
      ? ""
      : /(?:fe?)$/.test(top[0])
        ? top[0].replace(/fe?$/, "ves")
        : /y$/.test(top[0])
          ? top[0].replace(/y$/, "ies")
          : /(?:s|x|ch|sh)$/.test(top[0])
            ? top[0] + "es"
            : top[0] + "s";
    if (top && top[1] >= 12) {
      const forms = centralityPluralForms(top[0])
        .map((w) => w.toLowerCase())
        .join("|");
      const lordRe = new RegExp(
        "(?:other )?(?:" +
          forms +
          ") you control (?:get|have|gain)|(?:each|every|another) (?:" +
          forms +
          ")[^.]{0,40}(?:get|gets|have)",
      );
      const lords = matched.filter((m) => lordRe.test(ixText(m.card))).map((m) => m.card.n);
      if (lords.length <= 1) {
        const list: IxPick[] = [];
        for (const c of pool) {
          if (
            (c.m || 0) > IXD_CHEAP ||
            deckSet.has(String(c.n).toLowerCase()) ||
            /\bland\b/.test(ixdTyp(c)) ||
            !knowCard(k, c.n)
          )
            continue;
          const t = ixText(c);
          if (lordRe.test(t))
            list.push({ n: c.n, m: c.m || 0, why: "boosts or rewards your " + tribe, g: c.g });
        }
        list.sort(by);
        if (list.length >= 2)
          found.push({
            score: top[1] / 12,
            item: {
              title: "Your " + tribe,
              sub:
                "you run " +
                top[1] +
                " " +
                tribe +
                " but " +
                (lords.length ? "only " + lords.length + " lord" : "no lords"),
              tag: "Feed what you make",
              dim: true,
              groups: [{ label: "Lords and tribal payoffs", list: list.slice(0, 5) }],
            },
          });
      }
    }
  } catch {
    // display only
  }
}
