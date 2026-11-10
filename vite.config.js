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
      },
      preserveEntrySignatures: "strict",
    },
  },
});
