import { browser, $ } from "@wdio/globals";

/** Navigate to the visual test page and wait for the keyboard to fully render. */
export async function openTestPage(): Promise<void> {
  await browser.url("/test/pages/visual.html");
  await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
    timeout: 10_000,
    timeoutMsg: "kiosk-keyboard not registered",
  });
  // Wait for keys to render so the layout is stable before any interaction
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        return (kb?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0;
      }),
    { timeout: 5_000, timeoutMsg: "Keyboard keys not rendered" },
  );
}

/** Get the shadow DOM root element of a kiosk-keyboard by host ID. */
export async function getKeyboardRoot(hostId: string) {
  // WDIO pierces shadow DOM with >>> (deep selector)
  return $(`#${hostId}`).$(">>>.kiosk-keyboard");
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
