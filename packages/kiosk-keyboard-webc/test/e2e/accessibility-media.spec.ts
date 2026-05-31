import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";

// Accessibility media-query visual regression. Media must be emulated before
// navigation so the component renders in the target mode from the start.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null, reducedMotion: null });
});

test("webc-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("webc-qwerty-forced-colors.png");
});

test("webc-qwerty-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("webc-qwerty-reduced-motion.png");
});
