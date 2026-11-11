// Chronicle grouping, editing, scoped reads and optional feedback without Firebase traffic.
// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as cloud from "../../services/cloud/chronicles";
import { loadPodMembers } from "../../services/cloud/members";
import { reportError } from "../../services/report-error";
import { closeTryADeckModal } from "../../ui/tad-modal";
import {
  configureChronicles,
  mount,
  refreshCloudChroniclesCache,
  showFeedbackSurvey,
} from "./index";
import {
  canEditChronicle,
  emptyState,
  feedbackSummary,
  groupChronicles,
  type Chronicle,
} from "./state";

const fake = vi.hoisted(() => ({ user: { uid: "me" } as { uid: string } | null }));
vi.mock("../../services/cloud/session", () => ({ getCurrentUser: () => fake.user }));
vi.mock("../../services/cloud/chronicles", () => ({
  loadAllChronicles: vi.fn(),
  updateChronicleNotes: vi.fn(),
  deleteChronicleEntry: vi.fn(),
  clearAllChronicles: vi.fn(),
  addChronicleFeedback: vi.fn(),
}));
vi.mock("../../services/cloud/members", () => ({ loadPodMembers: vi.fn() }));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));
vi.mock("../../ui/toast", () => ({ showToast: vi.fn() }));

function entry(overrides: Partial<Chronicle> = {}): Chronicle {
  return {
    id: "battle",
    date: "11/11/2026, 8:00 PM",
    createdAt: 1,
    notes: "A close finish.",
    loggedBy: "Alex",
    gatheringId: "gathering",
    gatheringTitle: "Wednesday",
    decks: [{ commander: "Atraxa", player: "Alex", spark: "6.3" }],
    participants: ["me"],
    feedbackResponses: [],
    ...overrides,
  };
}

describe("journal state", () => {
  it("preserves newest-first group order and includes older entries and arbitrary titles", () => {
    const newest = entry({ id: "new", gatheringTitle: "__proto__" });
    const older = entry({ id: "old", gatheringTitle: null });
    const repeated = entry({ id: "again", gatheringTitle: "__proto__" });
    expect([...groupChronicles([newest, older, repeated])]).toEqual([
      ["__proto__", [newest, repeated]],
      ["Earlier Chronicles", [older]],
    ]);
  });

  it("allows leaders, participants and members managing historical battles, never signed-out users", () => {
    const member = emptyState("me");
    const otherBattle = entry({ participants: ["other"] });
    expect(canEditChronicle(otherBattle, member)).toBe(false);
    expect(canEditChronicle(entry(), member)).toBe(true);
    expect(canEditChronicle(entry({ participants: [] }), member)).toBe(true);
    expect(canEditChronicle(entry(), emptyState())).toBe(false);
    expect(canEditChronicle(entry({ id: "" }), member)).toBe(false);
    for (const role of ["leader", "co-leader"] as const)
      expect(canEditChronicle(otherBattle, { ...member, role })).toBe(true);
  });

  it("averages only numeric ratings, retaining all written highlights", () => {
    const responses = [
      { uid: "a", displayName: "A", submittedAt: 1, fun: 5, accuracy: null, bestMoment: "Close!" },
      { uid: "b", displayName: "B", submittedAt: 2, fun: 4, accuracy: 3, bestMoment: "" },
      { uid: "c", displayName: "C", submittedAt: 3, fun: "1", accuracy: 5, bestMoment: "Wow!" },
    ];
    expect(feedbackSummary(responses)).toEqual({
      fun: "4.5",
      accuracy: "4.0",
      moments: ["Close!", "Wow!"],
    });
  });
});

