import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, setDocumentDirection } from "./helpers.js";

// Right-to-left visual regression. Direction is reset after each test.

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
  await setDocumentDirection(page, "rtl");
});

test.afterEach(async ({ page }) => {
  await setDocumentDirection(page, "ltr");
});

for (const { id, tag } of [
  { id: "kb-qwerty", tag: "webc-qwerty-rtl" },
  { id: "kb-numpad", tag: "webc-numpad-rtl" },
  { id: "kb-numeric", tag: "webc-numeric-rtl" },
  { id: "kb-arabic", tag: "webc-arabic-rtl" },
  // The corner hint's clip-path is mirrored for RTL. This is the only fixture
  // that arms variants: `arabic` resolves its built-in table to null.
  { id: "kb-accent-variants", tag: "webc-accent-variants-rtl" },
]) {
  test(tag, async ({ page }) => {
    await expect(keyboardRoot(page, id)).toHaveScreenshot(`${tag}.png`);
  });
}
