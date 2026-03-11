/**
 * Shared WDIO test helpers for CDP-based media emulation and document direction.
 *
 * These helpers are used by both the kiosk-keyboard and kiosk-keyboard-webc
 * e2e test suites. They rely on the `browser` global from `@wdio/globals`
 * and require a Chrome/Chromium browser with DevTools protocol access.
 *
 * @note This file is excluded from tools/tsconfig.json because it depends on
 *       WDIO types that are only available in the e2e test tsconfigs.
 */
import { browser } from "@wdio/globals";

/**
 * Set emulated CSS media features via the Chrome DevTools Protocol.
 *
 * Requires a WDIO browser instance with DevTools protocol access
 * (the default when using `chromedriver` or `devtools` automation).
 */
export async function setEmulatedMediaFeatures(features: Array<{ name: string; value: string }>): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  // Assumes single-tab — safe because WDIO runs one page per browser instance
  const [page] = await puppeteer.pages();
  const cdp = page.client();
  await cdp.send("Emulation.setEmulatedMedia", { features });
}

/** Clear all emulated CSS media features via CDP. */
export async function clearEmulatedMediaFeatures(): Promise<void> {
  await setEmulatedMediaFeatures([]);
}

/** Set the `dir` and `lang` attributes on the document root element and wait for layout reflow. */
export async function setDocumentDirection(dir: "ltr" | "rtl"): Promise<void> {
  await browser.execute((d) => {
    document.documentElement.setAttribute("dir", d);
    document.documentElement.setAttribute("lang", d === "rtl" ? "ar" : "en");
  }, dir);
  // Wait for the browser to reflow after the direction change
  await browser.execute(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
