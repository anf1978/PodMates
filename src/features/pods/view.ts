// Pod templates only: user/network values are text bindings, never trusted markup.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { PodMember } from "../../services/cloud/types";
import { inviteLink, permissions, roleDisplayLabel, type Pod } from "./state";

export function shellTemplate(): TemplateResult {
  return html`
    <h2>MyPods</h2>
    <p class="pods-intro">
      A pod is your regular group of people, not a specific set of decks — who's bringing what gets
      chosen fresh each time you chart a game night.
    </p>
    <div id="ourPodPanelArea"></div>
  `;
}

export function signedOutTemplate(onSignIn: () => void): TemplateResult {
  return html`
    <p class="pods-signed-out">
      Sign up or log in to create or join a pod -- your regular group, shared across everyone in it.
    </p>
    <button id="ourPodSignUpBtn" @click=${onSignIn}>Sign Up / Log In</button>
  `;
}

export function loadingTemplate(message: string): TemplateResult {
  return html`<p class="pods-loading">${message}</p>`;
}

export function landingTemplate(
  pods: Pod[],
  open: (pod: Pod) => void,
  create: () => void,
  join: () => void,
  sample: () => void,
): TemplateResult {
  return html`
    <p class="pods-landing-intro">
      Your pods live here -- your regular groups, each with their own members, saved Table
      Formations, and Chronicles. Open a pod to host a Gathering, invite people, or manage
      membership.
    </p>
    <div id="myPodsLiveGatheringArea"></div>
    <div id="myPodsList" class="pods-list">
      ${
        pods.length
          ? pods.map(
              (pod) => html`
                <button
                  type="button"
                  data-pod-id=${pod.id}
                  class="ghost pods-list-item"
                  @click=${() => open(pod)}
                >
                  ${pod.name}
                </button>
              `,
            )
          : html`<p class="pods-empty">
              You're not in a pod yet -- create one, or join with an invite link.
            </p>`
      }
    </div>
    <button id="myPodsCreateBtn" class="pods-wide pods-gap-10" @click=${create}>
      Create a Pod
    </button>
    <button id="myPodsJoinBtn" class="ghost pods-wide pods-gap-10" @click=${join}>
      Join a Pod
    </button>
    <button id="myPodsSampleBtn" class="ghost pods-wide" @click=${sample}>
      Sample a Gathering
    </button>
  `;
}

export function overlayTemplate(close: () => void): TemplateResult {
  return html`
    <button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <div id="podOverlayContent"></div>
  `;
}

export function formTemplate(create: () => void, join: () => void): TemplateResult {
  return html`
    <p class="pods-form-intro">
      You're not in a pod yet. Start one, or join one with an invite link.
    </p>
    <div class="pods-create-section">
      <div class="pods-label">Create a Pod</div>
      <div class="row pods-row">
        <input
          id="podCreateNameInput"
          type="text"
          placeholder="Pod name (e.g. Thursday Night Crew)"
          class="pods-input pods-form-input"
        />
        <button id="podCreateBtn" class="pods-nowrap" @click=${create}>Create</button>
      </div>
    </div>
    <div class="pods-divider">
      <div class="pods-divider-line"></div>
      <span class="pods-or">or</span>
      <div class="pods-divider-line"></div>
    </div>
    <div>
      <div class="pods-label">Join a Pod</div>
      <div class="row pods-row">
        <input
          id="podJoinCodeInput"
          type="text"
          placeholder="Paste an invite link or code"
          class="pods-input pods-form-input"
        />
        <button id="podJoinBtn" class="ghost pods-nowrap" @click=${join}>Join</button>
      </div>
    </div>
    <div id="podModalStatus" class="pods-form-status"></div>
  `;
}

