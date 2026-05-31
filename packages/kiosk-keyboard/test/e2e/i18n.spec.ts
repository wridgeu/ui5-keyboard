import { test, expect, type Page, type Locator } from "@playwright/test";
import { openPage, keyboardRoot, key } from "./helpers.js";

// KioskKeyboard i18n e2e (desktop-only, behavioral). Each test runs on a fresh
// page, so the global i18n resolver resets between tests with no manual cleanup.

const PAGE = "/test-resources/ui5/kiosk/e2e/i18n/index.html";

const keyLabel = (page: Page, containerId: string, dataKey: string): Locator =>
  key(page, containerId, dataKey).locator(".ui5KioskKey__label");

const clickControl = (page: Page, controlsId: string, text: string): Promise<void> =>
  page.locator(`#${controlsId}`).getByRole("button", { name: text }).click();

test.beforeEach(async ({ page }) => {
  await openPage(page, PAGE);
});

test("baseline: default English aria-label and key labels", async ({ page }) => {
  await expect(keyboardRoot(page, "kb-baseline")).toHaveAttribute("aria-label", "Virtual Keyboard");
  await expect(keyLabel(page, "kb-baseline", "{shift}")).toHaveText("Shift");
  await expect(keyLabel(page, "kb-baseline", "{enter}")).toHaveText("Enter");
});

test("French resolver updates labels", async ({ page }) => {
  await clickControl(page, "controls-french", "Apply French bundle");
  await expect(keyboardRoot(page, "kb-french")).toHaveAttribute("aria-label", "Clavier virtuel");
  await expect(keyLabel(page, "kb-french", "{shift}")).toHaveText("Maj");
});

test("French resolver restores English after reset", async ({ page }) => {
  await clickControl(page, "controls-french", "Apply French bundle");
  await expect(keyboardRoot(page, "kb-french")).toHaveAttribute("aria-label", "Clavier virtuel");
  await clickControl(page, "controls-french", "Reset to defaults");
  await expect(keyboardRoot(page, "kb-french")).toHaveAttribute("aria-label", "Virtual Keyboard");
});

test("override applies custom labels", async ({ page }) => {
  await clickControl(page, "controls-override", "Apply overrides");
  await expect(keyboardRoot(page, "kb-override")).toHaveAttribute("aria-label", "Touch Keyboard");
  await expect(keyLabel(page, "kb-override", "{enter}")).toHaveText("Go");
  await expect(keyLabel(page, "kb-override", "{backspace}")).toHaveText("Delete");
});

test("override keeps non-overridden keys at base text", async ({ page }) => {
  await clickControl(page, "controls-override", "Apply overrides");
  await expect(keyboardRoot(page, "kb-override")).toHaveAttribute("aria-label", "Touch Keyboard");
  await expect(keyLabel(page, "kb-override", "{shift}")).toHaveText("Shift");
});

test("override hook transforms labels", async ({ page }) => {
  await clickControl(page, "controls-hook", "Set override hook");
  await expect(keyboardRoot(page, "kb-hook")).toHaveAttribute("aria-label", /⌨/);
  await expect(keyLabel(page, "kb-hook", "{shift}")).toHaveText("SHIFT");
});

test("override hook restores defaults after reset", async ({ page }) => {
  await clickControl(page, "controls-hook", "Set override hook");
  await expect(keyboardRoot(page, "kb-hook")).toHaveAttribute("aria-label", /⌨/);
  await clickControl(page, "controls-hook", "Reset to defaults");
  await expect(keyboardRoot(page, "kb-hook")).toHaveAttribute("aria-label", "Virtual Keyboard");
  await expect(keyLabel(page, "kb-hook", "{shift}")).toHaveText("Shift");
});
