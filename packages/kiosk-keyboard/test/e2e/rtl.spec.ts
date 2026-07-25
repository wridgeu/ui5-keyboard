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
]) {
  test(tag, async ({ page }) => {
    await expectKeyboardVisualMatch(page, id, `${tag}.png`);
  });
}
