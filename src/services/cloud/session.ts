// Signed-in state shared by every repository. PodMates' policy: saving anything requires a real
// account, so there is no automatic anonymous sign-in on load. A visitor who hasn't signed up has
// no Firebase user at all; the current user stays null until they do.
import { auth, onAuthStateChanged, type User } from "./firebase";

export interface CloudUserSummary {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  providers: string[];
}

let currentUser: User | null = null;
let isReady = false;
const readyCallbacks: Array<() => void> = [];
const authChangeCallbacks: Array<(user: CloudUserSummary | null) => void> = [];

export function describeUser(user: User | null): CloudUserSummary | null {
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.email || null,
    displayName: user.displayName || null,
    providers: (user.providerData || []).map((p) => p.providerId).filter(Boolean),
  };
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!isReady) {
    // Firebase confirming "nobody is signed in" is itself a definitive ready signal, so a null
    // user must set isReady too, or it would never fire for anyone who hasn't signed up.
    isReady = true;
    readyCallbacks.splice(0).forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }
  authChangeCallbacks.forEach((cb) => {
    try {
      cb(describeUser(user));
    } catch (e) {
      console.error(e);
    }
  });
});

export function getCurrentUser(): User | null {
  return currentUser;
}

export function requireUser(): User {
  if (!currentUser) throw new Error("Not signed in yet");
  return currentUser;
}

export function isCloudReady(): boolean {
  return isReady;
}

export function onReady(cb: () => void): void {
  if (isReady) cb();
  else readyCallbacks.push(cb);
}

// Fires immediately with the current state, then again on every future sign-in/sign-out/link.
export function onAuthChange(cb: (user: CloudUserSummary | null) => void): void {
  authChangeCallbacks.push(cb);
  if (currentUser !== null || isReady) cb(describeUser(currentUser));
}
