import { test } from "@playwright/test";
import { openPage, expectKeyboardVisualMatch } from "./helpers.js";

// Forced-colors (high contrast) visual regression (desktop + device matrix).
// Media is emulated before navigation so the control renders in the target mode.
// (prefers-reduced-motion is not tested: the keyboard has no idle animation, so
// it renders identically to the default, adding no regression coverage.)

test("kb-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expectKeyboardVisualMatch(page, "kb-qwerty", "kb-qwerty-forced-colors.png");
});

// The variant-hint ::after paints only under `accentVariants`, so it needs its
// own forced-colors capture (the qwerty fixture above carries no variant keys).
test("kb-accent-variants-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expectKeyboardVisualMatch(page, "kb-accent-variants", "kb-accent-variants-forced-colors.png");
});
