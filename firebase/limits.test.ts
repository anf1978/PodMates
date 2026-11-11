import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { beforeEach, describe, expect, test } from "vitest";
import { PM_LIMITS } from "../src/services/cloud/limits";
import { db, environment, pod, remove, seed } from "./setup";

type Field = [name: string, maximum: number, client?: keyof typeof PM_LIMITS];
type Guard = {
  path: string;
  data: Record<string, unknown>;
  strings?: Field[];
  lists?: Field[];
  maps?: Field[];
};

const guards: Guard[] = [
  {
    path: "users/alice",
    data: {},
    strings: [
      ["displayName", 80, "displayName"],
      ["archidektProfileUrl", 300, "profileUrl"],
      ["moxfieldProfileUrl", 300, "profileUrl"],
    ],
    lists: [["podIds", 40, "maxPodsPerUser"]],
  },
  {
    path: "users/alice/decks/new",
    data: {},
    strings: [
      ["list", 40000, "deckListChars"],
      ["deckName", 300, "deckName"],
      ["commander", 200, "commanderName"],
      ["player", 80, "playerName"],
      ["key", 400, "deckKey"],
    ],
  },
  {
    path: "users/alice/trades/new",
    data: {},
    strings: [
      ["card", 200, "tradeCard"],
      ["shop", 100, "tradeShop"],
      ["note", 400, "tradeNote"],
    ],
    lists: [["sells", 40, "tradeSells"]],
  },
  {
    path: "users/alice/spoilerVotes/new",
    data: { vote: "like" },
    strings: [
      ["key", 120],
      ["n", 200],
      ["setName", 100],
    ],
  },
  {
    path: "users/alice/linkedDecks/new",
    data: {},
    strings: [
      ["decklistText", 40000, "deckListChars"],
      ["name", 300, "deckName"],
      ["commander", 200, "commanderName"],
      ["url", 500, "deckLinkUrl"],
    ],
  },
  {
    path: "pods/new",
    data: pod,
    strings: [["name", 120, "podName"]],
    lists: [["memberIds", 40, "maxPodMembers"]],
  },
  {
    path: "pods/pod/members/new",
    data: {},
    strings: [["displayName", 80, "displayName"]],
  },
  {
    path: "pods/pod/tableFormations/new",
    data: {},
    strings: [["name", 120, "formationName"]],
    lists: [["seats", 12]],
  },
  {
    path: "pods/pod/chronicles/new",
    data: {},
    strings: [
      ["notes", 1000, "notes"],
      ["gatheringTitle", 160, "gatheringTitle"],
    ],
    lists: [
      ["decks", 12, "chronicleDecks"],
      ["participants", 24, "chronicleParticipants"],
      ["feedbackResponses", 48, "feedbackResponses"],
    ],
  },
  {
    path: "pods/pod/settings/impactCards",
    data: {},
    maps: [["changes", 70, "impactChanges"]],
  },
  {
    path: "pods/pod/impactNominations/new",
    data: { by: "alice", card: "Sol Ring" },
    strings: [
      ["card", 200],
      ["note", 400],
      ["byName", 80],
    ],
  },
  {
    path: "pods/pod/activity/new",
    data: { by: "alice", type: "deck" },
    strings: [
      ["subject", 160],
      ["byName", 80],
      ["ref", 80],
    ],
    lists: [["to", 12]],
  },
  {
    path: "pods/pod/gatherings/new",
    data: {},
    strings: [["title", 160, "gatheringTitle"]],
  },
];

const fields = guards.flatMap(({ path, data, strings = [], lists = [], maps = [] }) =>
  [
    ...strings.map((field) => ({ field, kind: "string" as const })),
    ...lists.map((field) => ({ field, kind: "list" as const })),
    ...maps.map((field) => ({ field, kind: "map" as const })),
  ].map(({ field: [field, maximum, client], kind }) => ({
    path,
    data,
    field,
    maximum,
    client,
    kind,
  })),
);

function value(kind: "string" | "list" | "map", size: number) {
  if (kind === "string") return "x".repeat(size);
  if (kind === "list") return Array.from({ length: size }, () => "alice");
  return Object.fromEntries(Array.from({ length: size }, (_, i) => [`card${i}`, true]));
}

