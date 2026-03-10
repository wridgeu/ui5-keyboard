import { browser } from "@wdio/globals";

/**
 * Set emulated CSS media features via the Chrome DevTools Protocol.
 *
 * Requires a WDIO browser instance with DevTools protocol access
 * (the default when using `chromedriver` or `devtools` automation).
 */
export async function setEmulatedMediaFeatures(features: Array<{ name: string; value: string }>): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = page.client();
  await cdp.send("Emulation.setEmulatedMedia", { features });
}

/** Clear all emulated CSS media features via CDP. */
export async function clearEmulatedMediaFeatures(): Promise<void> {
  await setEmulatedMediaFeatures([]);
}
