/** Shared device profiles for phone/tablet e2e testing via Chrome mobileEmulation. */

/**
 * Pinned Chrome version for visual regression testing.
 *
 * WDIO 9 auto-downloads this exact Chrome-for-Testing build so that
 * baselines are reproducible across machines. When updating, regenerate
 * all visual baselines and verify the diffs visually.
 */
export const CHROME_VERSION = "145.0.7632.160";

export interface DeviceProfile {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  touch: boolean;
  /** Port offset from the package's base port so device profiles can run in parallel. */
  portOffset: number;
}

export const deviceProfiles: Record<string, DeviceProfile> = {
  phone: { id: "phone", width: 360, height: 800, deviceScaleFactor: 3, touch: true, portOffset: 1 },
  tablet: { id: "tablet", width: 768, height: 1024, deviceScaleFactor: 2, touch: true, portOffset: 2 },
};

/**
 * Build `goog:chromeOptions` for a given device profile.
 *
 * Uses Chrome's `mobileEmulation` to set viewport size, DPR and touch mode
 * instead of `--window-size`, so that CSS media queries like `(hover: none)`
 * and `(pointer: coarse)` evaluate correctly.
 */
export function buildChromeOptions(profile: DeviceProfile, headless: boolean) {
  const args = ["--disable-gpu", "--no-sandbox"];
  if (headless) args.unshift("--headless=new");

  return {
    args,
    mobileEmulation: {
      deviceMetrics: {
        width: profile.width,
        height: profile.height,
        pixelRatio: profile.deviceScaleFactor,
        touch: profile.touch,
      },
    },
  };
}
