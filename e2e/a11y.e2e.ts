// ADR-0033: axe against every page, in the states a person actually sees. Any WCAG 2.1 A/AA
// violation fails, with axe's own rule, impact and selectors. Hermetic like the rest of the
// suite (the harness fakes YouTube), so a finding is about our markup, never the embed's.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, fixture, gotoEditor, gotoHome, gotoStudio, test, ytJump, ytReady } from "./support/app.ts";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact ?? "?"}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
  );
  expect(summary).toEqual([]);
}

test("the home page", async ({ app: { page } }) => {
  await gotoHome(page);
  await expectNoViolations(page);
});

test("the create page", async ({ app: { page } }) => {
  await page.goto("create.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoViolations(page);
});

test("the player, its choices, and its chapter menu", async ({ app: { page } }) => {
  await page.goto("player.html?config=e2e-fixtures/branching.json");
  await ytReady(page);
  await expectNoViolations(page);
  await ytJump(page, 9.9);
  await expect(page.locator("#choices .choice-btn")).toHaveCount(2);
  // The choices fade in (opacity, 350 ms); contrast measured mid-fade is a test artefact.
  await expect
    .poll(() => page.locator("#choices").evaluate((e) => getComputedStyle(e).opacity))
    .toBe("1");
  await expectNoViolations(page);
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#menu")).toHaveAttribute("aria-hidden", "false");
  await expectNoViolations(page);
});

test("Studio, empty and with a show loaded", async ({ app: { page } }) => {
  await gotoStudio(page);
  await expectNoViolations(page);
  await page.locator("#importFile").setInputFiles(fixture("ukulele.json"));
  await expect(page.locator("#workspace")).toBeVisible();
  await page.locator("#nodeTableBody tr").first().click();
  await expectNoViolations(page);
});

test("the Editor, empty and with a show loaded", async ({ app: { page } }) => {
  await gotoEditor(page);
  await expectNoViolations(page);
  await page.locator("#fileInput").setInputFiles(fixture("branching.json"));
  await expect(page.locator("#editor")).toBeVisible();
  await expectNoViolations(page);
});
