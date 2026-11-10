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
        // Bundle the typed loader, but leave the legacy scripts and bot data untouched.
        const loader = Object.values(bundle).find(
          (output) => output.type === "chunk" && output.isEntry && output.name === "datasets",
        );
        if (!loader) throw new Error("Missing dataset loader entry");
        this.emitFile({
          type: "asset",
          fileName: "index.html",
          source: readFileSync(new URL("./index.html", import.meta.url), "utf8").replaceAll(
            "./src/data/load-dataset.ts",
            `./${loader.fileName}`,
          ),
        });
      },
    },
  ],
  build: {
    minify: false,
    rollupOptions: {
      input: { datasets: fileURLToPath(new URL("./src/data/load-dataset.ts", import.meta.url)) },
      preserveEntrySignatures: "strict",
    },
  },
});
