/** Shared device profiles for phone/tablet e2e testing via Chrome mobileEmulation. */

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { computeExecutablePath, Browser, install } from "@puppeteer/browsers";

/**
 * Pinned Chrome version for visual regression testing.
 *
 * WDIO 9 auto-downloads this exact Chrome-for-Testing build so that
 * baselines are reproducible across machines. When updating, regenerate
 * all visual baselines and verify the diffs visually.
 */
export const CHROME_VERSION = "145.0.7632.160";

/**
 * Resolve cached Chrome-for-Testing and ChromeDriver binary paths without
 * network I/O.
 *
 * WDIO 9 calls `resolveBuildId`, `canDownload`, and `install` on every
 * worker start, each making HTTP requests to the Chrome-for-Testing CDN.
 * On slow networks this adds 5-9 minutes per worker. Passing both binary
 * paths via `goog:chromeOptions.binary` and `wdio:chromedriverOptions.binary`
 * short-circuits this entirely (per WDIO docs, both must be set).
 *
 * Returns `undefined` entries if the cached binaries are not found (first
 * run), in which case WDIO falls back to its normal download-and-cache flow.
 */
export function resolveCachedBinaries(): { chrome?: string; chromedriver?: string } {
  const result: { chrome?: string; chromedriver?: string } = {};
  const cacheDir = os.tmpdir();
  try {
    const chromePath = computeExecutablePath({
      browser: Browser.CHROME,
      buildId: CHROME_VERSION,
      cacheDir,
    });
    if (fs.existsSync(chromePath)) result.chrome = chromePath;
  } catch {
    // computeExecutablePath can throw if platform detection fails
  }
  try {
    const driverPath = computeExecutablePath({
      browser: Browser.CHROMEDRIVER,
      buildId: CHROME_VERSION,
      cacheDir,
    });
    if (fs.existsSync(driverPath)) result.chromedriver = driverPath;
  } catch {
    // same
  }
  return result;
}

/**
 * Pre-downloads Chrome and ChromeDriver to the shared cache directory so
 * that worker processes find them immediately via `resolveCachedBinaries`.
 *
 * Call this in `onPrepare` (before any workers spawn). On subsequent runs
 * where binaries are already cached, this returns instantly (filesystem
 * check only, no network I/O).
 */
export async function ensureBrowsersDownloaded(): Promise<void> {
  const cached = resolveCachedBinaries();
  if (cached.chrome && cached.chromedriver) return;

  const cacheDir = os.tmpdir();
  const tasks: Promise<unknown>[] = [];

  if (!cached.chrome) {
    tasks.push(
      install({ browser: Browser.CHROME, buildId: CHROME_VERSION, cacheDir }).then(() =>
        console.log(`[wdio] Chrome ${CHROME_VERSION} downloaded to cache`),
      ),
    );
  }
  if (!cached.chromedriver) {
    tasks.push(
      install({ browser: Browser.CHROMEDRIVER, buildId: CHROME_VERSION, cacheDir }).then(() =>
        console.log(`[wdio] ChromeDriver ${CHROME_VERSION} downloaded to cache`),
      ),
    );
  }

  await Promise.all(tasks);
}

// Resolve once at config load time, not per-call
const _cachedBinaries = resolveCachedBinaries();

/** Default window size for desktop e2e tests. */
export const DESKTOP_WINDOW_SIZE = "1440,900";

/**
 * Base ports for device-emulation test servers, keyed by package directory name.
 *
 * Each device profile adds its `portOffset` (phone-sm: +1, phone-md: +2, phone-lg: +3, tablet: +4) to the
 * base port so that profiles can run in parallel without collisions.
 * Desktop e2e ports are separate and defined directly in their wdio.conf.ts.
 *
 * **When adding a new package or device profile, update this map to keep
 * ranges non-overlapping.**
 */
export const DEVICE_BASE_PORTS: Record<string, number> = {
  "kiosk-keyboard-webc": 8086,
  "kiosk-keyboard": 8091,
};

export interface DeviceProfile {
  id: string;
  width: number;
  height: number;
  pixelRatio: number;
  /** Enable Chrome's mobile layout viewport emulation. */
  mobile: boolean;
  touch: boolean;
  /** Port offset from the package's base port so device profiles can run in parallel. */
  portOffset: number;
}

export const deviceProfiles: Record<string, DeviceProfile> = {
  "phone-sm": { id: "phone-sm", width: 320, height: 568, pixelRatio: 2, mobile: true, touch: true, portOffset: 1 },
  "phone-md": { id: "phone-md", width: 390, height: 844, pixelRatio: 3, mobile: true, touch: true, portOffset: 2 },
  "phone-lg": { id: "phone-lg", width: 430, height: 932, pixelRatio: 3, mobile: true, touch: true, portOffset: 3 },
  tablet: { id: "tablet", width: 768, height: 1024, pixelRatio: 2, mobile: true, touch: true, portOffset: 4 },
};

/**
 * Build `goog:chromeOptions` for a given device profile.
 *
 * Uses Chrome's `mobileEmulation` to set viewport size, DPR and touch mode
 * instead of `--window-size`, so that CSS media queries like `(hover: none)`
 * and `(pointer: coarse)` evaluate correctly.
 *
 * When a cached Chrome binary is found, `binary` is set so that WDIO skips
 * its per-worker HTTP calls to the Chrome-for-Testing CDN (see
 * `resolveCachedBinaries`).
 */
export function buildChromeOptions(profile: DeviceProfile, headless: boolean) {
  const args = ["--disable-gpu", "--no-sandbox"];
  if (headless) args.unshift("--headless=new");

  return {
    args,
    ...(_cachedBinaries.chrome ? { binary: _cachedBinaries.chrome } : {}),
    mobileEmulation: {
      deviceMetrics: {
        width: profile.width,
        height: profile.height,
        pixelRatio: profile.pixelRatio,
        mobile: profile.mobile,
        touch: profile.touch,
      },
    },
  };
}

/**
 * Build `wdio:chromedriverOptions` that points to the cached ChromeDriver
 * binary (if available). Must be paired with `goog:chromeOptions.binary` to
 * fully skip WDIO's per-worker CDN calls.
 */
export function buildChromedriverOptions(): Record<string, string> | undefined {
  return _cachedBinaries.chromedriver ? { binary: _cachedBinaries.chromedriver } : undefined;
}

/**
 * Remove stale `actual/` and `diff/` screenshots from a previous run.
 * Called in `onPrepare` so each test run starts with a clean slate.
 * Preserves the screenshot root directory itself and any `output.json` /
 * `report/` artifacts (the visual report tool handles those separately).
 */
export function cleanScreenshots(screenshotPath: string): void {
  for (const subdir of ["actual", "diff"]) {
    const dir = path.resolve(screenshotPath, subdir);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
