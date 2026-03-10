import { browser, $, expect } from "@wdio/globals";

const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

async function openVisualPage(): Promise<void> {
  await browser.url(VISUAL_PAGE);
  await $("#kb-stable-height .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
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

describe("KioskKeyboard Accessibility Media Emulation", () => {
  afterEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-forced-colors");
  });

  it("should match prefers-reduced-motion mode", async () => {
    await setEmulatedMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-reduced-motion");
  });
});
