// One package as markup for the Synergy panel (synergy/panel.ts inserts it as trusted markup;
// package heads and lines are prebuilt strings). Every card name goes through `link` and every
// other piece of card text through escapeHtml.

import { escapeHtml } from "../../../ui/card-name.ts";
import type { IxPackage } from "./types.ts";

function ixPlural(l: string): string {
  const m = /^(.*?)( with .*)$/.exec(l);
  const h = m ? m[1]! : l,
    t = m ? m[2]! : "";
  return (/s$/.test(h) ? h : h.replace(/y$/, "ie") + "s").replace(/ieie/, "ie") + t;
}

const slots = (s: string, L: (n: string) => string): string =>
  s.replace(/\u0001([^\u0002]*)\u0002/g, (_m, n: string) => L(n));

export function ixDescribePackage(pk: IxPackage, link: (name: string) => string): string {
  const L = (n: string): string => link(n);
  const names = (arr: string[], k: number): string =>
    arr.slice(0, k).map(L).join(", ") + (arr.length > k ? ` +${arr.length - k} more` : "");
  let head: string;
  if (pk.head) head = slots(pk.head, L);
  else if (pk.kind === "pool") {
    const ms = pk.members!;
    const phrase = pk.phrase!;
    if (pk.rule)
      head = `<strong>${ms.length} cards reward your ${ixPlural(phrase.replace(/^an? /, ""))}</strong> (${ms
        .slice(0, 5)
        .map(
          (m) =>
            L(m.name) + (m.effect ? " – " + escapeHtml(m.effect.replace(/~/g, "").trim()) : ""),
        )
        .join(
          ", ",
        )}${ms.length > 5 ? ` +${ms.length - 5} more` : ""}). ${pk.objCount} cards in the deck count, so these stack.`;
    else
      head = `<strong>${ms.length} cards pay off whenever ${escapeHtml(phrase)}</strong> (${ms
        .slice(0, 5)
        .map((m) => L(m.name) + (m.effect ? " – " + escapeHtml(m.effect) : ""))
        .join(", ")}${ms.length > 5 ? ` +${ms.length - 5} more` : ""}). ${
        /\bland\b/.test(phrase)
          ? "Every land drop sets these off, so extra land drops and replayed lands pay several times."
          : "Nearly every card in the deck feeds these, so they are steady value rather than a focused plan."
      }`;
  } else if (pk.kind === "group") {
    const ms = pk.members!;
    head = `<strong>${ms.length} cards do something ${pk.event === "dies" ? "when they die" : "when they enter"}</strong> (${ms
      .slice(0, 4)
      .map((m) => L(m.name) + " – " + escapeHtml(m.effect))
      .join(", ")}${ms.length > 4 ? ` +${ms.length - 4} more` : ""}), so anything that ${
      pk.event === "dies"
        ? "repeats or doubles deaths"
        : "brings them back in or doubles enter effects"
    } is worth extra here.`;
  } else if (pk.kind === "rule")
    head = `<strong>${L(pk.payoff)}</strong> changes how your ${ixPlural(pk.filter.label.replace(/^an? |^another /, ""))} work: ${escapeHtml(pk.effect.replace(/~/g, pk.payoff))}.`;
  else if (pk.phrase)
    head = `<strong>${L(pk.payoff)}</strong> ${pk.effect} whenever ${escapeHtml(pk.phrase)}.`;
  else if (pk.filter.self)
    head = `<strong>${L(pk.payoff)}</strong> ${pk.effect} when it ${pk.event === "dies" ? "dies" : "enters"}.`;
  else
    head = `<strong>${L(pk.payoff)}</strong> ${pk.effect} whenever ${escapeHtml(pk.filter.label)} ${pk.event === "dies" ? "dies" : "enters"}.`;
  const lines = (pk.extraLines || []).map((x) => slots(x, L));
  if (pk.objCount)
    lines.push(
      `<span style="color:var(--text-primary);">${pk.objCount} ${pk.fodderLabel ? escapeHtml(pk.fodderLabel) : "card" + (pk.objCount === 1 ? "" : "s") + " in the deck " + (pk.kind === "rule" && pk.head ? "get the discount" : "set it off")}</span> (${names(pk.objects, 4)}).`,
    );
  if (pk.tokenMakers.length)
    lines.push(`Token makers that also trigger it: ${names(pk.tokenMakers, 3)}.`);
  const rep = pk.repeaters.map((r) => `${L(r.name)} (${escapeHtml(r.how)})`);
  if (rep.length)
    lines.push(
      `${pk.kind === "rule" ? "Helps it work faster" : "Sets it off again"}: ${rep.slice(0, 4).join(", ")}${rep.length > 4 ? ` +${rep.length - 4} more` : ""}.`,
    );
  if (pk.statLine) lines.push(escapeHtml(pk.statLine));
  if (pk.finishers && pk.finishers.length)
    lines.push(
      `<span style="color:var(--gold);">Finishers</span> (the rule turns toughness into damage, so each point of toughness is a point of damage): ${pk.finishers
        .slice(0, 5)
        .map((r) => L(r.name))
        .join(", ")}${pk.finishers.length > 5 ? ` +${pk.finishers.length - 5} more` : ""}.`,
    );
  if (pk.backups && pk.backups.length)
    lines.push(
      `<span style="color:var(--gold);">Backup</span> if the commander is removed: ${pk.backups.map((r) => L(r.name)).join(", ")} gives the same rule.`,
    );
  if (pk.multipliers.length)
    lines.push(
      `<span style="color:var(--gold);">Counts twice</span> with ${pk.multipliers
        .slice(0, 4)
        .map((r) => L(r.name))
        .join(", ")}.`,
    );
  return `<div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed var(--line);">
    <div style="font-size:14px; color:var(--text-primary);">${pk.isCmd ? '<span style="font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--gold); border:1px solid var(--line-strong); border-radius:8px; padding:1px 7px; margin-right:6px; white-space:nowrap;">Commander</span>' : ""}${head}</div>
    ${lines.map((x) => `<div style="font-size:12.5px; color:var(--text-soft); margin-top:3px;">${x}</div>`).join("")}
  </div>`;
}
