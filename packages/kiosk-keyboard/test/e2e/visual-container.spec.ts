import { test, type Page } from "@playwright/test";
import { openPage, keyboardRoot, expectVisualMatch } from "./helpers.js";

// Fixed-container visual regression (desktop + device matrix). Tests that need a
// wider viewport than a small phone skip themselves at runtime.

test.beforeEach(async ({ page }) => {
  await openPage(page);
});

const vw = (page: Page): number => page.viewportSize()?.width ?? 0;

// [target kind, element id, tag, minViewportWidth]
const cases: Array<["root" | "el", string, string, number]> = [
  ["root", "kb-wide", "kb-wide", 620],
  ["root", "kb-narrow", "kb-narrow", 0],
  ["el", "kb-container-fixed", "kb-container-fixed", 420],
  ["el", "kb-height-constrained", "kb-height-constrained", 420],
  ["el", "kb-height-tiny", "kb-height-tiny", 420],
  ["el", "kb-ancestor-constrained-wrap", "kb-ancestor-constrained", 420],
  ["el", "kb-ancestor-tiny-wrap", "kb-ancestor-tiny", 420],
  ["el", "kb-narrow-short", "kb-narrow-short", 0],
];

for (const [kind, id, tag, minWidth] of cases) {
  test(tag, async ({ page }) => {
    test.skip(vw(page) < minWidth, `fixture needs >= ${minWidth}px`);
    const locator = kind === "root" ? keyboardRoot(page, id) : page.locator(`#${id}`);
    await expectVisualMatch(page, locator, `${tag}.png`);
  });
}
