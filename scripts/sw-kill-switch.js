// Emergency replacement for dist/sw.js. Deliberately has no fetch handler or navigation.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const owned = new Set(["pm-data-manifest", "pm-datasets", "pm-card-art"]);
      for (const name of await caches.keys()) {
        if (
          owned.has(name) ||
          (name.startsWith("workbox-precache-") && name.endsWith(self.registration.scope))
        ) {
          await caches.delete(name);
        }
      }
      await self.registration.unregister();
    })(),
  );
});
