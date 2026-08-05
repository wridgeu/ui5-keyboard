import { defineConfig } from "@playwright/test";
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
    // Captured at 2x so the README renders sharp on a HiDPI display, where the
    // images are scaled down rather than up.
    deviceScaleFactor: 2,
    // `--disable-lcd-text` forces grayscale antialiasing. Chrome's subpixel
    // antialiasing tints glyph edges red and blue, which survives into a PNG as
    // stray colour on the keycap letters - most visible on the two high-contrast
    // themes, whose palette has no colour of its own to hide it.
    launchOptions: { args: [...CHROMIUM_ARGS, "--disable-lcd-text"] },
  },
  projects: [{ name: "desktop", use: { browserName: "chromium" } }],
  webServer: ui5ServeWebServer({
    port: PORT,
    cwd: __dirname,
    urlPath: "/test-resources/ui5/kiosk/e2e/visual/index.html",
  }),
});
