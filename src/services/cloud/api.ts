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
    signOutUser: authApi.signOutUser,
    saveDeck: decks.saveDeck,
    setSpoilerVote: spoilerVotes.setSpoilerVote,
    clearSpoilerVote: spoilerVotes.clearSpoilerVote,
    loadSpoilerVotes: spoilerVotes.loadSpoilerVotes,
    loadPodSpoilerVotes: spoilerVotes.loadPodSpoilerVotes,
    setDeckSecret: decks.setDeckSecret,
    deleteDeck: decks.deleteDeck,
    loadAllDecks: decks.loadAllDecks,
    loadPodmateDecks: decks.loadPodmateDecks,
    loadPodmateDecksRaw: decks.loadPodmateDecksRaw,
    fetchDeckByLink: linkedDecks.fetchDeckByLink,
    addLinkedDeck: linkedDecks.addLinkedDeck,
    refreshLinkedDeck: linkedDecks.refreshLinkedDeck,
    removeLinkedDeck: linkedDecks.removeLinkedDeck,
    loadLinkedDecks: linkedDecks.loadLinkedDecks,
    createPod: pods.createPod,
    joinPodByInviteCode: pods.joinPodByInviteCode,
    loadMyPods: pods.loadMyPods,
    loadPodMembers,
    leavePod: pods.leavePod,
    removePodMember: pods.removePodMember,
    renamePod: pods.renamePod,
    regenerateInviteCode: pods.regenerateInviteCode,
    promoteToCoLeader: pods.promoteToCoLeader,
    transferLeadership: pods.transferLeadership,
    deletePod: pods.deletePod,
    updateDisplayName: updateMyDisplayName,
    updateProfileLinks: updateMyProfileLinks,
    getMyRawUserDoc,
    forceSyncMyPodIds: pods.forceSyncMyPodIds,
    saveTableFormation: formations.saveTableFormation,
    deleteTableFormation: formations.deleteTableFormation,
    loadAllTableFormations: formations.loadAllTableFormations,
    addChronicleEntry: chronicles.addChronicleEntry,
    loadAllChronicles: chronicles.loadAllChronicles,
    addChronicleFeedback: chronicles.addChronicleFeedback,
    logBattle: gatherings.logBattle,
    resetGatheringDecks: gatherings.resetGatheringDecks,
    clearAllChronicles: chronicles.clearAllChronicles,
    updateChronicleNotes: chronicles.updateChronicleNotes,
    deleteChronicleEntry: chronicles.deleteChronicleEntry,
    saveTrade: trades.saveTrade,
    loadTrades: trades.loadTrades,
    deleteTrade: trades.deleteTrade,
    createGathering: gatherings.createGathering,
    loadGathering: gatherings.loadGathering,
    loadLiveGatherings: gatherings.loadLiveGatherings,
    watchGathering: gatherings.watchGathering,
    watchLiveGatherings: gatherings.watchLiveGatherings,
    setGatheringSeat: gatherings.setGatheringSeat,
    goLiveGathering: gatherings.goLiveGathering,
    endGathering: gatherings.endGathering,
    setSeatRsvp: gatherings.setSeatRsvp,
    setSeatDeck: gatherings.setSeatDeck,
    updateGatheringDetails: gatherings.updateGatheringDetails,
    cancelGathering: gatherings.cancelGathering,
    loadOpenGatherings: gatherings.loadOpenGatherings,
    watchOpenGatherings: gatherings.watchOpenGatherings,
    notify: activity.notify,
    markGatheringCharted: gatherings.markGatheringCharted,
    loadImpactSettings: impact.loadImpactSettings,
    setImpactChange: impact.setImpactChange,
    setImpactReason: impact.setImpactReason,
    resetImpactSettings: impact.resetImpactSettings,
    setImpactDismiss: impact.setImpactDismiss,
    clearImpactDismissed: impact.clearImpactDismissed,
    watchActivity: activity.watchActivity,
    loadNominations: impact.loadNominations,
    nominateImpact: impact.nominateImpact,
    withdrawNomination: impact.withdrawNomination,
  };
}

export type PodmatesCloudApi = ReturnType<typeof createCloudApi>;
