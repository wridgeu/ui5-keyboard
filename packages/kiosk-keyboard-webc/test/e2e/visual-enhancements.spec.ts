import { test, expect } from "@playwright/test";
import {
  openPage,
  keyboardRoot,
  injectShadowStyleOverride,
  removeShadowStyleOverride,
  DISABLE_TEXT_BOX_TRIM,
} from "./helpers.js";

// Progressive-enhancement fallback visual regression: how keys render when
// text-box-trim is forced off.

test.describe("Fallback: without text-box-trim", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, "/test/pages/visual.html");
    await injectShadowStyleOverride(page, DISABLE_TEXT_BOX_TRIM, "disable-text-box-trim");
  });
  test.afterEach(async ({ page }) => {
    await removeShadowStyleOverride(page, "disable-text-box-trim");
  });

  for (const { id, tag } of [
    { id: "kb-qwerty", tag: "webc-qwerty-no-text-trim" },
    { id: "kb-narrow", tag: "webc-narrow-no-text-trim" },
    { id: "kb-height-constrained", tag: "webc-height-constrained-no-text-trim" },
    { id: "kb-glyph-stress", tag: "webc-glyph-stress-no-text-trim" },
  ]) {
    test(tag, async ({ page }) => {
      await expect(keyboardRoot(page, id)).toHaveScreenshot(`${tag}.png`);
    });
  }
});
