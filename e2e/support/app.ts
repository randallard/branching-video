/**
 * Shared harness for the browser suite (ADR-0027).
 *
 * Every browser context is made hermetic: YouTube's IFrame API is answered by a fake with a
 * test-driven clock, the oEmbed title lookup gets a canned title, `/e2e-fixtures/*` is served from
 * `e2e/fixtures/`, and every other off-origin request is aborted. Every page in the context is
 * watched for console errors, uncaught exceptions and CSP violations, and dialogs are answered from
 * a queue the test fills. The fixture fails the test on anything unexpected.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test as base } from "@playwright/test";
import type { Browser, BrowserContext, Dialog, Locator, Page, Route } from "@playwright/test";

const FAKE_YOUTUBE = readFileSync(resolve(import.meta.dirname, "fake-youtube.js"), "utf8");
const FIXTURES = resolve(import.meta.dirname, "../fixtures");

export const VIDEO_TITLE = "Fake Video Title";
export const UKULELE_TITLE = "Most Useful Music Theory for Ukulele";

export function fixture(name: string): string {
  return resolve(FIXTURES, name);
}

/** Answers `confirm`/`prompt` in the order the test queued them; accepts every `alert` and keeps
 * its text. A confirm or prompt nobody queued is dismissed and fails the test. */
export class Dialogs {
  readonly alerts: string[] = [];
  /** The text of every confirm/prompt that was answered, in order. */
  readonly asked: string[] = [];
  readonly unexpected: string[] = [];
  private readonly queue: { type: "confirm" | "prompt"; accept: boolean; text?: string }[] = [];

  confirm(accept: boolean): void {
    this.queue.push({ type: "confirm", accept });
  }

  /** `null` cancels the prompt. */
  prompt(text: string | null): void {
    this.queue.push(text === null ? { type: "prompt", accept: false } : { type: "prompt", accept: true, text });
  }

  get pending(): number {
    return this.queue.length;
  }

  /** How many alerts earlier `alert()` calls have consumed. */
  private consumed = 0;

  /** Wait for the next not-yet-consumed alert matching `pattern`, consume it, and return its text.
   * Consuming matters: an earlier "Import complete" must not satisfy a wait for a later one. */
  async alert(pattern: RegExp): Promise<string> {
    const find = (): number => this.alerts.findIndex((a, i) => i >= this.consumed && pattern.test(a));
    await expect.poll(find, { message: `a new alert matching ${String(pattern)}` }).toBeGreaterThanOrEqual(0);
    const i = find();
    this.consumed = i + 1;
    return this.alerts[i] ?? "";
  }

  async handle(d: Dialog): Promise<void> {
    const type = d.type();
    if (type === "alert") {
      this.alerts.push(d.message());
      await d.accept();
      return;
    }
    if (type === "beforeunload") {
      await d.accept();
      return;
    }
    const next = this.queue[0];
    if (next?.type !== type) {
      this.unexpected.push(`${type}: ${d.message()}`);
      await d.dismiss();
      return;
    }
    this.queue.shift();
    this.asked.push(d.message());
    if (next.accept) await d.accept(next.text);
    else await d.dismiss();
  }
}

export interface Device {
  context: BrowserContext;
  page: Page;
  dialogs: Dialogs;
  errors: string[];
  /** Console errors matching one of these are expected by the test, not failures. */
  allow: RegExp[];
}

function isLocal(url: URL): boolean {
  return url.hostname === "127.0.0.1" || url.hostname === "localhost";
}

async function routeRequest(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  if (isLocal(url)) {
    if (url.pathname.startsWith("/e2e-fixtures/")) {
      const file = fixture(url.pathname.slice("/e2e-fixtures/".length));
      if (existsSync(file)) await route.fulfill({ path: file, contentType: "application/json" });
      else await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    await route.fallback();
    return;
  }
  if (url.hostname === "www.youtube.com" && url.pathname === "/iframe_api") {
    await route.fulfill({ contentType: "text/javascript", body: FAKE_YOUTUBE });
    return;
  }
  if (url.hostname === "www.youtube.com" && url.pathname === "/oembed") {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: VIDEO_TITLE }) });
    return;
  }
  await route.abort();
}

