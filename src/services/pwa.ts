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
      console.warn("PodMates: offline cache not ready; continuing online.");
      finish();
    }, 5000);
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((registration) => {
        const prompt = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            void showUpdate(registration).catch((error: unknown) =>
              console.error("PodMates: could not show the update prompt.", error),
            );
          }
        };
        prompt();
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", prompt);
        });
        if (navigator.serviceWorker.controller) finish();
      })
      .catch((error: unknown) => {
        console.warn("PodMates: offline cache registration failed.", error);
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
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), {
      once: true,
    });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
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
