import { test, expect } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";
import { openPage, keyboardRoot, key } from "./helpers.js";

// Accessibility media-query visual regression. Media must be emulated before
// navigation so the component renders in the target mode from the start.

// reduced-motion is intentionally not snapshotted: it only sets transition/
// transform to none, which has no effect on a settled screenshot (animations
// are already disabled), so the baseline is byte-identical to webc-qwerty.png.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null });
});

test("webc-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("webc-qwerty-forced-colors.png");
});

// The variant-hint ::after paints only under `accent-variants`, so it needs its
// own forced-colors capture (the qwerty fixture above carries no variant keys).
test("webc-accent-variants-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-accent-variants")).toHaveScreenshot("webc-accent-variants-forced-colors.png");
});

// The active/highlight arm inverts the hint to HighlightText so it stays
// visible where the key itself paints on Highlight. Asserted on the computed
// pseudo-element rather than captured: the variant fixture has no target input
// to drive a physical-key highlight, and holding a pointer down to force
// `:active` also arms the long-press variant popup.
test("webc-accent-variants-forced-colors-highlight", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  const variantKey = key(page, "kb-accent-variants", "a");
  await expect(variantKey).toHaveAttribute(DOM.attributes.hasVariants, "");
  const restingHint = await variantKey.evaluate((el) => getComputedStyle(el, "::after").backgroundColor);
  const highlighted = await variantKey.evaluate((el, highlightClass) => {
    el.classList.add(highlightClass);
    return { hint: getComputedStyle(el, "::after").backgroundColor, text: getComputedStyle(el).color };
  }, DOM.classes.keyHighlight);
  expect(highlighted.hint).toBe(highlighted.text);
  expect(highlighted.hint).not.toBe(restingHint);
});
