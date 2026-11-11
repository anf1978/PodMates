// The PriceScry password is a soft door, NOT security: the page's code is public. The word is stored as a hash so it
// is not sitting in plain sight, but a short word can be guessed. Real protection would need a server-side check.
import { html } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { paint } from "./dom";
import { openPriceScry } from "./screen";

const PW_SHA256 = "671ec1ded41bee58be046f5eba69a446f7e7f229f3c76efe9d70388ebb845ffa";
const STORAGE_KEY = "pricescryUnlocked";
let unlocked = false;
let failures = 0,
  lockUntil = 0;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function requestAccess(): void {
  let remembered = false;
  try {
    remembered = sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* storage unavailable: just ask */
  }
  if (unlocked || remembered) {
    unlocked = true;
    openPriceScry();
    return;
  }
  openPrompt();
}

function openPrompt(): void {
  const { modal } = openTadOverlay({ modalStyle: "max-width:460px" });
  const go = (): void =>
    void tryPassword(modal.querySelector<HTMLInputElement>("#psPwInput")!.value);
  paint(
    modal,
    html`<button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>Close ×</button>
      <h2 class="ps-pw-title">PriceScry</h2>
      <p class="tad-sub ps-pw-sub">Enter the password to continue.</p>
      <input
        id="psPwInput"
        class="ps-input"
        type="password"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Password"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") go();
        }}
      />
      <div id="psPwStatus" class="status ps-pw-status"></div>
      <div class="row ps-pw-actions">
        <button id="psPwCancel" class="ghost" @click=${closeTryADeckModal}>Cancel</button>
        <button id="psPwGo" @click=${go}>Enter</button>
      </div>`,
  );
  modal.querySelector<HTMLInputElement>("#psPwInput")!.focus();
}

async function tryPassword(value: string): Promise<void> {
  const status = document.getElementById("psPwStatus");
  const say = (msg: string, err: boolean): void => {
    if (status) {
      status.textContent = msg;
      status.className = "status ps-pw-status" + (err ? " err" : "");
    }
  };
  if (Date.now() < lockUntil) {
    say(`Too many tries. Wait ${Math.ceil((lockUntil - Date.now()) / 1000)} seconds.`, true);
    return;
  }
  if (!window.crypto || !crypto.subtle) {
    say("This browser can't check the password on this connection.", true);
    return;
  }
  const hex = await sha256Hex(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
  if (hex === PW_SHA256) {
    failures = 0;
    unlocked = true;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* fine: just asks again next visit */
    }
    closeTryADeckModal();
    openPriceScry();
    return;
  }
  failures++;
  if (failures >= 5) {
    lockUntil = Date.now() + 30000;
    failures = 0;
    say("Too many tries. Wait 30 seconds.", true);
  } else say("That isn't the password.", true);
}
