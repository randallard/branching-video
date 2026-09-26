// The Editor: draft-first autosave, per-field history (ADR-0023), edit-burst coalescing
// (ADR-0007), node add/delete, validation, and every way a show gets in or out.
import type { Page } from "@playwright/test";
import {
  UKULELE_TITLE,
  VIDEO_TITLE,
  badge,
  expect,
  field,
  fixture,
  gotoEditor,
  historyValues,
  openDraftInEditor,
  reopenUntil,
  test,
} from "./support/app.ts";

async function load(page: Page, name: string, title: string): Promise<void> {
  await gotoEditor(page);
  await page.locator("#fileInput").setInputFiles(fixture(name));
  await expect(field(page, "#showSettings", "Title").locator("input")).toHaveValue(title);
}

const nodeField = (page: Page, label: string) => field(page, "#editor", label);
const showField = (page: Page, label: string) => field(page, "#showSettings", label);

test("a typing burst is one edit, and the field's history lists what it was (ADR-0007, ADR-0023)", async ({
  app: { page },
}) => {
  await load(page, "branching.json", "E2E Branching");
  const title = nodeField(page, "Title");
  await expect(title.locator("input")).toHaveValue("Intro");
  await expect(badge(title)).toBeHidden();

  await title.locator("input").fill("");
  await title.locator("input").pressSequentially("Welcome", { delay: 40 });
  // One burst → one prior value. Per-keystroke saves would list "W", "We", … as well.
  await expect(badge(title)).toHaveText("⟲ 1");
  await expect(page.locator("#nodeList .node-item.active .ttl")).toHaveText("Welcome");

  await title.locator("input").fill("Opening");
  await expect(badge(title)).toHaveText("⟲ 2");
  expect(await historyValues(title)).toEqual(['"Welcome"', '"Intro"']);
  await expect(title.locator(".hist-meta")).toHaveText([/^edited /, /^imported /]);

  await title.locator(".hist-row").nth(1).locator(".hist-use").click();
  const after = nodeField(page, "Title");
  await expect(after.locator("input")).toHaveValue("Intro");
  await expect(page.locator("#nodeList .node-item.active .ttl")).toHaveText("Intro");
  expect(await historyValues(after)).toEqual(['"Opening"', '"Welcome"']);
});

test("every kind of field gets history: show title, number, checkbox, select, choices, end screen", async ({
  app: { page },
}) => {
  await load(page, "branching.json", "E2E Branching");

  await showField(page, "Title").locator("input").fill("Renamed show");
  await expect(badge(showField(page, "Title"))).toHaveText("⟲ 1");

  await nodeField(page, "Start (s)").locator("input").fill("1.5");
  await expect(badge(nodeField(page, "Start (s)"))).toHaveText("⟲ 1");
  expect(await historyValues(nodeField(page, "Start (s)"))).toEqual(["0"]);

  const aside = page.locator("#editor .check-row", { hasText: "Is aside" });
  await aside.locator("input").check();
  await page.locator("#editor .check-row", { hasText: "Is aside" }).locator("input").uncheck();
  await expect(badge(page.locator("#editor .check-row", { hasText: "Is aside" }))).toHaveText("⟲ 1");

  await showField(page, "Start node").locator("select").selectOption("right");
  await expect(badge(showField(page, "Start node"))).toHaveText("⟲ 1");

  await page.locator("#editor .choice").first().locator("button[title='Remove choice']").click();
  const choicesCard = page.locator("#editor .card", { has: page.locator("h2", { hasText: "Choices" }) });
  await expect(badge(choicesCard)).toHaveText("⟲ 1");
  expect(await historyValues(choicesCard)).toEqual(["2 choices: Left → left; Right → right"]);
  await choicesCard.locator(".hist-use").click();
  await expect(page.locator("#editor .choice")).toHaveCount(2);

  await page.locator("#nodeList .node-item", { hasText: "finale" }).click();
  await field(page, "#editor", "Heading").locator("input").fill("Finished");
  const endCard = page.locator("#editor .card", { has: page.locator("h2", { hasText: "End screen" }) });
  await expect(badge(endCard)).toHaveText("⟲ 1");
  expect(await historyValues(endCard)).toEqual(['"All done", 2 links']);
});

test("restoring an old node id renames it back and carries every reference with it", async ({
  app: { page },
}) => {
  await load(page, "branching.json", "E2E Branching");
  const id = () => nodeField(page, "Node id");
  await id().locator("input").fill("hello");
  await id().locator("input").press("Enter");
  await expect(showField(page, "Start node").locator("select")).toHaveValue("hello");
  expect(await historyValues(id())).toEqual(['"intro"']);

  await id().locator(".hist-use").click();
  await expect(id().locator("input")).toHaveValue("intro");
  await expect(showField(page, "Start node").locator("select")).toHaveValue("intro");
  await page.locator("#nodeList .node-item", { hasText: "dive" }).click();
  await expect(nodeField(page, "Return to").locator("select")).toHaveValue("left");
});

