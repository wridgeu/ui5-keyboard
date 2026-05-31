import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";

// Accessibility media-query visual regression (desktop + device matrix). Media
// is emulated before navigation so the control renders in the target mode.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null, reducedMotion: null });
});

test("kb-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("kb-qwerty-forced-colors.png");
});

test("kb-qwerty-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page);
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("kb-qwerty-reduced-motion.png");
});
