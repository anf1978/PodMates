// One table, used by the page (input boxes, friendly messages, via window.PM_LIMITS) and by the
// cloud repositories, so the two can never disagree. They exist to stop accidents and abuse -- a
// runaway paste, a pod that keeps growing, one account hoarding storage -- and every figure sits
// well above what a normal playgroup would ever reach. The matching server-side limits live in
// firestore.rules, because anything enforced only in the browser can be bypassed by someone
// calling Firebase directly.
export const PM_LIMITS = Object.freeze({
  // text lengths (characters)
  displayName: 40,
  playerName: 40,
  podName: 60,
  gatheringTitle: 80,
  formationName: 60,
  deckName: 200,
  commanderName: 150,
  deckKey: 300,
  profileUrl: 200,
  deckLinkUrl: 300,
  notes: 500,
  bestMoment: 280,
  // one decklist (a normal 100-card list is roughly 3,000 characters / 100 lines)
  deckListChars: 30000,
  deckListLines: 600,
  // counts
  maxSavedDecks: 150,
  maxLinkedDecks: 25,
  maxPodsPerUser: 10,
  maxPodMembers: 30,
  maxFormationsPerPod: 30,
  maxChroniclesPerPod: 1000,
  chronicleDecks: 6,
  chronicleParticipants: 12,
  feedbackResponses: 24,
  builderMaxCards: 300,
  builderMaxQty: 99,
  // pod impact list
  impactChanges: 60,
  impactAdds: 15,
  impactReason: 280,
  // PriceScry trade ledger
  tradeCard: 150,
  tradeShop: 60,
  tradeNote: 280,
  maxTrades: 2000,
  tradeSells: 20,
  tradeQtyMax: 999,
  tradeYenMax: 10000000,
});

export type PmLimits = typeof PM_LIMITS;
