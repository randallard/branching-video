// Playback routing against the fake IFrame API: segment ends, choices, countdown, asides, end
// screens, the chapter menu and history navigation.
import type { Page } from "@playwright/test";
import { expect, test, ytJump, ytPause, ytPlay, ytRate, ytReady, ytTime } from "./support/app.ts";

async function play(page: Page, show: string, hash = ""): Promise<void> {
  await page.goto(`player.html?config=e2e-fixtures/${show}${hash}`);
  await ytReady(page);
}

const nodeTitle = (page: Page) => page.locator("#node-title");
const choices = (page: Page) => page.locator("#choices .choice-btn");

test("a show of no-choice nodes plays straight through every node to a wrap (ADR-0022)", async ({
  app: { page },
}) => {
  test.slow();
  await page.addInitScript(() => {
    const visited: string[] = [];
    (window as unknown as { __visited: string[] }).__visited = visited;
    const push = history.pushState.bind(history);
    history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      visited.push(String(url));
      push(data, unused, url);
    };
  });
  await play(page, "ukulele.json");
  await expect(nodeTitle(page)).toHaveText("intro");
  await ytRate(page, 200);

  await expect(page.locator("#end-heading")).toHaveText("That's a wrap.", { timeout: 30_000 });
  const visited = await page.evaluate(() => (window as unknown as { __visited: string[] }).__visited);
  expect(visited).toEqual([
    "#intro",
    "#string-names",
    "#string-names-2",
    "#notes-bc-ef",
    "#g-string-notes",
    "#strumming-count",
    "#strumming-count-concise",
    "#major-scale",
    "#major-scale-concise",
    "#chords-of-a-key",
    "#chords-of-a-key-concise",
  ]);
});

test("choices appear when a segment ends, and the default fires after the countdown", async ({ app: { page } }) => {
  await play(page, "branching.json");
  await expect(nodeTitle(page)).toHaveText("Intro");
  await ytJump(page, 9.9);
  await expect(choices(page)).toHaveText(["Left", "Right"]);
  await expect(page.locator("#countdown-wrap")).toBeVisible();
  await expect(nodeTitle(page)).toHaveText("Left path", { timeout: 5000 });
  await expect(choices(page)).toHaveCount(0);
});

test("clicking a choice goes to its target", async ({ app: { page } }) => {
  await play(page, "branching.json");
  await ytJump(page, 9.9);
  await page.locator("#choices .choice-btn", { hasText: "Right" }).click();
  await expect(nodeTitle(page)).toHaveText("Right path");
  expect(await ytTime(page)).toBeGreaterThanOrEqual(20);
});

test("pausing freezes the choice countdown", async ({ app: { page } }) => {
  await play(page, "branching.json");
  await ytJump(page, 9.9);
  await expect(choices(page)).toHaveCount(2);
  await ytPause(page);
  await page.waitForTimeout(2000); // twice the 1 s countdown
  await expect(nodeTitle(page)).toHaveText("Intro");
  await expect(choices(page)).toHaveCount(2);
  await ytPlay(page);
  await expect(nodeTitle(page)).toHaveText("Left path", { timeout: 5000 });
});

test("mid-segment choices appear at showChoicesAt, with no countdown when there's no default", async ({
  app: { page },
}) => {
  await play(page, "branching.json", "#left");
  await expect(nodeTitle(page)).toHaveText("Left path");
  await expect(choices(page)).toHaveCount(0);
  await ytJump(page, 12.5);
  await expect(choices(page)).toHaveText(["Deep dive"]);
  await expect(page.locator("#countdown-wrap")).toBeHidden();
});

test("an aside with returnAtCurrentTime offers a way back to the branch point", async ({ app: { page } }) => {
  await play(page, "branching.json", "#left");
  await ytJump(page, 12.5);
  await page.locator("#choices .choice-btn", { hasText: "Deep dive" }).click();
  await expect(nodeTitle(page)).toHaveText("The dive");
  await expect(page.locator("#aside-badge")).toHaveText("Deep dive");
  await expect(page.locator("#aside-badge")).toBeVisible();

  await page.locator("#back-btn").click();
  await expect(nodeTitle(page)).toHaveText("Left path");
  expect(Math.abs((await ytTime(page)) - 12.5)).toBeLessThan(1.5);
  // Resuming past the cue must not re-show the mid-segment choices.
  await page.waitForTimeout(600);
  await expect(choices(page)).toHaveCount(0);
});

