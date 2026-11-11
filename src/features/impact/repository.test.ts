// Selected-pod and account changes must not expose another request's proposals.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImpactRepository } from "./repository";
import { loadImpactSettings } from "../../services/cloud/impact";
import { loadMyPods } from "../../services/cloud/pods";
import type { ImpactSettingsDoc } from "../../services/cloud/types";

const account = vi.hoisted(() => ({ uid: "u" }));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => (account.uid ? { uid: account.uid } : null),
}));
vi.mock("../../services/cloud/pods", () => ({
  loadMyPods: vi.fn(async () =>
    ["a", "b"].map((id) => ({
      id,
      name: id,
      leaderId: "u",
      coLeaderIds: [],
      memberIds: ["u"],
      inviteCode: "",
    })),
  ),
}));
vi.mock("../../services/cloud/impact", () => ({
  loadImpactSettings: vi.fn(async () => ({ changes: {} })),
  loadNominations: vi.fn(async () => []),
}));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  account.uid = "u";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps the most recently selected pod when an earlier load finishes late", async () => {
  const repo = new ImpactRepository();
  await repo.load();
  let release!: (data: ImpactSettingsDoc) => void;
  vi.mocked(loadImpactSettings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const older = repo.load("a", true);
  await repo.load("b", true);
  release({ changes: { wrong: { card: "Wrong Card", action: "add" } } });
  expect(await older).toBe(false);
  expect(repo.state.podId).toBe("b");
  expect(repo.state.changes).toEqual({});
});

it("clears cached proposals and re-queries memberships after sign-out and another account", async () => {
  const repo = new ImpactRepository();
  await repo.load();
  repo.state.changes = { old: { card: "Old Card", action: "add" } };
  account.uid = "";
  repo.syncAccount();
  expect(repo.state.pods).toBeNull();
  expect(repo.state.changes).toEqual({});
  account.uid = "another";
  await repo.load();
  expect(loadMyPods).toHaveBeenCalledTimes(2);
});

it("keeps the previous pod and its proposals together when the next settings load fails", async () => {
  const repo = new ImpactRepository();
  await repo.load("a");
  repo.state.changes = { old: { card: "Old Card", action: "add" } };
  vi.mocked(loadImpactSettings).mockRejectedValueOnce(new Error("offline"));
  await expect(repo.load("b", true)).rejects.toThrow("offline");
  expect(repo.state.podId).toBe("a");
  expect(repo.state.changes).toEqual({ old: { card: "Old Card", action: "add" } });
});
