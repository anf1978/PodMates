import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notify, watchActivity } from "./activity";
import { friendlyAuthError, signUpWithEmail } from "./auth";
import { addChronicleEntry, addChronicleFeedback, clearAllChronicles } from "./chronicles";
import { loadAllDecks, loadPodmateDecksRaw, saveDeck } from "./decks";
import { createGathering, loadOpenGatherings, setSeatDeck, watchGathering } from "./gatherings";
import { nominateImpact, setImpactChange, setImpactReason } from "./impact";
import { addLinkedDeck } from "./linked-decks";
import { loadPodMembers } from "./members";
import { createPod, joinPodByInviteCode } from "./pods";
import { updateMyDisplayName } from "./profile";
import { onAuthChange } from "./session";
import { on } from "../events";
import { loadSpoilerVotes, setSpoilerVote } from "./spoiler-votes";
import { loadAllTableFormations, saveTableFormation } from "./table-formations";
import { loadTrades, saveTrade } from "./trades";
import { updateMyProfileLinks } from "./users";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

const { fake, SERVER_TIMESTAMP } = fb;
const NOW = 1_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const writesTo = (prefix: string) => fake.writes.filter((w) => w.path.startsWith(prefix));

it("announces successful membership writes without depending on the legacy cloud API", async () => {
  const changed = vi.fn();
  const off = on("pods:membership", changed);
  try {
    await joinPodByInviteCode("");
    expect(changed).not.toHaveBeenCalled();
    await createPod("Friday");
    expect(changed).toHaveBeenCalledOnce();
    vi.spyOn(fb, "setDoc").mockRejectedValueOnce(new Error("offline"));
    await expect(createPod("Saturday")).rejects.toThrow("offline");
    expect(changed).toHaveBeenCalledOnce();
  } finally {
    off();
  }
});

beforeEach(() => {
  fake.reset();
  fake.signIn({ uid: "u1", displayName: "Ann", email: "ann@example.com" });
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session and auth", () => {
  it("refuses repository calls while signed out and reports auth changes", async () => {
    const seen: unknown[] = [];
    onAuthChange((user) => seen.push(user && user.uid));
    fake.signOut();
    await expect(loadAllDecks()).rejects.toThrow("Not signed in yet");
    expect(seen).toEqual(["u1", null]);
  });

  it("falls back to logging in when sign-up finds an existing account", async () => {
    vi.mocked(fb.createUserWithEmailAndPassword).mockRejectedValueOnce({
      code: "auth/email-already-in-use",
    });
    vi.mocked(fb.signInWithEmailAndPassword).mockResolvedValueOnce({
      user: fake.signIn({ uid: "u9", email: "nine@example.com" }),
    } as never);
    await expect(signUpWithEmail("nine@example.com", "secret1")).resolves.toEqual({
      ok: true,
      switchedToExisting: true,
      user: {
        uid: "u9",
        isAnonymous: false,
        email: "nine@example.com",
        displayName: null,
        providers: ["password"],
      },
    });
  });

  it("translates Firebase errors into plain language", () => {
    expect(friendlyAuthError({ code: "auth/weak-password" })).toBe(
      "Password needs to be at least 6 characters.",
    );
    expect(
      friendlyAuthError({ message: "Unable to process request due to missing initial state" }),
    ).toMatch(/^Your browser blocked the sign-in window from finishing\./);
    expect(friendlyAuthError({ code: "auth/other", message: "Raw" })).toBe("Raw");
    expect(friendlyAuthError(null)).toBe("Something went wrong. Please try again.");
  });
});

