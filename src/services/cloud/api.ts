// The legacy window.PodmatesCloud surface, assembled from the typed repositories. Keys, argument
// lists and return shapes are unchanged from the inline Firebase module this replaced.
import * as activity from "./activity";
import * as authApi from "./auth";
import * as chronicles from "./chronicles";
import * as decks from "./decks";
import * as gatherings from "./gatherings";
import * as impact from "./impact";
import * as linkedDecks from "./linked-decks";
import { loadPodMembers } from "./members";
import * as pods from "./pods";
import { updateMyDisplayName } from "./profile";
import { describeUser, getCurrentUser, isCloudReady, onAuthChange, onReady } from "./session";
import * as spoilerVotes from "./spoiler-votes";
import * as formations from "./table-formations";
import * as trades from "./trades";
import { getMyRawUserDoc, updateMyProfileLinks } from "./users";
import { reportOperation } from "../report-error";

const action = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  reportOperation(fn, { operation: "cloud", userTriggered: true });
const load = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  reportOperation(fn, { operation: "cloud" });

export function createCloudApi() {
  return {
    get ready() {
      return isCloudReady();
    },
    get uid() {
      const user = getCurrentUser();
      return user ? user.uid : null;
    },
    get user() {
      return describeUser(getCurrentUser());
    },
    onReady,
    onAuthChange,
    signUpWithEmail: authApi.signUpWithEmail,
    logInWithEmail: authApi.logInWithEmail,
    signInWithGoogle: authApi.signInWithGoogle,
    signInWithYahoo: authApi.signInWithYahoo,
    resetPassword: authApi.resetPassword,
    signOutUser: action(authApi.signOutUser),
    saveDeck: action(decks.saveDeck),
    setSpoilerVote: action(spoilerVotes.setSpoilerVote),
    clearSpoilerVote: action(spoilerVotes.clearSpoilerVote),
    loadSpoilerVotes: load(spoilerVotes.loadSpoilerVotes),
    loadPodSpoilerVotes: load(spoilerVotes.loadPodSpoilerVotes),
    setDeckSecret: action(decks.setDeckSecret),
    deleteDeck: action(decks.deleteDeck),
    loadAllDecks: load(decks.loadAllDecks),
    loadPodmateDecks: load(decks.loadPodmateDecks),
    loadPodmateDecksRaw: load(decks.loadPodmateDecksRaw),
    fetchDeckByLink: linkedDecks.fetchDeckByLink,
    addLinkedDeck: action(linkedDecks.addLinkedDeck),
    refreshLinkedDeck: action(linkedDecks.refreshLinkedDeck),
    removeLinkedDeck: action(linkedDecks.removeLinkedDeck),
    loadLinkedDecks: load(linkedDecks.loadLinkedDecks),
    createPod: action(pods.createPod),
    joinPodByInviteCode: action(pods.joinPodByInviteCode),
    loadMyPods: load(pods.loadMyPods),
    loadPodMembers: load(loadPodMembers),
    leavePod: action(pods.leavePod),
    removePodMember: action(pods.removePodMember),
    renamePod: action(pods.renamePod),
    regenerateInviteCode: action(pods.regenerateInviteCode),
    promoteToCoLeader: action(pods.promoteToCoLeader),
    transferLeadership: action(pods.transferLeadership),
    deletePod: action(pods.deletePod),
    updateDisplayName: action(updateMyDisplayName),
    updateProfileLinks: action(updateMyProfileLinks),
    getMyRawUserDoc: load(getMyRawUserDoc),
    forceSyncMyPodIds: action(pods.forceSyncMyPodIds),
    saveTableFormation: action(formations.saveTableFormation),
    deleteTableFormation: action(formations.deleteTableFormation),
    loadAllTableFormations: load(formations.loadAllTableFormations),
    addChronicleEntry: action(chronicles.addChronicleEntry),
    loadAllChronicles: load(chronicles.loadAllChronicles),
    addChronicleFeedback: action(chronicles.addChronicleFeedback),
    logBattle: action(gatherings.logBattle),
    resetGatheringDecks: action(gatherings.resetGatheringDecks),
    clearAllChronicles: action(chronicles.clearAllChronicles),
    updateChronicleNotes: action(chronicles.updateChronicleNotes),
    deleteChronicleEntry: action(chronicles.deleteChronicleEntry),
    saveTrade: action(trades.saveTrade),
    loadTrades: load(trades.loadTrades),
    deleteTrade: action(trades.deleteTrade),
    createGathering: action(gatherings.createGathering),
    loadGathering: load(gatherings.loadGathering),
    loadLiveGatherings: load(gatherings.loadLiveGatherings),
    watchGathering: gatherings.watchGathering,
    watchLiveGatherings: gatherings.watchLiveGatherings,
    setGatheringSeat: action(gatherings.setGatheringSeat),
    goLiveGathering: action(gatherings.goLiveGathering),
    endGathering: action(gatherings.endGathering),
    setSeatRsvp: action(gatherings.setSeatRsvp),
    setSeatDeck: action(gatherings.setSeatDeck),
    updateGatheringDetails: action(gatherings.updateGatheringDetails),
    cancelGathering: action(gatherings.cancelGathering),
    loadOpenGatherings: load(gatherings.loadOpenGatherings),
    watchOpenGatherings: gatherings.watchOpenGatherings,
    notify: activity.notify,
    markGatheringCharted: action(gatherings.markGatheringCharted),
    loadImpactSettings: load(impact.loadImpactSettings),
    setImpactChange: action(impact.setImpactChange),
    setImpactReason: action(impact.setImpactReason),
    resetImpactSettings: action(impact.resetImpactSettings),
    setImpactDismiss: action(impact.setImpactDismiss),
    clearImpactDismissed: action(impact.clearImpactDismissed),
    watchActivity: activity.watchActivity,
    loadNominations: load(impact.loadNominations),
    nominateImpact: action(impact.nominateImpact),
    withdrawNomination: action(impact.withdrawNomination),
  };
}

export type PodmatesCloudApi = ReturnType<typeof createCloudApi>;
