import { test, expect, type Page } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, keyboardRoot, CLOSED_CLASS } from "./helpers.js";

// Interop: the keyboard targets UI5 controls, a bridge custom element, and a
// shadow-DOM custom element via the page's interop harness (desktop-only).

const PAGE = "/test-resources/ui5/kiosk/e2e/interop/index.html";
const CLOSED = new RegExp(CLOSED_CLASS);
const NUMPAD = new RegExp(DOM.keyboardTypeClass("Numpad"));

interface InteropHarness {
  focusControlById(id: string): void;
  getKeyboardTargetId(): string;
  focusCustomElement(): void;
  focusShadowCustomElement(): void;
}
type InteropWindow = Window & { interopHarnessReady?: boolean; interopHarness?: InteropHarness };

async function openInteropPage(page: Page): Promise<void> {
  await openPage(page, PAGE);
  await page.waitForFunction(
    () => {
      const w = window as InteropWindow;
      return Boolean(
        w.interopHarnessReady &&
        w.interopHarness?.focusControlById &&
        w.interopHarness?.getKeyboardTargetId &&
        w.interopHarness?.focusCustomElement &&
        w.interopHarness?.focusShadowCustomElement,
      );
    },
    { timeout: 10_000 },
  );
}

const targetId = (page: Page) => page.evaluate(() => (window as InteropWindow).interopHarness!.getKeyboardTargetId());

test.beforeEach(async ({ page }) => {
  await openInteropPage(page);
});

test("opens and targets StepInput via controls", async ({ page }) => {
  await page.evaluate(() => (window as InteropWindow).interopHarness!.focusControlById("interopStep"));
  await expect(keyboardRoot(page, "interop-kb")).not.toHaveClass(CLOSED);
  await expect(keyboardRoot(page, "interop-kb")).toHaveClass(NUMPAD);
  expect(await targetId(page)).toBe("interopStep");
});

test("opens and targets TextArea via controls", async ({ page }) => {
  await page.evaluate(() => (window as InteropWindow).interopHarness!.focusControlById("interopTextArea"));
  await expect(keyboardRoot(page, "interop-kb")).not.toHaveClass(CLOSED);
  expect(await targetId(page)).toBe("interopTextArea");
});

test("opens for a custom element and targets the bridge input", async ({ page }) => {
  await page.evaluate(() => (window as InteropWindow).interopHarness!.focusCustomElement());
  await expect(keyboardRoot(page, "interop-kb")).not.toHaveClass(CLOSED);
  expect(await targetId(page)).toBe("interopBridgeInput");
});

test("opens for a shadow custom element and targets the shadow bridge input", async ({ page }) => {
  await page.evaluate(() => (window as InteropWindow).interopHarness!.focusShadowCustomElement());
  await expect(keyboardRoot(page, "interop-kb")).not.toHaveClass(CLOSED);
  expect(await targetId(page)).toBe("interopShadowBridgeInput");
});
