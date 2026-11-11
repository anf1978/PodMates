// Account transitions exercise the real templates without network requests.
// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render } from "../../ui/html";
import { on } from "../../services/events";
import { configureAuth, showAuthModal } from "./index";
import { rememberedSignIn } from "./state";

vi.mock("../../services/cloud/auth", () => ({
  signUpWithEmail: vi.fn(),
  logInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithYahoo: vi.fn(),
  resetPassword: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => null,
  describeUser: () => null,
  onAuthChange: vi.fn(),
}));
vi.mock("../../ui/toast", () => ({ showToast: vi.fn() }));
import * as auth from "../../services/cloud/auth";

let modal: HTMLElement;
const close = vi.fn();
function click(id: string): void {
  modal.querySelector<HTMLElement>(`#${id}`)!.click();
}
function fill(id: string, value: string): void {
  modal.querySelector<HTMLInputElement>(`#${id}`)!.value = value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  modal = document.createElement("div");
  document.body.append(modal);
  configureAuth({ open: () => modal, close, confirm: vi.fn() });
});
afterEach(() => {
  render(null, modal);
  modal.remove();
  vi.unstubAllGlobals();
});

describe("optional account form", () => {
  it("preserves email but clears passwords on validation and mode changes", () => {
    showAuthModal();
    fill("authEmail", "<player>@example.test");
    click("authSubmitBtn");
    expect(modal.textContent).toContain("Email and password are both required.");
    expect(modal.querySelector<HTMLInputElement>("#authEmail")!.value).toBe(
      "<player>@example.test",
    );
    fill("authPassword", "secret-password");
    click("authToggleModeLink");
    expect(modal.querySelector("h2")!.textContent).toBe("Log In");
    expect(modal.querySelector<HTMLInputElement>("#authPassword")!.value).toBe("");
    expect(modal.querySelector<HTMLInputElement>("#authEmail")!.value).toBe(
      "<player>@example.test",
    );
    expect(auth.logInWithEmail).not.toHaveBeenCalled();
  });

  it("uses repository results and opens welcome only for a newly created account", async () => {
    const unsubscribe = on("profile:open", (options) => welcomes.push(options));
    const welcomes: Array<{ welcome?: boolean }> = [];
    vi.mocked(auth.signUpWithEmail).mockResolvedValue({
      ok: true,
      user: {
        uid: "u",
        isAnonymous: false,
        displayName: "Alex",
        email: "a@example.test",
        providers: ["password"],
      },
    });
    showAuthModal();
    fill("authDisplayName", " Alex ");
    fill("authEmail", " a@example.test ");
    fill("authPassword", "password");
    click("authSubmitBtn");
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(auth.signUpWithEmail).toHaveBeenCalledWith("a@example.test", "password", "Alex");
    expect(welcomes).toEqual([{ welcome: true }]);
    welcomes.length = 0;
    vi.mocked(auth.signUpWithEmail).mockResolvedValue({
      ok: true,
      user: null,
      switchedToExisting: true,
    });
    showAuthModal();
    fill("authDisplayName", "Alex");
    fill("authEmail", "a@example.test");
    fill("authPassword", "password");
    click("authSubmitBtn");
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(2));
    expect(welcomes).toEqual([]);
    unsubscribe();
  });

  it("retains the login email after provider failure and shows escaped reset confirmation", async () => {
    showAuthModal();
    click("authToggleModeLink");
    fill("authEmail", "<player>@example.test");
    vi.mocked(auth.signInWithGoogle).mockResolvedValue({ ok: false, error: "Popup blocked" });
    click("authGoogleBtn");
    await vi.waitFor(() => expect(modal.textContent).toContain("Popup blocked"));
    expect(modal.querySelector<HTMLInputElement>("#authEmail")!.value).toBe(
      "<player>@example.test",
    );
    vi.mocked(auth.resetPassword).mockResolvedValue({ ok: true });
    click("authForgotLink");
    await vi.waitFor(() =>
      expect(modal.textContent).toContain("If <player>@example.test has a PodMates account"),
    );
    expect(modal.querySelector("player")).toBeNull();
    expect(auth.resetPassword).toHaveBeenCalledWith("<player>@example.test");
  });
});

it("ignores malformed remembered hints and bounds usable email hints", () => {
  expect(rememberedSignIn("{")).toEqual({ email: "", via: "" });
  expect(rememberedSignIn('{"email":true}')).toEqual({ email: "", via: "" });
  expect(
    rememberedSignIn(JSON.stringify({ email: "x".repeat(220), providers: ["google.com"] })),
  ).toEqual({ email: "x".repeat(200), via: "Google" });
  expect(rememberedSignIn('{"email":"a@example.test","providers":null}').via).toBe(
    "email and password",
  );
});
