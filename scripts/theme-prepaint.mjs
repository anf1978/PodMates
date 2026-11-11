// Inlines the colour-theme pre-paint script. index.html references it as
//   <script id="theme-script" src="./src/features/themes/prepaint.ts"></script>
// which is not runnable as written: it must run synchronously in <head>, before first paint, and
// module scripts are always deferred. Both the dev server and the production build replace the tag
// with the file bundled as a classic IIFE, inline, before the CSP hashes are computed.
import { fileURLToPath } from "node:url";
import { build } from "vite";

export const PREPAINT_SRC = "./src/features/themes/prepaint.ts";
const entry = fileURLToPath(new URL("../src/features/themes/prepaint.ts", import.meta.url));
const tag = `<script id="theme-script" src="${PREPAINT_SRC}"></script>`;

async function bundlePrepaint() {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    build: {
      write: false,
      minify: false,
      emptyOutDir: false,
      modulePreload: false,
      rollupOptions: { input: entry, output: { format: "iife" } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const chunks = outputs.filter((o) => o.type === "chunk");
  if (chunks.length !== 1) throw new Error(`Theme pre-paint must bundle to one chunk`);
  const code = chunks[0].code.trim();
  if (/<\/script/i.test(code)) throw new Error("Theme pre-paint contains </script");
  return code;
}

export async function inlineThemePrepaint(html) {
  if (!html.includes(tag)) throw new Error(`index.html is missing ${tag}`);
  const code = await bundlePrepaint();
  return html.replace(tag, () => `<script id="theme-script">\n${code}\n</script>`);
}
