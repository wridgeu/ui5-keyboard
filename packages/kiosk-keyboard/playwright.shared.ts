import type { PlaywrightTestConfig } from "@playwright/test";

/** Chrome flags for CI-safe headless runs, shared by the kiosk Playwright configs. */
export const CHROMIUM_ARGS = ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"];

/** Desktop viewport for the non-device-emulation projects. */
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/** Build a `ui5 serve` webServer entry for the given port, working dir and start URL. */
export function ui5ServeWebServer(opts: {
  port: number;
  cwd: string;
  urlPath: string;
  command?: string;
  timeout?: number;
}): PlaywrightTestConfig["webServer"] {
  return {
    command: opts.command ?? `ui5 serve --port ${opts.port}`,
    cwd: opts.cwd,
    url: `http://localhost:${opts.port}${opts.urlPath}`,
    reuseExistingServer: !process.env.CI,
    timeout: opts.timeout ?? 120_000,
  };
}