describe("every server field guard", () => {
  test.each(fields)(
    "$path / $field create boundary, type and optional branches",
    async ({ path, data, field, maximum, kind }) => {
      const ref = doc(db("alice"), path);
      const required = path.includes("/impactNominations/") && field === "card";
      for (const [input, allowed] of [
        [value(kind, maximum + 1), false],
        [42, false],
        [value(kind, maximum), true],
        [null, !required && kind !== "map"],
      ] as const) {
        await remove(path);
        const operation = setDoc(ref, { ...data, [field]: input });
        await (allowed ? assertSucceeds(operation) : assertFails(operation));
      }
      if (!required) {
        await remove(path);
        await assertSucceeds(setDoc(ref, data));
      }
    },
  );

  test.each(fields.filter(({ path }) => !path.includes("/activity/")))(
    "$path / $field update boundary and type",
    async ({ path, data, field, maximum, kind }) => {
      await seed(path, data);
      const ref = doc(db("alice"), path);
      await assertFails(updateDoc(ref, { [field]: value(kind, maximum + 1) }));
      await assertFails(updateDoc(ref, { [field]: 42 }));
      await assertSucceeds(updateDoc(ref, { [field]: value(kind, maximum) }));
    },
  );

  test("chronicle notesEditedBy is guarded only on update", async () => {
    const ref = doc(db("alice"), "pods/pod/chronicles/game");
    await assertFails(updateDoc(ref, { notesEditedBy: "x".repeat(81) }));
    await assertFails(updateDoc(ref, { notesEditedBy: 42 }));
    await assertSucceeds(updateDoc(ref, { notesEditedBy: "x".repeat(80) }));
    await assertSucceeds(updateDoc(ref, { notesEditedBy: null }));
  });

  test.each(["like", "pass"])(
    "vote accepts %s; rejects invalid and missing votes",
    async (vote) => {
      const ref = doc(db("alice"), "users/alice/spoilerVotes/new");
      await assertSucceeds(setDoc(ref, { vote }));
      await assertFails(updateDoc(ref, { vote: "other" }));
      await assertFails(setDoc(ref, {}));
      await assertFails(setDoc(ref, { vote: null }));
    },
  );
});

describe("SECURITY: server limits do not match PM_LIMITS", () => {
  // SECURITY: every mapped server ceiling is looser than its browser counterpart.
  test.fails.each(fields.filter(({ client }) => client !== undefined))(
    "$path / $field rejects PM_LIMITS $client + 1",
    async ({ path, data, field, client, kind }) => {
      if (!client) throw new Error("Missing PM_LIMITS mapping");
      await seed(path, data);
      const target = path.includes("/activity/") ? `${path}-client` : path;
      await assertFails(
        setDoc(doc(db("alice"), target), { ...data, [field]: value(kind, PM_LIMITS[client] + 1) }),
      );
    },
  );

  // SECURITY: notesEditedBy has the same display-name mismatch, and no create guard.
  test.fails("chronicle notesEditedBy rejects PM_LIMITS.displayName + 1 on update", async () => {
    await assertFails(
      updateDoc(doc(db("alice"), "pods/pod/chronicles/game"), {
        notesEditedBy: "x".repeat(PM_LIMITS.displayName + 1),
      }),
    );
  });

  test.fails("chronicle creation enforces notesEditedBy server ceiling", async () => {
    await assertFails(
      setDoc(doc(db("alice"), "pods/pod/chronicles/new"), { notesEditedBy: "x".repeat(81) }),
    );
  });

  // SECURITY: these persisted client limits have no matching field/nested-value rule.
  test.fails.each([
    { path: "users/alice/decks/new", data: { list: "x\n".repeat(PM_LIMITS.deckListLines + 1) } },
    { path: "users/alice/trades/new", data: { key: "x".repeat(PM_LIMITS.tradeCard + 1) } },
    { path: "users/alice/trades/new", data: { qty: PM_LIMITS.tradeQtyMax + 1 } },
    { path: "users/alice/trades/new", data: { buyYen: PM_LIMITS.tradeYenMax + 1 } },
    {
      path: "pods/pod/chronicles/new",
      data: { feedbackResponses: [{ bestMoment: "x".repeat(PM_LIMITS.bestMoment + 1) }] },
    },
    {
      path: "pods/pod/settings/impactCards",
      data: {
        changes: {
          card: { reason: "x".repeat(PM_LIMITS.impactReason + 1) },
        },
      },
    },
    {
      path: "pods/pod/settings/impactCards",
      data: {
        changes: Object.fromEntries(
          Array.from({ length: PM_LIMITS.impactAdds + 1 }, (_, i) => [
            `card${i}`,
            { action: "add" },
          ]),
        ),
      },
    },
  ])("$path rejects unguarded client limit %#", async ({ path, data }) => {
    await assertFails(setDoc(doc(db("alice"), path), data));
  });
});

describe("SECURITY: document-count ceilings exist only in the client", () => {
  const counts = [
    ["users/alice/decks", PM_LIMITS.maxSavedDecks],
    ["users/alice/linkedDecks", PM_LIMITS.maxLinkedDecks],
    ["users/alice/trades", PM_LIMITS.maxTrades],
    ["pods/pod/tableFormations", PM_LIMITS.maxFormationsPerPod],
    ["pods/pod/chronicles", PM_LIMITS.maxChroniclesPerPod],
  ] as const;
  describe.each(counts)("%s ceiling %i", (path, maximum) => {
    beforeEach(async () => {
      await environment.withSecurityRulesDisabled(async (context) => {
        const store = context.firestore();
        const existing = (await getDocs(collection(store, path))).size;
        for (let start = existing; start < maximum; start += 400) {
          const batch = writeBatch(store);
          for (let i = start; i < Math.min(start + 400, maximum); i++) {
            batch.set(doc(store, `${path}/seed${i}`), {});
          }
          await batch.commit();
        }
        expect((await getDocs(collection(store, path))).size).toBe(maximum);
      });
    });
    // SECURITY: no rule checks collection counts. Setup failures are outside test.fails.
    test.fails("rejects one additional record", async () => {
      await assertFails(setDoc(doc(db("alice"), `${path}/overflow`), {}));
    });
  });
});
