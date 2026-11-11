// Sign-up / log-in / sign-out. Every function resolves to { ok: true, user } or { ok: false, error }
// -- never throws (except signOutUser) -- so calling code never needs a try/catch of its own.
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  yahooProvider,
} from "./firebase";
import { PM_LIMITS } from "./limits";
import { describeUser, type CloudUserSummary } from "./session";
import { clampText } from "./shared";
import { reportError } from "../report-error";

export type AuthResult =
  | { ok: true; user: CloudUserSummary | null; switchedToExisting?: true }
  | { ok: false; error: string };

// Plain-language versions of Firebase's error codes -- the people using this have no reason to
// know what "auth/weak-password" means.
export function friendlyAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null | undefined;
  const code = e && e.code;
  const map: Record<string, string> = {
    "auth/email-already-in-use":
      'That email already has an account. Try logging in instead, or use "Forgot password" below.',
    "auth/invalid-email": "That doesn\u2019t look like a valid email address.",
    "auth/weak-password": "Password needs to be at least 6 characters.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/too-many-requests": "Too many attempts -- please wait a moment and try again.",
    "auth/popup-closed-by-user": "Sign-in window was closed before finishing.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in window. Allow pop-ups for this page and try again.",
    "auth/account-exists-with-different-credential":
      "That email already has a PodMates account that uses a different sign-in method. Log in with your email and password (or Google) instead.",
    "auth/operation-not-allowed": "This sign-in method is not switched on yet.",
    "auth/network-request-failed": "Network error -- check your connection and try again.",
  };
  if (e && /missing initial state|sessionStorage/i.test(String(e.message || ""))) {
    return "Your browser blocked the sign-in window from finishing. Open PodMates directly in Safari or Chrome (not inside another app such as an email or chat app), turn off Private Browsing, and try again. If it still fails, log in with your email and password instead.";
  }
  return (code && map[code]) || (e && e.message) || "Something went wrong. Please try again.";
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName)
      await updateProfile(cred.user, {
        displayName: clampText(String(displayName).trim(), PM_LIMITS.displayName),
      });
    return { ok: true, user: describeUser(cred.user) };
  } catch (err) {
    if ((err as { code?: string }).code === "auth/email-already-in-use") {
      reportError(err, { operation: "authentication" });
      // That email already has an account -- fall back to logging into it instead of failing.
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { ok: true, user: describeUser(cred.user), switchedToExisting: true };
      } catch (loginErr) {
        reportError(loginErr, { operation: "authentication", userTriggered: true });
        return { ok: false, error: friendlyAuthError(loginErr) };
      }
    }
    reportError(err, { operation: "authentication", userTriggered: true });
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function logInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: describeUser(cred.user) };
  } catch (err) {
    reportError(err, { operation: "authentication", userTriggered: true });
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return { ok: true, user: describeUser(cred.user) };
  } catch (err) {
    reportError(err, { operation: "authentication", userTriggered: true });
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function signInWithYahoo(): Promise<AuthResult> {
  try {
    const cred = await signInWithPopup(auth, yahooProvider);
    return { ok: true, user: describeUser(cred.user) };
  } catch (err) {
    reportError(err, { operation: "authentication", userTriggered: true });
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function resetPassword(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (err) {
    reportError(err, { operation: "authentication", userTriggered: true });
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// The user simply becomes null again afterwards, a normal "not signed in" state.
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
