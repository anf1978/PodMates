// Gathering interaction tests use repository mocks; never authenticate or write real data.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Gathering } from "../../services/cloud/gatherings";
import { configureGatherings, type GatheringRuntime } from "./runtime";
import { openHostGatheringOverlay } from "./host";
import { openLiveGatheringOverlay, stopGatheringPolling, runSampleGathering } from "./view";
import { closeTryADeckModal } from "../../ui/tad-modal";
import { paintOpenGatherings } from "./landing";

const fake = vi.hoisted(() => ({
  load: vi.fn(),
  create: vi.fn(),
  members: vi.fn(),
  notify: vi.fn(),
  setSeat: vi.fn(),
  rsvp: vi.fn(),
  chart: vi.fn(),
  end: vi.fn(),
  lineups: vi.fn(),
  saveLineup: vi.fn(),
  off: vi.fn(),
  update: undefined as
    undefined | ((g: Gathering | null, metadata: { hasPendingWrites: boolean }) => void),
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => ({ uid: "host", displayName: "Host" }),
  requireUser: () => ({ uid: "host", displayName: "Host" }),
}));
vi.mock("../../services/cloud/gatherings", () => ({
  loadGathering: fake.load,
  createGathering: fake.create,
  setGatheringSeat: fake.setSeat,
  setSeatRsvp: fake.rsvp,
  markGatheringCharted: fake.chart,
  endGathering: fake.end,
  updateGatheringDetails: vi.fn(),
  cancelGathering: vi.fn(),
  goLiveGathering: vi.fn(),
  watchGathering: (_pod: string, _id: string, update: typeof fake.update) => {
    fake.update = update;
    return fake.off;
  },
}));
vi.mock("../../services/cloud/members", () => ({ loadPodMembers: fake.members }));
vi.mock("../../services/cloud/activity", () => ({ notify: fake.notify }));
vi.mock("../../services/cloud/table-formations", () => ({
  loadAllTableFormations: fake.lineups,
  saveTableFormation: fake.saveLineup,
}));

