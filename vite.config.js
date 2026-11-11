import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { withScriptHashes } from "./scripts/content-security-policy.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "development-csp",
      apply: "serve",
      transformIndexHtml: { order: "post", handler: withScriptHashes },
    },
    {
      name: "preserve-legacy-html",
      apply: "build",
      generateBundle(_options, bundle) {
        let html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
        const sanitizer = this.emitFile({
          type: "asset",
          name: "purify.min.js",
          source: readFileSync(
            new URL("./node_modules/dompurify/dist/purify.min.js", import.meta.url),
          ),
        });
        html = html.replace(
          "./node_modules/dompurify/dist/purify.min.js",
          `./${this.getFileName(sanitizer)}`,
        );
        // `main` is the page's module tag; the others are imported by the inline start-up code.
        for (const [name, source] of [
          ["main", "./src/main.ts"],
          ["datasets", "./src/data/load-dataset.ts"],
          ["cardDb", "./src/cards/load-db.ts"],
          ["cardsLegacy", "./src/cards/legacy-globals.ts"],
          ["engineLegacy", "./src/engine/legacy-globals.ts"],
        ]) {
          const loader = Object.values(bundle).find(
            (output) => output.type === "chunk" && output.isEntry && output.name === name,
          );
          if (!loader) throw new Error(`Missing ${name} loader entry`);
          html = html.replaceAll(source, `./${loader.fileName}`);
        }
        for (const source of [
          "./src/styles/tokens.css",
          "./src/styles/base.css",
          "./src/features/deck-chart/deck-chart.css",
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
  ],
  build: {
    minify: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
        datasets: fileURLToPath(new URL("./src/data/load-dataset.ts", import.meta.url)),
        cardDb: fileURLToPath(new URL("./src/cards/load-db.ts", import.meta.url)),
        cardsLegacy: fileURLToPath(new URL("./src/cards/legacy-globals.ts", import.meta.url)),
        engineLegacy: fileURLToPath(new URL("./src/engine/legacy-globals.ts", import.meta.url)),
      },
      preserveEntrySignatures: "strict",
    },
  },
});