test("an aside that reaches its end resumes at the branch point on its own", async ({ app: { page } }) => {
  await play(page, "branching.json", "#left");
  await ytJump(page, 13);
  await page.locator("#choices .choice-btn", { hasText: "Deep dive" }).click();
  await expect(nodeTitle(page)).toHaveText("The dive");
  await ytJump(page, 60.5);
  await expect(nodeTitle(page)).toHaveText("Left path");
  expect(Math.abs((await ytTime(page)) - 13)).toBeLessThan(1.5);
});

test("a default aside shows Skip → back to main, which returns to the main line", async ({ app: { page } }) => {
  await play(page, "branching.json", "#extra");
  await expect(nodeTitle(page)).toHaveText("Extra");
  await expect(page.locator("#aside-badge")).toHaveText("Aside");
  const skip = page.locator("#skip-btn");
  await expect(skip).toHaveText("Skip → back to main");
  await skip.click();
  await expect(nodeTitle(page)).toHaveText("Right path");
  await expect(skip).toBeHidden();
});

test("an end screen shows its heading, body and links, and an internal link navigates", async ({
  app: { page },
}) => {
  await play(page, "branching.json", "#finale");
  await expect(nodeTitle(page)).toHaveText("Finale");
  await ytJump(page, 49.95);
  const end = page.locator("#end-screen");
  await expect(end).toBeVisible();
  await expect(page.locator("#end-heading")).toHaveText("All done");
  await expect(page.locator("#end-body")).toHaveText("Thanks for watching");
  const site = end.locator("a", { hasText: "Site" });
  await expect(site).toHaveAttribute("href", "https://example.com/");
  await expect(site).toHaveAttribute("target", "_blank");
  await expect(site).toHaveAttribute("rel", "noopener noreferrer");

  await end.locator("a", { hasText: "Again" }).click();
  await expect(nodeTitle(page)).toHaveText("Intro");
  await expect(end).toBeHidden();
});

test("the chapter menu lists every node, marks asides, and navigates", async ({ app: { page } }) => {
  await play(page, "branching.json");
  await expect(nodeTitle(page)).toHaveText("Intro");
  await page.locator("#menu-toggle").click();
  const menu = page.locator("#menu");
  await expect(menu).toHaveAttribute("aria-hidden", "false");
  const items = page.locator("#menu-list .menu-item");
  await expect(items.locator(".menu-item-title")).toHaveText([
    "Intro",
    "Left path",
    "The dive",
    "Right path",
    "Extra",
    "Finale",
  ]);
  await expect(items.filter({ hasText: "The dive" }).locator(".menu-item-badge")).toHaveText("Deep dive");
  await expect(items.filter({ hasText: "Extra" }).locator(".menu-item-badge")).toHaveText("Aside");
  await expect(items.filter({ hasText: "Intro" })).toHaveClass(/current/);

  await items.filter({ hasText: "Finale" }).click();
  await expect(nodeTitle(page)).toHaveText("Finale");
  await expect(menu).toHaveAttribute("aria-hidden", "true");

  await page.locator("#menu-toggle").click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-hidden", "true");
});

test("browser back returns to the previous node", async ({ app: { page } }) => {
  await play(page, "branching.json");
  await ytJump(page, 9.9);
  await page.locator("#choices .choice-btn", { hasText: "Right" }).click();
  await expect(nodeTitle(page)).toHaveText("Right path");
  await page.goBack();
  await expect(nodeTitle(page)).toHaveText("Intro");
});

test("a deep link starts at that node", async ({ app: { page } }) => {
  await play(page, "branching.json", "#right");
  await expect(nodeTitle(page)).toHaveText("Right path");
});

test("a missing config says so instead of failing silently", async ({ app }) => {
  app.allow.push(/404/);
  await app.page.goto("player.html?config=e2e-fixtures/nope.json");
  await expect(app.page.locator("#status")).toContainText("Could not load e2e-fixtures/nope.json (404)");
});
