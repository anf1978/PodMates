// Pure pod selection, membership permissions and invite parsing; stored roles never change.
import type { PodDoc, PodMember, WithId } from "../../services/cloud/types";

export type Pod = WithId<PodDoc>;

export interface PodState {
  activePodId: string | null;
  pendingJoinCode: string | null;
  promptedForJoin: boolean;
}

export function initialState(search: string): PodState {
  return {
    activePodId: null,
    pendingJoinCode: new URLSearchParams(search).get("join") || null,
    promptedForJoin: false,
  };
}

export function selectPod(state: PodState, pods: Pod[], focusPodId?: string): PodState {
  const requested = focusPodId || state.activePodId;
  return {
    ...state,
    activePodId: pods.find((pod) => pod.id === requested)?.id ?? pods[0]?.id ?? null,
  };
}

export function inviteCode(raw: string): string {
  const text = raw.trim();
  if (!URL.canParse(text)) return text;
  return new URL(text).searchParams.get("join") || text;
}

export function inviteLink(code: string, location: Pick<Location, "origin" | "pathname">): string {
  return `${location.origin}${location.pathname}?join=${code}`;
}

export function roleDisplayLabel(role: string): string {
  if (role === "leader") return "Steward";
  if (role === "co-leader") return "Co-Steward";
  return "Member";
}

export function permissions(members: PodMember[], uid: string | null) {
  const role = members.find((member) => member.uid === uid)?.role || "member";
  return {
    isLeader: role === "leader",
    isCoLeader: role === "co-leader",
    canManage: role === "leader" || role === "co-leader",
  };
}
