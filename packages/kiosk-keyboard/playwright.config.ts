import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { CHROMIUM_ARGS, DESKTOP_VIEWPORT, ui5ServeWebServer } from "./playwright.shared.js";

/**
 * Playwright e2e + visual regression config for the kiosk-keyboard UI5 control.
 *
 * The UI5 control renders into light DOM, so locators target it directly (no
 * shadow piercing). Pages are served by `ui5 serve` (the UI5 Tooling middleware
 * transpiles the TS test code).
 *
 * The behavioral spec (focus) is desktop-only; the visual specs run on the
 * desktop + device matrix. The FLP spec (flp-*.spec.ts) uses a different server
 * and runs under playwright.flp.config.ts.
 *
 * Browser provisioning: `npx playwright install chromium` (`--with-deps` in CI).
 * Visual baselines under test/e2e/__baselines__/<project>/ are committed and
 * carry no platform suffix, so a baseline is only valid for the OS it was
 * generated on. test:e2e:ci runs every project with --ignore-snapshots, so pixel
 * comparison is never gated on CI; see CI_DEVICE_SPECS for what the device
 * projects run there.
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
// run desktop-only; the flp-* specs / readme-screenshots run under their own
// configs. Everything else is a visual spec and runs on the device matrix too.
// A denylist (not an allowlist) keeps the matrix self-maintaining: a new visual
// spec joins it automatically, while a forgotten new behavioral spec fails
// loudly on mobile instead of being silently skipped.
const DESKTOP_ONLY_SPECS = /focus\.spec\.ts$/;
const SEPARATE_CONFIG_SPECS = /(flp-.*|readme-screenshots)\.spec\.ts$/;

// CI narrows the device profiles to the structural invariants. The rest of their
// matrix is pixel comparison, and CI passes --ignore-snapshots, under which
// toHaveScreenshot returns without capturing. The non-pixel assertions those
// specs also carry (shift aria-pressed, the docked class, the forced-colors hint
// inversion) still run on CI via the desktop project, which keeps the full spec
// list. Locally every project runs every spec and compares pixels.
const CI_DEVICE_SPEC = "invariants.spec.ts";
const CI_DEVICE_SPECS = new RegExp(`${CI_DEVICE_SPEC.replaceAll(".", "\\.")}$`);

// A project whose testMatch selects nothing still exits 0: Playwright's
// "no tests found" check looks at the whole run, not per project. Renaming the
// spec would turn all four device legs into silent no-ops, so fail the config
// instead. A config that throws exits 1. A spec left in place but emptied is not
// covered; see docs/specs/2026-07-28-stylesheet-guards-adversarial-hypotheses.md.
if (process.env.CI && !existsSync(join(__dirname, "test", "e2e", CI_DEVICE_SPEC))) {
  throw new Error(`CI device projects match ${CI_DEVICE_SPEC}, which no longer exists in test/e2e.`);
}

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.ts",
  snapshotPathTemplate: "{testDir}/__baselines__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Percentage rather than a count: Playwright's own default is "50%", which
  // floors to a single worker on the 2-vCPU hosted runner and quietly cancels
  // the fullyParallel above. A hardcoded 2 would not grow with a runner that
  // has more cores.
  workers: process.env.CI ? "100%" : undefined,
  // The html report is written into the runner and discarded with it; the github
  // reporter puts failures inline on the job summary and file annotations.
  reporter: process.env.CI ? [["github"], ["list"]] : [["html", { open: "never" }], ["list"]],

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
      // The flp-* specs run under playwright.flp.config.ts; readme-screenshots is generated
      // on demand via test:e2e:docs, not part of the regression run.
      testIgnore: SEPARATE_CONFIG_SPECS,
      use: { viewport: DESKTOP_VIEWPORT },
    },
    ...deviceProfiles.map((d) => ({
      name: d.name,
      testIgnore: [DESKTOP_ONLY_SPECS, SEPARATE_CONFIG_SPECS],
      testMatch: process.env.CI ? CI_DEVICE_SPECS : undefined,
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
