import { browser, $ } from "@wdio/globals";

export const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

/** Navigate to the visual test page and wait for UI5 to finish rendering. */
export async function openVisualPage(): Promise<void> {
  await browser.url(VISUAL_PAGE);
  // wdi5 "ui5" service handles UI5 bootstrap sync; additionally wait for the last keyboard
  await $("#kb-stable-height .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

/** Get the rendered KioskKeyboard element inside a container. */
export function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
}

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
