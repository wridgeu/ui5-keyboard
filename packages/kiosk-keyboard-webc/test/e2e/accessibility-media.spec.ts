import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";

// Accessibility media-query visual regression. Media must be emulated before
// navigation so the component renders in the target mode from the start.

// reduced-motion is intentionally not snapshotted: it only sets transition/
// transform to none, which has no effect on a settled screenshot (animations
// are already disabled), so the baseline is byte-identical to webc-qwerty.png.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null });
});

test("webc-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("webc-qwerty-forced-colors.png");
});
