// Hand-written step-by-step text for well-known combo lines (display only). A key is a list of
// card names that must ALL be in the combo; a name containing " / " means any one of those.
// Anything without an entry gets a plain-English template chosen from its outcome (comboHow).

interface ComboSteps {
  k: string[];
  t: string;
}

// prettier-ignore
const COMBO_STEPS: ComboSteps[] = [
  { k: ["Thassa's Oracle", "Demonic Consultation"], t: "Cast Demonic Consultation naming a card that is not in your library. It exiles your whole library. Then cast Thassa's Oracle: with an empty library its enter trigger wins you the game." },
  { k: ["Thassa's Oracle", "Tainted Pact"], t: "Cast Tainted Pact. It exiles cards one at a time until two share a name; decline to take any of them. In a singleton deck that is the whole library (a repeated basic land can stop it early). Then cast Thassa's Oracle with an empty library and win." },
  { k: ["Isochron Scepter", "Dramatic Reversal"], t: "Imprint Dramatic Reversal on Isochron Scepter. Pay {2} and tap the Scepter to copy Reversal: it untaps all your nonland permanents, including the Scepter and your mana rocks. If your rocks make 3 or more mana in total, every loop is a net gain." },
  { k: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"], t: "Tap Kiki-Jiki to copy Zealous Conscripts. The copy's enter trigger takes control of a permanent and untaps it, so aim it at Kiki-Jiki and untap him. Repeat for as many hasty Conscripts as you like." },
  { k: ["Kiki-Jiki, Mirror Breaker", "Pestermite / Deceiver Exarch"], t: "Tap Kiki-Jiki to copy Pestermite (or Deceiver Exarch). The copy's enter trigger untaps Kiki-Jiki, so you can copy again, as often as you like, and each copy has haste." },
  { k: ["Splinter Twin", "Pestermite / Deceiver Exarch"], t: "Enchant Pestermite (or Deceiver Exarch) with Splinter Twin. Tap it to make a hasty token copy. The copy's enter trigger untaps the original, so repeat for as many hasty copies as you want." },
  { k: ["Heliod, Sun-Crowned", "Walking Ballista"], t: "Pay {1}{W} to give Walking Ballista lifelink. Remove a counter to ping: lifelink gains you 1 life, and Heliod puts a counter back on the Ballista. Every loop deals 1 damage at no cost, so point it at the opponents." },
  { k: ["Basalt Monolith", "Rings of Brighthearth"], t: "Tap Basalt Monolith for {C}{C}{C}, then activate its {3} untap ability. Rings of Brighthearth lets you pay {2} to copy it. The copy and the original each untap the Monolith, so you can tap it again in between and end the loop one mana ahead. You need a little spare mana to start." },
  { k: ["Basalt Monolith", "Forsaken Monument"], t: "Forsaken Monument adds one extra {C} whenever you tap a permanent for {C}, so Basalt Monolith taps for four. Pay {3} to untap it and repeat: a net gain of {C} each loop." },
  { k: ["Power Artifact", "Basalt Monolith / Grim Monolith"], t: "Power Artifact makes the Monolith's {3} untap cost {1}. Basalt Monolith taps for {C}{C}{C}, so each loop pays {1} and returns three: a net gain of two colourless mana. Grim Monolith's untap costs {4}, so it drops to {2} and nets one mana per loop." },
  { k: ["Deadeye Navigator", "Peregrine Drake / Palinchron / Great Whale"], t: "Pair Deadeye Navigator with the creature. Pay {1}{U} to blink it: its enter trigger untaps lands (five for Peregrine Drake, seven for Palinchron or Great Whale), which refunds more than the blink cost. Repeat for as much mana as you want." },
  { k: ["Palinchron", "Phantasmal Image"], t: "Cast Phantasmal Image as a copy of Palinchron to untap seven lands. Pay {2}{U}{U} to return the copy to your hand, recast Image for {1}{U}, and untap seven lands again. With 7 or more lands every loop nets mana." },
  { k: ["Food Chain", "Squee, the Immortal"], t: "Cast Squee, then exile it with Food Chain: you get four mana plus one extra, usable on creature spells. Recast Squee from exile with that mana (it costs four) and keep the extra {1}. Each loop gains one mana for creature spells." },
  { k: ["Sanguine Bond", "Exquisite Blood"], t: "Any life loss starts it. Exquisite Blood gains you life whenever an opponent loses life, and Sanguine Bond makes an opponent lose life whenever you gain it. They feed each other until the opponent is dead." },
  { k: ["Sanguine Bond", "Blood Tribute"], t: "Cast Blood Tribute kicked (tap an untapped Vampire). The opponent loses half their life and you gain the same amount, which Sanguine Bond turns into the same loss again. That is usually enough to finish them." },
  { k: ["Krenko, Mob Boss", "Intruder Alarm"], t: "Tap Krenko to make Goblins equal to the Goblins you control. Each one entering triggers Intruder Alarm, which untaps every creature including Krenko. Repeat: your Goblins double each time." },
  { k: ["Earthcraft", "Squirrel Nest"], t: "Squirrel Nest on a basic land makes a Squirrel each time you tap that land. Tap a Squirrel for Earthcraft to untap the land, then tap the land for another Squirrel. That makes as many Squirrels as you want." },
  { k: ["Sprout Swarm", "Mana Echoes"], t: "Cast Sprout Swarm with buyback, using convoke. Each Saproling that enters triggers Mana Echoes for {C} per creature that shares a type, which pays for the buyback again with mana to spare." },
  { k: ["Duskmantle Guildmage", "Mindcrank"], t: "Activate Duskmantle Guildmage's {1}{U}{B} ability once: until end of turn, an opponent loses 1 life whenever a card goes to their graveyard. Mindcrank mills them whenever they lose life, and those milled cards make them lose life again. The two feed each other until their library is gone." },
  { k: ["Stuffy Doll", "Guilty Conscience"], t: "Put Guilty Conscience on Stuffy Doll. When the Doll is dealt damage, it deals that much to the chosen player and Guilty Conscience deals that much to the Doll again. Ping the Doll once and the damage keeps repeating." },
  { k: ["Rest in Peace", "Helm of Obedience"], t: "Activate Helm of Obedience with X=1 on one opponent. It mills until a creature card reaches their graveyard, but Rest in Peace exiles every card instead, so it never stops and their whole library is exiled. They lose when they next have to draw." },
  { k: ["Leyline of the Void", "Helm of Obedience"], t: "Activate Helm of Obedience with X=1 on one opponent. It mills until a creature card reaches their graveyard, but Leyline of the Void exiles every card instead, so their whole library is exiled. They lose when they next have to draw." },
  { k: ["Mikaeus, the Unhallowed", "Triskelion"], t: "Mikaeus gives Triskelion +1/+1 and undying. Remove its counters to ping, aiming enough of them at Triskelion itself to kill it. When it dies with no +1/+1 counter, undying brings it back with one extra counter on top of its three enter counters, so each loop leaves you one counter ahead. Those spare pings can go at the opponents." },
  { k: ["Godo, Bandit Warlord", "Helm of the Host"], t: "Equip Helm of the Host to Godo. Every combat, Helm makes a hasty, non-legendary copy of Godo. Godo's attack trigger adds another combat phase, which starts another copy, so combat never ends." },
  { k: ["Pitiless Plunderer", "Ashnod's Altar", "Reassembling Skeleton"], t: "Sacrifice Reassembling Skeleton to Ashnod's Altar for {C}{C}, and Pitiless Plunderer makes a Treasure. Pay {1}{B} to bring the Skeleton back. The Altar mana pays for the return, so each loop nets one Treasure." },
];

export function comboStepsFor(cards: readonly string[]): string | null {
  for (const e of COMBO_STEPS) {
    if (e.k.every((req) => req.split(" / ").some((n) => cards.includes(n)))) return e.t;
  }
  return null;
}
