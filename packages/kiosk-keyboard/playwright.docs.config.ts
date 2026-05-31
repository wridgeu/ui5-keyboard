import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Config for generating the README theme screenshots (docs/kiosk/images) on
 * demand via `npm run test:e2e:docs`. Kept separate from the regression config
 * because it writes doc assets rather than comparing snapshots.
 */

const PORT = 8085;
const __dirname = import.meta.dirname;
const chromiumArgs = ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"];

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "readme-screenshots.spec.ts",
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: chromiumArgs },
  },
  projects: [{ name: "desktop", use: { browserName: "chromium" } }],
  webServer: {
    command: `ui5 serve --port ${PORT}`,
    cwd: path.resolve(__dirname),
    url: `http://localhost:${PORT}/test-resources/ui5/kiosk/e2e/visual/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
