import { test, type Page } from "@playwright/test";
import { openPage, expectKeyboardVisualMatch } from "./helpers.js";

// Per-theme visual regression (desktop + device matrix). The theme is set via a
// URL parameter so OpenUI5 bootstraps with the right CSS from the start.

const THEMES_PAGE = "/test-resources/ui5/kiosk/e2e/visual/themes.html";
const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"] as const;
type ThemeId = (typeof THEMES)[number];

const THEME_BACKGROUNDS = {
  sap_horizon: "#f5f6f7",
  sap_horizon_dark: "#12171c",
  sap_horizon_hcb: "#000000",
  sap_horizon_hcw: "#ffffff",
} satisfies Record<ThemeId, string>;

async function openWithTheme(page: Page, theme: ThemeId): Promise<void> {
  await openPage(page, `${THEMES_PAGE}?sap-ui-theme=${theme}`);
  await page.evaluate((bg) => {
    document.body.style.background = bg;
    for (const el of document.querySelectorAll<HTMLElement>(".keyboard-container")) {
      el.style.background = bg;
    }
  }, THEME_BACKGROUNDS[theme]);
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test.beforeEach(async ({ page }) => {
      await openWithTheme(page, theme);
    });

    test(`kb-qwerty-${theme}`, async ({ page }) => {
      await expectKeyboardVisualMatch(page, "kb-qwerty", `kb-qwerty-${theme}.png`);
    });

    test(`kb-numpad-${theme}`, async ({ page }) => {
      await expectKeyboardVisualMatch(page, "kb-numpad", `kb-numpad-${theme}.png`);
    });
  });
}
