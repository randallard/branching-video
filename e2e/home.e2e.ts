// The home page's Import All / Export All (ADR-0007, ADR-0011) and its draft rows — including the
// real ukulele export, the file that started the event-log migration.
import {
  UKULELE_TITLE,
  assertClean,
  draftTitles,
  expect,
  exportAll,
  field,
  fixture,
  gotoHome,
  importAll,
  newDevice,
  test,
} from "./support/app.ts";

test("Import All accepts a single-show config file", async ({ app: { page, dialogs } }) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/^Import complete: 1 config\(s\) added\.$/);
  await expect(draftTitles(page)).toHaveText([UKULELE_TITLE]);
});

test("re-importing a same-titled config asks, and OK updates the existing draft", async ({
  app: { page, dialogs },
}) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/1 config\(s\) added/);
  dialogs.confirm(true);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/^Import complete: 1 config\(s\) updated\.$/);
  expect(dialogs.asked.at(-1)).toContain(`A draft titled "${UKULELE_TITLE}" already exists.`);
  await expect(draftTitles(page)).toHaveCount(1);
});

test("re-importing and choosing Cancel adds a separate draft, and says added", async ({
  app: { page, dialogs },
}) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/1 config\(s\) added/);
  dialogs.confirm(false);
  await importAll(page, [fixture("ukulele.json")]);
  await expect.poll(() => dialogs.alerts.length).toBe(2);
  expect(dialogs.alerts[1]).toBe("Import complete: 1 config(s) added.");
  await expect(draftTitles(page)).toHaveText([UKULELE_TITLE, UKULELE_TITLE]);
});

test("Import All migrates an old bvp-backup file", async ({ app: { page, dialogs } }) => {
  await gotoHome(page);
  await importAll(page, [fixture("legacy-backup.json")]);
  await dialogs.alert(/^Import complete: 1 legacy backup file\(s\) migrated\.$/);
  await expect(draftTitles(page)).toHaveText(["Old Draft From Before"]);
});

test("Import All classifies each file of a multi-file selection on its own", async ({
  app: { page, dialogs },
}, testInfo) => {
  const junk = testInfo.outputPath("not-json.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(junk, "this is not json");
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json"), fixture("legacy-backup.json"), junk]);
  await dialogs.alert(
    /^Import complete: 1 legacy backup file\(s\) migrated, 1 config\(s\) added, 1 file\(s\) could not be read\.$/
  );
  await expect(draftTitles(page)).toHaveCount(2);
});

test("Export All then Import All in a fresh browser reproduces the drafts, and a second import is a no-op", async ({
  app: { page, dialogs },
  browser,
}, testInfo) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json"), fixture("legacy-backup.json")]);
  await dialogs.alert(/Import complete/);
  const bundle = await exportAll(page, testInfo.outputPath("bundle.json"));

  const other = await newDevice(browser);
  await gotoHome(other.page);
  await importAll(other.page, [bundle]);
  await other.dialogs.alert(/^Import complete: \d+ event\(s\) merged\.$/);
  await expect(draftTitles(other.page)).toHaveText(await draftTitles(page).allTextContents());

  await importAll(other.page, [bundle]);
  await other.dialogs.alert(/^Nothing to import\.$/);
  await expect(draftTitles(other.page)).toHaveCount(2);
  assertClean(other);
  await other.context.close();
});

test("a draft's Studio link resumes that draft in Studio", async ({ app: { page, dialogs } }) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/added/);
  await page.locator("#local-shows .draft .studio-link").click();
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.locator("#nodeTableBody tr")).toHaveCount(11);
});

test("a draft's Editor link opens it in the Editor, which asks before updating the same-titled draft", async ({
  app: { page, dialogs, context },
}) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/added/);
  dialogs.confirm(true);
  const popup = context.waitForEvent("page");
  await page.locator("#local-shows .draft .editor-link").click();
  const editor = await popup;
  await expect(field(editor, "#showSettings", "Title").locator("input")).toHaveValue(UKULELE_TITLE);
  await expect(editor.locator("#nodeList .node-item")).toHaveCount(11);

  await page.reload();
  await expect(draftTitles(page)).toHaveCount(1);
});

test("a draft's Play link opens it in the player", async ({ app: { page, dialogs, context } }) => {
  await gotoHome(page);
  await importAll(page, [fixture("ukulele.json")]);
  await dialogs.alert(/added/);
  const popup = context.waitForEvent("page");
  await page.locator("#local-shows .draft .play-link").click();
  const player = await popup;
  await expect(player.locator("#show-title")).toHaveText(UKULELE_TITLE);
  await expect(player.locator("#node-title")).toHaveText("intro");
});
