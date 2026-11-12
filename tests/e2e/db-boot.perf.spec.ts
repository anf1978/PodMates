import { devices } from "@playwright/test";
import { test, expect } from "./offline";

test.use({ ...devices["Pixel 5"] });
test.skip(!process.env.PM_BOOT_BENCHMARK, "Opt-in mobile boot benchmark");

for (let run = 1; run <= 3; run++) {
  test(`mobile boot blocking, run ${run}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 93_750,
    });
    await page.addInitScript(() => {
      performance.mark("pm-boot-start");
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          performance.measure("pm-boot-longtask", {
            start: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
      // DB-ready enables Chart Deck; mark the moment its disabled attribute goes.
      new MutationObserver((changes, observer) => {
        const button = document.getElementById("chartBtn");
        if (changes.length && button && !button.hasAttribute("disabled")) {
          performance.mark("pm-boot-ready");
          observer.disconnect();
        }
      }).observe(document, { attributes: true, attributeFilter: ["disabled"], subtree: true });
    });
    await page.goto("/");
    await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/, {
      timeout: 100_000,
    });
    const metrics = await page.evaluate(() => {
      const end = performance.getEntriesByName("pm-boot-ready")[0].startTime;
      const tasks = performance
        .getEntriesByName("pm-boot-longtask")
        .filter((entry) => entry.startTime < end);
      return {
        bootMs: end,
        blockingMs: tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
        longestTaskMs: Math.max(0, ...tasks.map((task) => task.duration)),
        longTasks: tasks.length,
        indexHydrationMs: performance.getEntriesByName("pm-card-index-hydration")[0]?.duration ?? 0,
      };
    });
    console.log(`Mobile boot ${run}: ${JSON.stringify(metrics)}`);
    await testInfo.attach("mobile-boot.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
  });
}
