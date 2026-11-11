// Selection and invite contracts without DOM, cloud or global state.
import { describe, expect, it } from "vitest";
import { initialState, inviteCode, permissions, selectPod, type Pod } from "./state";

const pod = (id: string): Pod => ({
  id,
  name: id,
  inviteCode: "ABCDEFGH",
  leaderId: "me",
  coLeaderIds: [],
  memberIds: ["me"],
});

describe("pod selection", () => {
  it("retains the active pod, honors explicit focus, and falls back after leaving", () => {
    const state = { ...initialState(""), activePodId: "second" };
    const pods = [pod("first"), pod("second")];
    expect(selectPod(state, pods).activePodId).toBe("second");
    expect(selectPod(state, pods, "first").activePodId).toBe("first");
    expect(selectPod(state, [pods[0]]).activePodId).toBe("first");
    expect(selectPod(state, []).activePodId).toBeNull();
    expect(state.activePodId).toBe("second");
  });

  it("does not grant management to absent members", () => {
    expect(permissions([], "me")).toEqual({ isLeader: false, isCoLeader: false, canManage: false });
  });
});

describe("pod invites", () => {
  it("accepts bare codes and full invite links without changing the cloud's normalization", () => {
    expect(inviteCode(" abCd2345 ")).toBe("abCd2345");
    expect(inviteCode("https://example.test/PodMates/?join=ABCD2345")).toBe("ABCD2345");
    expect(inviteCode("https://example.test/without-invite")).toBe(
      "https://example.test/without-invite",
    );
    expect(initialState("?join=ABCD2345").pendingJoinCode).toBe("ABCD2345");
  });
});
