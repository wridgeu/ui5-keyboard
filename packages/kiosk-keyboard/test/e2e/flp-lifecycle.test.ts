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
  await browser.waitUntil(async () => (await $$(".sapMGT").length) > 0, {
    timeout: 30_000,
    timeoutMsg: "FLP home page tiles did not render",
  });
}

/**
 * Click the demo-app tile in the FLP launchpad.
 * Uses the Generic Tile (.sapMGT) which is the actual clickable element.
 * Waits for the app's NavContainer to appear.
 */
async function openAppTile(): Promise<void> {
  const tile = await $(".sapMGT");
  await tile.click();
  // sap.m.App extends NavContainer → rendered with class "sapMNav"
  await $(".sapMNav").waitForExist({ timeout: 30_000 });
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
 * In FLP, inner app routes are appended after "&/".
 * Waits for the KioskKeyboard on that page to render.
 */
async function navigateToI18nPage(): Promise<void> {
  await navigateToHash("DemoApp-display&/kiosk/i18n-extensibility");
  await $(".ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

/**
 * Navigate back to FLP home, triggering Component.destroy() → auto-reset.
 * Waits until the FLP tile reappears.
 */
async function navigateToFlpHome(): Promise<void> {
  await navigateToHash("Shell-home");
  await browser.waitUntil(async () => (await $$(".sapMGT").length) > 0, {
    timeout: 15_000,
    timeoutMsg: "FLP home tiles did not reappear after navigation",
  });
}

/**
 * Get the keyboard element on the i18n page.
 */
function getKeyboard() {
  return $(".ui5KioskKeyboard");
}

/** Get visible label text of a key via native DOM (more reliable than WDIO getText for small elements). */
async function getShiftLabelText(): Promise<string> {
  return browser.execute(() => {
    const kb = document.querySelector(".ui5KioskKeyboard");
    const key = kb?.querySelector('[data-key="{shift}"]');
    return key?.querySelector(".ui5KioskKey__label")?.textContent ?? "";
  });
}

/**
 * Click a SegmentedButtonItem by its visible text on the i18n page.
 * SegmentedButton renders items as `<li role="option">` - wdio's `li=` selector matches by text.
 */
async function selectI18nMode(text: string): Promise<void> {
  const item = await $(`li=${text}`);
  await item.click();
}

/**
 * Wait until the keyboard's aria-label matches the expected value.
 */
async function waitForKeyboardLabel(expected: string, timeout = 10_000): Promise<void> {
  const kb = getKeyboard();
  await browser.waitUntil(async () => (await kb.getAttribute("aria-label")) === expected, {
    timeout,
    timeoutMsg: `Keyboard aria-label did not become "${expected}" within ${timeout}ms`,
  });
}

/**
 * Wait for the inline keyboard on the i18n page to be visible.
 */
async function waitForKeyboardVisible(): Promise<void> {
  await getKeyboard().waitForDisplayed({ timeout: 5_000 });
}

// ─── Test Scenarios ──────────────────────────────────────────

describe("FLP lifecycle - i18n auto-reset", () => {
  before(async () => {
    await waitForFlpShell();
  });

  describe("Scenario 1: Component leave clears i18n bundle", () => {
    it("should show French labels after applying French bundle", async () => {
      await openAppTile();
      await navigateToI18nPage();
      await waitForKeyboardVisible();

      // Apply French mode
      await selectI18nMode("French");
      await waitForKeyboardLabel("Clavier virtuel");

      const shiftLabel = await getShiftLabelText();
      await expect(shiftLabel).toBe("Maj");
    });

    it("should show default English labels after Component re-enter", async () => {
      // Leave app → Component.destroy() → auto-reset
      await navigateToFlpHome();

      // Re-enter app
      await openAppTile();
      await navigateToI18nPage();
      await waitForKeyboardVisible();

      // Keyboard should show default English labels (i18n was auto-reset)
      await waitForKeyboardLabel("Virtual Keyboard");

      const shiftLabel = await getShiftLabelText();
      await expect(shiftLabel).toBe("Shift");
    });
  });

  describe("Scenario 2: Component leave clears override hook", () => {
    before(async () => {
      // Ensure clean FLP home state regardless of Scenario 1 outcome
      await navigateToFlpHome();
    });

    it("should show uppercased labels after applying hook", async () => {
      await openAppTile();
      await navigateToI18nPage();
      await waitForKeyboardVisible();

      // Apply Hook mode (uppercases special-key labels)
      await selectI18nMode("Hook");
      await waitForKeyboardLabel("Custom Keyboard");

      const shiftLabel = await getShiftLabelText();
      await expect(shiftLabel).toBe("SHIFT");
    });

    it("should show default labels after Component re-enter", async () => {
      // Leave app → Component.destroy() → auto-reset clears hook
      await navigateToFlpHome();

      // Re-enter app
      await openAppTile();
      await navigateToI18nPage();
      await waitForKeyboardVisible();

      // Hook should be cleared - default labels restored
      await waitForKeyboardLabel("Virtual Keyboard");

      const shiftLabel = await getShiftLabelText();
      await expect(shiftLabel).toBe("Shift");
    });
  });
});
