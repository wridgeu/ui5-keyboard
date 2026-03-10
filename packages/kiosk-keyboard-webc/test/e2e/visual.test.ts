import { browser, $, expect } from "@wdio/globals";
import { openTestPage, getKeyboardRoot, forceHoverState, clearForcedHoverState } from "./test-helpers.js";

describe("KioskKeyboard Web Component - Visual Regression", () => {
  before(async () => {
    await openTestPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await $('kiosk-keyboard[for="text-input"]').$(">>>.kiosk-keyboard");
    await expect(kb).toMatchElementSnapshot("webc-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await $('kiosk-keyboard[keyboard-type="Numpad"]').$(">>>.kiosk-keyboard");
    await expect(kb).toMatchElementSnapshot("webc-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await $('kiosk-keyboard[keyboard-type="Numeric"]').$(">>>.kiosk-keyboard");
    await expect(kb).toMatchElementSnapshot("webc-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await $("kiosk-keyboard[disabled]").$(">>>.kiosk-keyboard");
    await expect(kb).toMatchElementSnapshot("webc-disabled");
  });

  it("should match QWERTZ-DE layout", async () => {
    const kb = await $('kiosk-keyboard[layout="qwertz-de"]').$(">>>.kiosk-keyboard");
    await expect(kb).toMatchElementSnapshot("webc-qwertz-de");
  });

  it("should match narrow container (320px)", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await expect(kb).toMatchElementSnapshot("webc-narrow");
  });
});

describe("KioskKeyboard Web Component - Interactive States", () => {
  before(async () => {
    await openTestPage();
  });

  it("should match key hover state", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await forceHoverState("kb-qwerty", '[data-key="f"]');
    await expect(kb).toMatchElementSnapshot("webc-key-hovered");
    await clearForcedHoverState("kb-qwerty", '[data-key="f"]');
  });

  it("should match Shift active state", async () => {
    // Click shift on the QWERTY keyboard
    const shiftKey = await browser.execute(() => {
      const kb = document.getElementById("kb-qwerty");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
      return !!shift;
    });
    expect(shiftKey).toBe(true);

    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-shifted");

    // Reset shift
    await browser.execute(() => {
      const kb = document.getElementById("kb-qwerty");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
    });
  });

  it("should match docked mode open", async function () {
    // Docked keyboards defer to native input on touch devices (pointer: coarse),
    // so .show() intentionally does not open the on-screen keyboard.
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (isCoarse) {
      this.skip();
      return;
    }

    // Open the docked keyboard
    await browser.execute(() => {
      const kb = document.getElementById("kb-docked") as HTMLElement & { show(): void };
      kb.show();
    });

    const kb = await getKeyboardRoot("kb-docked");
    await kb.waitForDisplayed({ timeout: 5_000 });
    await expect(kb).toMatchElementSnapshot("webc-docked-open");

    // Close it again
    await browser.execute(() => {
      const kb = document.getElementById("kb-docked") as HTMLElement & { close(): void };
      kb.close();
    });
  });
});