export function detailTemplate(
  pod: Pod,
  pods: Pod[],
  members: PodMember[],
  uid: string | null,
): TemplateResult {
  const { isLeader, isCoLeader, canManage } = permissions(members, uid);
  return html`
    ${
      pods.length > 1
        ? html`
            <select id="podSwitcher" class="pods-switcher">
              ${pods.map((p) => html`<option value=${p.id} ?selected=${p.id === pod.id}>${p.name}</option>`)}
            </select>
          `
        : nothing
    }
    <h2 class="pods-title">${pod.name}</h2>
    <p class="pods-member-count">
      ${`${members.length} member${members.length === 1 ? "" : "s"} · you're ${isLeader ? "the Steward" : isCoLeader ? "a Co-Steward" : "a member"}`}
    </p>

    <button id="hostGatheringBtn" class="pods-wide pods-gap-10">Host a Gathering</button>
    <button id="viewPodProfileBtn" class="ghost pods-wide pods-gap-10">View Pod Profile</button>
    <button id="spoilerBaitBtn" class="ghost pods-wide pods-gap-18">
      Spoiler Bait — swipe on this week’s new cards
    </button>

    <div class="pods-gap-18">
      <div class="pods-label">Invite Link</div>
      <div class="row pods-row">
        <input
          id="podInviteLinkField"
          type="text"
          readonly
          .value=${inviteLink(pod.inviteCode, location)}
          class="pods-input pods-invite-input"
        />
        <button id="podCopyInviteBtn" class="ghost pods-nowrap pods-small">Copy</button>
      </div>
    </div>

    <div class="pods-gap-14">
      <div class="pods-label">Members</div>
      <div id="podMembersList"></div>
    </div>

    ${
      canManage
        ? html`
            <details class="pods-settings">
              <summary class="pods-settings-summary">Pod Settings</summary>
              <div class="pods-settings-body">
                <div class="row pods-row pods-gap-10">
                  <input
                    id="podRenameInput"
                    type="text"
                    placeholder="Rename pod"
                    .value=${pod.name}
                    class="pods-input pods-rename-input"
                  />
                  <button id="podRenameBtn" class="ghost pods-small">Rename</button>
                </div>
                <button
                  id="podRegenerateBtn"
                  class="ghost pods-wide pods-gap-10 pods-setting-button"
                >
                  Regenerate Invite Link
                </button>
                ${isLeader ? html`<button id="podDeleteBtn" class="ghost pods-wide pods-danger pods-setting-button">Delete Pod</button>` : nothing}
              </div>
            </details>
          `
        : nothing
    }

    <p class="pods-leave">
      <a href="#" id="podLeaveLink" class="pods-leave-link">Leave this pod</a>
    </p>
  `;
}

export function membersTemplate(
  members: PodMember[],
  uid: string | null,
  canManage: boolean,
  isLeader: boolean,
): TemplateResult {
  const clashNames = [...new Set(members.filter((m) => m.nameClash).map((m) => m.displayName))];
  return html`
    ${
      clashNames.length
        ? html`
            <div class="pods-name-clash">
              ${`Some members share a display name (${clashNames.join(", ")}), so they are numbered here. Ask one of them to change theirs in their Profile.`}
            </div>
          `
        : nothing
    }
    ${members.map(
      (m) => html`
        <div class="pods-member">
          <div class="pods-member-name">
            <span class="pods-display-name">${m.displayLabel || m.displayName || "Player"}</span>
            ${m.uid === uid ? html`<span class="pods-you"> (you)</span>` : nothing}
            <div class="pods-role">${roleDisplayLabel(m.role)}</div>
          </div>
          <div class="pods-member-actions">
            <button
              type="button"
              class="ghost icon-btn pods-profile-button"
              data-view-profile=${m.uid}
              data-tooltip="View Profile"
              aria-label=${`View ${m.displayName || "Player"}'s Profile`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
              </svg>
            </button>
            ${
              canManage && m.uid !== uid && m.role !== "leader"
                ? html`
                    ${m.role !== "co-leader" ? html`<button class="ghost pods-member-action" data-action="promote" data-uid=${m.uid}>Make Co-Steward</button>` : nothing}
                    ${isLeader ? html`<button class="ghost pods-member-action" data-action="transfer" data-uid=${m.uid}>Make Steward</button>` : nothing}
                    <button
                      class="ghost pods-member-action pods-danger"
                      data-action="remove"
                      data-uid=${m.uid}
                    >
                      Remove
                    </button>
                  `
                : nothing
            }
          </div>
        </div>
      `,
    )}
  `;
}
