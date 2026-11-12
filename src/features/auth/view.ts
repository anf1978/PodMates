// Escaped account templates; actions are supplied by the account controller.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { AuthMode, RememberedSignIn } from "./state";

export function authBarTemplate(): TemplateResult {
  return html`
    <span id="authStatusText"></span>
    <button id="authOpenBtn" class="ghost auth-hidden">Sign In</button>
    <button id="authProfileBtn" class="ghost auth-hidden">My Profile</button>
    <button id="authSignOutBtn" class="ghost auth-hidden">Sign Out</button>
  `;
}

export interface AuthView {
  mode: AuthMode;
  email: string;
  remembered: RememberedSignIn;
  error?: string | null;
  resetEmail?: string;
  close: () => void;
  toggle: (event: Event) => void;
  submit: () => void;
  forgot: (event: Event) => void;
  google: () => void;
  yahoo: () => void;
}

export function authTemplate(view: AuthView): TemplateResult {
  const signup = view.mode === "signup";
  return html`
    <button class="tad-close" id="tadCloseBtn" @click=${view.close}>Close ×</button>
    <h2 class="auth-title">${signup ? "Create an Account" : "Log In"}</h2>
    <p class="auth-intro">
      ${
        signup
          ? "Optional — save decks across devices and pods. You can keep using PodMates as a guest without this."
          : "Welcome back."
      }
    </p>
    ${view.error ? html`<div class="status err auth-error">${view.error}</div>` : nothing}
    <div id="authFormFields">
      ${view.resetEmail ? html`<div class="status auth-reset">${`If ${view.resetEmail} has a PodMates account, a reset link is on its way. It can take a few minutes, so check spam too. If nothing arrives, you probably signed up with a different address: try another one, or "Continue with Google". The link works once and lasts about an hour, and only the newest email counts, so open it straight away and don’t ask for a second one. If it says "expired", copy the link from the email into a private window instead of clicking it.`}</div>` : nothing}
      ${
        signup
          ? html`<div class="row auth-field-row">
              <input
                class="auth-input"
                id="authDisplayName"
                type="text"
                aria-label="Display name"
                autocomplete="nickname"
                placeholder="Display name (e.g. Alex)"
              />
            </div>`
          : nothing
      }
      <div class="row auth-field-row">
        <input
          class="auth-input"
          id="authEmail"
          type="email"
          aria-label="Email"
          autocomplete="email"
          placeholder="Email"
          .value=${view.email}
        />
      </div>
      <div class="row auth-password-row">
        <input
          class="auth-input"
          id="authPassword"
          type="password"
          aria-label="Password"
          autocomplete=${signup ? "new-password" : "current-password"}
          placeholder="Password"
        />
      </div>
      ${
        signup
          ? html`<div class="auth-spacer"></div>`
          : html`
              <div class="auth-forgot">
                <a href="#" id="authForgotLink" @click=${view.forgot}>Forgot password?</a>
              </div>
              <div class="auth-hint">
                ${view.remembered.email ? html`Last signed in on this browser: <strong>${view.remembered.email}</strong>${` (${view.remembered.via}). `}` : nothing}Not
                sure which email you used? Try "Continue with Google" below, or enter each address
                you might have used and click "Forgot password?". After you sign in,
                <em>My Profile</em> shows the email on your account.
              </div>
            `
      }
    </div>
    <button id="authSubmitBtn" class="auth-submit" @click=${view.submit}>
      ${signup ? "Create Account" : "Log In"}
    </button>
    <div class="auth-divider">
      <div></div>
      <span>or</span>
      <div></div>
    </div>
    <button id="authGoogleBtn" class="ghost auth-google" @click=${view.google}>
      Continue with Google
    </button>
    <button id="authYahooBtn" class="ghost auth-yahoo" @click=${view.yahoo}>
      Continue with Yahoo
    </button>
    <p class="auth-toggle">
      ${signup ? "Already have an account?" : "New here?"}
      <a href="#" id="authToggleModeLink" @click=${view.toggle}>${signup ? "Log in" : "Sign up"}</a>
    </p>
  `;
}
