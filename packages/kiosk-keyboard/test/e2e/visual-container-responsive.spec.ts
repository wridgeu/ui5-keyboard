import { test } from "@playwright/test";
import { openPage, keyboardRoot, expectVisualMatch } from "./helpers.js";

// Responsive height-constrained visual regression (desktop + device matrix).
// Some targets are the container/wrapper (content overflows the keyboard root).

test.beforeEach(async ({ page }) => {
  await openPage(page);
});

// ["root" pierces to the keyboard; "el" snapshots the container/wrapper element]
const cases: Array<["root" | "el", string, string]> = [
  ["root", "kb-vw-height-short", "kb-vw-height-short"],
  ["el", "kb-vw-height-tiny", "kb-vw-height-tiny"],
  ["el", "kb-flex-auto-wrap", "kb-flex-auto"],
  ["el", "kb-grid-auto-wrap", "kb-grid-auto"],
  ["root", "kb-unconstrained", "kb-unconstrained"],
];

for (const [kind, id, tag] of cases) {
  test(tag, async ({ page }) => {
    const locator = kind === "root" ? keyboardRoot(page, id) : page.locator(`#${id}`);
    await expectVisualMatch(page, locator, `${tag}.png`);
  });
}
