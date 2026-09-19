// Studio: marking nodes against the (fake) playing video, transport controls, import with
// update-or-add, and per-field history in the sidebar (ADR-0023).
import type { Page } from "@playwright/test";
import {
  UKULELE_TITLE,
  badge,
  draftTitles,
  expect,
  field,
  fixture,
  gotoHome,
  gotoStudio,
  historyValues,
  test,
  ytJump,
  ytReady,
  ytState,
  ytTime,
} from "./support/app.ts";

const rows = (page: Page) => page.locator("#nodeTableBody tr");
const cell = (page: Page, row: number, col: number) => rows(page).nth(row).locator("td").nth(col);

async function importUkulele(page: Page): Promise<void> {
  await page.locator("#importFile").setInputFiles(fixture("ukulele.json"));
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(rows(page)).toHaveCount(11);
}

test("mark node starts and ends against the playing video", async ({ app: { page, dialogs } }) => {
  await gotoStudio(page);
  await page.locator("#videoInput").fill("https://www.youtube.com/watch?v=Jvu5VZVe3MI");
  await page.locator("#titleInput").fill("Marked show");
  await page.locator("#startBtn").click();
  await expect(page.locator("#workspace")).toBeVisible();
  await ytReady(page);

  await ytJump(page, 12.3);
  dialogs.prompt("Opening");
  await page.locator("#markStartBtn").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(cell(page, 0, 0)).toHaveText("opening");
  await expect(cell(page, 0, 2)).toHaveText("0:12.3");
  await expect(cell(page, 0, 3)).toHaveText("—");

  await ytJump(page, 30);
  dialogs.prompt("Second part");
  await page.locator("#markStartBtn").click();
  await expect(rows(page)).toHaveCount(2);
  await expect(cell(page, 1, 0)).toHaveText("second-part");
  await expect(cell(page, 0, 3)).toHaveText("0:30.0"); // the open node was closed at the new start

  await ytJump(page, 41.5);
  await page.locator("#setEndBtn").click();
  await expect(cell(page, 1, 3)).toHaveText("0:41.5");

  await gotoHome(page);
  await expect(draftTitles(page)).toHaveText(["Marked show"]);
});

test("a blank title is filled from the video's own title", async ({ app: { page } }) => {
  await gotoStudio(page);
  await page.locator("#videoInput").fill("Jvu5VZVe3MI");
  await page.locator("#startBtn").click();
  await expect(page.locator("#workspace")).toBeVisible();
  await expect.poll(async () => {
    await gotoHome(page);
    return draftTitles(page).allTextContents();
  }).toEqual(["Fake Video Title"]);
});

test("transport: play/pause button, Space, and arrow-key seeking", async ({ app: { page } }) => {
  await gotoStudio(page);
  await page.locator("#videoInput").fill("Jvu5VZVe3MI");
  await page.locator("#titleInput").fill("Transport");
  await page.locator("#startBtn").click();
  await ytReady(page);
  await expect.poll(() => ytState(page)).toBe(5); // cued

  await page.locator("#playPauseBtn").click();
  await expect(page.locator("#playPauseBtn")).toHaveText("⏸");
  await page.locator("#playPauseBtn").click();
  await expect(page.locator("#playPauseBtn")).toHaveText("▶");

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Space");
  await expect.poll(() => ytState(page)).toBe(1);
  await page.keyboard.press("Space");
  await expect.poll(() => ytState(page)).toBe(2);

  await ytJump(page, 20);
  await page.keyboard.press("ArrowRight");
  expect(await ytTime(page)).toBeCloseTo(21, 1);
  await page.keyboard.press("Shift+ArrowLeft");
  expect(await ytTime(page)).toBeCloseTo(16, 1);
});

test("Import config JSON asks update-or-add for a same-titled draft", async ({ app: { page, dialogs } }) => {
  await gotoStudio(page);
  await importUkulele(page);

  dialogs.confirm(true); // "Start a new show? Unsaved changes will be lost."
  await page.locator("#newBtn").click();
  await expect(page.locator("#setup")).toBeVisible();
  dialogs.confirm(false); // add as a separate draft
  await importUkulele(page);

  dialogs.confirm(true);
  await page.locator("#newBtn").click();
  dialogs.confirm(true); // update the existing one
  await importUkulele(page);

  expect(dialogs.asked.filter((q) => q.includes("already exists"))).toHaveLength(2);
  await gotoHome(page);
  await expect(draftTitles(page)).toHaveText([UKULELE_TITLE, UKULELE_TITLE]);
});

test("a legacy backup file is turned away with directions to the home page", async ({ app: { page } }) => {
  await gotoStudio(page);
  await page.locator("#importFile").setInputFiles(fixture("legacy-backup.json"));
  await expect(page.locator("#setup-err")).toContainText("full backup file");
  await expect(page.locator("#workspace")).toBeHidden();
});

test("the sidebar shows a field's earlier values, and Use restores one (ADR-0023)", async ({ app: { page } }) => {
  await gotoStudio(page);
  await importUkulele(page);
  await rows(page).first().click();
  const title = field(page, "#sidebar-body", "Title");
  await expect(badge(title)).toBeHidden();

  await title.locator("input").fill("Welcome");
  await title.locator("input").press("Enter");
  await expect(badge(title)).toHaveText("⟲ 1");
  await expect(cell(page, 0, 1)).toHaveText("Welcome");

  expect(await historyValues(title)).toEqual(['"intro"']);
  await expect(title.locator(".hist-meta")).toHaveText([/^imported /]);
  await title.locator(".hist-use").click();
  await expect(cell(page, 0, 1)).toHaveText("intro");
  const restored = field(page, "#sidebar-body", "Title");
  await expect(restored.locator("input")).toHaveValue("intro");
  expect(await historyValues(restored)).toEqual(['"Welcome"']);
});

test("resuming a draft from the setup screen picks it by number", async ({ app: { page, dialogs } }) => {
  await gotoStudio(page);
  await importUkulele(page);
  await page.reload();
  await expect(page.locator("#resumeBtn")).toBeEnabled();
  dialogs.prompt("1");
  await page.locator("#resumeBtn").click();
  await expect(rows(page)).toHaveCount(11);
});

test("Open in Editor and Play hand the show to those pages", async ({ app: { page, dialogs, context } }) => {
  await gotoStudio(page);
  await importUkulele(page);

  dialogs.confirm(true); // the Editor's update-or-add on receiving the transfer
  let popup = context.waitForEvent("page");
  await page.locator("#editBtn").click();
  const editor = await popup;
  await expect(field(editor, "#showSettings", "Title").locator("input")).toHaveValue(UKULELE_TITLE);

  popup = context.waitForEvent("page");
  await page.locator("#playBtn").click();
  const player = await popup;
  await expect(player.locator("#show-title")).toHaveText(UKULELE_TITLE);
  await expect(player.locator("#node-title")).toHaveText("intro");
});
