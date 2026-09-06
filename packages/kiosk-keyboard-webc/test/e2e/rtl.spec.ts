import { test } from "@playwright/test";
import { openPage, keyboardRoot, expectVisualMatch, setDocumentDirection } from "./helpers.js";

// Right-to-left visual regression.
//
// The captures are the whole assertion, so CI's --ignore-snapshots leaves these
// checking nothing. No computed style on the root closes that gap: `direction`
// reaches it by inheritance from the document `dir` the helper sets, so a bare
// <div> on the page reports `rtl` just as well, and asserting it would hold for
// every implementation. The RTL that is production's is asserted in the component
// suite: the mirrored corner hint in variant-popup.test.ts, arrow polarity there
// and in key-grid-navigation.test.ts.

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
  await setDocumentDirection(page, "rtl");
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
    await expectVisualMatch(keyboardRoot(page, id), `${tag}.png`);
  });
}
