// @vitest-environment happy-dom
// Real templates/controllers with mocked repository boundaries; no Firebase traffic.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudUserSummary } from "../../services/cloud/session";
import type { PodMember } from "../../services/cloud/types";
import type { Gathering } from "../../services/cloud/gatherings";
import { on as onAppEvent } from "../../services/events";
import { closeAllModals, closeModal, openModal } from "../../ui/modal";
import { mount, type PodsFeature } from "./index";
import type { PodIntegration } from "./integration";
import type { Pod } from "./state";

const mocks = vi.hoisted(() => ({
  signedIn: true,
  auth: [] as Array<(user: CloudUserSummary | null) => void>,
  loadMyPods: vi.fn(),
  loadPodMembers: vi.fn(),
  createPod: vi.fn(),
  joinPodByInviteCode: vi.fn(),
  renamePod: vi.fn(),
  leavePod: vi.fn(),
  deletePod: vi.fn(),
  regenerateInviteCode: vi.fn(),
  promoteToCoLeader: vi.fn(),
  transferLeadership: vi.fn(),
  removePodMember: vi.fn(),
  loadOpenGatherings: vi.fn(),
  watchOpenGatherings: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("../../services/cloud/pods", () => mocks);
vi.mock("../../services/cloud/members", () => mocks);
vi.mock("../../services/cloud/gatherings", () => mocks);
vi.mock("../../services/report-error", () => ({ reportError: mocks.reportError }));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => (mocks.signedIn ? { uid: "me" } : null),
  onAuthChange: (cb: (user: CloudUserSummary | null) => void) => mocks.auth.push(cb),
}));

const pod: Pod = {
  id: "p1",
  name: "Thursday Crew",
  inviteCode: "ABCD2345",
  leaderId: "me",
  coLeaderIds: [],
  memberIds: ["me", "friend"],
};
const member = (uid: string, role: PodMember["role"]): PodMember => ({
  uid,
  role,
  displayName: uid,
  displayLabel: uid,
  nameClash: false,
  joinedAt: 1,
});
let feature: PodsFeature;
let panel: HTMLElement;
let ui: PodIntegration;
let disposers: Array<() => void>;

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  expect(found, selector).not.toBeNull();
  return found!;
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const click = async (selector: string) => {
  element(selector).click();
  await settle();
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = [];
  mocks.signedIn = true;
  mocks.loadMyPods.mockResolvedValue([pod]);
  mocks.loadPodMembers.mockResolvedValue([member("me", "leader"), member("friend", "member")]);
  mocks.loadOpenGatherings.mockResolvedValue([]);
  mocks.watchOpenGatherings.mockReturnValue(vi.fn());
  history.replaceState({}, "", "/");
  panel = document.createElement("div");
  document.body.appendChild(panel);
  ui = {
    openOverlay(onDismiss) {
      closeModal(document.getElementById("tadOverlay"));
      return openModal({ overlayId: "tadOverlay", onDismiss }).dialog;
    },
    closeOverlay: () => closeModal(document.getElementById("tadOverlay")),
    confirm: vi.fn(),
    actionConfirm: vi.fn(),
    paintOpenGatherings: vi.fn(),
  };
  disposers = [];
});
afterEach(() => {
  feature?.destroy();
  closeAllModals();
  disposers.forEach((dispose) => dispose());
  document.body.replaceChildren();
});
function start() {
  feature = mount(panel, ui);
}

