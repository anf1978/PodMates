// Pod detail, settings and invite controls; repositories preserve all existing Firestore contracts.
import { loadPodMembers } from "../../services/cloud/members";
import {
  deletePod,
  leavePod,
  loadMyPods,
  regenerateInviteCode,
  renamePod,
} from "../../services/cloud/pods";
import { getCurrentUser } from "../../services/cloud/session";
import { emit as emitAppEvent } from "../../services/events";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { errorMessage } from "./integration";
import { renderMembers, type DetailContext } from "./members";
import { permissions, type Pod } from "./state";
import { detailTemplate, loadingTemplate } from "./view";

export async function renderDetail(
  container: HTMLElement,
  pod: Pod,
  pods: Pod[],
  context: DetailContext,
): Promise<void> {
  context.setActive(pod.id);
  emitAppEvent("pods:active", pod.id);
  render(loadingTemplate("Loading members…"), container);
  let members: Awaited<ReturnType<typeof loadPodMembers>> = [];
  try {
    members = await loadPodMembers(pod.id);
  } catch (error) {
    reportError(error, { operation: "cloud" });
  }
  if (!container.isConnected) return;

  const uid = getCurrentUser()?.uid ?? null;
  const { isLeader, canManage } = permissions(members, uid);
  render(detailTemplate(pod, pods, members, uid), container);
  const button = (id: string, handler: () => void) =>
    container.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener("click", handler);
  const refresh = async () => context.refresh(container, await loadMyPods());
  const fail = (error: unknown, prefix: string) => {
    reportError(error, { operation: "cloud" });
    showToast(prefix + errorMessage(error));
  };
  button("hostGatheringBtn", () => emitAppEvent("gatherings:host", { pod, members }));
  button("viewPodProfileBtn", () => emitAppEvent("profile:pod", pod));
  button("spoilerBaitBtn", () => emitAppEvent("spoilers:open", pod));

  const switcher = container.querySelector<HTMLSelectElement>("#podSwitcher");
  switcher?.addEventListener("change", async () => {
    context.setActive(switcher.value);
    await context.refresh(container, pods);
  });
  button("podCopyInviteBtn", () => {
    container.querySelector<HTMLInputElement>("#podInviteLinkField")!.select();
    try {
      document.execCommand("copy");
      showToast("Invite link copied.");
    } catch (error) {
      reportError(error, { operation: "cloud" });
      showToast("Could not copy automatically -- select and copy the link manually.");
    }
  });
  container.querySelector("#podLeaveLink")!.addEventListener("click", (event) => {
    event.preventDefault();
    if (isLeader && members.length > 1) {
      showToast(
        "As Steward, hand off Stewardship to someone else before leaving -- see Pod Settings.",
      );
      return;
    }
    context.ui.confirm(`Leave "${pod.name}"?`, async () => {
      try {
        await leavePod(pod.id);
        context.setActive(null);
        await refresh();
        showToast(`Left "${pod.name}."`);
      } catch (error) {
        fail(error, "Could not leave the pod: ");
      }
    });
  });
  if (canManage) {
    button("podRenameBtn", async () => {
      try {
        await renamePod(
          pod.id,
          container.querySelector<HTMLInputElement>("#podRenameInput")!.value,
        );
        await refresh();
        showToast("Pod renamed.");
      } catch (error) {
        fail(error, "Could not rename: ");
      }
    });
    button("podRegenerateBtn", () =>
      context.ui.actionConfirm(
        "Regenerate the invite link? The old link will stop working immediately.",
        "Regenerate",
        async () => {
          try {
            await regenerateInviteCode(pod.id);
            await refresh();
            showToast("New invite link generated.");
          } catch (error) {
            fail(error, "Could not regenerate: ");
          }
        },
        () => void context.reopen(pod),
      ),
    );
    button("podDeleteBtn", () =>
      context.ui.confirm(
        `Delete "${pod.name}" for everyone? This removes all ${members.length} member${members.length === 1 ? "" : "s"} and cannot be undone.`,
        async () => {
          try {
            await deletePod(pod.id);
            context.setActive(null);
            await refresh();
            showToast(`"${pod.name}" deleted.`);
          } catch (error) {
            fail(error, "Could not delete the pod: ");
          }
        },
      ),
    );
  }
  renderMembers(container, pod, members, uid, canManage, isLeader, context);
}
