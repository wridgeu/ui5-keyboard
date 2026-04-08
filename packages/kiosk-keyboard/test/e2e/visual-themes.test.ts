import { browser, $ } from "@wdio/globals";
import { matchElementSnapshotInSection } from "./test-helpers.js";

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];

/** Background colors that match each theme for the page body. */
const THEME_BACKGROUNDS: Record<string, string> = {
  sap_horizon: "#f5f6f7",
  sap_horizon_dark: "#12171c",
  sap_horizon_hcb: "#000",
  sap_horizon_hcw: "#fff",
};

const THEMES_PAGE = "/test-resources/ui5/kiosk/e2e/visual/themes.html";

async function openWithTheme(theme: string): Promise<void> {
  // Load the page with the theme pre-set via URL parameter so OpenUI5 bootstraps
  // with the correct theme CSS from the start - no runtime switching needed.
  await browser.url(`${THEMES_PAGE}?sap-ui-theme=${theme}`);
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const keyboards = document.querySelectorAll(".ui5KioskKeyboard");
        if (keyboards.length === 0) return false;
        return [...keyboards].every((kb) => kb.querySelectorAll('[role="button"]').length > 0);
      }),
    { timeout: 15_000, timeoutMsg: "Keyboard keys not rendered" },
  );
  await browser.execute((bg) => {
    document.body.style.background = bg;
    for (const el of document.querySelectorAll<HTMLElement>(".keyboard-container")) {
      el.style.background = bg;
    }
  }, THEME_BACKGROUNDS[theme]);
}

function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
}

describe("KioskKeyboard Theme Visual Regression", () => {
  for (const theme of THEMES) {
    describe(`${theme}`, () => {
      before(async () => {
        await openWithTheme(theme);
      });

      it(`should match QWERTY layout in ${theme}`, async () => {
        const kb = await getKeyboard("kb-qwerty");
        await matchElementSnapshotInSection(kb, `kb-qwerty-${theme}`);
      });

      it(`should match Numpad layout in ${theme}`, async () => {
        const kb = await getKeyboard("kb-numpad");
        await matchElementSnapshotInSection(kb, `kb-numpad-${theme}`);
      });
    });
  }
});
