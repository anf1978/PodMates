// Battle controls only appear for a live Gathering battle, which needs a signed-in pod. This runs
// on the Vite dev server ("modules" project) and sets the battle through the page's own modules.
import { test, expect } from "./offline";
import { BATTLE, withModules } from "./modules";

const CONTROLS = "/src/features/chronicles/battle.ts";

test("battle controls confirm logging and keep post-battle choices host-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  // Feed the comparison handoff without authenticating or writing to Firestore.
  await withModules(
    page,
    { battle: BATTLE, controls: CONTROLS },
    `battle.setBattleContext({ podId: 'fixture-pod', gatheringId: 'fixture-battle',
      isHost: true, participants: [] });
    document.getElementById('podResultsSection').style.display = 'block';
    controls.renderBattleControls();`,
  );
  await page.getByRole("button", { name: "Log Battle", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("This can’t be undone.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#logBattleBtn")).toBeFocused();
  await withModules(
    page,
    { battle: BATTLE, controls: CONTROLS },
    "battle.battleContext().loggedChronicleId = 'logged'; controls.renderBattleControls();",
  );
  await expect(page.locator("#repeatBattleBtn")).toBeVisible();
  await expect(page.locator("#startNewBattleBtn")).toBeVisible();
  await withModules(
    page,
    { battle: BATTLE, controls: CONTROLS },
    "battle.battleContext().isHost = false; controls.renderBattleControls();",
  );
  await expect(page.locator("#battleControlsArea")).toContainText("thanks for playing");
  await expect(page.locator("#repeatBattleBtn")).toHaveCount(0);
});
