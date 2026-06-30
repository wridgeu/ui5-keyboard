import { defineConfig } from "@playwright/test";
import { CHROMIUM_ARGS, DESKTOP_VIEWPORT, ui5ServeWebServer } from "./playwright.shared.js";

/**
 * Playwright e2e + visual regression config for the kiosk-keyboard UI5 control.
 *
 * The UI5 control renders into light DOM, so locators target it directly (no
 * shadow piercing). Pages are served by `ui5 serve` (the UI5 Tooling middleware
 * transpiles the TS test code).
 *
 * The behavioral specs (autotype, focus, i18n, inputmode, interop) are
 * desktop-only; the visual specs run on the desktop + device matrix. The FLP
 * lifecycle spec uses a different server and lives in playwright.flp.config.ts.
 *
 * Browser provisioning: `npx playwright install chromium` (`--with-deps` in CI).
 * Visual baselines under test/e2e/__baselines__/<project>/ are committed and
 * carry no platform suffix, so a baseline is only valid for the OS it was
 * generated on. The desktop project runs in CI via test:e2e:ci as render smoke
 * tests; pixel comparison is not gated (snapshots ignored).
 */

const PORT = 8085;
const __dirname = import.meta.dirname;

const deviceProfiles = [
  { name: "phone-sm", viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 },
  { name: "phone-md", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: "phone-lg", viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
  { name: "tablet", viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
];

// Behavioral specs need a desktop interaction context (real focus, typing) and
// run desktop-only; flp-lifecycle / readme-screenshots run under their own
// configs. Everything else is a visual spec and runs on the device matrix too.
// A denylist (not an allowlist) keeps the matrix self-maintaining: a new visual
// spec joins it automatically, while a forgotten new behavioral spec fails
// loudly on mobile instead of being silently skipped.
const DESKTOP_ONLY_SPECS = /(autotype|focus|i18n|inputmode|interop)\.spec\.ts$/;
const SEPARATE_CONFIG_SPECS = /(flp-lifecycle|readme-screenshots)\.spec\.ts$/;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.ts",
  snapshotPathTemplate: "{testDir}/__baselines__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide" },
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: CHROMIUM_ARGS },
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "desktop",
      // FLP runs under playwright.flp.config.ts; readme-screenshots is generated
      // on demand via test:e2e:docs, not part of the regression run.
      testIgnore: SEPARATE_CONFIG_SPECS,
      use: { viewport: DESKTOP_VIEWPORT },
    },
    ...deviceProfiles.map((d) => ({
      name: d.name,
      testIgnore: [DESKTOP_ONLY_SPECS, SEPARATE_CONFIG_SPECS],
      use: {
        viewport: d.viewport,
        deviceScaleFactor: d.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
      },
    })),
  ],

  webServer: ui5ServeWebServer({
    port: PORT,
    cwd: __dirname,
    urlPath: "/test-resources/ui5/kiosk/e2e/visual/index.html",
  }),
});
