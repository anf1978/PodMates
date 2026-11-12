import type { Page } from "@playwright/test";

/**
 * Runs `body` in the page with the named modules imported from the Vite dev server (the "modules"
 * project). Dev serves each source file at its path, so these are the very module instances the
 * page itself uses. The body is a string so the test runner never transforms its `import()`.
 */
export function withModules<T = unknown>(
  page: Page,
  modules: Record<string, string>,
  body: string,
): Promise<T> {
  const imports = Object.entries(modules)
    .map(([name, path]) => `const ${name} = await import(${JSON.stringify(path)});`)
    .join("\n");
  return page.evaluate(`(async () => {\n${imports}\n${body}\n})()`) as Promise<T>;
}

export const EVENTS = "/src/services/events.ts";
export const BATTLE = "/src/app/battle.ts";
