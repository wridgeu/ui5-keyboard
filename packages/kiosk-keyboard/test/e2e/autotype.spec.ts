import { test, expect, type Page } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, keyboardRoot, CLOSED_CLASS } from "./helpers.js";

// Auto-type detection across input types (desktop-only, behavioral).

const PAGE = "/test-resources/ui5/kiosk/e2e/autotype/index.html";
const CLOSED = new RegExp(CLOSED_CLASS);
const NUMPAD = new RegExp(DOM.keyboardTypeClass("Numpad"));

/** Focus the inner input/textarea of a UI5 control container without a click
 * (clicks would trigger ComboBox/DatePicker popups). */
const focusInput = (page: Page, containerId: string) =>
  page.locator(`#${containerId}`).locator("input, textarea").first().focus();

/** Focus the blur target and wait for the docked keyboard to close. */
async function blurAndWaitForClose(page: Page): Promise<void> {
  await page.locator("#blur-target").focus();
  await expect(keyboardRoot(page, "kb")).toHaveClass(CLOSED);
}

test.beforeEach(async ({ page }) => {
  await openPage(page, PAGE);
});

test.describe("Full keyboard inputs", () => {
  for (const { id, label } of [
    { id: "input-text", label: "Text" },
    { id: "input-email", label: "Email" },
    { id: "input-password", label: "Password" },
    { id: "input-url", label: "URL" },
    { id: "input-textarea", label: "TextArea" },
    { id: "input-search", label: "SearchField" },
    { id: "input-combo", label: "ComboBox" },
    { id: "input-date", label: "DatePicker" },
  ]) {
    test(`opens the Full keyboard for ${label}`, async ({ page }) => {
      await blurAndWaitForClose(page);
      await focusInput(page, id);
      await expect(keyboardRoot(page, "kb")).not.toHaveClass(CLOSED);
      await expect(keyboardRoot(page, "kb")).not.toHaveClass(NUMPAD);
    });
  }
});

test.describe("Numpad keyboard inputs", () => {
  for (const { id, label } of [
    { id: "input-number", label: "Number" },
    { id: "input-tel", label: "Tel" },
    { id: "input-step", label: "StepInput" },
  ]) {
    test(`opens the Numpad keyboard for ${label}`, async ({ page }) => {
      await blurAndWaitForClose(page);
      await focusInput(page, id);
      await expect(keyboardRoot(page, "kb")).not.toHaveClass(CLOSED);
      await expect(keyboardRoot(page, "kb")).toHaveClass(NUMPAD);
    });
  }
});

test.describe("Ignored inputs", () => {
  for (const { label, selector } of [
    { label: "CheckBox", selector: "#input-checkbox input" },
    { label: "RadioButton", selector: "#input-radio input" },
    { label: "Readonly Input", selector: "#input-readonly input" },
    { label: "Raw HTML input", selector: "#input-raw" },
  ]) {
    test(`does not open the keyboard for ${label}`, async ({ page }) => {
      await blurAndWaitForClose(page);
      await page.locator(selector).focus();
      // Negative assertion: give any (incorrect) open a chance, then assert it stayed closed.
      // oxlint-disable-next-line test-guardrails/no-hard-wait -- no event signals the absence of an open
      await page.waitForTimeout(400);
      await expect(keyboardRoot(page, "kb")).toHaveClass(CLOSED);
    });
  }
});
