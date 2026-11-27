// Ending a Gathering tells its players that their battles are ready to rate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endGathering, surveyRecipients } from "./gatherings";
import { SURVEY_NOTICE_REF } from "./activity";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));
vi.mock("../report-error", () => ({ reportError: vi.fn() }));

const { fake } = fb;
const notices = async () => {
  await vi.waitFor(() => expect(fake.writes.some((w) => w.path.includes("/activity/"))).toBe(true));
  return fake.writes
    .filter((w) => w.path.startsWith("pods/p1/activity/"))
    .map((w) => w.data as { type: string; ref?: string; to?: string[]; subject: string });
};

beforeEach(() => {
  fake.reset();
  fake.signIn({ uid: "host", displayName: "Hana", email: "hana@example.com" });
  fake.seed("pods/p1/gatherings/g1", { title: "Friday Night", status: "live" });
});
afterEach(() => vi.restoreAllMocks());

describe("survey recipients", () => {
  it("lists this Gathering's players who still have a battle to rate, never the host or guests", () => {
    const entries = [
      {
        gatheringId: "g1",
        participants: ["host", "ann", null, "ben"],
        feedbackResponses: [{ uid: "ann" }],
      },
      { gatheringId: "g1", participants: ["ann", "cat"], feedbackResponses: [] },
      { gatheringId: "other", participants: ["dee"], feedbackResponses: [] },
      { gatheringId: "g1", participants: ["ben"], feedbackResponses: [{ uid: "ben" }] },
    ];
    expect(surveyRecipients(entries, "g1", "host").sort()).toEqual(["ann", "ben", "cat"]);
    expect(surveyRecipients([], "g1", "host")).toEqual([]);
  });
});

describe("ending a Gathering", () => {
  it("sends one addressed survey notice, stored as a gathering activity with the survey ref", async () => {
    fake.seed("pods/p1/chronicles/c1", {
      gatheringId: "g1",
      participants: ["host", "ann", "ben"],
      feedbackResponses: [],
    });
    await endGathering("p1", "g1");
    const [notice, ...rest] = await notices();
    expect(rest).toEqual([]);
    expect(notice).toMatchObject({
      type: "gathering",
      ref: SURVEY_NOTICE_REF,
      subject: "Friday Night",
    });
    expect(notice.to!.sort()).toEqual(["ann", "ben"]);
  });

  it("splits more than twelve players across notices (the rules' limit on to)", async () => {
    const players = Array.from({ length: 14 }, (_, i) => "p" + i);
    fake.seed("pods/p1/chronicles/c1", {
      gatheringId: "g1",
      participants: players,
      feedbackResponses: [],
    });
    await endGathering("p1", "g1");
    await vi.waitFor(async () => expect((await notices()).length).toBe(2));
    const sent = await notices();
    expect(sent.map((n) => n.to!.length)).toEqual([12, 2]);
  });

  it("sends nothing when no battle was logged", async () => {
    await endGathering("p1", "g1");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fake.writes.filter((w) => w.path.includes("/activity/"))).toEqual([]);
  });
});
