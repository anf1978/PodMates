import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./offline";

async function expectAccessible(page: Page, view: string) {
  const results = await new AxeBuilder({ page }).analyze();
  // Design-deferred: the hardcoded teal combo badge is 4.45:1, not 4.5:1.
  // Only that exact colour pair/ratio is waived; no other rule or node is excluded.
  // See docs/architecture.md, Accessibility, before changing this exception.
  const violations = results.violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) =>
          !(
            violation.id === "color-contrast" &&
            node.html.includes('data-contrast-review="combo-warp"') &&
            node.any.some(
              ({ data }) =>
                data?.fgColor === "#06201f" &&
                data?.bgColor === "#3d8f8a" &&
                data?.contrastRatio === 4.45,
            )
          ),
      ),
    }))
    .filter(({ nodes }) => nodes.length);
  await test.info().attach(`axe-${view}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  expect
    .soft(
      violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
      `${view}: serious/critical accessibility violations`,
    )
    .toEqual([]);
}

test("main views have no serious or critical axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await expectAccessible(page, "deck-form");

  await page.getByRole("button", { name: "Try a Deck", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Try a Deck", exact: true })).toBeVisible();
  await expectAccessible(page, "try-a-deck-home");
  await page.getByRole("button", { name: /Browse by Archetype/ }).click();
  await expectAccessible(page, "try-a-deck");
  await page.getByRole("button", { name: /^Voltron\b/ }).click();
  await page.getByRole("button", { name: /Commander:.*Uril, the Miststalker/ }).click();
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText(/^Charted /);
  for (const details of await page.locator("#resultsSection details").all()) {
    if ((await details.getAttribute("open")) === null) {
      await details.locator(":scope > summary").click();
    }
  }
  await expectAccessible(page, "chart");

  await page.locator("#resultsSection button.info-btn:visible").first().click();
  await expectAccessible(page, "info-dialog");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create an Account" })).toBeVisible();
  await expectAccessible(page, "sign-in");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Log In", exact: true })).toBeFocused();
  await expectAccessible(page, "log-in");
});
