import { defineConfig, devices } from "@playwright/test";
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_e2e"))
  throw new Error(
    "Set E2E_DATABASE_URL to a dedicated PostgreSQL database whose name ends in _e2e.",
  );
export default defineConfig({
  testDir: "./client/test",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:31479",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "node dist/db/migrate.js && npm start",
    url: "http://127.0.0.1:31479/api/health",
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
      PORT: "31479",
      ROUND_DURATION: "4",
      COOLDOWN_DURATION: "2",
    },
  },
  reporter: "list",
});
