import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "preserve-legacy-html",
      apply: "build",
      generateBundle(_options, bundle) {
        let html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
        for (const [name, source] of [
          ["datasets", "./src/data/load-dataset.ts"],
          ["cardDb", "./src/cards/load-db.ts"],
          ["cardsLegacy", "./src/cards/legacy-globals.ts"],
          ["engineLegacy", "./src/engine/legacy-globals.ts"],
          ["cloudLimits", "./src/services/cloud/limits-global.ts"],
          ["cloud", "./src/services/cloud/index.ts"],
        ]) {
          const loader = Object.values(bundle).find(
            (output) => output.type === "chunk" && output.isEntry && output.name === name,
          );
          if (!loader) throw new Error(`Missing ${name} loader entry`);
          html = html.replaceAll(source, `./${loader.fileName}`);
        }
        this.emitFile({
          type: "asset",
          fileName: "index.html",
          source: html,
        });
      },
    },
  ],
  build: {
    minify: false,
    rollupOptions: {
      input: {
        datasets: fileURLToPath(new URL("./src/data/load-dataset.ts", import.meta.url)),
        cardDb: fileURLToPath(new URL("./src/cards/load-db.ts", import.meta.url)),
        cardsLegacy: fileURLToPath(new URL("./src/cards/legacy-globals.ts", import.meta.url)),
        engineLegacy: fileURLToPath(new URL("./src/engine/legacy-globals.ts", import.meta.url)),
        cloudLimits: fileURLToPath(
          new URL("./src/services/cloud/limits-global.ts", import.meta.url),
        ),
        cloud: fileURLToPath(new URL("./src/services/cloud/index.ts", import.meta.url)),
      },
      preserveEntrySignatures: "strict",
    },
  },
});
