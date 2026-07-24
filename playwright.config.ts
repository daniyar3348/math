import { defineConfig, devices } from "@playwright/test";

// E2E (§18): последовательный прогон против dev-сервера на общей dev-БД.
// Сценарии используют уникальные слаги, поэтому повторные прогоны безопасны.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "ru-RU",
    timezoneId: "Asia/Almaty",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/healthz",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
