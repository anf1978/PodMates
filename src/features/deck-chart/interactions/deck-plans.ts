// Game plans read from the deck's make-up rather than from one trigger: ramp to the commander,
// a mana-sink commander, board resets, what helps the commander work, Aura stacking and
// protection. Moved unchanged from the inline INTERACTION PACKAGES block.

import { escapeHtml } from "../../../ui/card-name.ts";
import { ixTrait } from "./secondary-packages.ts";
import { IX_UNTAP_RE, ixLinkSlot, ixNames, ixPlan, ixRoles } from "./text.ts";
import type { IxEntry, IxPackage } from "./types.ts";

const flag = (m: IxEntry, k: string): boolean => {
  try {
    return !!ixTrait(m.card, k);
  } catch {
    return false;
  }
};
const roleOf = (m: IxEntry) => ixRoles(m.text);
const namesOf = ixNames;
const plan = (
  payoff: string,
  isCmd: boolean,
  head: string,
  lines: string[],
  score: number,
): IxPackage => ixPlan(payoff, isCmd, head, lines, score, false);

export function ixDeckPlans(all: IxEntry[], nonland: IxEntry[], used: Set<string>): IxPackage[] {
  const plans: IxPackage[] = [];
  const safeNames = new Set<string>();
  const cmdAll = all.filter((x) => x.isCmd);
  {
    const pieces = nonland.filter((m) => !m.isCmd && (flag(m, "ramp") || roleOf(m).landRamp));
    const rocks = pieces.filter((m) => flag(m, "manaRock") || flag(m, "fastMana"));
    const dorks = pieces.filter((m) => flag(m, "manaDork"));
    const lands = pieces.filter(
      (m) =>
        !rocks.includes(m) &&
        !dorks.includes(m) &&
        (roleOf(m).landRamp ||
          /search your library[^.]*(?:basic )?land|put (?:a|that) land card onto the battlefield|additional land/.test(
            m.text,
          )),
    );
    const dbl = nonland.filter(
      (m) => !m.isCmd && (flag(m, "manaMultiplier") || /untap all lands you control/.test(m.text)),
    );
    const cmdc = cmdAll.length ? Math.max(...cmdAll.map((c) => c.card.m || 0)) : 0;
    // 16+ is roughly the top tenth of precons
    if (cmdAll.length && ((cmdc >= 6 && pieces.length >= 16) || pieces.length >= 22)) {
      const lines: string[] = [];
      if (lands.length) lines.push(`Land fetch and extra land drops: ${namesOf(lands, 6)}.`);
      if (rocks.length) lines.push(`Rocks and fast mana: ${namesOf(rocks, 5)}.`);
      if (dorks.length) lines.push(`Mana creatures: ${namesOf(dorks, 5)}.`);
      if (dbl.length)
        lines.push(
          `<span style="color:var(--gold);">Doublers and untappers</span> (the same lands pay twice): ${namesOf(dbl, 5)}.`,
        );
      const lf = nonland.filter((m) => !m.isCmd && flag(m, "landfall"));
      if (lf.length) {
        lines.push(`Every extra land also triggers: ${namesOf(lf, 4)}.`);
        lf.forEach((m) => used.add(m.card.n));
      }
      plans.push(
        plan(
          "__plan_ramp",
          true,
          `<strong>Ramp into ${ixLinkSlot(cmdAll[0]!.card.n)}</strong>: it costs ${cmdc}, and the deck has ${pieces.length} ramp pieces to reach it early.`,
          lines,
          99,
        ),
      );
      pieces.concat(dbl).forEach((m) => used.add(m.card.n));
    }
    // A commander that can spend spare mana on its own abilities
    for (const c of cmdAll) {
      const abil: Array<{ cost: string; effect: string }> = [];
      for (const line of String(c.card.o || "").split("\n")) {
        const am = /^((?:\{[^}]+\})+): ([^.\n]+)/.exec(line);
        if (am)
          abil.push({
            cost: am[1]!.replace(/[{}]/g, ""),
            effect: am[2]!.replace(
              new RegExp(c.card.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
              c.card.n.split(",")[0]!,
            ),
          });
      }
      if (abil.length >= 2 || (abil.length === 1 && cmdc >= 6)) {
        const lines: string[] = [];
        if (/enters[^.]*untap all lands you control/.test(c.text))
          lines.push(
            "When it enters it untaps all your lands, so the mana spent casting it can be spent again the same turn on these abilities.",
          );
        const untap = nonland.filter((m) => !m.isCmd && IX_UNTAP_RE.test(m.text));
        const doub = dbl.filter((m) => !untap.includes(m));
        if (untap.length)
          lines.push(
            `<span style="color:var(--gold);">Untappers</span> (a second full set of mana, usable on an opponent's turn since these abilities are instant speed): ${namesOf(untap, 4)}.`,
          );
        if (doub.length) lines.push(`Mana doublers multiply the uses: ${namesOf(doub, 4)}.`);
        untap.forEach((m) => used.add(m.card.n));
        plans.push(
          plan(
            "__plan_sink_" + c.card.n,
            true,
            `<strong>${ixLinkSlot(c.card.n)}</strong> turns spare mana into effects: ${abil.map((a) => escapeHtml(a.cost) + " – " + escapeHtml(a.effect)).join("; ")}.`,
            lines,
            98,
          ),
        );
      }
    }
    const wipes = nonland.filter(
      (m) => !m.isCmd && (flag(m, "wipe") || roleOf(m).wipeDamage || roleOf(m).wipeSac),
    );
    // the typical precon has 2; 6+ is a deliberate plan
    if (wipes.length >= 6) {
      const safe = nonland.filter(
        (m) =>
          !m.isCmd &&
          !/counter on ~|~ has indestructible|~ is indestructible/.test(m.text) &&
          /(?:permanents?|creatures?) you control[^.]*indestructible|target creature[^.]*indestructible|enchanted creature[^.]*indestructible|equipped creature[^.]*indestructible|gains? indestructible/.test(
            m.text,
          ),
      );
      const lines: string[] = [];
      if (safe.length) lines.push(`To keep your own commander through them: ${namesOf(safe, 4)}.`);
      plans.push(
        plan(
          "__plan_wipes",
          false,
          `<strong>${wipes.length} board wipes and sweepers</strong> (${namesOf(wipes, 6)}): the deck is built to reset the table and win from what is left.`,
          lines,
          97,
        ),
      );
      wipes.concat(safe).forEach((m) => {
        used.add(m.card.n);
      });
      safe.forEach((m) => safeNames.add(m.card.n));
    }
  }
  for (const c of cmdAll) {
    const help = commanderHelpPlan(c, nonland, used, safeNames);
    if (help) plans.push(help);
  }
  auraAndProtectionPlans(plans, nonland, used);
  return plans;
}

