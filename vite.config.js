import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { withScriptHashes } from "./scripts/content-security-policy.mjs";
import { conditionalDatasetRequests } from "./scripts/pwa-cache.mjs";
import { inlineThemePrepaint } from "./scripts/theme-prepaint.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    {
      // Before Vite's own HTML handling, so the classic tag is matched as written.
      name: "development-theme-prepaint",
      apply: "serve",
      transformIndexHtml: { order: "pre", handler: inlineThemePrepaint },
    },
    {
      name: "development-csp",
      apply: "serve",
      transformIndexHtml: { order: "post", handler: withScriptHashes },
    },
    {
      name: "page-html",
      apply: "build",
      async generateBundle(_options, bundle) {
        let html = await inlineThemePrepaint(
          readFileSync(new URL("./index.html", import.meta.url), "utf8"),
        );
        // `main` is the page's one module tag.
        const main = Object.values(bundle).find(
          (output) => output.type === "chunk" && output.isEntry && output.name === "main",
        );
        if (!main) throw new Error("Missing main entry");
        html = html.replaceAll("./src/main.ts", `./${main.fileName}`);
        for (const source of [
          "./src/styles/tokens.css",
          "./src/styles/base.css",
          "./src/features/deck-chart/deck-chart.css",
          "./src/features/deck-chart/report.css",
          "./src/features/deck-chart/results/results.css",
          "./src/ui/tad-modal.css",
          "./src/ui/card-search.css",
          "./src/ui/decks-table.css",
          "./src/features/try-a-deck/try-a-deck.css",
          "./src/features/export/export.css",
          "./src/features/card-viewer/card-viewer.css",
          "./src/features/scan-cards/scan-cards.css",
          "./src/features/deck-crafter/deck-crafter.css",
          "./src/features/saved-decks/saved-decks.css",
          "./src/features/auth/auth.css",
          "./src/features/profile/profile.css",
          "./src/features/profile/public-profile.css",
          "./src/features/pods/pods.css",
          "./src/features/gatherings/gatherings.css",
          "./src/features/chronicles/chronicles.css",
          "./src/features/impact/impact.css",
          "./src/features/spoiler-bait/spoiler-bait.css",
          "./src/features/trades/trades.css",
          "./src/features/notifications/notifications.css",
          "./src/features/comparison/comparison.css",
          "./src/features/comparison/detail.css",
          "./src/features/ledger/ledger.css",
          "./src/features/themes/themes.css",
          "./src/features/pricescry/pricescry.css",
        ]) {
          const reference = this.emitFile({
            type: "asset",
            name: source.split("/").pop(),
            source: readFileSync(new URL(source, import.meta.url), "utf8"),
          });
          html = html.replaceAll(source, `./${this.getFileName(reference)}`);
        }
        this.emitFile({
          type: "asset",
          fileName: "index.html",
          source: withScriptHashes(html),
        });
      },
    },
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      includeAssets: ["manifest.webmanifest", "*.png"],
      workbox: {
        globPatterns: ["**/*.{html,js,css}"],
        globIgnores: ["**/db.worker-*.js"],
        maximumFileSizeToCacheInBytes: 4_000_000,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "index.html",
        navigateFallbackAllowlist: [/\/(?:index\.html)?$/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.endsWith("/data/manifest.json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pm-data-manifest",
              plugins: [conditionalDatasetRequests],
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /\/data\/[A-Za-z0-9_-]+\.json$/.test(url.pathname) &&
              /^[a-f0-9]{64}$/.test(url.searchParams.get("v") ?? ""),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pm-datasets",
              plugins: [conditionalDatasetRequests],
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 64 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://cards.scryfall.io",
            handler: "CacheFirst",
            options: {
              cacheName: "pm-card-art",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 250, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    minify: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
      },
      preserveEntrySignatures: "strict",
    },
  },
});
