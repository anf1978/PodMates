// Real controller with mocked repositories: permissions, persistence, search and modal dismissal.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mount, openImpactCardsModal } from "./index";
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults";
import { impactKey } from "./state";
import * as cloud from "../../services/cloud/impact";
import { closeTryADeckModal } from "../../ui/tad-modal";
import type { ImpactSettingsDoc, ImpactNominationDoc, WithId } from "../../services/cloud/types";

const fake = vi.hoisted(() => ({
  uid: "leader",
  role: "leader",
  settings: { changes: {} } as ImpactSettingsDoc,
  nominations: [] as WithId<ImpactNominationDoc>[],
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => (fake.uid ? { uid: fake.uid } : null),
}));
vi.mock("../../services/cloud/pods", () => ({
  loadMyPods: vi.fn(async () =>
    ["pod", "second"].map((id) => ({
      id,
      name: "<Our pod>",
      leaderId: fake.role === "leader" ? fake.uid : "other",
      coLeaderIds: fake.role === "co-leader" ? [fake.uid] : [],
      memberIds: [fake.uid],
      inviteCode: "CODE",
    })),
  ),
}));
vi.mock("../../services/cloud/impact", () => ({
  loadImpactSettings: vi.fn(async () => structuredClone(fake.settings)),
  loadNominations: vi.fn(async () => structuredClone(fake.nominations)),
  setImpactChange: vi.fn(async (_id, key, change) => {
    if (change) fake.settings.changes[key] = { ...change, reason: "" };
    else delete fake.settings.changes[key];
  }),
  setImpactReason: vi.fn(async (_id, key, reason) => {
    fake.settings.changes[key].reason = reason;
  }),
  resetImpactSettings: vi.fn(async () => {
    fake.settings = { changes: {} };
  }),
  setImpactDismiss: vi.fn(),
  clearImpactDismissed: vi.fn(),
  nominateImpact: vi.fn(),
  withdrawNomination: vi.fn(),
}));
vi.mock("../../data/load-dataset", () => ({
  loadDataset: vi.fn(async () => [["Idea Card", "Tutors", 1, 20, 1, 0, "<Reason>"]]),
}));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));
vi.mock("../../ui/toast", () => ({ showToast: vi.fn() }));
let account = 0;
const library = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  fake.uid = `leader-${++account}`;
  fake.role = "leader";
  fake.settings = { changes: {} };
  fake.nominations = [];
  mount({
    analysis: () => null,
    loadLibrary: library,
    search: () =>
      [DEFAULT_IMPACT_CARDS[0], "<Arbitrary Card>"].map((n) => ({
        n,
        t: "Artifact",
        o: "",
        c: "{3}",
        ci: "",
        m: 3,
        p: "",
        r: "r",
        g: false,
        b: false,
      })),
    searchStyles: vi.fn(),
    anchor: (_input, change) => change(),
  });
});
afterEach(() => {
  closeTryADeckModal();
  vi.unstubAllGlobals();
});
function button(selector: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(selector)!;
}
async function settled(): Promise<void> {
  await vi.waitFor(() =>
    expect(document.querySelector<HTMLInputElement>("[data-impact-toggle]")!.disabled).toBe(false),
  );
}

it("saves a Steward's toggle and escaped reason, supports undo and two-click reset", async () => {
  await openImpactCardsModal();
  const first = DEFAULT_IMPACT_CARDS[0],
    key = impactKey(first);
  button(`[data-impact-toggle="${key}"]`).click();
  await settled();
  expect(cloud.setImpactChange).toHaveBeenCalledWith("pod", key, { card: first, action: "remove" });
  const reason = document.querySelector<HTMLTextAreaElement>("#impactReasonInput")!;
  reason.value = '<img src=x onerror="bad()"> Too strong';
  button("[data-impact-reason-save]").click();
  await settled();
  expect(cloud.setImpactReason).toHaveBeenCalledWith("pod", key, reason.value);
  expect(document.querySelector(".impact-reason")!.textContent).toContain("<img");
  expect(document.querySelector("#impactBody img")).toBeNull();
  button(`[data-impact-toggle="${key}"]`).click();
  await settled();
  expect(cloud.setImpactChange).toHaveBeenLastCalledWith("pod", key, null);
  button("[data-impact-add]").click();
  await settled();
  expect(cloud.withdrawNomination).toHaveBeenCalledWith("pod", "idea_card");
  button("#impactResetBtn").click();
  expect(cloud.resetImpactSettings).not.toHaveBeenCalled();
  button("#impactResetBtn").click();
  await settled();
  expect(cloud.resetImpactSettings).toHaveBeenCalledWith("pod");
});

