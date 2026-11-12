// index.html is a static shell: markup, CSS and exactly two external scripts -- the module entry
// and the theme pre-paint placeholder that the build inlines. All behaviour lives in src/.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(
  /<!--[\s\S]*?-->/g,
  "",
);

it("has no inline scripts or inline event handlers", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  expect(scripts.map((match) => match[1].trim())).toEqual([
    'type="module" src="./src/main.ts"',
    'id="theme-script" src="./src/features/themes/prepaint.ts"',
  ]);
  expect(scripts.every((match) => match[2].trim() === "")).toBe(true);
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
});
