// Account details, clipboard fallback and editable external profile links.
import { resetPassword } from "../../services/cloud/auth";
import { describeUser, getCurrentUser } from "../../services/cloud/session";
import { getMyRawUserDoc, updateMyProfileLinks } from "../../services/cloud/users";
import { reportError } from "../../services/report-error";
import { html, nothing, render } from "../../ui/html";
import { profileRuntime } from "./runtime";
import { signInMethod } from "./state";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function renderProfileSignInBox(): void {
  const box = document.getElementById("profileSignInBox");
  if (!box) return;
  const user = describeUser(getCurrentUser());
  if (!user || user.isAnonymous || !user.email) {
    render(
      html`<label class="profile-label">Your sign-in details</label>
        <div class="profile-soft">
          You are using PodMates as a guest. Create an account (or log in) to save decks across
          devices; this box will then show which email you signed in with.
        </div>`,
      box,
    );
    return;
  }
  const email = user.email;
  const providers = user.providers || [];
  const password = providers.includes("password");
  const google = providers.includes("google.com");
  const yahoo = providers.includes("yahoo.com");
  render(
    html`
      <label class="profile-label"
        >Your sign-in details — keep a note of this email so you can always get back in</label
      >
      <div class="row profile-row profile-signin-row">
        <div class="profile-email"><strong id="profileSignInEmail">${email}</strong></div>
        <button id="profileCopyEmailBtn" class="ghost profile-nowrap">Copy email</button>
      </div>
      <div class="profile-signin-method">
        ${`Signs in with: ${signInMethod(providers)}.${
          (google || yahoo) && !password
            ? ` There is no PodMates password to forget: use "Continue with ${google ? "Google" : "Yahoo"}" on the Log In window.`
            : ""
        }`}
      </div>
      ${password ? html`<button id="profileResetPwBtn" class="ghost profile-reset-button">Email me a password reset link</button>` : nothing}
      <div id="profileSignInStatus" class="profile-small-status"></div>
    `,
    box,
  );
  const status = box.querySelector<HTMLElement>("#profileSignInStatus")!;
  box.querySelector("#profileCopyEmailBtn")?.addEventListener("click", async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(email);
      ok = true;
    } catch {
      try {
        const range = document.createRange();
        range.selectNodeContents(box.querySelector("#profileSignInEmail")!);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    status.textContent = ok ? "Email copied." : "Select the email above and copy it by hand.";
    status.className = ok ? "status" : "status err";
  });
  const reset = box.querySelector<HTMLButtonElement>("#profileResetPwBtn");
  reset?.addEventListener("click", async () => {
    reset.disabled = true;
    status.textContent = "Sending…";
    status.className = "status";
    const result = await resetPassword(email);
    reset.disabled = false;
    status.textContent = result.ok
      ? `Reset link sent to ${email}. It can take a few minutes; check spam too. It works once, lasts about an hour, and only the newest email counts.`
      : result.error || "Could not send the email.";
    status.className = result.ok ? "status" : "status err";
  });
}

export async function renderProfileLinksSection(container: HTMLElement): Promise<void> {
  let doc = null;
  if (getCurrentUser()) {
    try {
      doc = await getMyRawUserDoc();
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
  }
  if (!container.isConnected) return;
  const archidekt = doc?.archidektProfileUrl || "";
  const moxfield = doc?.moxfieldProfileUrl || "";
  const link = (name: string, value: string, placeholder: string) => {
    const href = profileRuntime().safeUrl(value);
    return html` <div
      class=${name === "Archidekt" ? "profile-link-archidekt" : "profile-link-moxfield"}
    >
      <label class="profile-link-label">${`${name} profile`}</label>
      <div class="row profile-row">
        <input
          id=${`profile${name}Input`}
          type="text"
          class="profile-input profile-link-input"
          .value=${value}
          placeholder=${placeholder}
        />
        ${href ? html`<a href=${href} target="_blank" rel="noopener noreferrer" class="ghost profile-visit">Visit ↗</a>` : nothing}
      </div>
    </div>`;
  };
  render(null, container);
  render(
    html`
      ${link("Archidekt", archidekt, "archidekt.com/u/yourname")}
      ${link("Moxfield", moxfield, "moxfield.com/users/yourname")}
      <button id="profileSaveLinksBtn" class="ghost profile-reset-button">Save Links</button>
      <div id="profileLinksStatus" class="profile-small-status"></div>
    `,
    container,
  );
  const save = container.querySelector<HTMLButtonElement>("#profileSaveLinksBtn")!;
  const status = container.querySelector<HTMLElement>("#profileLinksStatus")!;
  save.addEventListener("click", async () => {
    save.disabled = true;
    save.textContent = "Saving…";
    try {
      await updateMyProfileLinks({
        archidektUrl: container.querySelector<HTMLInputElement>("#profileArchidektInput")!.value,
        moxfieldUrl: container.querySelector<HTMLInputElement>("#profileMoxfieldInput")!.value,
      });
      status.textContent = "Saved.";
      status.className = "status ok";
      await renderProfileLinksSection(container);
    } catch (error) {
      reportError(error, { operation: "cloud", userTriggered: true });
      status.textContent = "Could not save: " + errorMessage(error);
      status.className = "status err";
    } finally {
      save.disabled = false;
      save.textContent = "Save Links";
    }
  });
}
