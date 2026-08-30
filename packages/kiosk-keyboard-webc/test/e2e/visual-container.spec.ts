import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, expectVisualMatch } from "./helpers.js";

// Container-query / constrained-layout visual regression. All targets live on
// the visual page; some snapshots target the light-DOM wrapper element.

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
});

// [locator kind, id, tag]. "root" pierces to the keyboard root; "wrap" snapshots
// the light-DOM wrapper that constrains the keyboard.
const cases: Array<["root" | "wrap", string, string]> = [
  ["root", "kb-narrow", "webc-narrow"],
  ["root", "kb-glyph-stress", "webc-glyph-stress"],
  ["root", "kb-height-constrained", "webc-height-constrained"],
  ["root", "kb-height-tiny", "webc-height-tiny"],
  ["wrap", "kb-ancestor-constrained-wrap", "webc-ancestor-constrained"],
  ["wrap", "kb-ancestor-tiny-wrap", "webc-ancestor-tiny"],
  ["root", "kb-height-padded-host", "webc-height-padded-host"],
  ["root", "kb-narrow-short", "webc-narrow-short"],
  ["root", "kb-custom-threshold", "webc-custom-threshold"],
  ["wrap", "kb-flex-auto-wrap", "webc-flex-auto"],
  ["wrap", "kb-grid-auto-wrap", "webc-grid-auto"],
  ["root", "kb-unconstrained", "webc-unconstrained"],
];

for (const [kind, id, tag] of cases) {
  test(tag, async ({ page }) => {
    // A wrapper's box is authored by the fixture page, so it resolves whether or
    // not the keyboard inside it rendered.
    if (kind === "wrap") await expect(keyboardRoot(page, id)).toBeVisible();
    const locator = kind === "wrap" ? page.locator(`#${id}`) : keyboardRoot(page, id);
    await expectVisualMatch(locator, `${tag}.png`);
  });
}
