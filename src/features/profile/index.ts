// Optional My Profile onboarding and account management.
import { getCurrentUser } from "../../services/cloud/session";
import { updateMyDisplayName } from "../../services/cloud/profile";
import { addLinkedDeck } from "../../services/cloud/linked-decks";
import { on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { html, render } from "../../ui/html";
import { setupIconTooltips } from "../../ui/tooltip";
import { loadAndMergeMyDecks } from "./decks";
import { renderMyDecksList } from "./deck-list";
import { renderProfileLinksSection, renderProfileSignInBox, errorMessage } from "./account";
import { profileTemplate } from "./view";
import { profileRuntime } from "./runtime";
import {
  openPlayerProfileOverlay,
  openPodProfileOverlay,
  renderPlayerProfileContent,
} from "./public-view";

import "./profile.css";

export { configureProfile } from "./runtime";
export { loadAndMergeMyDecks } from "./decks";
export interface ProfileOptions {
  welcome?: boolean;
}

let mounted = false;
export function mount(): void {
  if (mounted) return;
  mounted = true;
  on("profile:open", (options) => {
    void showProfileModal(options);
  });
  on("profile:pod", (pod) => openPodProfileOverlay(pod));
  on("profile:player", ({ uid, name, podId }) => openPlayerProfileOverlay(uid, name, podId));
}

export async function showProfileModal(options: ProfileOptions = {}): Promise<void> {
  const runtime = profileRuntime();
  const modal = runtime.open();
  render(html`<p class="profile-loading">Loading your profile…</p>`, modal);
  const decks = await loadAndMergeMyDecks();
  if (!modal.isConnected) return;
  const welcome = Boolean(options.welcome);
  const user = getCurrentUser();
  render(null, modal);
  render(profileTemplate(welcome, user?.displayName || ""), modal);
  const find = <T extends HTMLElement = HTMLElement>(id: string): T =>
    modal.querySelector<T>(`#${id}`)!;
  find("tadCloseBtn").addEventListener("click", runtime.close);
  find("profileSkipLink")?.addEventListener("click", (event) => {
    event.preventDefault();
    runtime.close();
  });
  find("profileBuildTableBtn")?.addEventListener("click", () => {
    void runtime.buildTable();
  });
  const display = find<HTMLDetailsElement>("profileDisplayDetails");
  display?.addEventListener("toggle", () => {
    if (display.open) runtime.displaySettings(find("profileDisplayArea"));
  });
  find("profileDownloadBackupBtn")?.addEventListener("click", runtime.downloadBackup);
  find("profilePriceScryBtn")?.addEventListener("click", runtime.priceScry);
  const restore = find<HTMLInputElement>("profileRestoreFile");
  restore?.addEventListener("change", () => {
    const file = restore.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await runtime.restoreBackup(String(reader.result));
        const refreshed = await loadAndMergeMyDecks();
        if (modal.isConnected) renderMyDecksList(modal, refreshed);
      } catch (error) {
        reportError(error, { operation: "cloud", userTriggered: true });
        find("profileDataStatus").textContent = "Could not restore: " + errorMessage(error);
        find("profileDataStatus").className = "status err";
      }
    };
    reader.onerror = () => {
      find("profileDataStatus").textContent = "Could not read that file.";
      find("profileDataStatus").className = "status err";
    };
    reader.readAsText(file);
    restore.value = "";
  });
  renderMyDecksList(modal, decks);
  find<HTMLButtonElement>("profileSaveNameBtn").addEventListener("click", async () => {
    const name = find<HTMLInputElement>("profileDisplayNameInput").value.trim();
    const status = find("profileNameStatus");
    if (!name) {
      status.textContent = "Enter a name first.";
      status.className = "status err";
      return;
    }
    const button = find<HTMLButtonElement>("profileSaveNameBtn");
    button.disabled = true;
    status.textContent = "Saving…";
    status.className = "status";
    try {
      await updateMyDisplayName(name);
      status.textContent = "Saved — this is now what your podmates see.";
      status.className = "status";
      // Updating Firebase's profile does not emit an auth-state transition.
      const authText = document.getElementById("authStatusText");
      if (authText)
        authText.textContent = `Signed in as ${getCurrentUser()?.displayName || getCurrentUser()?.email}`;
    } catch (error) {
      reportError(error, { operation: "cloud", userTriggered: true });
      status.textContent = "Could not save: " + errorMessage(error);
      status.className = "status err";
    } finally {
      button.disabled = false;
    }
  });
  find<HTMLButtonElement>("profileAddDeckBtn").addEventListener("click", async () => {
    const input = find<HTMLInputElement>("profileDeckLinkInput");
    const status = find("profileSyncStatus");
    const url = input.value.trim();
    if (!url) {
      status.textContent = "Paste a deck link first.";
      status.className = "status err";
      return;
    }
    const button = find<HTMLButtonElement>("profileAddDeckBtn");
    button.disabled = true;
    button.textContent = "Adding…";
    status.textContent = "";
    try {
      const result = await addLinkedDeck(url);
      if (!result.ok) {
        status.textContent = result.error;
        status.className = "status err";
        return;
      }
      input.value = "";
      status.textContent = result.renamed
        ? `Added as "${result.deck.name}" — you already had a deck named that, so this one got a distinguishing suffix.`
        : `Added “${result.deck.name}.”`;
      status.className = "status";
      const refreshed = await loadAndMergeMyDecks();
      if (modal.isConnected) renderMyDecksList(modal, refreshed);
    } catch (error) {
      reportError(error, { operation: "cloud", userTriggered: true });
      status.textContent = "Could not save this deck: " + errorMessage(error);
      status.className = "status err";
    } finally {
      button.disabled = false;
      button.textContent = "Add Deck";
    }
  });
  renderProfileSignInBox();
  const header = find("myProfileHeaderArea");
  if (header && user)
    void renderPlayerProfileContent(header, user.uid, user.displayName || "You", runtime.podId());
  const links = find("profileLinksArea");
  if (links) void renderProfileLinksSection(links);
  setupIconTooltips(modal);
}
