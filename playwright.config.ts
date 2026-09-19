import { defineConfig, devices } from "@playwright/test";

// ADR-0027: against the built site (`pnpm e2e` builds first), Chromium only. A spare port so a
// local run never touches the dev server on 8080.
const PORT = Number(process.env["E2E_PORT"] ?? 4299);
const CI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: CI,
  // No retries: a flaky test is a bug in the test or the fake player, and a retry would hide it.
  retries: 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${String(PORT)}/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec vite preview --port ${String(PORT)} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: !CI,
  },
});
