import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, CLOSED_CLASS } from "./helpers.js";

// Docked keyboard focus behavior (desktop-only, behavioral). Open/closed state
// is asserted natively via the closed-state class (Playwright auto-waits).

const PAGE = "/test-resources/ui5/kiosk/e2e/focus/index.html";
const CLOSED = new RegExp(CLOSED_CLASS);
const expectOpen = (page: import("@playwright/test").Page) => expect(keyboardRoot(page, "kb")).not.toHaveClass(CLOSED);
const expectClosed = (page: import("@playwright/test").Page) => expect(keyboardRoot(page, "kb")).toHaveClass(CLOSED);

test.beforeEach(async ({ page }) => {
  await openPage(page, PAGE);
});

test("opens when an input is focused", async ({ page }) => {
  await page.locator("#input-a input").click();
  await expectOpen(page);
});

test("stays open when focus moves from one input to another", async ({ page }) => {
  await page.locator("#input-a input").click();
  await expectOpen(page);

  await page.locator("#input-b input").click();
  // Negative assertion: give any (incorrect) close a chance to happen, then assert it stayed open.
  // oxlint-disable-next-line test-guardrails/no-hard-wait -- no event signals the absence of a close
  await page.waitForTimeout(300);
  await expectOpen(page);
});

test("closes when focus moves to a non-input element", async ({ page }) => {
  await page.locator("#input-b input").click();
  await expectOpen(page);

  await page.locator("#blur-target").click();
  await expectClosed(page);
});

test("reopens when an input is focused again after closing", async ({ page }) => {
  await page.locator("#input-b input").click();
  await expectOpen(page);

  await page.locator("#blur-target").click();
  await expectClosed(page);

  await page.locator("#input-a input").click();
  await expectOpen(page);
});
