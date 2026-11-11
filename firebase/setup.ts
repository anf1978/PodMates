import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

export let environment: RulesTestEnvironment;

export const members = ["alice", "bob", "carol", "dave"];
export const pod = {
  leaderId: "alice",
  coLeaderIds: ["bob"],
  memberIds: members,
  name: "Test pod",
};
export const cases = [
  { path: "users/alice", data: { displayName: "Alice", podIds: ["pod"] } },
  { path: "users/alice/decks/deck", data: { deckName: "Deck", list: "1 Sol Ring", secret: false } },
  { path: "users/alice/linkedDecks/link", data: { name: "Mirror", decklistText: "1 Sol Ring" } },
  { path: "users/alice/trades/trade", data: { card: "Sol Ring" } },
  { path: "users/alice/spoilerVotes/card", data: { vote: "like", key: "card" } },
  { path: "pods/pod", data: pod },
  { path: "pods/pod/members/alice", data: { displayName: "Alice" } },
  { path: "pods/pod/tableFormations/table", data: { name: "Table", seats: [] } },
  { path: "pods/pod/chronicles/game", data: { notes: "Game", participants: ["carol"] } },
  { path: "pods/pod/settings/impactCards", data: { changes: {} } },
  { path: "pods/pod/impactNominations/card", data: { by: "carol", card: "Sol Ring" } },
  { path: "pods/pod/activity/event", data: { by: "carol", type: "deck" } },
  { path: "pods/pod/gatherings/night", data: { title: "Game night" } },
] as const;

export function db(uid: string | null, anonymous = false) {
  return uid === null
    ? environment.unauthenticatedContext().firestore()
    : environment
        .authenticatedContext(uid, {
          firebase: { sign_in_provider: anonymous ? "anonymous" : "password", identities: {} },
        })
        .firestore();
}

export async function seed(path: string, data: object): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

export async function remove(path: string): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), path));
  });
}

beforeAll(async () => {
  // Refuse to run against any other database, including a real Firebase project.
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8184") {
    throw new Error("Run npm run test:rules to start the isolated Firestore emulator on 8184.");
  }
  environment = await initializeTestEnvironment({
    projectId: "demo-podmates-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8184,
      rules: await readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const store = context.firestore();
    await Promise.all([
      ...cases.map(({ path, data }) => setDoc(doc(store, path), data)),
      ...["bob", "carol", "dave", "eve", "mallory"].map((uid) =>
        setDoc(doc(store, `users/${uid}`), { podIds: members.includes(uid) ? ["pod"] : [] }),
      ),
      setDoc(doc(store, "users/alice/decks/secret"), { secret: true, deckName: "Hidden" }),
    ]);
  });
});

afterAll(async () => {
  if (environment) await environment.cleanup();
});
