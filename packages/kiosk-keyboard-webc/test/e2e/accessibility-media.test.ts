import { browser, $, expect } from "@wdio/globals";

/** Navigate to the standalone test page and wait for the custom element to register. */
async function openTestPage(): Promise<void> {
  await browser.url("/test/pages/index.html");
  await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
    timeout: 10_000,
    timeoutMsg: "kiosk-keyboard not registered",
  });
}

/** Get the shadow DOM root element of a kiosk-keyboard by host ID. */
async function getKeyboardRoot(hostId: string) {
  return $(`#${hostId}`).$(">>>.kiosk-keyboard");
}

/** Use CDP Emulation.setEmulatedMedia to set CSS media features. */
async function setEmulatedMediaFeatures(features: Array<{ name: string; value: string }>): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = page.client();
  await cdp.send("Emulation.setEmulatedMedia", { features });
}

/** Reset all emulated media features via CDP. */
async function clearEmulatedMediaFeatures(): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = page.client();
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
}

describe("KioskKeyboard Web Component - Accessibility Media Emulation", () => {
  afterEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
    await openTestPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-forced-colors");
  });

  it("should match prefers-reduced-motion mode", async () => {
    await setEmulatedMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await openTestPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-reduced-motion");
  });
});
