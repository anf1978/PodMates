import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { describe, test } from "vitest";
import { cases, db, pod, remove, seed } from "./setup";

describe("signed-out access", () => {
  test.each(cases)("$path denies all operations", async ({ path, data }) => {
    const ref = doc(db(null), path);
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, { denied: true }));
    await assertFails(deleteDoc(ref));
    await seed(path, data);
    // A new document exercises create rather than update.
    const parent = path.split("/").slice(0, -1).join("/");
    await assertFails(getDocs(collection(db(null), parent)));
    await assertFails(setDoc(doc(db(null), `${parent}/new`), data));
  });
});

describe("user ownership", () => {
  test.each(cases.filter(({ path }) => path.startsWith("users/")))(
    "$path owner CRUD; outsiders cannot read or write",
    async ({ path, data }) => {
      const owner = doc(db("alice"), path);
      await assertSucceeds(getDoc(owner));
      await assertSucceeds(updateDoc(owner, { updated: true }));
      await assertSucceeds(deleteDoc(owner));
      await assertSucceeds(setDoc(owner, data));
      const outsider = doc(db("mallory"), path);
      await assertFails(getDoc(outsider));
      await assertFails(updateDoc(outsider, { updated: true }));
      await assertFails(deleteDoc(outsider));
      await assertSucceeds(deleteDoc(owner));
      await assertFails(setDoc(outsider, data));
    },
  );

  test("owners can list each own subcollection, but not another user's private data", async () => {
    for (const name of ["decks", "linkedDecks", "trades", "spoilerVotes"]) {
      await assertSucceeds(getDocs(collection(db("alice"), `users/alice/${name}`)));
    }
    for (const name of ["linkedDecks", "trades"]) {
      await assertFails(
        getDoc(doc(db("bob"), `users/alice/${name}/${name === "trades" ? "trade" : "link"}`)),
      );
      await assertFails(getDocs(collection(db("bob"), `users/alice/${name}`)));
    }
    await assertFails(getDoc(doc(db("bob"), "users/alice")));
  });

  test("podmates read votes and non-secret mirrored decks, never write them", async () => {
    for (const path of ["users/alice/spoilerVotes/card", "users/alice/decks/deck"]) {
      const ref = doc(db("bob"), path);
      await assertSucceeds(getDoc(ref));
      await assertFails(updateDoc(ref, { updated: true }));
      await assertFails(deleteDoc(ref));
    }
    await assertSucceeds(getDocs(collection(db("bob"), "users/alice/spoilerVotes")));
    await assertSucceeds(
      getDocs(query(collection(db("bob"), "users/alice/decks"), where("secret", "==", false))),
    );
    await assertFails(getDocs(collection(db("bob"), "users/alice/decks")));
    await assertFails(getDoc(doc(db("bob"), "users/alice/decks/secret")));
    await assertSucceeds(getDoc(doc(db("alice"), "users/alice/decks/secret")));
  });

  test("missing or disjoint podIds do not grant sharing", async () => {
    for (const podIds of [[], ["other"]]) {
      await seed("users/bob", { podIds });
      await assertFails(getDoc(doc(db("bob"), "users/alice/decks/deck")));
      await assertFails(getDoc(doc(db("bob"), "users/alice/spoilerVotes/card")));
    }
    await seed("users/bob", {});
    await assertFails(getDoc(doc(db("bob"), "users/alice/decks/deck")));
  });
});

describe("pods and members", () => {
  test("pod creation needs its own leader; only leader deletes", async () => {
    await assertSucceeds(setDoc(doc(db("alice"), "pods/new"), pod));
    await assertFails(setDoc(doc(db("mallory"), "pods/forged"), pod));
    for (const uid of ["bob", "carol", "mallory"]) {
      await assertFails(deleteDoc(doc(db(uid), "pods/pod")));
    }
    await assertSucceeds(deleteDoc(doc(db("alice"), "pods/pod")));
  });

  test.each(["alice", "bob", "carol"])(
    "%s updates pod as leader, co-leader or member",
    async (uid) => {
      await assertSucceeds(updateDoc(doc(db(uid), "pods/pod"), { name: "Updated" }));
      await assertSucceeds(getDoc(doc(db(uid), "pods/pod")));
    },
  );

  test("outsider cannot update without adding themselves", async () => {
    await assertFails(updateDoc(doc(db("mallory"), "pods/pod"), { name: "Denied" }));
  });

  test("existing member can remove themselves using the current-member branch", async () => {
    await assertSucceeds(
      updateDoc(doc(db("carol"), "pods/pod"), {
        memberIds: pod.memberIds.filter((uid) => uid !== "carol"),
      }),
    );
  });

  test.each(["alice", "bob", "carol"])(
    "%s manages member via leader, co-leader or self",
    async (uid) => {
      const ref = doc(db(uid), "pods/pod/members/carol");
      await assertSucceeds(setDoc(ref, { displayName: "Carol" }));
      await assertSucceeds(updateDoc(ref, { displayName: "C" }));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(deleteDoc(ref));
      await assertSucceeds(setDoc(ref, { displayName: "Carol" }));
    },
  );

  test("ordinary members and outsiders cannot manage someone else's member record", async () => {
    for (const uid of ["carol", "mallory"]) {
      const ref = doc(db(uid), "pods/pod/members/alice");
      await assertFails(updateDoc(ref, { displayName: "Denied" }));
      await assertFails(deleteDoc(ref));
      await assertFails(setDoc(doc(db(uid), "pods/pod/members/dave"), { displayName: "Denied" }));
    }
  });
});

