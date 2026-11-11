import { afterEach, expect, it, vi } from "vitest";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// The exact surface the inline Firebase module exposed; index.html depends on every key.
const LEGACY_KEYS = [
  "ready",
  "uid",
  "user",
  "onReady",
  "onAuthChange",
  "signUpWithEmail",
  "logInWithEmail",
  "signInWithGoogle",
  "signInWithYahoo",
  "resetPassword",
  "signOutUser",
  "saveDeck",
  "setSpoilerVote",
  "clearSpoilerVote",
  "loadSpoilerVotes",
  "loadPodSpoilerVotes",
  "setDeckSecret",
  "deleteDeck",
  "loadAllDecks",
  "loadPodmateDecks",
  "loadPodmateDecksRaw",
  "fetchDeckByLink",
  "addLinkedDeck",
  "refreshLinkedDeck",
  "removeLinkedDeck",
  "loadLinkedDecks",
  "createPod",
  "joinPodByInviteCode",
  "loadMyPods",
  "loadPodMembers",
  "leavePod",
  "removePodMember",
  "renamePod",
  "regenerateInviteCode",
  "promoteToCoLeader",
  "transferLeadership",
  "deletePod",
  "updateDisplayName",
  "updateProfileLinks",
  "getMyRawUserDoc",
  "forceSyncMyPodIds",
  "saveTableFormation",
  "deleteTableFormation",
  "loadAllTableFormations",
  "addChronicleEntry",
  "loadAllChronicles",
  "addChronicleFeedback",
  "logBattle",
  "resetGatheringDecks",
  "clearAllChronicles",
  "updateChronicleNotes",
  "deleteChronicleEntry",
  "saveTrade",
  "loadTrades",
  "deleteTrade",
  "createGathering",
  "loadGathering",
  "loadLiveGatherings",
  "watchGathering",
  "watchLiveGatherings",
  "setGatheringSeat",
  "goLiveGathering",
  "endGathering",
  "setSeatRsvp",
  "setSeatDeck",
  "updateGatheringDetails",
  "cancelGathering",
  "loadOpenGatherings",
  "watchOpenGatherings",
  "notify",
  "markGatheringCharted",
  "loadImpactSettings",
  "setImpactChange",
  "setImpactReason",
  "resetImpactSettings",
  "setImpactDismiss",
  "clearImpactDismissed",
  "watchActivity",
  "loadNominations",
  "nominateImpact",
  "withdrawNomination",
];

it("installs the legacy cloud bridge and size limits, then announces it", async () => {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const announced = vi.fn();
  win.addEventListener("podmates-cloud-init", announced);
  vi.stubGlobal("window", win);

  await import("./index");
  const { fake } = await import("./testing/fake-firebase");
  const cloud = win.PodmatesCloud as Record<string, unknown> & {
    ready: boolean;
    uid: string | null;
  };

  expect(Object.keys(cloud)).toEqual(LEGACY_KEYS);
  for (const key of LEGACY_KEYS.slice(3)) expect(typeof cloud[key], key).toBe("function");
  expect(announced).toHaveBeenCalledOnce();
  expect(win.PM_LIMITS).toMatchObject({ displayName: 40, deckListChars: 30000, maxTrades: 2000 });
  expect(Object.isFrozen(win.PM_LIMITS)).toBe(true);

  expect([cloud.ready, cloud.uid]).toEqual([false, null]);
  fake.signIn({ uid: "u1", email: "ann@example.com" });
  expect([cloud.ready, cloud.uid]).toEqual([true, "u1"]);
  expect(cloud.user).toEqual({
    uid: "u1",
    isAnonymous: false,
    email: "ann@example.com",
    displayName: null,
    providers: ["password"],
  });
});
