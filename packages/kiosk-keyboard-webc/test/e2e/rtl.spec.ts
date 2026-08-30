import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, expectVisualMatch, setDocumentDirection } from "./helpers.js";

// Right-to-left visual regression. Direction is reset after each test.
//
// CI runs with --ignore-snapshots, so the mirroring itself is asserted rather than
// only captured: the direction the rows lay out along is what every baseline here
// is a picture of, and it is the one part of that picture a computed style can see.

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
    await expect(keyboardRoot(page, id), `${id} did not inherit the document direction`).toHaveCSS("direction", "rtl");
    await expectVisualMatch(keyboardRoot(page, id), `${tag}.png`);
  });
}
