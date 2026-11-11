import { reportError } from "./report-error";

let ready: Promise<void> | undefined;

/** Bound first-install waiting: a broken SW must not block ordinary online boot. */
export function prepareOffline(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return Promise.resolve();
  return (ready ??= new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", finish);
    const timer = setTimeout(() => {
      reportError(new Error("Offline cache timed out"), {
        operation: "offline-cache",
        severity: "warning",
      });
      finish();
    }, 5000);
    void Promise.resolve()
      .then(() =>
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        }),
      )
      .then((registration) => {
        const prompt = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            void showUpdate(registration).catch((error: unknown) =>
              reportError(error, { operation: "app-update", severity: "warning" }),
            );
          }
        };
        prompt();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "redundant") {
              reportError(new Error("Offline cache installation failed"), {
                operation: "offline-cache",
                severity: "warning",
              });
              finish();
            }
            prompt();
          });
        });
        if (navigator.serviceWorker.controller) finish();
      })
      .catch((error: unknown) => {
        reportError(error, { operation: "offline-cache", severity: "warning" });
        finish();
      });
  }));
}

async function showUpdate(registration: ServiceWorkerRegistration): Promise<void> {
  const { html, render } = await import("../ui/html");
  if (document.getElementById("pmUpdate")) return;
  const banner = document.createElement("aside");
  banner.id = "pmUpdate";
  banner.className = "pm-update";
  banner.setAttribute("aria-label", "Application update");
  const reload = () => {
    if (!registration.waiting) return;
    const changed = () => location.reload();
    try {
      navigator.serviceWorker.addEventListener("controllerchange", changed, { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (err) {
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      reportError(err, { operation: "app-update", userTriggered: true });
    }
  };
  render(
    html`<span role="status">New version available</span>
      <button type="button" @click=${reload}>Reload</button>
      <button type="button" aria-label="Dismiss update" @click=${() => banner.remove()}>
        Later
      </button>`,
    banner,
  );
  document.body.appendChild(banner);
}
