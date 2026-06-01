import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, CLOSED_CLASS } from "./helpers.js";

// inputmode suppression across keyboard modes (desktop-only, behavioral).

const PAGE = "/test-resources/ui5/kiosk/e2e/inputmode/index.html";
const CLOSED = new RegExp(CLOSED_CLASS);

test.beforeEach(async ({ page }) => {
  await openPage(page, PAGE);
});

test("Custom: suppresses inputmode and opens the keyboard", async ({ page }) => {
  await page.locator("#input-custom input").click();
  await expect(keyboardRoot(page, "kb-custom")).not.toHaveClass(CLOSED);
  await expect(page.locator("#input-custom input")).toHaveAttribute("inputmode", "none");
});

test("Native: keeps inputmode and does not open the keyboard", async ({ page }) => {
  await page.locator("#input-native input").click();
  // Negative assertion: give any (incorrect) open a chance, then assert it stayed closed.
  // oxlint-disable-next-line test-guardrails/no-hard-wait -- no event signals the absence of an open
  await page.waitForTimeout(400);
  await expect(keyboardRoot(page, "kb-native")).toHaveClass(CLOSED);
  await expect(page.locator("#input-native input")).not.toHaveAttribute("inputmode", "none");
});

test("Auto (desktop): suppresses inputmode and opens the keyboard", async ({ page }) => {
  await page.locator("#input-auto input").click();
  await expect(keyboardRoot(page, "kb-auto")).not.toHaveClass(CLOSED);
  await expect(page.locator("#input-auto input")).toHaveAttribute("inputmode", "none");
});

test("restores the original inputmode when the keyboard closes", async ({ page }) => {
  await page.locator("#input-custom input").click();
  await expect(keyboardRoot(page, "kb-custom")).not.toHaveClass(CLOSED);
  await expect(page.locator("#input-custom input")).toHaveAttribute("inputmode", "none");

  await page.locator("#blur-target").click();
  await expect(keyboardRoot(page, "kb-custom")).toHaveClass(CLOSED);
  await expect(page.locator("#input-custom input")).not.toHaveAttribute("inputmode", "none");
});