function watch(page: Page, device: Omit<Device, "page">): void {
  page.on("dialog", (d) => {
    void device.dialogs.handle(d);
  });
  page.on("pageerror", (e) => {
    device.errors.push(`uncaught: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // No favicon yet — a known 404 on every page (PROGRESS.md, "found in slice 2").
    if (m.location().url.endsWith("/favicon.ico")) return;
    device.errors.push(`${m.text()} ${m.location().url}`);
  });
}

/** Make a context hermetic and watched. Pages already open and pages opened later (popups) are
 * both covered. */
export async function instrument(context: BrowserContext): Promise<Omit<Device, "page">> {
  const device = { context, dialogs: new Dialogs(), errors: [] as string[], allow: [] as RegExp[] };
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
  await context.route("**/*", routeRequest);
  for (const page of context.pages()) watch(page, device);
  context.on("page", (page) => {
    watch(page, device);
  });
  return device;
}

export function assertClean(device: Omit<Device, "page">): void {
  const errors = device.errors.filter((e) => !device.allow.some((re) => re.test(e)));
  expect(errors, "console errors, uncaught exceptions or CSP violations").toEqual([]);
  expect(device.dialogs.unexpected, "dialogs nobody expected").toEqual([]);
  expect(device.dialogs.pending, "dialogs the test queued that never appeared").toBe(0);
}

/** A second (third…) browser with its own storage — another device, for merge tests. */
export async function newDevice(browser: Browser): Promise<Device> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { ...(await instrument(context)), page };
}

export const test = base.extend<{ app: Device }>({
  app: async ({ context, page }, use) => {
    const device = await instrument(context);
    await use({ ...device, page });
    assertClean(device);
  },
});

export { expect };

// ── Page helpers ─────────────────────────────────────────────────────────

/** Pages disable their store-backed buttons until IndexedDB has opened. */
export async function gotoEditor(page: Page): Promise<void> {
  await page.goto("editor.html");
  await expect(page.locator("#myDraftsBtn")).toBeEnabled();
}

export async function gotoStudio(page: Page): Promise<void> {
  await page.goto("studio.html");
  await expect(page.locator("#importBtn")).toBeEnabled();
}

export async function gotoHome(page: Page): Promise<void> {
  await page.goto("index.html");
  // The placeholder starts hidden; once the store has booted either it or a draft row shows.
  await expect(page.locator("#local-empty:visible, #local-shows .draft").first()).toBeVisible();
}

export async function importAll(page: Page, files: string[]): Promise<void> {
  await page.locator("#import-all-file").setInputFiles(files);
}

export async function exportAll(page: Page, to: string): Promise<string> {
  const download = page.waitForEvent("download");
  await page.locator("#export-all-btn").click();
  await (await download).saveAs(to);
  return to;
}

export function draftTitles(page: Page): Locator {
  return page.locator("#local-shows .draft .t");
}

export async function openDraftInEditor(page: Page, title: string): Promise<void> {
  await gotoEditor(page);
  await page.locator("#myDraftsBtn").click();
  await page.locator("#myDraftsMenu .dd-item", { hasText: title }).first().click();
  await expect(field(page, "#showSettings", "Title").locator("input")).toHaveValue(title);
}

/**
 * Reopen a draft from the Editor's My Drafts menu — in the page, no navigation — until `check`
 * passes. The store only shows a save once IndexedDB has it, so this is how a test waits for a
 * write to land. Navigating (a reload, `openDraftInEditor`) straight after an edit instead can
 * abandon a write still in flight, which is a test racing the disk, not a bug in the app.
 */
export async function reopenUntil(page: Page, title: string, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.locator("#myDraftsBtn").click();
    await page.locator("#myDraftsMenu .dd-item", { hasText: title }).first().click({ timeout: 500 });
    await check();
  }).toPass({ timeout: 10_000 });
}

/** A labelled form field inside `scope`. The label may carry a history badge after its text. */
export function field(page: Page, scope: string, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page
    .locator(`${scope} .field`)
    .filter({ has: page.locator(":scope > label", { hasText: new RegExp(`^${escaped}(⟲ \\d+)?$`) }) });
}

export function badge(scope: Locator): Locator {
  return scope.locator(".hist-badge");
}

/** Open a field's history and return its values as shown. */
export async function historyValues(scope: Locator): Promise<string[]> {
  const panel = scope.locator(".hist-panel");
  if (await panel.isHidden()) await badge(scope).click();
  await expect(panel).toBeVisible();
  return panel.locator(".hist-value").allTextContents();
}

// ── Fake YouTube controls ───────────────────────────────────────────────

interface FakeWindow {
  __ytRate?: number;
  __ytPlayer?: { t: number; state: number; jump(t: number): void; playVideo(): void; pauseVideo(): void };
}

export async function ytReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as FakeWindow).__ytPlayer !== undefined);
}

export async function ytRate(page: Page, rate: number): Promise<void> {
  await page.evaluate((r) => {
    (window as unknown as FakeWindow).__ytRate = r;
  }, rate);
}

export async function ytJump(page: Page, t: number): Promise<void> {
  await page.evaluate((seconds) => {
    (window as unknown as FakeWindow).__ytPlayer?.jump(seconds);
  }, t);
}

export async function ytTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as FakeWindow).__ytPlayer?.t ?? -1);
}

export async function ytState(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as FakeWindow).__ytPlayer?.state ?? -99);
}

export async function ytPause(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as FakeWindow).__ytPlayer?.pauseVideo();
  });
}

export async function ytPlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as FakeWindow).__ytPlayer?.playVideo();
  });
}
