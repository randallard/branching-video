// Two devices merging through Export All / Import All — each a separate browser context with its
// own IndexedDB. Per-field last-writer-wins (ADR-0008), the recoverable loser (ADR-0023), and a
// delete-versus-edit collision that asks (ADR-0024).
import type { TestInfo } from "@playwright/test";
import {
  UKULELE_TITLE,
  assertClean,
  badge,
  expect,
  exportAll,
  field,
  fixture,
  gotoHome,
  historyValues,
  importAll,
  newDevice,
  openDraftInEditor,
  test as base,
} from "./support/app.ts";
import type { Device } from "./support/app.ts";

/** Extra devices for one test, each checked and closed when the test ends. */
const test = base.extend<{ device: () => Promise<Device> }>({
  device: async ({ browser }, use) => {
    const made: Device[] = [];
    await use(async () => {
      const d = await newDevice(browser);
      made.push(d);
      return d;
    });
    for (const d of made) {
      assertClean(d);
      await d.context.close();
    }
  },
});

/** Hand `from`'s whole log to `to`, the way a person would: Export All, then Import All. */
async function sync(from: Device, to: Device, testInfo: TestInfo, name: string): Promise<void> {
  await gotoHome(from.page);
  const bundle = await exportAll(from.page, testInfo.outputPath(`${name}.json`));
  await gotoHome(to.page);
  await importAll(to.page, [bundle]);
  await to.dialogs.alert(/Import complete|Nothing to import/);
}

/** Both devices start from the same show: the laptop imports the file, the phone takes its bundle. */
async function sharedStart(
  device: () => Promise<Device>,
  testInfo: TestInfo
): Promise<{ laptop: Device; phone: Device }> {
  const laptop = await device();
  const phone = await device();
  await gotoHome(laptop.page);
  await importAll(laptop.page, [fixture("ukulele.json")]);
  await laptop.dialogs.alert(/1 config\(s\) added/);
  await sync(laptop, phone, testInfo, "start");
  return { laptop, phone };
}

async function editNodeTitle(d: Device, value: string): Promise<void> {
  await openDraftInEditor(d.page, UKULELE_TITLE);
  const title = field(d.page, "#editor", "Title");
  await title.locator("input").fill(value);
  await expect(badge(title)).toBeVisible(); // the edit has landed in the store
}

test("the same field edited on two devices: the later edit wins, the other is one click away (ADR-0023)", async ({ device }, testInfo) => {
  const { laptop, phone } = await sharedStart(device, testInfo);
  await editNodeTitle(phone, "Edited on the phone");
  await editNodeTitle(laptop, "Edited on the laptop"); // later, so it wins

  await sync(phone, laptop, testInfo, "phone");
  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  const title = field(laptop.page, "#editor", "Title");
  await expect(title.locator("input")).toHaveValue("Edited on the laptop");
  expect(await historyValues(title)).toEqual(['"Edited on the phone"', '"intro"']);

  await title.locator(".hist-use").first().click();
  await expect(field(laptop.page, "#editor", "Title").locator("input")).toHaveValue("Edited on the phone");

  // And the phone converges on whatever the laptop now says.
  await sync(laptop, phone, testInfo, "laptop");
  await openDraftInEditor(phone.page, UKULELE_TITLE);
  await expect(field(phone.page, "#editor", "Title").locator("input")).toHaveValue("Edited on the phone");
});

test("different fields edited on two devices both survive the merge (ADR-0008)", async ({ device }, testInfo) => {
  const { laptop, phone } = await sharedStart(device, testInfo);
  await editNodeTitle(phone, "Phone's title");

  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  const end = field(laptop.page, "#editor", "End (s)");
  await end.locator("input").fill("50");
  await expect(badge(end)).toBeVisible();

  await sync(phone, laptop, testInfo, "phone");
  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  await expect(field(laptop.page, "#editor", "Title").locator("input")).toHaveValue("Phone's title");
  await expect(field(laptop.page, "#editor", "End (s)").locator("input")).toHaveValue("50");
});

test("a node deleted on one device while edited on the other asks, and can come back (ADR-0024)", async ({ device }, testInfo) => {
  const { laptop, phone } = await sharedStart(device, testInfo);

  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  await laptop.page.locator("#nodeList .node-item", { hasText: "string-names-2" }).click();
  laptop.dialogs.confirm(true);
  await laptop.page.locator("#editor button.danger", { hasText: "Delete node" }).click();
  await expect(laptop.page.locator("#nodeList .node-item")).toHaveCount(10);

  await openDraftInEditor(phone.page, UKULELE_TITLE);
  await phone.page.locator("#nodeList .node-item", { hasText: "string-names-2" }).click();
  const title = field(phone.page, "#editor", "Title");
  await title.locator("input").fill("Still wanted this");
  await expect(badge(title)).toBeVisible();

  laptop.dialogs.confirm(true); // "bring the node back"
  await sync(phone, laptop, testInfo, "phone");
  expect(laptop.dialogs.asked.at(-1)).toMatch(/was edited at .* but it was deleted at .*1 edit\(s\) would be lost/s);

  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  await expect(laptop.page.locator("#nodeList .node-item")).toHaveCount(11);
});

test("answering Cancel to a collision leaves the node deleted, and doesn't ask again", async ({ device }, testInfo) => {
  const { laptop, phone } = await sharedStart(device, testInfo);

  await openDraftInEditor(laptop.page, UKULELE_TITLE);
  await laptop.page.locator("#nodeList .node-item", { hasText: "notes-bc-ef" }).click();
  laptop.dialogs.confirm(true);
  await laptop.page.locator("#editor button.danger", { hasText: "Delete node" }).click();

  await openDraftInEditor(phone.page, UKULELE_TITLE);
  await phone.page.locator("#nodeList .node-item", { hasText: "notes-bc-ef" }).click();
  const title = field(phone.page, "#editor", "Title");
  await title.locator("input").fill("Edited after the delete");
  await expect(badge(title)).toBeVisible();

  laptop.dialogs.confirm(false); // leave it deleted
  await sync(phone, laptop, testInfo, "phone");
  await openDraftInEditor(laptop.page, UKULELE_TITLE); // a fresh boot: no second question
  await expect(laptop.page.locator("#nodeList .node-item")).toHaveCount(10);
});