describe("member-gated collections", () => {
  const paths = cases.filter(
    ({ path }) => path.startsWith("pods/pod/") && !path.includes("/members/"),
  );
  test.each(paths)(
    "$path members read/list; outsiders cannot read or create",
    async ({ path, data }) => {
      await assertSucceeds(getDoc(doc(db("carol"), path)));
      const parent = path.split("/").slice(0, -1).join("/");
      await assertSucceeds(getDocs(collection(db("carol"), parent)));
      await assertFails(getDoc(doc(db("mallory"), path)));
      await assertFails(getDocs(collection(db("mallory"), parent)));
      await assertFails(setDoc(doc(db("mallory"), `${parent}/new`), data));
      await assertFails(updateDoc(doc(db("mallory"), path), { updated: true }));
      await assertFails(deleteDoc(doc(db("mallory"), path)));
    },
  );

  test.each(["tableFormations", "gatherings"])("%s allows member CRUD", async (name) => {
    const ref = doc(db("carol"), `pods/pod/${name}/new`);
    await assertSucceeds(setDoc(ref, { name: "Table", title: "Night" }));
    await assertSucceeds(updateDoc(ref, { updated: true }));
    await assertSucceeds(deleteDoc(ref));
  });
});

describe("chronicle management", () => {
  test("any member creates; a nonparticipant cannot edit or delete", async () => {
    await assertSucceeds(
      setDoc(doc(db("dave"), "pods/pod/chronicles/new"), { participants: ["carol"] }),
    );
    await assertFails(updateDoc(doc(db("dave"), "pods/pod/chronicles/game"), { notes: "Denied" }));
    await assertFails(deleteDoc(doc(db("dave"), "pods/pod/chronicles/game")));
  });

  test.each(["alice", "bob", "carol"])(
    "%s manages as leader, co-leader or participant",
    async (uid) => {
      const ref = doc(db(uid), "pods/pod/chronicles/game");
      await assertSucceeds(updateDoc(ref, { notes: "Updated" }));
      await assertSucceeds(deleteDoc(ref));
    },
  );

  test.each([{}, { participants: [] }])(
    "any member manages legacy/empty participants %j",
    async (data) => {
      await seed("pods/pod/chronicles/game", data);
      const ref = doc(db("dave"), "pods/pod/chronicles/game");
      await assertSucceeds(updateDoc(ref, { notes: "Updated" }));
      await assertSucceeds(deleteDoc(ref));
    },
  );

  test("participant or leader no longer in memberIds cannot manage", async () => {
    await seed("pods/pod", { ...pod, memberIds: ["dave"] });
    for (const uid of ["alice", "bob", "carol"]) {
      await assertFails(updateDoc(doc(db(uid), "pods/pod/chronicles/game"), { notes: "Denied" }));
      await assertFails(deleteDoc(doc(db(uid), "pods/pod/chronicles/game")));
    }
  });
});

describe("impact settings", () => {
  test.each(["alice", "bob"])("%s writes impactCards but not arbitrary settings", async (uid) => {
    const ref = doc(db(uid), "pods/pod/settings/impactCards");
    await assertSucceeds(updateDoc(ref, { changes: { card: true } }));
    await assertSucceeds(setDoc(ref, {}));
    await assertFails(setDoc(doc(db(uid), "pods/pod/settings/other"), { changes: {} }));
  });

  test("only leader deletes settings; members cannot create or update", async () => {
    for (const uid of ["bob", "carol"]) {
      await assertFails(deleteDoc(doc(db(uid), "pods/pod/settings/impactCards")));
    }
    await assertFails(setDoc(doc(db("carol"), "pods/pod/settings/impactCards"), { changes: {} }));
    await assertFails(
      updateDoc(doc(db("carol"), "pods/pod/settings/impactCards"), { changes: {} }),
    );
    await assertSucceeds(deleteDoc(doc(db("alice"), "pods/pod/settings/impactCards")));
    await assertSucceeds(
      setDoc(doc(db("alice"), "pods/pod/settings/impactCards"), { changes: {} }),
    );
    await seed("pods/pod/settings/other", {});
    await assertSucceeds(deleteDoc(doc(db("alice"), "pods/pod/settings/other")));
  });
});

