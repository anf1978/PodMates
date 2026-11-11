import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PM_E2E_PORT ?? 4183);
// `*.modules.spec.ts` drive flows that have no signed-out UI entry (sample Gathering, battle
// controls, trade dialogs) by importing the page's own modules, which only the Vite dev server
// serves by path. Everything else runs against the production build.
const devPort = port + 1;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/*.modules.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${port}` },
    },
    {
      name: "modules",
      testMatch: "**/*.modules.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${devPort}` },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${devPort} --strictPort`,
      url: `http://127.0.0.1:${devPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
