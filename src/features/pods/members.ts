// Pod membership actions; profile navigation crosses the typed app-event boundary.
import { loadPodMembers } from "../../services/cloud/members";
import {
  loadMyPods,
  promoteToCoLeader,
  removePodMember,
  transferLeadership,
} from "../../services/cloud/pods";
import type { PodMember } from "../../services/cloud/types";
import { emit as emitAppEvent } from "../../services/events";
import { reportError } from "../../services/report-error";
import { nothing, render } from "../../ui/html";
import { setupIconTooltips } from "../../ui/tooltip";
import { showToast } from "../../ui/toast";
import { errorMessage, type PodIntegration } from "./integration";
import type { Pod } from "./state";
import { membersTemplate } from "./view";

export interface DetailContext {
  ui: PodIntegration;
  refresh(container: HTMLElement, pods: Pod[]): Promise<void>;
  reopen(pod: Pod): Promise<void>;
  setActive(id: string | null): void;
}

export function renderMembers(
  outer: HTMLElement,
  pod: Pod,
  members: PodMember[],
  uid: string | null,
  canManage: boolean,
  isLeader: boolean,
  context: DetailContext,
): void {
  const area = outer.querySelector<HTMLElement>("#podMembersList");
  if (!area) return;
  render(nothing, area);
  render(membersTemplate(members, uid, canManage, isLeader), area);

  for (const button of area.querySelectorAll<HTMLButtonElement>("[data-view-profile]")) {
    const member = members.find((m) => m.uid === button.dataset.viewProfile)!;
    button.addEventListener("click", () =>
      emitAppEvent("profile:player", {
        uid: member.uid,
        name: member.displayLabel || member.displayName || "Player",
        podId: pod.id,
      }),
    );
  }
  setupIconTooltips(area);

  const reload = async () => {
    const refreshed = await loadPodMembers(pod.id);
    if (outer.isConnected) renderMembers(outer, pod, refreshed, uid, canManage, isLeader, context);
  };
  const fail = (error: unknown, prefix: string) => {
    reportError(error, { operation: "cloud" });
    showToast(prefix + errorMessage(error));
  };
  for (const button of area.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
    const member = members.find((m) => m.uid === button.dataset.uid)!;
    const name = member.displayLabel || member.displayName;
    button.addEventListener("click", async () => {
      if (button.dataset.action === "promote") {
        try {
          await promoteToCoLeader(pod.id, member.uid);
          await reload();
          showToast(`${name} is now a Co-Steward.`);
        } catch (error) {
          fail(error, "Could not promote: ");
        }
      } else if (button.dataset.action === "transfer") {
        context.ui.actionConfirm(
          `Make ${name} the Steward? You'll become a Co-Steward.`,
          "Make Steward",
          async () => {
            try {
              await transferLeadership(pod.id, member.uid);
              await context.refresh(outer, await loadMyPods());
              showToast(`${name} is now the Steward.`);
            } catch (error) {
              fail(error, "Could not hand off Stewardship: ");
            }
          },
          () => void context.reopen(pod),
        );
      } else if (button.dataset.action === "remove") {
        context.ui.confirm(`Remove ${name} from "${pod.name}"?`, async () => {
          try {
            await removePodMember(pod.id, member.uid);
            await reload();
            showToast(`${name} removed.`);
          } catch (error) {
            fail(error, "Could not remove this member: ");
          }
        });
      }
    });
  }
}
