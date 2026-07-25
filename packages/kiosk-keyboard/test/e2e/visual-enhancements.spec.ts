import { test } from "@playwright/test";
import { openPage, expectVisualMatch, expectKeyboardVisualMatch, DISABLE_TEXT_BOX_TRIM } from "./helpers.js";

// Fallback visual regression: how keys render with text-box-trim forced off.
// Captures the rendering a non-supporting browser would show.

test.beforeEach(async ({ page }) => {
  await openPage(page);
  await page.addStyleTag({ content: DISABLE_TEXT_BOX_TRIM });
});

test("kb-qwerty-no-text-trim", async ({ page }) => {
  await expectKeyboardVisualMatch(page, "kb-qwerty", "kb-qwerty-no-text-trim.png");
});

test("kb-narrow-no-text-trim", async ({ page }) => {
  await expectKeyboardVisualMatch(page, "kb-narrow", "kb-narrow-no-text-trim.png");
});

test("kb-height-constrained-no-text-trim", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 420, "height-constrained fixture needs >= 420px");
  await expectVisualMatch(page, page.locator("#kb-height-constrained"), "kb-height-constrained-no-text-trim.png");
});

test("kb-glyph-stress-no-text-trim", async ({ page }) => {
  await expectKeyboardVisualMatch(page, "kb-glyph-stress", "kb-glyph-stress-no-text-trim.png");
});
