// Battle result controls, repeat/new/end writes and realtime fallback without live cloud traffic.
// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as cloud from "../../services/cloud/gatherings";
import {
  configureBattle,
  renderBattleControls,
  startResultsPolling,
  stopResultsPolling,
} from "./battle";
import { watchBattleResults } from "./watch";
import type { ChronicleBattle, ChronicleBattleDeck } from "./state";

vi.mock("../../services/cloud/gatherings", () => ({
  loadGathering: vi.fn(),
  watchGathering: vi.fn(),
  markGatheringCharted: vi.fn(),
  resetGatheringDecks: vi.fn(),
  endGathering: vi.fn(),
}));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));
vi.mock("../../ui/toast", () => ({ showToast: vi.fn() }));

const metadata = { hasPendingWrites: false, fromCache: false, isEqual: () => false };
function gathering(overrides: Partial<cloud.Gathering> = {}): cloud.Gathering {
  return {
    id: "g1",
    title: "Wednesday",
    hostUid: "host",
    status: "live",
    createdAt: 1,
    lastLoggedChronicleId: "old",
    seats: {
      "0": { uid: "host", displayName: "Host", deck: { list: "deck-a", commander: "A" } },
      "1": {
        uid: "guest-1",
        displayName: "Guest",
        guest: true,
        deck: { list: "deck-b", commander: "B" },
      },
    },
    ...overrides,
  };
}

let context: ChronicleBattle | null;
const unsubscribe = vi.fn();
const feedback = vi.fn();
const log = vi.fn<() => Promise<void>>();
const results = vi.fn<(decks: ChronicleBattleDeck[]) => void>();
const clearDecks = vi.fn();
const openGathering = vi.fn();
const confirm = vi.fn<(message: string, label: string, action: () => Promise<void>) => void>();
const click = (id: string): void => document.querySelector<HTMLButtonElement>(id)!.click();

beforeEach(() => {
  vi.resetAllMocks();
  context = {
    podId: "pod-a",
    gatheringId: "g1",
    gatheringTitle: "Wednesday",
    participants: [{ uid: "host" }],
    isHost: true,
    loggedChronicleId: "old",
  };
  document.body.innerHTML = '<div id="battleControlsArea"></div><div id="podResultsSection"></div>';
  vi.mocked(cloud.watchGathering).mockReturnValue(unsubscribe);
  vi.mocked(cloud.loadGathering).mockResolvedValue(gathering());
  configureBattle(
    {
      context: () => context,
      setContext: (value) => {
        context = value;
      },
      clearDecks,
      ready: () => true,
      analyze: () => ({ commandSpark: 6, style: "Engine" }),
      colors: ["red", "blue"],
      results,
      openGathering,
      confirmAction: confirm,
    },
    feedback,
    log,
  );
  renderBattleControls();
});
afterEach(() => {
  stopResultsPolling();
  vi.useRealTimers();
});

it("repeats seated decks, excluding guest identities and ignoring the previous Chronicle signal", async () => {
  click("#repeatBattleBtn");
  await vi.waitFor(() => expect(results).toHaveBeenCalledOnce());
  expect(results.mock.calls[0][0]).toMatchObject([
    { uid: "host", color: "red" },
    { uid: null, color: "blue" },
  ]);
  expect(cloud.markGatheringCharted).toHaveBeenCalledWith("pod-a", "g1");
  expect(context).toMatchObject({ ignoreChronicleId: "old", loggedChronicleId: null });
  expect(document.querySelector("#logBattleBtn")).not.toBeNull();
  expect(cloud.watchGathering).toHaveBeenCalledOnce();
});

it("clears decks only after the new-battle write succeeds and returns to the Gathering", async () => {
  click("#startNewBattleBtn");
  await vi.waitFor(() => expect(openGathering).toHaveBeenCalledWith("pod-a", "g1"));
  expect(cloud.resetGatheringDecks).toHaveBeenCalledWith("pod-a", "g1");
  expect(context).toBeNull();
  expect(clearDecks).toHaveBeenCalledOnce();
  expect(document.querySelector("#battleControlsArea")!.textContent).toBe("");
});

it("requires confirmation for End Gathering and Log Battle", async () => {
  click("#endGatheringFromResultsBtn");
  expect(cloud.endGathering).not.toHaveBeenCalled();
  await confirm.mock.calls[0][2]();
  expect(cloud.endGathering).toHaveBeenCalledWith("pod-a", "g1");
  context = { podId: "pod-a", gatheringId: "g1", participants: [], isHost: true };
  renderBattleControls();
  click("#logBattleBtn");
  expect(log).not.toHaveBeenCalled();
  expect(confirm.mock.calls[1][1]).toBe("Log Battle");
  await confirm.mock.calls[1][2]();
  expect(log).toHaveBeenCalledOnce();
});

it("opens a non-host survey only for a new committed result and tears down its listener", () => {
  context!.isHost = false;
  context!.loggedChronicleId = null;
  context!.ignoreChronicleId = "old";
  startResultsPolling();
  const receive = vi.mocked(cloud.watchGathering).mock.calls[0][2];
  receive(gathering({ lastLoggedChronicleId: "new" }), { ...metadata, hasPendingWrites: true });
  receive(gathering(), metadata);
  expect(feedback).not.toHaveBeenCalled();
  receive(gathering({ lastLoggedChronicleId: "new" }), metadata);
  receive(gathering({ lastLoggedChronicleId: "new" }), metadata);
  expect(feedback).toHaveBeenCalledExactlyOnceWith("pod-a", "new");
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(document.querySelector("#battleControlsArea")!.textContent).toContain(
    "thanks for playing",
  );
});

it("falls back to eight-second reads and ignores an in-flight result after teardown", async () => {
  vi.useFakeTimers();
  context!.loggedChronicleId = null;
  vi.mocked(cloud.watchGathering).mockImplementationOnce(() => {
    throw new Error("offline");
  });
  let resolve!: (value: cloud.Gathering) => void;
  vi.mocked(cloud.loadGathering).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const logged = vi.fn();
  const stop = watchBattleResults(context!, () => true, logged);
  await vi.advanceTimersByTimeAsync(8000);
  expect(cloud.loadGathering).toHaveBeenCalledWith("pod-a", "g1");
  stop();
  resolve(gathering({ lastLoggedChronicleId: "late" }));
  await vi.advanceTimersByTimeAsync(16000);
  expect(cloud.loadGathering).toHaveBeenCalledOnce();
  expect(logged).not.toHaveBeenCalled();
});

it("does not apply an old new-battle completion to a replacement context", async () => {
  let resolve!: () => void;
  vi.mocked(cloud.resetGatheringDecks).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  click("#startNewBattleBtn");
  const replacement = { ...context!, gatheringId: "g2" };
  context = replacement;
  resolve();
  await vi.waitFor(() => expect(cloud.resetGatheringDecks).toHaveBeenCalledOnce());
  expect(context).toBe(replacement);
  expect(clearDecks).not.toHaveBeenCalled();
  expect(openGathering).not.toHaveBeenCalled();
});
