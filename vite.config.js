import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const legacyEntry = "\0podmates-legacy-entry";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "preserve-legacy-html",
      apply: "build",
      resolveId(id) {
        if (id === legacyEntry) return id;
      },
      load(id) {
        if (id === legacyEntry) return "";
      },
      generateBundle(_options, bundle) {
        // The placeholder lets Vite copy public/ without processing inline scripts.
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === "chunk" && output.facadeModuleId === legacyEntry) {
            delete bundle[fileName];
          }
        }
        this.emitFile({
          type: "asset",
          fileName: "index.html",
          source: readFileSync(new URL("./index.html", import.meta.url)),
        });
      },
    },
  ],
  build: {
    minify: false,
    rollupOptions: {
      input: legacyEntry,
    },
  },
});