describe("nominations and activity", () => {
  test("nomination needs a member author, string card and unchanged author on update", async () => {
    const ref = doc(db("carol"), "pods/pod/impactNominations/new");
    await assertFails(setDoc(ref, { by: "dave", card: "Sol Ring" }));
    await assertFails(setDoc(ref, { by: "carol" }));
    await assertFails(setDoc(ref, { by: "carol", card: 42 }));
    await assertSucceeds(setDoc(ref, { by: "carol", card: "Sol Ring" }));
    await assertSucceeds(updateDoc(ref, { note: "Updated" }));
    await assertFails(updateDoc(ref, { by: "dave" }));
    await assertFails(
      updateDoc(doc(db("dave"), "pods/pod/impactNominations/new"), { note: "Denied" }),
    );
  });

  test.each(["impactNominations/card", "activity/event"])(
    "%s author/leader/co-leader deletes",
    async (suffix) => {
      const path = `pods/pod/${suffix}`;
      const data = suffix.startsWith("activity")
        ? { by: "carol", type: "deck" }
        : { by: "carol", card: "Sol Ring" };
      for (const uid of ["carol", "alice", "bob"]) {
        await seed(path, data);
        await assertSucceeds(deleteDoc(doc(db(uid), path)));
      }
      await seed(path, data);
      await assertFails(deleteDoc(doc(db("dave"), path)));
    },
  );

  test.each(["deck", "gathering", "live", "nomination", "joined", "invite", "rsvp", "cancelled"])(
    "activity accepts %s, never updates",
    async (type) => {
      const ref = doc(db("carol"), "pods/pod/activity/new");
      await assertSucceeds(setDoc(ref, { by: "carol", type }));
      for (const uid of ["alice", "bob", "carol"]) {
        await assertFails(updateDoc(doc(db(uid), ref.path), { subject: "Denied" }));
      }
    },
  );

  test("activity rejects forged author and unsupported or missing type", async () => {
    const ref = doc(db("carol"), "pods/pod/activity/new");
    for (const data of [
      { by: "dave", type: "deck" },
      { by: "carol", type: "other" },
      { by: "carol" },
    ]) {
      await assertFails(setDoc(ref, data));
    }
  });
});

describe("default deny", () => {
  test.each([
    "other/doc",
    "users/alice/unknown/doc",
    "pods/pod/unknown/doc",
    "users/alice/decks/deck/nested/doc",
  ])("%s has no implicit recursive access", async (path) => {
    await seed(path, {});
    const ref = doc(db("alice"), path);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, {}));
    await assertFails(deleteDoc(ref));
  });
});

describe("SECURITY: unchanged-rule gaps requiring human decisions", () => {
  // SECURITY: pod and member reads check only authentication, not membership.
  test.fails.each(["pods/pod", "pods/pod/members/alice"])(
    "outsider cannot read %s",
    async (path) => {
      await assertFails(getDoc(doc(db("mallory"), path)));
    },
  );

  // SECURITY: self-asserted user podIds suffice to read another user's non-secret decks/votes.
  test.fails.each(["users/alice/decks/deck", "users/alice/spoilerVotes/card"])(
    "forged shared podIds cannot expose %s",
    async (path) => {
      await assertSucceeds(updateDoc(doc(db("mallory"), "users/mallory"), { podIds: ["pod"] }));
      await assertFails(getDoc(doc(db("mallory"), path)));
    },
  );

  // SECURITY: an outsider can add themselves through request.resource.data.memberIds.
  test.fails("outsider cannot self-join by rewriting the pod", async () => {
    await assertFails(
      updateDoc(doc(db("mallory"), "pods/pod"), { memberIds: [...pod.memberIds, "mallory"] }),
    );
  });

  // SECURITY: members can rewrite authority fields, not just ordinary pod metadata.
  test.fails("ordinary member cannot take leadership", async () => {
    await assertFails(
      updateDoc(doc(db("carol"), "pods/pod"), { leaderId: "carol", coLeaderIds: [] }),
    );
  });

  // SECURITY: member record self-writes do not require pod membership.
  test.fails("outsider cannot create their own member record", async () => {
    await assertFails(
      setDoc(doc(db("mallory"), "pods/pod/members/mallory"), { displayName: "Outsider" }),
    );
  });

  // SECURITY: nomination update checks author ownership but not current membership.
  test.fails("removed nomination author cannot update", async () => {
    await seed("pods/pod/impactNominations/card", { by: "eve", card: "Sol Ring" });
    await assertFails(
      updateDoc(doc(db("eve"), "pods/pod/impactNominations/card"), { note: "Changed" }),
    );
  });

  // SECURITY: request.auth != null also includes Firebase anonymous accounts.
  test.fails.each(cases)(
    "anonymous account cannot write account-only $path",
    async ({ path, data }) => {
      const authorData =
        path.includes("/impactNominations/") || path.includes("/activity/")
          ? { ...data, by: "alice" }
          : data;
      await remove(path);
      await assertFails(setDoc(doc(db("alice", true), path), authorData));
    },
  );
});