describe("decks", () => {
  it("saves under an escaped deck key with the stored field set", async () => {
    await saveDeck("Tymna / Kraum (Ann)", { commander: "Tymna", list: "1 Sol Ring" });
    expect(fake.get("users/u1/decks/Tymna%20%2F%20Kraum%20(Ann)")).toEqual({
      key: "Tymna / Kraum (Ann)",
      commander: "Tymna",
      player: "",
      list: "1 Sol Ring",
      deckName: "Tymna / Kraum (Ann)",
      savedAt: NOW,
      secret: false,
      updatedAt: SERVER_TIMESTAMP,
    });
  });

  it("maps saved decks by key and backfills a missing secret flag", async () => {
    fake.seed("users/u1/decks/d1", {
      key: "K",
      list: "L",
      commander: "C",
      player: "P",
      deckName: "N",
      savedAt: 5,
    });
    await expect(loadAllDecks()).resolves.toEqual({
      K: {
        list: "L",
        commander: "C",
        player: "P",
        deckName: "N",
        savedAt: 5,
        secret: false,
        docId: "d1",
      },
    });
    await flush();
    expect(fake.get("users/u1/decks/d1")?.secret).toBe(false);
  });

  it("reads only a podmate's decks explicitly marked not secret", async () => {
    fake.seed("users/u2/decks/s", { key: "S", secret: true });
    fake.seed("users/u2/decks/m", { key: "M" });
    fake.seed("users/u2/decks/p", {
      key: "P",
      list: "L",
      commander: "C",
      player: "Bo",
      savedAt: 3,
      secret: false,
    });
    await expect(loadPodmateDecksRaw("u2")).resolves.toEqual({
      P: { list: "L", commander: "C", player: "Bo", savedAt: 3, secret: false, docId: "p" },
    });
  });
});

describe("spoiler votes", () => {
  it("stores one vote per card and ignores malformed votes when loading", async () => {
    await setSpoilerVote({ key: "sol ring", n: "Sol Ring", setName: "Alpha" }, "like");
    expect(fake.get("users/u1/spoilerVotes/sol%20ring")).toEqual({
      key: "sol ring",
      n: "Sol Ring",
      setName: "Alpha",
      vote: "like",
      votedAt: NOW,
      updatedAt: SERVER_TIMESTAMP,
    });
    await expect(setSpoilerVote({ key: "x" }, "meh")).rejects.toThrow("Bad vote.");
    fake.seed("users/u1/spoilerVotes/bad", { key: "bad", vote: "meh" });
    expect((await loadSpoilerVotes("u1")).map((v) => v.key)).toEqual(["sol ring"]);
  });
});

describe("users", () => {
  it("stores only checked web links on the user's own document", async () => {
    vi.stubGlobal("window", {
      safeHttpUrl: (s: string) => (s.startsWith("javascript:") ? "" : `https://${s}`),
    });
    await updateMyProfileLinks({ archidektUrl: " archidekt.com/u/ann ", moxfieldUrl: "" });
    expect(fake.writes).toEqual([
      {
        op: "set",
        path: "users/u1",
        data: { archidektProfileUrl: "https://archidekt.com/u/ann", moxfieldProfileUrl: "" },
        options: { merge: true },
      },
    ]);
    await expect(updateMyProfileLinks({ moxfieldUrl: "javascript:alert(1)" })).rejects.toThrow(
      "Moxfield link doesn't look like a web address.",
    );
  });
});

