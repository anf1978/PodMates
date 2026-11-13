// @vitest-environment happy-dom
// Real inbox templates with repository mocks; no Firebase traffic or real accounts.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Storage } from "happy-dom";
import type { ActivityItem } from "../../services/cloud/activity";
import { emit, on } from "../../services/events";
import { closeAllModals } from "../../ui/modal";
import { mount, type NotificationsFeature } from "./index";
import type { Pod } from "./state";

const fake = vi.hoisted(() => ({
  user: { uid: "me", isAnonymous: false } as { uid: string; isAnonymous: boolean } | null,
  auth: [] as (() => void)[],
  load: vi.fn(),
  watch: vi.fn(),
  report: vi.fn(),
  samples: vi.fn(),
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => fake.user,
  onAuthChange: (cb: () => void) => fake.auth.push(cb),
}));
vi.mock("../../services/cloud/pods", () => ({ loadMyPods: fake.load }));
vi.mock("../../services/cloud/activity", () => ({ watchActivity: fake.watch }));
vi.mock("../../services/report-error", () => ({ reportError: fake.report }));
vi.mock("../../services/card-data", () => ({ loadNewSampleDecks: fake.samples }));

const now = 1800000000000;
const storage = new Storage();
const pod: Pod = {
  id: "pod",
  name: "Friday <friends>",
  leaderId: "me",
  memberIds: ["me", "friend"],
  coLeaderIds: [],
  inviteCode: "TEST",
};
const activity = (extra: Partial<ActivityItem> = {}): ActivityItem => ({
  id: "deck",
  podId: "pod",
  type: "deck",
  by: "friend",
  byName: "<Alex>",
  subject: "<img src=x onerror=alert(1)>",
  createdAt: now,
  ...extra,
});
let feature: NotificationsFeature;
let bar: HTMLElement;
let disposers: (() => void)[];
const query = <T extends HTMLElement = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubGlobal("localStorage", storage);
  fake.auth = [];
  fake.user = { uid: "me", isAnonymous: false };
  fake.load.mockResolvedValue([pod]);
  fake.samples.mockResolvedValue([]);
  fake.watch.mockImplementation((_id, cb: (items: ActivityItem[]) => void) => {
    cb([activity()]);
    return vi.fn();
  });
  storage.clear();
  storage.setItem("pm_notif_seen_me", String(now - 1000));
  bar = document.createElement("div");
  document.body.append(bar);
  disposers = [];
  feature = mount(bar);
});
afterEach(() => {
  feature.destroy();
  disposers.forEach((off) => off());
  closeAllModals();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("updates the badge, marks seen, escapes text and persists opt-outs without collapsing settings", async () => {
  await feature.restart();
  expect(query("#pmBellBtn").getAttribute("aria-label")).toBe("Notifications, 1 new");
  query("#pmBellBtn").click();
  await settle();
  expect(feature.unread()).toBe(0);
  expect(storage.getItem("pm_notif_seen_me")).toBe(String(now));
  expect(query("#pmNotifList").textContent).toContain("<Alex> charted a new deck: <img");
  expect(query("#pmNotifList img")).toBeNull();
  expect(query(".pm-notif-fresh")).not.toBeNull();
  query<HTMLDetailsElement>("details").open = true;
  query<HTMLInputElement>('[data-type="deck"]').click();
  expect(query("details").hasAttribute("open")).toBe(true);
  expect(query("#pmNotifList").textContent).toContain("Nothing new yet.");
  expect(JSON.parse(storage.getItem("pm_notif_prefs_me")!)).toEqual({
    types: { deck: false },
    muted: {},
  });
  query<HTMLInputElement>('[data-type="deck"]').click();
  query<HTMLInputElement>('[data-mute="pod"]').click();
  expect(query("#pmNotifList").textContent).toContain("Nothing new yet.");
});

it("keeps a guest's unsaved opt-out when auth settles after the inbox opens", async () => {
  fake.user = null;
  feature.open();
  await settle();
  query<HTMLDetailsElement>("details").open = true;
  query<HTMLInputElement>('[data-type="deck"]').click();
  expect(query<HTMLInputElement>('[data-type="deck"]').checked).toBe(false);
  fake.auth[0]();
  await vi.advanceTimersByTimeAsync(600);
  expect(query<HTMLInputElement>('[data-type="deck"]').checked).toBe(false);
  expect(query("details").hasAttribute("open")).toBe(true);
  expect(storage.getItem("pm_notif_prefs_null")).toBeNull();
});

it("routes gatherings and other activity through typed events, closing the inbox", async () => {
  const gathering = vi.fn(),
    detail = vi.fn();
  disposers.push(on("gatherings:open", gathering), on("pods:open", detail));
  fake.watch.mockImplementation((_id, cb: (items: ActivityItem[]) => void) => {
    cb([activity({ type: "invite", ref: "game" })]);
    return vi.fn();
  });
  await feature.restart();
  feature.open();
  await settle();
  query<HTMLButtonElement>("[data-n]").click();
  expect(gathering).toHaveBeenCalledWith({ podId: "pod", id: "game" });
  expect(query("#tadOverlay")).toBeNull();
  fake.watch.mockImplementation((_id, cb: (items: ActivityItem[]) => void) => {
    cb([activity({ type: "joined", subject: "the pod" })]);
    return vi.fn();
  });
  await feature.restart();
  feature.open();
  await settle();
  query<HTMLButtonElement>("[data-n]").click();
  expect(detail).toHaveBeenCalledWith({ pod, pods: [pod] });
});

it("opens a deck preview for new and updated deck notices instead of the pod", async () => {
  const preview = vi.fn(),
    podOpen = vi.fn();
  disposers.push(on("decks:preview", preview), on("pods:open", podOpen));
  for (const extra of [{}, { ref: "updated" }]) {
    fake.watch.mockImplementation((_id, cb: (items: ActivityItem[]) => void) => {
      cb([activity({ subject: "Atraxa (Alex)", ...extra })]);
      return vi.fn();
    });
    await feature.restart();
    feature.open();
    await settle();
    query<HTMLButtonElement>("[data-n]").click();
    expect(query("#tadOverlay")).toBeNull();
  }
  const request = { uid: "friend", name: "<Alex>", podId: "pod", deckName: "Atraxa (Alex)" };
  expect(preview.mock.calls).toEqual([[request], [request]]);
  expect(podOpen).not.toHaveBeenCalled();
});

it("debounces membership changes and stops subscriptions on account changes and cleanup", async () => {
  const off = vi.fn();
  fake.watch.mockReturnValue(off);
  await feature.restart();
  emit("pods:membership", undefined);
  emit("pods:membership", undefined);
  await vi.advanceTimersByTimeAsync(600);
  expect(fake.load).toHaveBeenCalledTimes(2);
  expect(off).toHaveBeenCalledTimes(1);
  fake.user = null;
  fake.auth[0]();
  expect(off).toHaveBeenCalledTimes(2);
  expect(query("#pmBellBtn").classList.contains("pm-notif-signed-in")).toBe(false);
  await vi.advanceTimersByTimeAsync(600);
  expect(fake.load).toHaveBeenCalledTimes(2);
  feature.destroy();
  emit("pods:membership", undefined);
  await vi.advanceTimersByTimeAsync(600);
  expect(fake.load).toHaveBeenCalledTimes(2);
});

it("ignores superseded pod loads and stale feed callbacks after sign-out", async () => {
  let resolve!: (pods: Pod[]) => void;
  fake.load.mockImplementationOnce(
    () =>
      new Promise<Pod[]>((r) => {
        resolve = r;
      }),
  );
  const old = feature.restart();
  await feature.restart();
  expect(fake.watch).toHaveBeenCalledTimes(1);
  const callback = fake.watch.mock.calls[0][1] as (items: ActivityItem[]) => void;
  fake.user = null;
  fake.auth[0]();
  resolve([pod]);
  await old;
  callback([activity()]);
  expect(fake.watch).toHaveBeenCalledTimes(1);
  expect(feature.unread()).toBe(0);
});

it("initializes each account independently and reports corrupt storage and repository failures", async () => {
  storage.removeItem("pm_notif_seen_me");
  storage.setItem("pm_notif_prefs_me", "{bad json");
  await feature.restart();
  expect(feature.unread()).toBe(0);
  expect(fake.report).toHaveBeenCalledWith(expect.any(Error), {
    operation: "notifications",
    severity: "warning",
  });
  storage.setItem("pm_notif_prefs_me", JSON.stringify({ types: { deck: false }, muted: {} }));
  await feature.restart();
  fake.user = { uid: "second", isAnonymous: false };
  fake.auth[0]();
  await vi.advanceTimersByTimeAsync(600);
  feature.open();
  await settle();
  expect(query<HTMLInputElement>('[data-type="deck"]').checked).toBe(true);
  const failure = new Error("offline");
  fake.load.mockRejectedValueOnce(failure);
  await feature.restart();
  expect(fake.report).toHaveBeenCalledWith(failure, { operation: "cloud" });
});

it("lists decks newly added to Try a Deck and opens their preview", async () => {
  const preview = vi.fn();
  disposers.push(on("samples:preview", preview));
  fake.watch.mockImplementation(() => vi.fn());
  fake.samples.mockResolvedValue([
    { key: "cmd2027-new", name: "New <Deck>", commander: "Some Legend", addedAt: now - 1000 },
  ]);
  storage.setItem("pm_notif_seen_me", String(now - 5000)); // seen before the deck was added
  await feature.restart();
  await settle();
  expect(fake.samples).toHaveBeenCalledWith(now);
  expect(feature.unread()).toBe(1);
  feature.open();
  await settle();
  const row = query<HTMLButtonElement>("[data-n]");
  expect(row.textContent).toContain("New in Try a Deck: New <Deck> (Some Legend)");
  expect(row.textContent).toContain("Try a Deck ·");
  expect(row.innerHTML).not.toContain("<Deck>");
  row.click();
  expect(preview).toHaveBeenCalledWith({ key: "cmd2027-new" });
  expect(query("#tadOverlay")).toBeNull();
});

it("shows Try-a-Deck notices to signed-in accounts only", async () => {
  fake.user = null;
  fake.samples.mockResolvedValue([
    { key: "cmd2027-new", name: "New", commander: "", addedAt: now - 1000 },
  ]);
  await feature.restart();
  await settle();
  expect(fake.samples).not.toHaveBeenCalled();
  expect(feature.unread()).toBe(0);
});