it("lets members nominate searched cards with a note and withdraw their own nomination, not edit", async () => {
  fake.role = "member";
  fake.nominations = [
    { id: "existing", card: "Existing", by: fake.uid, byName: "<Me>", at: 1, note: "<Note>" },
  ];
  await openImpactCardsModal();
  expect(document.querySelector<HTMLInputElement>("[data-impact-toggle]")!.disabled).toBe(true);
  expect(document.querySelector("[data-impact-add]")).toBeNull();
  const input = document.querySelector<HTMLInputElement>("#impactNomSearch")!;
  input.value = "Arbitrary";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.querySelectorAll("#impactNomHits button")).toHaveLength(1);
  expect(document.querySelector("#impactNomHits")!.textContent).toContain("<Arbitrary Card>");
  document.querySelector<HTMLInputElement>("#impactNomNote")!.value = "Our games";
  button("#impactNomHits button").click();
  await vi.waitFor(() =>
    expect(cloud.nominateImpact).toHaveBeenCalledWith("pod", "arbitrary_card", {
      card: "<Arbitrary Card>",
      note: "Our games",
    }),
  );
  await vi.waitFor(() =>
    expect(document.querySelector("[data-impact-nom-withdraw]")).not.toBeNull(),
  );
  button("[data-impact-nom-withdraw]").click();
  await vi.waitFor(() => expect(cloud.withdrawNomination).toHaveBeenCalledWith("pod", "existing"));
  expect(cloud.setImpactChange).not.toHaveBeenCalled();
});

it("lets Co-Stewards accept/reject nominations and restore dismissed ideas", async () => {
  fake.role = "co-leader";
  fake.nominations = [
    { id: "existing", card: "Existing", by: "other", byName: "Other", at: 1, note: "Try it" },
  ];
  fake.settings.dismissed = { hidden: { card: "Hidden", by: "other", byName: "Other", at: 1 } };
  await openImpactCardsModal();
  button("[data-impact-nom-reject]").click();
  await settled();
  expect(cloud.setImpactDismiss).toHaveBeenCalledWith("pod", "existing", { card: "Existing" });
  expect(cloud.withdrawNomination).toHaveBeenCalledWith("pod", "existing");
  button("[data-impact-nom-accept]").click();
  await settled();
  expect(cloud.setImpactChange).toHaveBeenCalledWith("pod", "existing", {
    card: "Existing",
    action: "add",
  });
  button("[data-impact-restore]").click();
  await settled();
  expect(cloud.clearImpactDismissed).toHaveBeenCalledWith("pod");
});

it("shows the read-only default list signed out and does not reopen a dismissed loading modal", async () => {
  fake.uid = "";
  let release!: () => void;
  library.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const opening = openImpactCardsModal();
  closeTryADeckModal();
  release();
  await opening;
  expect(document.querySelector("#tadOverlay")).toBeNull();
  await openImpactCardsModal();
  expect(document.querySelector("#impactBody")!.textContent).toContain("Sign in and join a pod");
  expect(document.querySelector<HTMLInputElement>("[data-impact-toggle]")!.disabled).toBe(true);
  expect(cloud.loadImpactSettings).not.toHaveBeenCalled();
});

it("loads the selected pod before enabling edits and writes only to that pod", async () => {
  await openImpactCardsModal();
  const select = document.querySelector<HTMLSelectElement>("#impactPodSel")!;
  select.value = "second";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(select.disabled).toBe(true);
  await settled();
  expect(cloud.loadImpactSettings).toHaveBeenLastCalledWith("second");
  button("[data-impact-add]").click();
  await settled();
  expect(cloud.setImpactChange).toHaveBeenCalledWith("second", "idea_card", {
    card: "Idea Card",
    action: "add",
  });
});