describe("pod lifecycle", () => {
  it("opens auth from the signed-out landing", async () => {
    mocks.signedIn = false;
    const auth = vi.fn();
    disposers.push(onAppEvent("auth:open", auth));
    start();
    await feature.renderPanel();
    await click("#ourPodSignUpBtn");
    expect(auth).toHaveBeenCalledOnce();
    expect(mocks.loadMyPods).not.toHaveBeenCalled();
  });

  it("creates a pod then shows its members and refreshes the landing on Close", async () => {
    mocks.loadMyPods.mockResolvedValueOnce([]);
    mocks.createPod.mockResolvedValue({ ok: true, podId: pod.id, inviteCode: pod.inviteCode });
    start();
    await feature.renderPanel();
    await click("#myPodsCreateBtn");
    element<HTMLInputElement>("#podCreateNameInput").value = "Thursday Crew";
    await click("#podCreateBtn");
    expect(mocks.createPod).toHaveBeenCalledWith("Thursday Crew");
    expect(feature.getActivePodId()).toBe(pod.id);
    expect(element("#podMembersList").textContent).toContain("friend");
    await click("#tadCloseBtn");
    expect(document.getElementById("tadOverlay")).toBeNull();
    expect(element("#myPodsList").textContent).toContain("Thursday Crew");
  });

  it("validates a join, preserves rejected forms, and accepts a full invite URL", async () => {
    mocks.joinPodByInviteCode
      .mockResolvedValueOnce({ ok: false, error: "That pod is full." })
      .mockResolvedValueOnce({ ok: true, podId: pod.id, podName: pod.name });
    start();
    await feature.renderPanel();
    await click("#myPodsJoinBtn");
    expect(document.activeElement).toBe(element("#podJoinCodeInput"));
    await click("#podJoinBtn");
    expect(element("#podModalStatus").textContent).toBe("Paste an invite link or code first.");
    expect(mocks.joinPodByInviteCode).not.toHaveBeenCalled();
    element<HTMLInputElement>("#podJoinCodeInput").value = "https://example.test/?join=ABCD2345";
    await click("#podJoinBtn");
    expect(element("#podModalStatus").textContent).toBe("That pod is full.");
    expect(element<HTMLButtonElement>("#podJoinBtn").disabled).toBe(false);
    await click("#podJoinBtn");
    expect(mocks.joinPodByInviteCode).toHaveBeenLastCalledWith("ABCD2345");
    expect(element("#podOverlayContent h2").textContent).toBe(pod.name);
  });

  it("reports failed actions and restores the form for retry", async () => {
    const error = new Error("Offline");
    mocks.createPod.mockRejectedValue(error);
    start();
    await feature.renderPanel();
    await click("#myPodsCreateBtn");
    await click("#podCreateBtn");
    expect(mocks.reportError).toHaveBeenCalledWith(error, { operation: "cloud" });
    expect(element("#podModalStatus").textContent).toBe("Could not create the pod: Offline");
    expect(element<HTMLButtonElement>("#podCreateBtn").disabled).toBe(false);
  });

  it("keeps pod/member names inert and routes profile/host actions through events", async () => {
    const unsafe = { ...pod, name: '<img src=x onerror="alert(1)">' };
    mocks.loadMyPods.mockResolvedValue([unsafe]);
    mocks.loadPodMembers.mockResolvedValue([member("<script>bad</script>", "member")]);
    const host = vi.fn(),
      profile = vi.fn();
    disposers.push(onAppEvent("gatherings:host", host), onAppEvent("profile:pod", profile));
    start();
    await feature.renderPanel();
    await click("[data-pod-id]");
    expect(element("#podOverlayContent h2").textContent).toBe(unsafe.name);
    expect(panel.querySelector("img")).toBeNull();
    expect(element("#podMembersList").querySelector("script")).toBeNull();
    await click("#hostGatheringBtn");
    await click("#viewPodProfileBtn");
    expect(host.mock.calls[0][0].pod).toEqual(unsafe);
    expect(profile).toHaveBeenCalledWith(unsafe);
  });

  it.each(["member", "co-leader", "leader"] as const)("preserves %s permissions", async (role) => {
    mocks.loadPodMembers.mockResolvedValue([member("me", role), member("friend", "member")]);
    start();
    await feature.renderPanel({ focusPodId: pod.id });
    await settle();
    expect(Boolean(document.querySelector("#podRenameBtn"))).toBe(role !== "member");
    expect(Boolean(document.querySelector("#podDeleteBtn"))).toBe(role === "leader");
    expect(Boolean(document.querySelector('[data-action="promote"]'))).toBe(role !== "member");
    expect(Boolean(document.querySelector('[data-action="transfer"]'))).toBe(role === "leader");
    if (role === "leader") {
      await click("#podLeaveLink");
      expect(ui.confirm).not.toHaveBeenCalled();
      expect(mocks.leavePod).not.toHaveBeenCalled();
    }
  });

  it("renames and regenerates invites and allows cancelling back into the detail", async () => {
    start();
    await feature.renderPanel({ focusPodId: pod.id });
    await settle();
    element<HTMLInputElement>("#podRenameInput").value = "Friday Crew";
    await click("#podRenameBtn");
    expect(mocks.renamePod).toHaveBeenCalledWith("p1", "Friday Crew");
    await click("#podRegenerateBtn");
    expect(mocks.regenerateInviteCode).not.toHaveBeenCalled();
    const [, label, confirm, cancel] = vi.mocked(ui.actionConfirm).mock.calls[0];
    expect(label).toBe("Regenerate");
    cancel!();
    await settle();
    expect(element("#podOverlayContent h2").textContent).toBe(pod.name);
    await confirm();
    expect(mocks.regenerateInviteCode).toHaveBeenCalledWith("p1");
  });

  it("promotes a member without duplicating handlers and confirms stewardship transfer", async () => {
    start();
    await feature.renderPanel({ focusPodId: pod.id });
    await settle();
    await click('[data-action="promote"]');
    await click('[data-action="promote"]');
    expect(mocks.promoteToCoLeader).toHaveBeenCalledTimes(2);
    await click('[data-action="transfer"]');
    expect(mocks.transferLeadership).not.toHaveBeenCalled();
    await vi.mocked(ui.actionConfirm).mock.calls[0][2]();
    expect(mocks.transferLeadership).toHaveBeenCalledWith("p1", "friend");
  });

  it("refreshes pod-scoped data when switching pods and clears selection after leaving", async () => {
    const second = { ...pod, id: "p2", name: "Second" };
    mocks.loadMyPods.mockResolvedValue([pod, second]);
    mocks.loadPodMembers.mockResolvedValue([member("me", "member")]);
    const active = vi.fn();
    disposers.push(onAppEvent("pods:active", active));
    start();
    await feature.renderPanel({ focusPodId: pod.id });
    await settle();
    const switcher = element<HTMLSelectElement>("#podSwitcher");
    switcher.value = second.id;
    switcher.dispatchEvent(new Event("change"));
    await settle();
    expect(feature.getActivePodId()).toBe("p2");
    expect(active).toHaveBeenLastCalledWith("p2");
    await click("#podLeaveLink");
    mocks.loadMyPods.mockResolvedValue([]);
    await vi.mocked(ui.confirm).mock.calls[0][1]();
    expect(mocks.leavePod).toHaveBeenCalledWith("p2");
    expect(feature.getActivePodId()).toBeNull();
    expect(active).toHaveBeenLastCalledWith(null);
  });

  it("disposes all live invitations on redraw and ignores old asynchronous loads", async () => {
    const stop = vi.fn();
    mocks.watchOpenGatherings.mockReturnValue(stop);
    let finish!: (pods: Pod[]) => void;
    mocks.loadMyPods.mockReturnValueOnce(
      new Promise<Pod[]>((resolve) => {
        finish = resolve;
      }),
    );
    start();
    const old = feature.renderPanel();
    await feature.renderPanel();
    expect(mocks.watchOpenGatherings).toHaveBeenCalledOnce();
    finish([]);
    await old;
    expect(element("#myPodsList").textContent).toContain(pod.name);
    await feature.renderPanel();
    expect(stop).toHaveBeenCalledOnce();
    feature.destroy();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(mocks.watchOpenGatherings.mock.calls[0][1]).toBeTypeOf("function");
  });

  it("combines live invites from multiple pods and stops when the landing is removed", async () => {
    const second = { ...pod, id: "p2" };
    const stop = vi.fn();
    mocks.loadMyPods.mockResolvedValue([pod, second]);
    mocks.watchOpenGatherings.mockReturnValue(stop);
    start();
    await feature.renderPanel();
    await settle();
    const gathering: Gathering = {
      id: "g1",
      title: "Game",
      hostUid: "me",
      status: "live",
      seats: {},
      createdAt: 1,
    };
    mocks.watchOpenGatherings.mock.calls[0][1]([gathering]);
    mocks.watchOpenGatherings.mock.calls[1][1]([{ ...gathering, id: "g2" }]);
    expect(vi.mocked(ui.paintOpenGatherings).mock.lastCall?.[1].map((g) => g.podId)).toEqual([
      "p1",
      "p2",
    ]);
    panel.remove();
    await settle();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("requires invite consent after sign-in and never joins twice", async () => {
    history.replaceState({}, "", "/?join=ABCD2345");
    mocks.signedIn = false;
    const auth = vi.fn(),
      navigate = vi.fn();
    disposers.push(onAppEvent("auth:open", auth), onAppEvent("pods:navigate", navigate));
    mocks.joinPodByInviteCode.mockResolvedValue({ ok: true, podId: pod.id, podName: pod.name });
    start();
    mocks.auth[0](null);
    mocks.auth[0](null);
    expect(auth).toHaveBeenCalledOnce();
    mocks.signedIn = true;
    const user: CloudUserSummary = {
      uid: "me",
      displayName: "me",
      isAnonymous: false,
      email: null,
      providers: [],
    };
    mocks.auth[0](user);
    mocks.auth[0](user);
    expect(ui.actionConfirm).toHaveBeenCalledOnce();
    expect(ui.actionConfirm).toHaveBeenCalledWith(
      "Join the pod from this invite? Its members will be able to see your non-secret saved decks.",
      "Join pod",
      expect.any(Function),
    );
    expect(mocks.joinPodByInviteCode).not.toHaveBeenCalled();
    expect(location.search).toBe("");
    await vi.mocked(ui.actionConfirm).mock.calls[0][2]();
    expect(mocks.joinPodByInviteCode).toHaveBeenCalledWith("ABCD2345");
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("does not join a declined URL invite on later auth notifications", () => {
    history.replaceState({}, "", "/?join=ABCD2345");
    start();
    const user: CloudUserSummary = {
      uid: "me",
      displayName: "me",
      isAnonymous: false,
      email: null,
      providers: [],
    };
    mocks.auth[0](user);
    // Dismiss the shared confirmation without invoking its acceptance callback.
    ui.closeOverlay();
    mocks.auth[0](user);
    expect(ui.actionConfirm).toHaveBeenCalledOnce();
    expect(mocks.joinPodByInviteCode).not.toHaveBeenCalled();
  });

  it("clears pod-scoped caches after a confirmation replaces the detail overlay", async () => {
    mocks.loadPodMembers.mockResolvedValue([member("me", "member")]);
    const active = vi.fn();
    disposers.push(onAppEvent("pods:active", active));
    start();
    await feature.renderPanel({ focusPodId: pod.id });
    await settle();
    vi.mocked(ui.confirm).mockImplementation(() => ui.closeOverlay());
    await click("#podLeaveLink");
    expect(document.getElementById("podOverlayContent")).toBeNull();
    mocks.loadMyPods.mockResolvedValue([]);
    await vi.mocked(ui.confirm).mock.calls[0][1]();
    expect(feature.getActivePodId()).toBeNull();
    expect(active).toHaveBeenLastCalledWith(null);
  });
});
