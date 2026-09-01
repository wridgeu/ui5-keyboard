import { test } from "@playwright/test";
import { openPage, expectKeyboardVisualMatch, setDocumentDirection } from "./helpers.js";

// Right-to-left visual regression (desktop + device matrix).
//
// The captures are the whole assertion, so CI's --ignore-snapshots leaves these
// checking nothing. No computed style on the root closes that gap: `direction`
// reaches it by inheritance from the document `dir` the helper sets, so a bare
// <div> on the page reports `rtl` just as well, and asserting it would hold for
// every implementation. The RTL that is production's - the mirrored corner hint,
// the popup's arrow polarity - is asserted in KioskKeyboard-variants.qunit.ts.

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