describe("journal interactions", () => {
  let podId: string | null;
  const confirm = vi.fn<(message: string, action: () => Promise<void>) => void>();
  const confirmDelete = vi.fn<(message: string, action: () => Promise<void>) => void>();
  const requireAccount = vi.fn(() => true);
  const click = (selector: string): void =>
    document.querySelector<HTMLButtonElement>(selector)!.click();

  beforeEach(async () => {
    vi.clearAllMocks();
    fake.user = { uid: "me" };
    podId = "pod-a";
    document.body.innerHTML = '<div id="matchHistoryPanel" class="panel"></div>';
    configureChronicles({ podId: () => podId, confirm, confirmDelete, requireAccount });
    vi.mocked(cloud.loadAllChronicles).mockResolvedValue([entry()]);
    vi.mocked(loadPodMembers).mockResolvedValue([]);
    mount();
    await refreshCloudChroniclesCache();
  });
  afterEach(closeTryADeckModal);

  it("escapes journal content and saves notes to the pod that opened the editor", async () => {
    vi.mocked(cloud.loadAllChronicles).mockResolvedValue([
      entry({ notes: "<img src=x onerror=alert(1)>", gatheringTitle: "<script>bad()</script>" }),
    ]);
    await refreshCloudChroniclesCache();
    expect(document.querySelector("#matchLogArea img, #matchLogArea script")).toBeNull();
    click("[data-chron-edit]");
    const input = document.querySelector<HTMLTextAreaElement>("#chronicleNotesInput")!;
    expect(input.value).toBe("<img src=x onerror=alert(1)>");
    input.value = "Updated notes";
    input.dispatchEvent(new Event("input"));
    expect(document.querySelector("#chronicleNotesCount")!.textContent?.trim()).toBe("13 / 500");
    podId = "pod-b";
    click("#chronicleNotesSaveBtn");
    await vi.waitFor(() =>
      expect(cloud.updateChronicleNotes).toHaveBeenCalledWith("pod-a", "battle", "Updated notes"),
    );
    await vi.waitFor(() => expect(document.querySelector("#tadOverlay")).toBeNull());
  });

  it("confirms deletion before writing and keeps the original pod scope", async () => {
    click("[data-chron-del]");
    expect(cloud.deleteChronicleEntry).not.toHaveBeenCalled();
    expect(confirmDelete.mock.calls[0][0]).toContain("Its notes and ratings go with it");
    podId = "pod-b";
    await confirmDelete.mock.calls[0][1]();
    expect(cloud.deleteChronicleEntry).toHaveBeenCalledWith("pod-a", "battle");
  });

  it("guards bulk clearing by role, while leaders must still confirm", async () => {
    click("#clearMatchHistoryBtn");
    expect(confirm).not.toHaveBeenCalled();
    vi.mocked(loadPodMembers).mockResolvedValue([
      {
        uid: "me",
        role: "leader",
        displayName: "Me",
        joinedAt: 1,
        nameClash: false,
        displayLabel: "Me",
      },
    ]);
    await refreshCloudChroniclesCache();
    click("#clearMatchHistoryBtn");
    expect(cloud.clearAllChronicles).not.toHaveBeenCalled();
    await confirm.mock.calls[0][1]();
    expect(cloud.clearAllChronicles).toHaveBeenCalledWith("pod-a");
  });

  it("does not display a slow response from an earlier pod after switching pods", async () => {
    let finish!: (entries: Chronicle[]) => void;
    vi.mocked(cloud.loadAllChronicles).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const oldRefresh = refreshCloudChroniclesCache();
    podId = "pod-b";
    vi.mocked(cloud.loadAllChronicles).mockResolvedValue([
      entry({ gatheringTitle: "Current pod" }),
    ]);
    await refreshCloudChroniclesCache();
    finish([entry({ gatheringTitle: "Old pod" })]);
    await oldRefresh;
    expect(document.querySelector("#matchLogArea")!.textContent).toContain("Current pod");
    expect(document.querySelector("#matchLogArea")!.textContent).not.toContain("Old pod");
    fake.user = null;
    await refreshCloudChroniclesCache();
    expect(document.querySelector("#matchLogArea")!.textContent).toContain("No chapters yet");
  });

  it("reports load failures and falls back to the existing empty journal", async () => {
    const error = new Error("offline");
    vi.mocked(cloud.loadAllChronicles).mockRejectedValueOnce(error);
    await refreshCloudChroniclesCache();
    expect(reportError).toHaveBeenCalledWith(error, { operation: "cloud" });
    expect(document.querySelector("#matchLogArea")!.textContent).toContain("No chapters yet");
  });

  it("saves independent optional ratings and trimmed highlights, while skipping writes nothing", async () => {
    showFeedbackSurvey("pod-a", "battle");
    click("#skipFeedbackBtn");
    expect(cloud.addChronicleFeedback).not.toHaveBeenCalled();
    showFeedbackSurvey("pod-a", "battle");
    click('#funRatingRow [data-rate="4"]');
    const moment = document.querySelector<HTMLTextAreaElement>("#bestMomentInput")!;
    moment.value = "  One life left!  ";
    click('#accuracyRatingRow [data-rate="5"]');
    expect(moment.value).toBe("  One life left!  ");
    click("#submitFeedbackBtn");
    await vi.waitFor(() =>
      expect(cloud.addChronicleFeedback).toHaveBeenCalledWith("pod-a", "battle", {
        fun: 4,
        accuracy: 5,
        bestMoment: "One life left!",
      }),
    );
    await vi.waitFor(() => expect(document.querySelector("#tadOverlay")).toBeNull());
    showFeedbackSurvey("pod-a", "battle");
    click("#submitFeedbackBtn");
    await vi.waitFor(() =>
      expect(cloud.addChronicleFeedback).toHaveBeenLastCalledWith("pod-a", "battle", {
        fun: null,
        accuracy: null,
        bestMoment: "",
      }),
    );
  });

  it("keeps failed feedback open with the existing error text", async () => {
    const error = new Error("That battle was deleted");
    vi.mocked(cloud.addChronicleFeedback).mockRejectedValueOnce(error);
    showFeedbackSurvey("pod-a", "battle");
    click("#submitFeedbackBtn");
    await vi.waitFor(() =>
      expect(document.querySelector("#feedbackStatus")!.textContent).toBe(
        "Could not save: That battle was deleted",
      ),
    );
    expect(reportError).toHaveBeenCalledWith(error, { operation: "cloud", userTriggered: true });
  });
});
