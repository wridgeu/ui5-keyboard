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
 * per-device update scripts. The desktop project runs in CI via test:e2e:ci as
 * render smoke tests; pixel comparison is not gated (snapshots ignored).
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
  // the fullyParallel above. A hardcoded 2 oversubscribes when the runner is
  // larger.
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
      use: { viewport: { width: 1440, height: 900 } },
    },
    // The behavioral component spec is desktop-only; the device matrix runs the
    // visual specs (which gate hover/pointer scenarios at runtime via matchMedia).
    // On CI the device profiles carry the structural invariants only: CI runs
    // with --ignore-snapshots, under which toHaveScreenshot passes without
    // capturing, so the visual specs there cost a browser and assert nothing.
    // Locally every project still runs every spec and compares pixels.
    ...devices.map((d) => ({
      name: d.name,
      testIgnore: /component\.spec\.ts/,
      testMatch: process.env.CI ? /invariants\.spec\.ts$/ : undefined,
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
