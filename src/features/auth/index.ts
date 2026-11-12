// Optional sign-in flow. Firebase access stays in cloud repositories.
import * as auth from "../../services/cloud/auth";
import { describeUser, getCurrentUser, onAuthChange } from "../../services/cloud/session";
import { emit, on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { showToast } from "../../ui/toast";
import { render } from "../../ui/html";
import { rememberedSignIn, validateCredentials, type AuthMode } from "./state";
import { authBarTemplate, authTemplate } from "./view";
import "./auth.css";

export interface AuthRuntime {
  open: () => HTMLElement;
  close: () => void;
  confirm: (message: string, label: string, action: () => Promise<void>) => void;
}

let runtime: AuthRuntime;
let mode: AuthMode = "signup";
let mounted = false;

export function configureAuth(value: AuthRuntime): void {
  runtime = value;
}

export function showAuthModal(): void {
  mode = "signup";
  draw(runtime.open());
}

function input(modal: HTMLElement, id: string): string {
  return modal.querySelector<HTMLInputElement>(`#${id}`)?.value || "";
}

function draw(modal: HTMLElement, error?: string | null, resetEmail?: string): void {
  const typed = input(modal, "authEmail");
  let remembered = rememberedSignIn(null);
  try {
    remembered = rememberedSignIn(localStorage.getItem("podmates_last_signin"));
  } catch {
    /* browser hint is optional */
  }
  const email = typed || (mode === "login" ? remembered.email : "");
  const signup = mode === "signup";
  // Match legacy redraw semantics, including clearing passwords and restoring dialog focus.
  render(null, modal);
  render(
    authTemplate({
      mode,
      email,
      remembered,
      error,
      resetEmail,
      close: runtime.close,
      toggle: (event) => {
        event.preventDefault();
        const email = input(modal, "authEmail");
        mode = signup ? "login" : "signup";
        draw(modal);
        const field = modal.querySelector<HTMLInputElement>("#authEmail");
        if (field && email) field.value = email;
      },
      forgot: async (event) => {
        event.preventDefault();
        const email = input(modal, "authEmail").trim();
        if (!email) {
          draw(modal, 'Enter your email above first, then click "Forgot password?" again.');
          return;
        }
        const result = await auth.resetPassword(email);
        if (modal.isConnected)
          draw(modal, result.ok ? null : result.error, result.ok ? email : undefined);
      },
      submit: async () => {
        const email = input(modal, "authEmail").trim();
        const password = input(modal, "authPassword");
        const name = signup ? input(modal, "authDisplayName").trim() : "";
        const error = validateCredentials(mode, email, password, name);
        if (error) {
          draw(modal, error);
          return;
        }
        busy(modal, "authSubmitBtn", "One moment…");
        const result = signup
          ? await auth.signUpWithEmail(email, password, name)
          : await auth.logInWithEmail(email, password);
        finish(modal, result, signup && !("switchedToExisting" in result));
      },
      google: () => provider(modal, "Google"),
      yahoo: () => provider(modal, "Yahoo"),
    }),
    modal,
  );
}

function busy(modal: HTMLElement, id: string, message: string): void {
  const button = modal.querySelector<HTMLButtonElement>(`#${id}`);
  if (button) {
    button.disabled = true;
    button.textContent = message;
  }
}

async function provider(modal: HTMLElement, name: "Google" | "Yahoo"): Promise<void> {
  busy(modal, `auth${name}Btn`, `Opening ${name} sign-in…`);
  const result = await (name === "Google" ? auth.signInWithGoogle() : auth.signInWithYahoo());
  finish(modal, result, true);
}

function finish(modal: HTMLElement, result: auth.AuthResult, welcome: boolean): void {
  if (!modal.isConnected) return;
  if (!result.ok) {
    draw(modal, result.error);
    return;
  }
  runtime.close();
  const name = result.user?.displayName || result.user?.email;
  showToast(
    result.switchedToExisting
      ? `Welcome back, ${name} — you already had an account, so we logged you in instead of creating a new one.`
      : `Signed in as ${name}.`,
  );
  if (welcome) emit("profile:open", { welcome: true });
}

export function requireAccountToSave(what?: string): boolean {
  if (getCurrentUser()) return true;
  showToast(
    `Sign up or log in to save ${what || "your progress"} — using PodMates to chart decks stays free either way.`,
  );
  showAuthModal();
  return false;
}

export function updateAuthBar(user = describeUser(getCurrentUser())): void {
  const real = Boolean(user && !user.isAnonymous);
  const text = document.getElementById("authStatusText");
  if (text)
    text.textContent =
      real && user ? `Signed in as ${user.displayName || user.email}` : "Playing as guest";
  for (const [id, visible] of [
    ["authOpenBtn", !real],
    ["authProfileBtn", real],
    ["authSignOutBtn", real],
  ] as const) {
    document.getElementById(id)?.classList.toggle("auth-hidden", !visible);
  }
}

export function mount(): void {
  if (mounted) return;
  mounted = true;
  on("auth:open", showAuthModal);
  const bar = document.getElementById("authBar");
  if (bar) render(authBarTemplate(), bar);
  document.getElementById("authOpenBtn")?.addEventListener("click", showAuthModal);
  document
    .getElementById("authProfileBtn")
    ?.addEventListener("click", () => emit("profile:open", {}));
  document.getElementById("authSignOutBtn")?.addEventListener("click", () => {
    runtime.confirm(
      "Sign out? You’ll keep using PodMates as a guest, and anything already saved to the cloud stays there for next time you sign in.",
      "Sign Out",
      async () => {
        try {
          await auth.signOutUser();
          showToast("Signed out.");
        } catch (error) {
          reportError(error, { operation: "cloud", userTriggered: true });
          showToast(
            `Sign out didn’t fully complete: ${error instanceof Error ? error.message : String(error)} -- try again if anything looks off.`,
          );
        }
      },
    );
  });
  onAuthChange((user) => {
    updateAuthBar(user);
    try {
      if (user && !user.isAnonymous && user.email)
        localStorage.setItem(
          "podmates_last_signin",
          JSON.stringify({ email: user.email, providers: user.providers || [] }),
        );
    } catch {
      /* browser hint is optional */
    }
  });
}