let runtime: GatheringRuntime;
let g: Gathering;
const query = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const click = (id: string): void => query<HTMLButtonElement>(`#${id}`).click();
const change = (selector: string, value: string): void => {
  const input = query<HTMLInputElement | HTMLSelectElement>(selector);
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
async function settled(): Promise<void> {
  await vi.waitFor(() => expect(query("#gatheringSeatsArea")).not.toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
  g = {
    id: "g",
    title: "Friday <friends>",
    hostUid: "host",
    status: "live",
    createdAt: 1,
    seats: {
      "0": { uid: "host", displayName: "Host", deck: { list: "1 Sol Ring", commander: "A" } },
      "1": {
        uid: "guest:1",
        displayName: "Visitor",
        guest: true,
        deck: { list: "1 Forest", commander: "B" },
      },
    },
  };
  fake.load.mockImplementation(async () => structuredClone(g));
  fake.members.mockResolvedValue([
    { uid: "host", displayName: "Host" },
    { uid: "friend", displayName: "Friend" },
  ]);
  fake.create.mockResolvedValue("new-g");
  fake.notify.mockResolvedValue(true);
  fake.lineups.mockResolvedValue({});
  fake.update = undefined;
  runtime = {
    ready: () => true,
    library: vi.fn().mockResolvedValue([]),
    analyze: vi.fn(() => ({})),
    colors: ["red", "green"],
    results: vi.fn(),
    refreshPods: vi.fn(),
    confirm: vi.fn(),
    pickDeck: vi.fn(() => closeTryADeckModal()),
  };
  configureGatherings(runtime);
});
afterEach(() => {
  stopGatheringPolling();
  closeTryADeckModal();
  vi.useRealTimers();
});

it("hosts an invited gathering with distinct member picks and named guest seats", async () => {
  const open = vi.fn();
  await openHostGatheringOverlay({ id: "pod" }, await fake.members(), open);
  query<HTMLInputElement>("#gatheringTitleInput").value = "Friday";
  change('[data-seat-index="1"]', "friend");
  expect(
    query<HTMLSelectElement>('[data-seat-index="2"]').querySelector('option[value="friend"]'),
  ).toBeNull();
  change('[data-seat-index="2"]', "__guest__");
  click("sendInvitesBtn");
  expect(query("#hostGatheringStatus").textContent).toContain("no name yet");
  const guest = query<HTMLInputElement>('[data-guest-name="2"]');
  guest.value = "Visitor";
  guest.dispatchEvent(new Event("input", { bubbles: true }));
  click("sendInvitesBtn");
  await vi.waitFor(() =>
    expect(fake.notify).toHaveBeenCalledWith("invite", "Friday", "pod", "new-g", ["friend"]),
  );
  expect(fake.create).toHaveBeenCalledWith(
    "pod",
    "Friday",
    expect.objectContaining({
      status: "proposed",
      seats: {
        "1": { uid: "friend", displayName: "Friend", deck: null, rsvp: "invited" },
        "2": expect.objectContaining({ displayName: "Visitor", guest: true, rsvp: "accepted" }),
      },
    }),
  );
  expect(document.body.textContent).toContain("Invites sent");
  expect(document.body.textContent).toContain("guest, no invite needed");
  click("invOpenBtn");
  expect(open).toHaveBeenCalledWith("pod", "new-g");
});

it("shows unconfirmed invite delivery rather than claiming success", async () => {
  fake.notify.mockResolvedValue(false);
  await openHostGatheringOverlay({ id: "pod" }, await fake.members(), vi.fn());
  change('[data-seat-index="1"]', "friend");
  click("sendInvitesBtn");
  await vi.waitFor(() => expect(document.body.textContent).toContain("invite not confirmed"));
  expect(document.body.textContent).toContain("could not confirm the invites were delivered");
});

it("renders waiting RSVP safely and writes the seated member's reply", async () => {
  g.status = "proposed";
  g.hostUid = "friend";
  g.seats["0"].rsvp = "invited";
  await openLiveGatheringOverlay("pod", "g");
  expect(document.body.textContent).toContain("Friday <friends>");
  expect(document.querySelector("friends")).toBeNull();
  click("wtAcceptBtn");
  await vi.waitFor(() => expect(fake.rsvp).toHaveBeenCalledWith("pod", "g", "0", "accepted"));
  expect(fake.notify).toHaveBeenCalledWith("rsvp", 'accepted "Friday <friends>"', "pod", "g", [
    "friend",
  ]);
});

it("charts guest decks without making guests Chronicle participants and releases the watcher", async () => {
  await openLiveGatheringOverlay("pod", "g");
  expect(query("#gatheringTrayContent").textContent).not.toContain("Loading");
  click("chartBattleBtn");
  await vi.waitFor(() => expect(runtime.results).toHaveBeenCalled());
  expect(fake.chart).toHaveBeenCalledWith("pod", "g");
  expect(runtime.results).toHaveBeenCalledWith(
    [
      { uid: "host", color: "red" },
      { uid: null, color: "green" },
    ],
    expect.objectContaining({
      podId: "pod",
      gatheringId: "g",
      isHost: true,
      participants: [{ uid: "host", displayName: "Host" }],
    }),
  );
  expect(fake.off).toHaveBeenCalledTimes(1);
});

it("holds an end warning through live updates and refreshes the latest seats on cancel", async () => {
  await openLiveGatheringOverlay("pod", "g");
  click("endGatheringBtn");
  expect(document.body.textContent).toContain("stop the current battle from being logged");
  g.title = "Updated title";
  fake.update?.(g, { hasPendingWrites: false });
  expect(query("#endGatheringCancelBtn")).not.toBeNull();
  click("endGatheringCancelBtn");
  await settled();
  expect(document.body.textContent).toContain("Updated title");
  click("endGatheringBtn");
  click("endGatheringConfirmBtn");
  await vi.waitFor(() => expect(runtime.refreshPods).toHaveBeenCalled());
  expect(fake.end).toHaveBeenCalledWith("pod", "g");
});

it("stops a tray subscription when the shared deck picker replaces the overlay", async () => {
  await openLiveGatheringOverlay("pod", "g");
  query<HTMLButtonElement>('[data-gathering-seat="1"]').click();
  await vi.waitFor(() => expect(fake.off).toHaveBeenCalledTimes(1));
  expect(runtime.pickDeck).toHaveBeenCalledWith({
    gatheringSeat: {
      podId: "pod",
      gatheringId: "g",
      seatIndex: 1,
      seatUid: "guest:1",
      seatIsGuest: true,
      seatDisplayName: "Visitor",
    },
  });
});

it("replaces an empty-seat select with guest controls and restores it without nesting", async () => {
  await openLiveGatheringOverlay("pod", "g");
  for (let i = 0; i < 2; i++) {
    change('[data-add-seat="3"]', "__guest__");
    const wrap = query<HTMLInputElement>("[data-gname]").closest("[data-add-wrap]")!;
    expect(wrap.querySelector("select")).toBeNull();
    wrap.querySelector<HTMLButtonElement>("[data-gcancel]")!.click();
    expect(wrap.querySelectorAll("[data-add-wrap]")).toHaveLength(0);
    expect(wrap.querySelector("select")).not.toBeNull();
  }
});

it("does not paint an old fetch into a newer gathering overlay", async () => {
  let release!: (value: Gathering) => void;
  fake.load.mockImplementationOnce(
    () =>
      new Promise<Gathering>((resolve) => {
        release = resolve;
      }),
  );
  const older = openLiveGatheringOverlay("pod", "old");
  await openLiveGatheringOverlay("pod", "new");
  release({ ...g, title: "Obsolete title" });
  await older;
  expect(document.body.textContent).not.toContain("Obsolete title");
  expect(document.body.textContent).toContain("Friday <friends>");
});

it("discards a sample when its loading overlay is closed", async () => {
  let release!: (value: Awaited<ReturnType<GatheringRuntime["library"]>>) => void;
  runtime.library = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = runSampleGathering();
  closeTryADeckModal();
  release([{ decklist: "1 Forest", flavorName: "A", commander: "A" }]);
  await pending;
  expect(runtime.analyze).not.toHaveBeenCalled();
  expect(runtime.results).not.toHaveBeenCalled();
});

it("omits stale and declined invites but keeps a live gathering joinable", () => {
  const area = document.createElement("div");
  document.body.append(area);
  const open = vi.fn();
  paintOpenGatherings(
    area,
    [
      { ...g, podId: "pod", status: "proposed", title: "Stale" },
      { ...g, podId: "pod", status: "live", title: "<Live>" },
    ],
    "host",
    open,
  );
  expect(area.textContent).not.toContain("Stale");
  expect(area.textContent).toContain("<Live>");
  expect(area.querySelector("live")).toBeNull();
  area.querySelector("button")!.click();
  expect(open).toHaveBeenCalledWith("pod", "g");
});