/** What helps this commander do its job: only exact, text-based links, each tied to something the commander really has. */
function commanderHelpPlan(
  c: IxEntry,
  nonland: IxEntry[],
  used: Set<string>,
  safeNames: Set<string>,
): IxPackage | null {
  const lines: string[] = [],
    helpers: string[] = [];
  const take = (arr: IxEntry[], label: string, k = 5): void => {
    if (!arr.length) return;
    lines.push(`${label}: ${namesOf(arr, k)}.`);
    arr.forEach((m) => {
      used.add(m.card.n);
      helpers.push(m.card.n);
    });
  };
  const others = nonland.filter((m) => !m.isCmd);
  const cmdc = c.card.m || 0,
    ctext = c.text;
  const hasActs = String(c.card.o || "")
    .split("\n")
    .some((l) => /^(?:\{[^}]+\})+: /.test(l));
  if (hasActs)
    take(
      others.filter((m) =>
        /abilities you activate[^.]*cost \{?\d\}? less|activated abilities[^.]*cost[^.]*less to activate/.test(
          m.text,
        ),
      ),
      "Cheaper abilities (more activations from the same mana)",
      3,
    );
  if (/deals? (?:\d+|x) damage/.test(ctext))
    take(
      others.filter((m) =>
        /double that damage|deals? double that|twice that much damage|noncombat damage[^.]*(?:double|twice)/.test(
          m.text,
        ),
      ),
      "Damage doublers (its damage, and any burn or sweepers that deal damage, count double)",
      3,
    );
  {
    const refl = others.filter((m) =>
      /whenever ~ is dealt damage[^.]*deals? that much damage|whenever ~ is dealt damage[^.]*that much damage to/.test(
        m.text,
      ),
    );
    const dmgSrc = others.filter(
      (m) =>
        roleOf(m).wipeDamage ||
        /deals? (?:\d+|x) damage to each (?:other )?(?:creature|opponent)/.test(m.text),
    );
    if (refl.length && (dmgSrc.length || /deals? (?:\d+|x) damage to (?:target|any)/.test(ctext))) {
      refl.forEach((m) => {
        used.add(m.card.n);
        helpers.push(m.card.n);
      });
      lines.push(
        `<span style="color:var(--gold);">Damage reflectors</span> (take damage you deal yourself, then send the same amount at an opponent): ${namesOf(refl, 3)}${dmgSrc.length ? `; sources in the deck: ${namesOf(dmgSrc, 4)}` : ""}${/deals? (?:\d+|x) damage to (?:target|any)/.test(ctext) ? `, and its own damage` : ""}.`,
      );
    }
  }
  if (/gain \d+ life|you gain \w+ life/.test(ctext))
    take(
      others.filter((m) => /whenever you gain life/.test(m.text)),
      "Pay off its life gain",
      3,
    );
  if (!/\bhaste\b/.test(ctext) && cmdc >= 5)
    take(
      others.filter(
        (m) =>
          (/\bhaste\b/.test(m.text) &&
            /(?:equipped creature|creatures? you control|target creature|enchanted creature)[^.]*haste|haste[^.]*(?:to|on) (?:it|target)/.test(
              m.text,
            )) ||
          roleOf(m).hasteAll,
      ),
      "Haste, so it can act the turn it lands",
      4,
    );
  if (cmdc >= 5)
    take(
      others.filter(
        (m) =>
          /(?:equipped|enchanted) creature (?:has|gets)[^.]*(?:hexproof|shroud|indestructible)|(?:permanents?|creatures?) you control (?:gain|have)[^.]*(?:hexproof|shroud|indestructible)|all creatures gain[^.]*(?:hexproof|indestructible)|target creature[^.]*(?:gains?|has)[^.]*(?:hexproof|indestructible|shroud)/.test(
            m.text,
          ) && !safeNames.has(m.card.n),
      ),
      "Protect it from removal",
      5,
    );
  if (!lines.length) return null;
  return plan(
    "__plan_help_" + c.card.n,
    true,
    `<strong>What helps ${ixLinkSlot(c.card.n)} work</strong>`,
    lines,
    96,
  );
}

