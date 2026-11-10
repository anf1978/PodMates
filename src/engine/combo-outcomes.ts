/** Buckets a combo outcome label into the kind of result it produces. */
export function comboKind(outcome: string | null | undefined): string {
  const o = String(outcome || "").toLowerCase();
  if (/mass land denial/.test(o)) return "landdenial";
  if (/win the game at the beginning/.test(o)) return "winlater";
  if (/^win the game|deck-out win/.test(o)) return "win";
  if (/loses? the game|loses all life|kill (?:a player|an opponent)/.test(o)) return "killplayer";
  if (/exile each opponent'?s? library with the ability/.test(o)) return "oppexileplay";
  if (/all libraries/.test(o)) return "milleveryone";
  if (/opponent'?s? librar|mill for target opponent|exile target library/.test(o)) return "oppmill";
  if (/put all creature cards from your library/.test(o)) return "putcreatures";
  if (/cast all spells in your library/.test(o)) return "castlib";
  if (/exile your library/.test(o)) return "ownlib";
  if (/self-mill/.test(o)) return "selfmill";
  if (/sacrifices any creature that enters/.test(o)) return "oppsaclock";
  if (/destroy all creatures$/.test(o)) return "allwipe";
  if (/(?:destroy|exile) all creatures opponents control|sacrifices all /.test(o)) return "oppwipe";
  if (/damage to (?:all |most |some )?creatures|damage to target creatures/.test(o))
    return "dmgcreatures";
  if (/infinite turns|extra turns?/.test(o)) return "turns";
  if (/skips? of .*untap step|tapped creatures/.test(o)) return "lock";
  if (/\bmana\b|treasure/.test(o) && !/damage|drain/.test(o)) return "mana";
  if (/combat phases?|^infinite combat(?: via.*)?$/.test(o)) return "combatphases";
  if (/combat damage/.test(o)) return "combatdmg";
  if (/^infinite mill/.test(o)) return "mill";
  if (/damage|lifeloss|life loss|drain/.test(o)) return "dmg";
  if (/discard/.test(o)) return "discard";
  if (/planeswalker activations/.test(o)) return "pwact";
  if (/creature (?:exile|destruction)/.test(o)) return "removal";
  if (/draw/.test(o)) return "draw";
  if (/mill|library/.test(o)) return "mill";
  if (/^lock$|prevent|\bstop\b/.test(o)) return "lock";
  if (/infinitely large/.test(o)) return "large";
  if (/life/.test(o)) return "life";
  if (/token|creatures?\b|saproling|bird|squirrel|goblin|zombie|spirit|elemental/.test(o))
    return "tokens";
  if (/etb|enter|leave|death|gravestorm|untap|trigger|landfall/.test(o)) return "etb";
  return "generic";
}

export const COMBO_FINISH: Readonly<Record<string, number>> = {
  win: 1,
  winlater: 1,
  killplayer: 1,
  dmg: 1,
  combatdmg: 1,
  oppmill: 1,
  oppexileplay: 1,
  milleveryone: 1,
};

export const COMBO_NEEDS_PAYOFF: Readonly<Record<string, number>> = {
  mana: 1,
  draw: 1,
  turns: 1,
  combatphases: 1,
  large: 1,
  tokens: 1,
  etb: 1,
  ownlib: 1,
  selfmill: 1,
  castlib: 1,
  putcreatures: 1,
  dmgcreatures: 1,
  allwipe: 1,
  landdenial: 1,
  removal: 1,
  discard: 1,
  pwact: 1,
  life: 1,
};

// Display only: which lines are tagged "Wins" and which "Warps". Scores are not touched.
export function comboDisplayWin(outcome: string | null | undefined, flag: unknown): boolean {
  const k = comboKind(outcome);
  if (COMBO_FINISH[k]) return true;
  if (COMBO_NEEDS_PAYOFF[k]) return false;
  return !!flag;
}
