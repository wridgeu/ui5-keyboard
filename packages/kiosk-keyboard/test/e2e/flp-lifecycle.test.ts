import { browser, $, $$, expect } from "@wdio/globals";

declare global {
  interface Window {
    hasher: { setHash(hash: string): void };
  }
}

const FLP_PAGE = "/test/flp.html";

/**
 * Wait for the FLP shell to fully render (header + at least one tile).
 */
async function waitForFlpShell(): Promise<void> {
  await browser.url(FLP_PAGE);
  await $("#shell-header").waitForExist({ timeout: 30_000 });
  await browser.waitUntil(
    async () => {
      const tiles = await $$(".sapMGT");
      return (await tiles.length) > 0;
    },
    { timeout: 30_000, timeoutMsg: "FLP home page tiles did not render" },
  );
}

/**
 * Click the demo-app tile in the FLP launchpad.
 * Waits for the app's NavContainer to appear, confirming the Component loaded.
 */
async function openAppTile(): Promise<void> {
  const tile = await $(".sapMGT");
  await tile.click();
  // Wait for the hash to change to the app hash -- this confirms the FLP
  // resolved the tile and started the app. Do not use DOM selectors here
  // because stale elements from a previous app session may still exist.
  await browser.waitUntil(async () => browser.execute(() => window.location.hash.includes("DemoApp-display")), {
    timeout: 30_000,
    timeoutMsg: "App hash did not appear after tile click",
  });
  // Wait for the app view to render
  await browser.waitUntil(
    async () => {
      const pages = await $$(".sapMPage");
      return (await pages.length) > 0;
    },
    { timeout: 30_000, timeoutMsg: "App content did not render after tile click" },
  );
}

/**
 * Navigate using the FLP shell's hasher.
 */
async function navigateToHash(hash: string): Promise<void> {
  await browser.execute((h: string) => {
    window.hasher.setHash(h);
  }, hash);
}

/**
 * Navigate to the i18n-extensibility page inside the demo app.
 * Waits for the KioskKeyboard on that page to render.
 */
async function navigateToI18nPage(): Promise<void> {
  await navigateToHash("DemoApp-display&/kiosk/i18n-extensibility");
  await $(".ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

/**
 * Navigate back to FLP home.
 * Waits until the FLP tile reappears.
 */
async function navigateToFlpHome(): Promise<void> {
  await navigateToHash("Shell-home");
  await browser.waitUntil(
    async () => {
      const tiles = await $$(".sapMGT");
      return (await tiles.length) > 0;
    },
    { timeout: 15_000, timeoutMsg: "FLP home tiles did not reappear after navigation" },
  );
}

function getKeyboard() {
  return $(".ui5KioskKeyboard");
}

async function getShiftLabelText(): Promise<string> {
  return browser.execute(() => {
    const kb = document.querySelector(".ui5KioskKeyboard");
    const key = kb?.querySelector('[data-key="{shift}"]');
    return key?.querySelector(".ui5KioskKey__label")?.textContent ?? "";
  });
}

async function selectI18nMode(text: string): Promise<void> {
  const item = await $(`li=${text}`);
  await item.click();
}

async function waitForKeyboardLabel(expected: string, timeout = 10_000): Promise<void> {
  const kb = getKeyboard();
  await browser.waitUntil(async () => (await kb.getAttribute("aria-label")) === expected, {
    timeout,
    timeoutMsg: `Keyboard aria-label did not become "${expected}" within ${timeout}ms`,
  });
}

async function waitForKeyboardVisible(): Promise<void> {
  await getKeyboard().waitForDisplayed({ timeout: 5_000 });
}

// ---- Test: FLP Component lifecycle ----
//
// Validates that the demo app can be entered via tile click, a demo
// scenario executed (i18n customization), and after navigating back to
// the FLP home page, the app can be re-entered with a clean state.
// This tests the Component lifecycle contract: Component.exit() destroys
// the HotkeyManager, and Component.init() creates a fresh instance.

describe("FLP lifecycle - Component re-entry", () => {
  before(async () => {
    await waitForFlpShell();
  });

  it("should open the app via tile click", async () => {
    await openAppTile();
    await navigateToI18nPage();
    await waitForKeyboardVisible();

    await waitForKeyboardLabel("Virtual Keyboard");
    const shiftLabel = await getShiftLabelText();
    await expect(shiftLabel).toBe("Shift");
  });

  it("should apply French i18n bundle", async () => {
    await selectI18nMode("French");
    await waitForKeyboardLabel("Clavier virtuel");

    const shiftLabel = await getShiftLabelText();
    await expect(shiftLabel).toBe("Maj");
  });

  it("should restore default labels after leaving and re-entering the app via tile click", async () => {
    // Leave: navigate to FLP home (triggers Component.exit)
    await navigateToFlpHome();

    // Re-enter: click the tile again (triggers Component.init on new instance)
    await openAppTile();
    await navigateToI18nPage();
    await waitForKeyboardVisible();

    // i18n auto-reset on last KioskKeyboard instance exit should have
    // cleared the French bundle. Default English labels should be active.
    await waitForKeyboardLabel("Virtual Keyboard");

    const shiftLabel = await getShiftLabelText();
    await expect(shiftLabel).toBe("Shift");
  });
});
