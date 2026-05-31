import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";

// Forced-colors (high contrast) visual regression (desktop + device matrix).
// Media is emulated before navigation so the control renders in the target mode.
// (prefers-reduced-motion is not tested: the keyboard has no idle animation, so
// it renders identically to the default, adding no regression coverage.)

test("kb-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("kb-qwerty-forced-colors.png");
});
