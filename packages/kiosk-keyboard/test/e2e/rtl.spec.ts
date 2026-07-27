import { test } from "@playwright/test";
import { openPage, expectKeyboardVisualMatch, setDocumentDirection } from "./helpers.js";

// Right-to-left visual regression (desktop + device matrix).

test.beforeEach(async ({ page }) => {
  await openPage(page);
  await setDocumentDirection(page, "rtl");
});

for (const { id, tag } of [
  { id: "kb-qwerty", tag: "kb-qwerty-rtl" },
  { id: "kb-numpad", tag: "kb-numpad-rtl" },
  { id: "kb-numeric", tag: "kb-numeric-rtl" },
  { id: "kb-arabic", tag: "kb-arabic-rtl" },
  // The corner hint's clip-path is mirrored for RTL. This is the only fixture
  // that arms variants: `arabic` resolves its built-in table to null.
  { id: "kb-accent-variants", tag: "kb-accent-variants-rtl" },
]) {
  test(tag, async ({ page }) => {
    await expectKeyboardVisualMatch(page, id, `${tag}.png`);
  });
}
