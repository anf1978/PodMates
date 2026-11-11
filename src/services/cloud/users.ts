// users/{uid}: the signed-in person's own document (pod ids for the sharing rule, profile links).
// Always a self-write, which the base users/{uid} rule allows.
import { db, doc, getDoc, setDoc } from "./firebase";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { requireText } from "./shared";
import { safeHttpUrl } from "../safe-url";
import type { UserDoc } from "./types";

export const userRef = (uid: string) => doc(db, "users", uid);

export async function loadUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

// Mirrors this user's own pod membership onto their user doc, purely so the deck-sharing security
// rule can check "do these two users share a pod" via a direct get() (rules can't run the
// array-contains query). Resyncing to the truth heals a stale entry from being removed by a leader.
export function setMyPodIds(uid: string, podIds: string[]): Promise<void> {
  return setDoc(userRef(uid), { podIds }, { merge: true });
}

// Reads this person's own user doc as it actually exists right now -- for checking from the
// console whether the podIds self-heal write has landed.
export async function getMyRawUserDoc(): Promise<UserDoc | null> {
  return loadUserDoc(requireUser().uid);
}

// Only real web addresses are stored (an empty value clears the link). Bare
// "archidekt.com/u/name" is saved as https://archidekt.com/u/name.
export async function updateMyProfileLinks(links: {
  archidektUrl?: string;
  moxfieldUrl?: string;
}): Promise<void> {
  const user = requireUser();
  const clean = (raw: string | undefined, label: string) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    const safe = safeHttpUrl(trimmed);
    if (!safe)
      throw new Error(
        `${label} link doesn't look like a web address. Use something like archidekt.com/u/yourname.`,
      );
    requireText(safe, PM_LIMITS.profileUrl, `${label} link`);
    return safe;
  };
  await setDoc(
    userRef(user.uid),
    {
      archidektProfileUrl: clean(links.archidektUrl, "Archidekt"),
      moxfieldProfileUrl: clean(links.moxfieldUrl, "Moxfield"),
    },
    { merge: true },
  );
}
