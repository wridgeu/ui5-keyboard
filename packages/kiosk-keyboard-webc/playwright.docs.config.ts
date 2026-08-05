import { defineConfig } from "@playwright/test";

/**
 * Config for generating the README images (docs/kiosk-webc/images and
 * docs/shared/images) on demand via `npm run test:e2e:docs`. Kept separate from
 * the regression config because it writes doc assets rather than comparing
 * snapshots: the scale factor and the text-rendering flag below would invalidate
 * every committed visual baseline if the two runs shared them.
 */

const PORT = 8087;
const __dirname = import.meta.dirname;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "readme-screenshots.spec.ts",
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    // Captured at 2x so the README renders sharp on a HiDPI display, where the
    // images are scaled down rather than up.
    deviceScaleFactor: 2,
    // `--disable-lcd-text` forces grayscale antialiasing. Chrome's subpixel
    // antialiasing tints glyph edges red and blue, which survives into a PNG as
    // stray colour on the keycap letters - most visible on the two high-contrast
    // themes, whose palette has no colour of its own to hide it.
    launchOptions: { args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--disable-lcd-text"] },
  },
  projects: [{ name: "desktop", use: { browserName: "chromium" } }],
  webServer: {
    command: `vite --port ${PORT} --strictPort`,
    cwd: __dirname,
    url: `http://localhost:${PORT}/test/pages/key-style-demo.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