test("edits autosave with no explicit save, and history survives a reload", async ({ app: { page } }) => {
  await load(page, "branching.json", "E2E Branching");
  await nodeField(page, "Title").locator("input").fill("Kept");
  await expect(badge(nodeField(page, "Title"))).toHaveText("⟲ 1");

  await openDraftInEditor(page, "E2E Branching");
  await expect(nodeField(page, "Title").locator("input")).toHaveValue("Kept");
  await expect(badge(nodeField(page, "Title"))).toHaveText("⟲ 1");
});

test("an edit still waiting on its pause is saved when the draft is switched", async ({ app: { page } }) => {
  await load(page, "branching.json", "E2E Branching");
  await page.locator("#fileInput").setInputFiles(fixture("ukulele.json")); // a second, different show
  await expect(showField(page, "Title").locator("input")).toHaveValue(UKULELE_TITLE);
  await openDraftInEditor(page, "E2E Branching");
  await nodeField(page, "Title").locator("input").fill("Typed then switched");
  // Switch immediately — well inside the 1 s edit-burst window.
  await page.locator("#myDraftsBtn").click();
  await page.locator("#myDraftsMenu .dd-item").filter({ hasNotText: "E2E Branching" }).first().click();
  await expect(showField(page, "Title").locator("input")).toHaveValue(UKULELE_TITLE);

  // Had the save followed the switch, it would have landed on the ukulele show instead.
  await reopenUntil(page, "E2E Branching", async () => {
    await expect(nodeField(page, "Title").locator("input")).toHaveValue("Typed then switched", { timeout: 250 });
  });
  await openDraftInEditor(page, "E2E Branching");
  await expect(nodeField(page, "Title").locator("input")).toHaveValue("Typed then switched");
});

test("leaving a field saves its edit at once, without waiting out the edit burst", async ({ app: { page } }) => {
  // Frozen timers: the 1 s debounce can't fire, so only the focusout flush can save.
  await page.clock.install();
  await load(page, "branching.json", "E2E Branching");
  await page.clock.pauseAt(Date.now() + 60_000);
  const title = nodeField(page, "Title");

  await title.locator("input").fill("Still typing");
  await page.waitForTimeout(300);
  await expect(badge(title)).toBeHidden(); // mid-burst: nothing written yet

  await nodeField(page, "Video ID").locator("input").focus(); // leave the field
  await expect(badge(title)).toHaveText("⟲ 1");
});

test("an edit made as the tab closes is recovered by the next page (unload backstop)", async ({
  app,
}) => {
  const { page, context } = app;
  await load(page, "branching.json", "E2E Branching");
  // This tab's IndexedDB writes never land — the disk losing the race with the closing tab — so
  // only the localStorage backstop can carry the edit over.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied to each instance below
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<typeof transaction>) {
      if (args[1] === "readwrite") throw new Error("simulated: tab closed mid-write");
      return transaction.apply(this, args);
    };
  });
  app.allow.push(/simulated: tab closed mid-write/);

  await nodeField(page, "Title").locator("input").fill("Typed as the tab closed");
  await page.close({ runBeforeUnload: true });

  const next = await context.newPage();
  await openDraftInEditor(next, "E2E Branching");
  await expect(nodeField(next, "Title").locator("input")).toHaveValue("Typed as the tab closed");
  await expect(badge(nodeField(next, "Title"))).toHaveText("⟲ 1");
});

test("adding and deleting nodes persists, and validation reacts to a broken reference", async ({
  app: { page, dialogs },
}) => {
  await load(page, "branching.json", "E2E Branching");
  await expect(page.locator("#validation .status-ok")).toHaveText("✓ Valid");

  await page.locator("#addNodeBtn").click();
  await expect(page.locator("#nodeList .node-item")).toHaveCount(7);

  await page.locator("#nodeList .node-item", { hasText: "left" }).first().click();
  dialogs.confirm(true);
  await page.locator("#editor button.danger", { hasText: "Delete node" }).click();
  await expect(page.locator("#nodeList .node-item")).toHaveCount(6);
  await expect(page.locator("#validation .status-err")).toBeVisible();
  await expect(page.locator("#validation .v-item.err").first()).toContainText("left");

  await reopenUntil(page, "E2E Branching", async () => {
    await expect(page.locator("#nodeList .node-item")).toHaveCount(6, { timeout: 250 });
  });
  await openDraftInEditor(page, "E2E Branching");
  await expect(page.locator("#nodeList .node-item")).toHaveCount(6);
  await expect(page.locator("#nodeList .node-item .id")).not.toContainText(["left"]);
});

