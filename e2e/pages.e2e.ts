// Every built page loads under its CSP with no console errors (ADR-0026's standing check — the
// fixture fails any test that logs an error or a CSP violation).
import { expect, test } from "./support/app.ts";

test("home page lists the published shows from the generated manifest", async ({ app: { page } }) => {
  await page.goto("index.html");
  const shows = page.locator("#shows a.show");
  await expect(shows).toHaveCount(2);
  await expect(shows.first()).toHaveAttribute("href", /^player\.html\?config=live%2F.+\.json$/);
});

test("a published show opens in the player", async ({ app: { page } }) => {
  await page.goto("index.html");
  await page.locator("#shows a.show", { hasText: "Big Buck Bunny" }).click();
  await expect(page.locator("#show-title")).toHaveText("Branching Test — Big Buck Bunny");
  await expect(page.locator("#node-title")).toHaveText("Intro (0-30s)");
});

test("studio loads to its setup screen", async ({ app: { page } }) => {
  await page.goto("studio.html");
  await expect(page.locator("#setup")).toBeVisible();
  await expect(page.locator("#startBtn")).toBeEnabled();
});

test("editor loads with its store-backed buttons enabled", async ({ app: { page } }) => {
  await page.goto("editor.html");
  await expect(page.locator("#myDraftsBtn")).toBeEnabled();
  await expect(page.locator("#validation")).toContainText("nodes");
});

test("the harness catches a CSP violation (so the check above can't silently stop working)", async ({ app }) => {
  await app.page.goto("index.html");
  await app.page.evaluate(() => {
    const img = document.createElement("img");
    img.src = "https://example.com/pixel.png"; // img-src 'self'
    document.body.appendChild(img);
  });
  // Caught twice over: our securitypolicyviolation listener, and Chromium's own console message.
  await expect.poll(() => app.errors.some((e) => e.startsWith("CSP violation: img-src"))).toBe(true);
  await expect.poll(() => app.errors.some((e) => e.includes("violates the following Content Security Policy"))).toBe(true);
  app.allow.push(/CSP violation: img-src|violates the following Content Security Policy/);
});

test("create page loads", async ({ app: { page } }) => {
  await page.goto("create.html");
  await expect(page.locator("h1").first()).toBeVisible();
});
