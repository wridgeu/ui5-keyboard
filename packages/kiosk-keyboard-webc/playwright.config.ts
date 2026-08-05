import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Playwright e2e + visual regression config for kiosk-keyboard-webc.
 *
 * Covers device emulation via projects, shadow-DOM piercing locators,
 * `emulateMedia` (including forced-colors), and `toHaveScreenshot` visual
 * comparison.
 *
 * Browser provisioning follows Playwright's recommended flow: run
 * `npx playwright install chromium` (CI uses `--with-deps`). Browsers are not
 * downloaded by `npm install`.
 *
 * Visual baselines live under test/e2e/__baselines__/<project>/, compared
 * against the pinned bundled chromium. They carry no platform suffix, so a
 * baseline is only valid for the OS it was generated on (font / anti-aliasing
 * rendering differs across platforms). Regenerate on whatever platform runs
 * the comparison. Update with `npm run test:e2e:update` (desktop) or the
 * per-device update scripts. test:e2e:ci runs every project with
 * --ignore-snapshots, so pixel comparison is never gated on CI; the device
 * projects are narrowed to CI_DEVICE_SPEC there (see the projects block).
 */

const PORT = 8086;
const __dirname = import.meta.dirname;

// Shared chromium launch flags. --no-sandbox and --disable-dev-shm-usage are
// required on CI runners (rootless containers / small /dev/shm).
const chromiumArgs = ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"];

// Device profiles mirror the previous Chrome mobileEmulation metrics so the
// (hover: none) / (pointer: coarse) media queries evaluate the same way.
const devices = [
  { name: "phone-sm", viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 },
  { name: "phone-md", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: "phone-lg", viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
  { name: "tablet", viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
];

const CI_DEVICE_SPEC = "invariants.spec.ts";
const CI_DEVICE_SPECS = new RegExp(`${CI_DEVICE_SPEC.replaceAll(".", "\\.")}$`);

// readme-screenshots runs under playwright.docs.config.ts: it writes doc assets
// at a different scale factor instead of comparing snapshots, so it has no place
// in the regression matrix.
const SEPARATE_CONFIG_SPECS = /readme-screenshots\.spec\.ts$/;

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
  // Committed visual baselines, organized per project, with no platform suffix
  // (the pinned chromium build is the reference, as it was under wdio).
  // Runtime "actual"/diff images go to test-results/ (gitignored).
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
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
    },
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: chromiumArgs },
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "desktop",
      testIgnore: SEPARATE_CONFIG_SPECS,
      use: { viewport: { width: 1440, height: 900 } },
    },
    // The behavioral component spec is desktop-only; the device matrix runs the
    // visual specs (which gate hover/pointer scenarios at runtime via matchMedia).
    // CI narrows the device profiles to the structural invariants: the rest of
    // their matrix is pixel comparison, and CI passes --ignore-snapshots, under
    // which toHaveScreenshot returns without capturing. The narrowing does give
    // up the two (pointer: coarse)-gated cases in visual.spec.ts, which the
    // desktop project skips, so those two run nowhere on CI. Locally every
    // project runs every spec and compares pixels.
    ...devices.map((d) => ({
      name: d.name,
      testIgnore: [/component\.spec\.ts/, SEPARATE_CONFIG_SPECS],
      testMatch: process.env.CI ? CI_DEVICE_SPECS : undefined,
      use: {
        viewport: d.viewport,
        deviceScaleFactor: d.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
      },
    })),
  ],

  webServer: {
    command: `vite --port ${PORT} --strictPort`,
    cwd: __dirname,
    url: `http://localhost:${PORT}/test/pages/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
