import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Separate Playwright config for the FLP (Fiori launchpad) lifecycle e2e. It
 * uses a different server than the visual/behavioral specs: the demo app served
 * with the FLP sandbox (ui5-flp.yaml / preview-middleware) on port 8083.
 *
 * The FLP test drives the sandbox through DOM selectors and the ushell
 * `window.hasher`, so no UI5 control-bridge or framework-stability plugin is
 * needed. Run with: npm run test:e2e:flp.
 */

const PORT = 8083;
const __dirname = import.meta.dirname;
const chromiumArgs = ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"];

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "flp-lifecycle.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: chromiumArgs },
    trace: "on-first-retry",
  },

  projects: [{ name: "flp", use: { browserName: "chromium" } }],

  webServer: {
    command: `ui5 serve --config ui5-flp.yaml --port ${PORT}`,
    cwd: path.resolve(__dirname, "../demo-app"),
    url: `http://localhost:${PORT}/test/flp.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
