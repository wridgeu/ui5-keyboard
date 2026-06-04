import { defineConfig } from "@playwright/test";
import path from "node:path";
import { CHROMIUM_ARGS, DESKTOP_VIEWPORT, ui5ServeWebServer } from "./playwright.shared.js";

/**
 * Config for generating the README theme screenshots (docs/kiosk/images) on
 * demand via `npm run test:e2e:docs`. Kept separate from the regression config
 * because it writes doc assets rather than comparing snapshots.
 */

const PORT = 8085;
const __dirname = import.meta.dirname;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "readme-screenshots.spec.ts",
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: DESKTOP_VIEWPORT,
    launchOptions: { args: CHROMIUM_ARGS },
  },
  projects: [{ name: "desktop", use: { browserName: "chromium" } }],
  webServer: ui5ServeWebServer({
    port: PORT,
    cwd: path.resolve(__dirname),
    urlPath: "/test-resources/ui5/kiosk/e2e/visual/index.html",
  }),
});