test("Export As… downloads the show when the save picker isn't available", async ({ app: { page, dialogs } }) => {
  await page.addInitScript(() => {
    Object.assign(window, { showSaveFilePicker: undefined, showOpenFilePicker: undefined });
  });
  await load(page, "branching.json", "E2E Branching");
  // A loaded file has a name, so the button offers Export; with no handle it still asks for one.
  await expect(page.locator("#saveBtn")).toHaveText("Export");

  dialogs.prompt("my-show");
  const download = page.waitForEvent("download");
  await page.locator("#saveBtn").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("my-show.json");
  const text = await (await file.createReadStream()).toArray();
  const saved = JSON.parse(Buffer.concat(text).toString("utf8")) as { title: string; nodes: unknown[] };
  expect(saved.title).toBe("E2E Branching");
  expect(saved.nodes).toHaveLength(6);
  await expect(page.locator("#saveBtn")).toHaveText("Export");
});

test("Export As… writes through the save picker, and Export writes to the same file again", async ({
  app: { page, dialogs },
}) => {
  await page.addInitScript(() => {
    const saved: string[] = [];
    Object.defineProperty(navigator, "userAgentData", { value: { brands: [{ brand: "Chromium" }] } });
    Object.assign(window, {
      __saved: saved,
      showOpenFilePicker: undefined,
      showSaveFilePicker: (o: { suggestedName: string }) =>
        Promise.resolve({
          name: o.suggestedName,
          createWritable: () => {
            let text = "";
            return Promise.resolve({
              write: (t: string) => {
                text += t;
                return Promise.resolve();
              },
              close: () => {
                saved.push(text);
                return Promise.resolve();
              },
            });
          },
        }),
    });
  });
  await load(page, "branching.json", "E2E Branching");
  const saves = () => page.evaluate(() => (window as unknown as { __saved: string[] }).__saved);

  dialogs.prompt("picked");
  await page.locator("#saveBtn").click();
  await expect.poll(async () => (await saves()).length).toBe(1);
  await expect(page.locator("#filename")).toHaveText("picked.json · exported");
  await expect(page.locator("#saveBtn")).toHaveText("Export");

  await nodeField(page, "Title").locator("input").fill("Changed");
  await page.locator("#saveBtn").click(); // no prompt this time
  await expect.poll(async () => (await saves()).length).toBe(2);
  expect((JSON.parse((await saves())[1] ?? "{}") as { nodes: { title: string }[] }).nodes[0]?.title).toBe("Changed");
});

test("Open… uses the file chooser when the open picker isn't available", async ({ app: { page } }) => {
  await page.addInitScript(() => {
    Object.assign(window, { showOpenFilePicker: undefined });
  });
  await gotoEditor(page);
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#loadBtn").click();
  await (await chooser).setFiles(fixture("branching.json"));
  await expect(showField(page, "Title").locator("input")).toHaveValue("E2E Branching");
});

test("Copy JSON puts the show on the clipboard", async ({ app: { page, context } }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await load(page, "branching.json", "E2E Branching");
  await page.locator("#copyBtn").click();
  await expect(page.locator("#copyBtn")).toHaveText("Copied!");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect((JSON.parse(text) as { title: string }).title).toBe("E2E Branching");
});

test("New… from a video URL starts a draft titled from the video", async ({ app: { page, dialogs } }) => {
  await gotoEditor(page);
  dialogs.prompt("https://youtu.be/Jvu5VZVe3MI");
  await page.locator("#newBtn").click();
  await expect(showField(page, "Title").locator("input")).toHaveValue(VIDEO_TITLE);
  await expect(showField(page, "Master video ID").locator("input")).toHaveValue("Jvu5VZVe3MI");
  await expect(page.locator("#nodeList .node-item .id")).toHaveText(["intro"]);
  // The title arrives after the draft is created, as a second save.
  await reopenUntil(page, VIDEO_TITLE, async () => {
    await expect(showField(page, "Title").locator("input")).toHaveValue(VIDEO_TITLE, { timeout: 250 });
  });
  await openDraftInEditor(page, VIDEO_TITLE);
});

test("visiting the Editor without editing creates no draft", async ({ app: { page } }) => {
  await gotoEditor(page);
  await page.locator("#myDraftsBtn").click();
  await expect(page.locator("#myDraftsMenu .dd-empty")).toBeVisible();
});

test("Open in Studio needs a master video", async ({ app: { page, dialogs } }) => {
  await gotoEditor(page);
  await showField(page, "Master video ID").locator("input").fill("");
  await page.locator("#studioBtn").click();
  await dialogs.alert(/Studio works from a single master video/);
});
