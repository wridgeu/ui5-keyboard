import { test, expect, type Page } from "@playwright/test";

// FLP Component lifecycle e2e: enter the app via a tile, run the i18n scenario,
// then leave to the FLP home (Component.exit) and re-enter (Component.init on a
// fresh instance) to verify state resets. Driven purely through DOM selectors
// and the ushell window.hasher (no UI5 control-bridge needed).

const FLP_PAGE = "/test/flp.html";
type HasherWindow = Window & typeof globalThis & { hasher: { setHash(hash: string): void } };

async function waitForFlpShell(page: Page): Promise<void> {
  await page.goto(FLP_PAGE);
  await page.locator("#shell-header").waitFor({ timeout: 30_000 });
  await page.locator(".sapMGT").first().waitFor({ timeout: 30_000 });
}

async function openAppTile(page: Page): Promise<void> {
  await page.locator(".sapMGT").first().click();
  // Confirm the app started via the hash, then that a page rendered. Use counts
  // (not a specific element) because stale pages from a prior session may exist.
  await page.waitForFunction(() => window.location.hash.includes("DemoApp-display"), null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll(".sapMPage").length > 0, null, { timeout: 30_000 });
}

async function navigateToHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => (window as HasherWindow).hasher.setHash(h), hash);
}

async function navigateToI18nPage(page: Page): Promise<void> {
  await navigateToHash(page, "DemoApp-display&/kiosk/i18n-extensibility");
  await page.locator(".ui5KioskKeyboard").first().waitFor({ timeout: 15_000 });
}

async function navigateToFlpHome(page: Page): Promise<void> {
  await navigateToHash(page, "Shell-home");
  await page.locator(".sapMGT").first().waitFor({ timeout: 15_000 });
}

const keyboard = (page: Page) => page.locator(".ui5KioskKeyboard").first();
const shiftLabel = (page: Page) => keyboard(page).locator('[data-key="{shift}"] .ui5KioskKey__label');

test("restores default labels after leaving and re-entering via tile click", async ({ page }) => {
  await waitForFlpShell(page);
  await openAppTile(page);
  await navigateToI18nPage(page);
  await expect(keyboard(page)).toBeVisible();
  await expect(keyboard(page)).toHaveAttribute("aria-label", "Virtual Keyboard");
  await expect(shiftLabel(page)).toHaveText("Shift");

  await page.locator("li").filter({ hasText: "French" }).first().click();
  await expect(keyboard(page)).toHaveAttribute("aria-label", "Clavier virtuel");
  await expect(shiftLabel(page)).toHaveText("Maj");

  await navigateToFlpHome(page);
  await openAppTile(page);
  await navigateToI18nPage(page);
  await expect(keyboard(page)).toBeVisible();
  await expect(keyboard(page)).toHaveAttribute("aria-label", "Virtual Keyboard");
  await expect(shiftLabel(page)).toHaveText("Shift");
});