describe("linked decks", () => {
  it("stores the link and mirrors it into saved decks under a stable id", async () => {
    const fetchDeck = vi.fn(async () =>
      Response.json({
        platform: "archidekt",
        deckId: "123",
        url: "https://archidekt.com/decks/123",
        name: "My Deck",
        commander: "Atraxa",
        decklistText: "1 Sol Ring",
        cardCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchDeck);
    vi.stubGlobal("window", {
      generateUniqueDeckName: (name: string, taken: Set<string>) =>
        taken.has(name) ? `${name} (2)` : name,
    });
    fake.seed("users/u1/decks/old", { key: "My Deck", deckName: "My Deck", secret: false });

    const result = await addLinkedDeck("https://archidekt.com/decks/123");

    expect(fetchDeck).toHaveBeenCalledWith(
      "https://spring-unit-49d9.anthony-ef7.workers.dev/?deckUrl=https%3A%2F%2Farchidekt.com%2Fdecks%2F123",
    );
    expect(result).toMatchObject({ ok: true, id: "archidekt-123", renamed: true });
    expect(fake.get("users/u1/linkedDecks/archidekt-123")).toMatchObject({
      name: "My Deck (2)",
      commander: "Atraxa",
      addedAt: NOW,
      syncedAt: NOW,
    });
    expect(fake.get("users/u1/decks/linked-archidekt-123")).toMatchObject({
      key: "My Deck (2)",
      list: "1 Sol Ring",
      player: "Ann",
      secret: false,
    });
  });
});

describe("pods and members", () => {
  it("creates a pod with its leader's member snapshot", async () => {
    const result = await createPod("  ");
    expect(result).toEqual({
      ok: true,
      podId: "auto-1",
      inviteCode: expect.stringMatching(/^[A-HJ-NP-Z2-9]{8}$/),
    });
    expect(fake.get("pods/auto-1")).toEqual({
      name: "Our Pod",
      leaderId: "u1",
      coLeaderIds: [],
      memberIds: ["u1"],
      inviteCode: result.inviteCode,
      createdAt: SERVER_TIMESTAMP,
    });
    expect(fake.get("pods/auto-1/members/u1")).toEqual({
      displayName: "Ann",
      role: "leader",
      joinedAt: NOW,
    });
  });

  it("joins by invite code unless the display name is already taken", async () => {
    fake.seed("pods/p9", { name: "Nine", inviteCode: "ABCDEFGH", memberIds: ["u2"] });
    fake.seed("pods/p9/members/u2", { displayName: " ANN ", role: "leader", joinedAt: 1 });
    await expect(joinPodByInviteCode(" abcdefgh ")).resolves.toMatchObject({
      ok: false,
      nameConflict: true,
      podId: "p9",
    });
    expect(fake.writes).toEqual([]);

    fake.seed("pods/p9/members/u2", { displayName: "Bo", role: "leader", joinedAt: 1 });
    await expect(joinPodByInviteCode("ABCDEFGH")).resolves.toEqual({
      ok: true,
      podId: "p9",
      podName: "Nine",
    });
    expect(fake.get("pods/p9")?.memberIds).toEqual(["u2", "u1"]);
    expect(fake.get("pods/p9/members/u1")).toEqual({
      displayName: "Ann",
      role: "member",
      joinedAt: NOW,
    });
  });

  it("orders members by join time and numbers clashing names", async () => {
    fake.seed("pods/p1/members/a", { displayName: "Alex", joinedAt: 2 });
    fake.seed("pods/p1/members/b", { displayName: "alex ", joinedAt: 1 });
    fake.seed("pods/p1/members/c", { displayName: "Bo", joinedAt: 3 });
    const members = await loadPodMembers("p1");
    expect(members.map((m) => [m.uid, m.displayLabel, m.nameClash])).toEqual([
      ["b", "alex (1)", true],
      ["a", "Alex (2)", true],
      ["c", "Bo", false],
    ]);
  });

  it("renames everywhere only when no podmate already uses the name", async () => {
    fake.seed("pods/p1", { name: "Pod One", memberIds: ["u1", "u2"] });
    fake.seed("pods/p1/members/u1", { displayName: "Ann", role: "leader" });
    fake.seed("pods/p1/members/u2", { displayName: "BO", role: "member" });
    await expect(updateMyDisplayName("Bo")).rejects.toThrow(
      'Someone in "Pod One" already uses the name "Bo"',
    );
    expect(fb.updateProfile).not.toHaveBeenCalled();

    await updateMyDisplayName(" Cy ");
    expect(fb.auth.currentUser?.displayName).toBe("Cy");
    expect(fake.get("pods/p1/members/u1")).toEqual({ displayName: "Cy", role: "leader" });
  });
});

describe("activity", () => {
  it("writes an addressed bell entry and reports whether it landed", async () => {
    await expect(notify("invite", "Game night", "p1", "g1", ["u2"])).resolves.toBe(true);
    expect(fake.get("pods/p1/activity/auto-1")).toEqual({
      type: "invite",
      by: "u1",
      byName: "Ann",
      subject: "Game night",
      createdAt: NOW,
      ref: "g1",
      to: ["u2"],
    });
    fake.signOut();
    await expect(notify("invite", "x", "p1")).resolves.toBe(false);
  });

  it("watches the 30 newest entries and reports a failed listener as empty", () => {
    for (let i = 1; i <= 35; i++) fake.seed(`pods/p1/activity/a${i}`, { createdAt: i });
    const cb = vi.fn();
    watchActivity("p1", cb);
    const items = cb.mock.calls[0][0];
    expect(items).toHaveLength(30);
    expect(items[0]).toEqual({ id: "a35", podId: "p1", createdAt: 35 });
    fake.failSnapshots(new Error("denied"));
    watchActivity("p1", cb);
    expect(cb).toHaveBeenLastCalledWith([]);
  });
});

describe("table formations", () => {
  it("saves up to six seats under the escaped lineup name and maps them back by name", async () => {
    await saveTableFormation("p1", "Friday / Late", { seats: [1, 2, 3, 4, 5, 6, 7] });
    expect(fake.get("pods/p1/tableFormations/Friday%20%2F%20Late")).toEqual({
      name: "Friday / Late",
      seats: [1, 2, 3, 4, 5, 6],
      savedAt: NOW,
      savedBy: "Ann",
      updatedAt: SERVER_TIMESTAMP,
    });
    await expect(loadAllTableFormations("p1")).resolves.toEqual({
      "Friday / Late": { seats: [1, 2, 3, 4, 5, 6], savedAt: NOW, savedBy: "Ann" },
    });
    await expect(saveTableFormation("", "x", {})).rejects.toThrow("No pod selected");
  });
});

describe("trades", () => {
  const trade = {
    card: " Sol Ring ",
    key: "SOL RING",
    finish: "foil",
    paper: 1,
    qty: 2,
    buyYen: 500,
    buyDate: "2026-10-09",
    shop: "Hareruya",
    tag: "bogus",
    note: "",
    sells: [{ qty: 1, yen: 900, feePct: "10", shipYen: 0, packYen: 50, date: "2026-10-10" }],
    markYen: "",
  };

  it("validates and normalises a trade before saving it in the private ledger", async () => {
    await expect(saveTrade(trade)).resolves.toBe("auto-1");
    expect(fake.get("users/u1/trades/auto-1")).toEqual({
      card: "Sol Ring",
      key: "sol ring",
      finish: "foil",
      paper: true,
      qty: 2,
      buyYen: 500,
      buyExtraYen: 0,
      buyDate: "2026-10-09",
      shop: "Hareruya",
      tag: "",
      note: "",
      sells: [{ qty: 1, yen: 900, feePct: 10, shipYen: 0, packYen: 50, date: "2026-10-10" }],
      markYen: null,
      markDate: "",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(saveTrade({ ...trade, qty: 0 })).rejects.toThrow(
      "How many must be a whole number from 1 to 999.",
    );
  });

  it("lists the newest purchases first", async () => {
    fake.seed("users/u1/trades/a", { buyDate: "2026-01-01", createdAt: 1 });
    fake.seed("users/u1/trades/b", { buyDate: "2026-02-01", createdAt: 1 });
    fake.seed("users/u1/trades/c", { buyDate: "2026-01-01", createdAt: 5 });
    expect((await loadTrades()).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});

describe("chronicles", () => {
  it("logs an entry with capped lists and empty feedback", async () => {
    const id = await addChronicleEntry("p1", {
      date: "Fri",
      notes: "Close game",
      decks: [1, 2, 3, 4, 5, 6, 7],
      participants: ["u1"],
    });
    expect(fake.get(`pods/p1/chronicles/${id}`)).toEqual({
      date: "Fri",
      notes: "Close game",
      decks: [1, 2, 3, 4, 5, 6],
      createdAt: NOW,
      loggedBy: "Ann",
      gatheringId: null,
      gatheringTitle: null,
      participants: ["u1"],
      feedbackResponses: [],
    });
    await addChronicleFeedback("p1", id, { fun: 5, accuracy: 4, bestMoment: "Combo" });
    expect(fake.get(`pods/p1/chronicles/${id}`)?.feedbackResponses).toEqual([
      { uid: "u1", displayName: "Ann", fun: 5, accuracy: 4, bestMoment: "Combo", submittedAt: NOW },
    ]);
  });

  it("explains feedback for a deleted entry and keeps clear-all for leaders", async () => {
    await expect(addChronicleFeedback("p1", "gone", { fun: 1 })).rejects.toThrow(
      "This battle's Chronicle entry was deleted, so it can't be rated.",
    );
    fake.seed("pods/p1", { leaderId: "u2", coLeaderIds: [] });
    fake.seed("pods/p1/chronicles/c1", { createdAt: 1 });
    await expect(clearAllChronicles("p1")).rejects.toThrow(
      "Only the pod's leaders can clear all Chronicles.",
    );
    fake.seed("pods/p1", { leaderId: "u2", coLeaderIds: ["u1"] });
    await clearAllChronicles("p1");
    expect(fake.get("pods/p1/chronicles/c1")).toBeUndefined();
  });
});

describe("gatherings", () => {
  it("creates the seat map in one write and edits one seat field at a time", async () => {
    const id = await createGathering("p1", "  ", {
      status: "proposed",
      place: " Shop ",
      seats: {
        1: { uid: "u2", displayName: "Bo", rsvp: "invited" },
        2: { uid: "g1", displayName: "Guest", guest: true },
        7: { uid: "u9" },
      },
    });
    const empty = { uid: null, displayName: null, deck: null };
    expect(fake.get(`pods/p1/gatherings/${id}`)).toEqual({
      title: "Untitled Gathering",
      hostUid: "u1",
      status: "proposed",
      seats: {
        0: { uid: "u1", displayName: "Ann", deck: null, rsvp: "accepted" },
        1: { uid: "u2", displayName: "Bo", deck: null, rsvp: "invited" },
        2: { uid: "g1", displayName: "Guest", deck: null, rsvp: "accepted", guest: true },
        3: empty,
        4: empty,
        5: empty,
      },
      createdAt: NOW,
      updatedAt: SERVER_TIMESTAMP,
      place: "Shop",
    });

    await setSeatDeck("p1", id, 1, { list: "1 Sol Ring" } as never);
    expect(fake.writes.at(-1)).toEqual({
      op: "update",
      path: `pods/p1/gatherings/${id}`,
      data: { "seats.1.deck": { list: "1 Sol Ring" }, updatedAt: { __fake: "serverTimestamp" } },
    });
    expect(fake.get(`pods/p1/gatherings/${id}`)?.seats).toMatchObject({
      1: { uid: "u2", rsvp: "invited", deck: { list: "1 Sol Ring" } },
    });
  });

  it("finds open gatherings and delivers a missing gathering as null", async () => {
    fake.seed("pods/p1/gatherings/a", { status: "proposed" });
    fake.seed("pods/p1/gatherings/b", { status: "live" });
    fake.seed("pods/p1/gatherings/c", { status: "ended" });
    expect((await loadOpenGatherings("p1")).map((g) => g.id)).toEqual(["a", "b"]);
    const onData = vi.fn();
    watchGathering("p1", "missing", onData);
    expect(onData).toHaveBeenCalledWith(null, expect.objectContaining({ hasPendingWrites: false }));
  });
});

describe("impact list", () => {
  it("merges per-card changes into the pod's settings document", async () => {
    await setImpactChange("p1", "sol_ring", { card: "Sol Ring", action: "add" });
    await setImpactReason("p1", "sol_ring", "  Fast mana  ");
    expect(fake.get("pods/p1/settings/impactCards")).toEqual({
      changes: {
        sol_ring: {
          card: "Sol Ring",
          action: "add",
          reason: "Fast mana",
          by: "u1",
          byName: "Ann",
          at: NOW,
          reasonBy: "Ann",
          reasonAt: NOW,
        },
      },
      updatedAt: SERVER_TIMESTAMP,
    });
    await setImpactChange("p1", "sol_ring", null);
    expect(fake.get("pods/p1/settings/impactCards")?.changes).toEqual({});
    await expect(setImpactChange("p1", "Sol Ring", null)).rejects.toThrow(
      "That card name cannot be used as a list key.",
    );
  });

  it("records a nomination and notifies the other leaders", async () => {
    fake.seed("pods/p1", { leaderId: "u1", coLeaderIds: ["u2", "u3"] });
    await nominateImpact("p1", "sol_ring", { card: "Sol Ring", note: " fast " });
    await flush();
    expect(fake.get("pods/p1/impactNominations/sol_ring")).toEqual({
      card: "Sol Ring",
      note: "fast",
      by: "u1",
      byName: "Ann",
      at: NOW,
    });
    expect(writesTo("pods/p1/activity/").map((w) => w.data)).toEqual([
      expect.objectContaining({ type: "nomination", subject: "Sol Ring", to: ["u2", "u3"] }),
    ]);
  });
});
