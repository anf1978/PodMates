import { test, expect } from "./offline";

test("trade dialogs retain purchase validation, sale preview and price-check cancellation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.evaluate("psOpenTradeForm({card:'Sol Ring',paper:true,finish:'foil',yen:1200})");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Paper trade");
  await expect(page.locator("#psTfCard")).toHaveValue("Sol Ring");
  await expect(page.locator("#psTfFinish")).toHaveValue("foil");
  await page.locator("#psTfDate").fill("2026-10-09");
  await dialog.screenshot({ path: test.info().outputPath("trade-purchase.png") });
  await test.info().attach("trade-purchase", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await page.locator("#psTfQty").fill("0");
  await page.locator("#psTfSave").click();
  await expect(page.locator("#psTfStatus")).toContainText("How many: a whole number");
  await page.locator("#psTfCancel").click();
  await expect(dialog).toHaveCount(0);

  await page.evaluate(`psLedger.lots = [{
    id:'test-lot',card:'Sol Ring',key:'sol ring',paper:true,finish:'foil',
    qty:3,buyYen:1200,buyExtraYen:60,buyDate:'2026-10-01',shop:'',
    tag:'spoiler',note:'',sells:[],markYen:null,markDate:'',createdAt:1,updatedAt:1
  }]; psLedger.marks={'test-lot':1800}; psOpenSellForm('test-lot')`);
  await expect(dialog).toHaveAccessibleName("Record a sale");
  await page.locator("#psSfDate").fill("2026-10-09");
  await expect(page.locator("#psSfPreview")).toContainText("+¥940");
  await dialog.screenshot({ path: test.info().outputPath("trade-sale.png") });
  await test.info().attach("trade-sale", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await page.locator("#psSfQty").fill("4");
  await page.locator("#psSfSave").click();
  await expect(page.locator("#psSfStatus")).toHaveText("How many sold: 1 to 3.");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.evaluate("psOpenMarkForm('test-lot')");
  await expect(dialog).toHaveAccessibleName("My price check");
  await page.locator("#psMfDate").fill("2026-10-09");
  await dialog.screenshot({ path: test.info().outputPath("trade-price-check.png") });
  await test.info().attach("trade-price-check", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await page.locator("#psMfYen").fill("-1");
  await page.locator("#psMfSave").click();
  await expect(page.locator("#psMfStatus")).toContainText("Price: a whole number");
  await page.locator("#psMfCancel").click();
  await page.evaluate("psConfirmDeleteLot('test-lot')");
  await expect(dialog).toContainText("Delete this paper trade of 3 × Sol Ring?");
  await page.locator("#actionConfirmCancelBtn").click();
  await expect(dialog).toHaveCount(0);
});
