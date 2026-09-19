// Phone-width layout (viewport emulation — a real phone stays on the manual list in e2e/README.md).
import { devices } from "@playwright/test";
import { badge, expect, field, fixture, gotoEditor, gotoHome, test } from "./support/app.ts";

test.use({ ...devices["Pixel 7"] });

test("the Editor's drawer lists nodes, picks one, and closes", async ({ app: { page } }) => {
  await gotoEditor(page);
  await page.locator("#fileInput").setInputFiles(fixture("branching.json"));
  await expect(page.locator("#mobile-menu-btn")).toBeVisible();

  await page.locator("#mobile-menu-btn").click();
  await expect(page.locator("#mobile-drawer")).toHaveClass(/open/);
  await expect(page.locator("#mobileNodeList .node-item")).toHaveCount(6);
  await page.locator("#mobileNodeList .node-item", { hasText: "right" }).click();
  await expect(page.locator("#mobile-drawer")).not.toHaveClass(/open/);
  await expect(field(page, "#editor", "Title").locator("input")).toHaveValue("Right path");
});

test("show settings in the drawer carry history too", async ({ app: { page } }) => {
  await gotoEditor(page);
  await page.locator("#fileInput").setInputFiles(fixture("branching.json"));
  await page.locator("#mobile-menu-btn").click();
  const title = field(page, "#mobileShowSettings", "Title");
  await title.locator("input").fill("Edited on a phone");
  await expect(badge(title)).toHaveText("⟲ 1");
  await expect(badge(title)).toBeVisible();
});

test("the drawer's My Drafts picks a draft by number", async ({ app: { page, dialogs } }) => {
  await gotoEditor(page);
  await page.locator("#fileInput").setInputFiles(fixture("branching.json"));
  // The page shows the import only once it's stored — wait for that before navigating away.
  await expect(field(page, "#editor", "Title").locator("input")).toHaveValue("Intro");
  await gotoEditor(page);
  await page.locator("#mobile-menu-btn").click();
  dialogs.prompt("1");
  await page.locator("#mobileMyDraftsBtn").click();
  await expect(field(page, "#editor", "Title").locator("input")).toHaveValue("Intro");
});

for (const path of ["index.html", "editor.html", "studio.html", "player.html?config=e2e-fixtures/branching.json"]) {
  test(`${path} doesn't scroll sideways at phone width`, async ({ app: { page } }) => {
    if (path === "index.html") await gotoHome(page);
    else await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