function auraAndProtectionPlans(plans: IxPackage[], nonland: IxEntry[], used: Set<string>): void {
  // Aura stacking: many Auras onto one creature, a one-shot plan
  const auras = nonland.filter(
    (m) =>
      !m.isCmd &&
      /\baura\b/i.test(
        String(m.card.t || "")
          .split("—")
          .slice(1)
          .join(" "),
      ),
  );
  if (auras.length >= 8) {
    const scale = auras.filter((m) =>
      /for each (?:other )?(?:artifact and\/or )?(?:enchantment|aura)|\+1\/\+1 for each/.test(
        m.text,
      ),
    );
    const evade = auras.filter(
      (m) =>
        !scale.includes(m) &&
        /umbra armor|can't be blocked|as though it weren't blocked|hexproof|shroud|indestructible|first strike|trample|haste/.test(
          m.text,
        ),
    );
    const back = nonland.filter(
      (m) =>
        !m.isCmd &&
        (roleOf(m).massReturn ||
          /aura card[^.]*from your graveyard|return [^.]*aura|when this aura is put into a graveyard[^.]*return/.test(
            m.text,
          )),
    );
    const lines: string[] = [];
    if (scale.length)
      lines.push(
        `<span style="color:var(--gold);">Grow with your enchantments</span>: ${namesOf(scale, 4)}.`,
      );
    if (evade.length) lines.push(`Evasion and staying power: ${namesOf(evade, 5)}.`);
    if (back.length) lines.push(`Bring Auras back: ${namesOf(back, 4)}.`);
    plans.push(
      plan(
        "__plan_auras",
        false,
        `<strong>${auras.length} Auras</strong> stack onto one creature, so a single hit can be lethal.`,
        lines,
        95,
      ),
    );
    auras.concat(back).forEach((m) => used.add(m.card.n));
  }
  const GRANTS =
    /(?:equipped|enchanted) creature (?:has|gets)[^.]*(?:hexproof|shroud|indestructible)|(?:permanents?|creatures?|enchantments?|other [a-z]+) you control (?:gain|have)[^.]*(?:hexproof|shroud|indestructible)|all creatures gain[^.]*(?:hexproof|indestructible)|target [a-z ]*(?:gains?|has)[^.]*(?:hexproof|indestructible|shroud)|counter target|can't be countered|phase out/;
  const prot = nonland.filter(
    (m) =>
      !m.isCmd &&
      flag(m, "protection") &&
      (!/\bcreature\b/i.test(String(m.card.t || "").split("—")[0]!) || GRANTS.test(m.text)),
  );
  // about 2% of precons reach 7
  if (prot.length >= 7) {
    plans.push(
      plan(
        "__plan_protect",
        false,
        `<strong>${prot.length} protection pieces</strong> (${namesOf(prot, 6)}): the deck is built to keep its engine alive while it works.`,
        [],
        94,
      ),
    );
    prot.forEach((m) => used.add(m.card.n));
  }
}
