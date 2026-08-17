import { test, expect, type Page } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";

// Per-theme visual regression on the dedicated theme page (qwerty + numpad).

const THEME_BG = {
  sap_horizon: "#f5f6f7",
  sap_horizon_dark: "#12171c",
  sap_horizon_hcb: "#000000",
  sap_horizon_hcw: "#ffffff",
} satisfies Record<string, string>;

type ThemeName = keyof typeof THEME_BG;

declare global {
  interface Window {
    /** Installed by test/pages/visual-themes.js; applies a UI5 theme and resolves once loaded. */
    __setTheme(theme: string): Promise<void>;
  }
}

async function switchTheme(page: Page, theme: ThemeName): Promise<void> {
  await page.evaluate((t) => window.__setTheme(t), theme);
  await page.waitForFunction(
    (t) => getComputedStyle(document.documentElement).getPropertyValue("--sapThemeMetaData-Base-baseLib").includes(t),
    theme,
    { timeout: 5_000 },
  );
  await page.evaluate((bg) => (document.body.style.background = bg), THEME_BG[theme]);
}

test.describe("Theme Visual Regression", () => {
  for (const theme of ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"] satisfies ThemeName[]) {
    test.describe(theme, () => {
      test.beforeEach(async ({ page }) => {
        await openPage(page, "/test/pages/visual-themes.html");
        await switchTheme(page, theme);
      });

      test(`webc-qwerty-${theme}`, async ({ page }) => {
        await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot(`webc-qwerty-${theme}.png`);
      });

      test(`webc-numpad-${theme}`, async ({ page }) => {
        await expect(keyboardRoot(page, "kb-numpad")).toHaveScreenshot(`webc-numpad-${theme}.png`);
      });
    });
  }
});
