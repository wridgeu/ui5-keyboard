import path from "node:path";
import { test } from "@playwright/test";
import { openPage, keyboardRoot } from "./helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";

// Generates the full-size inline-keyboard images used in the README, one per
// theme. Not a regression test: run on demand via `npm run test:e2e:docs`
// (playwright.docs.config.ts), it writes into docs/kiosk/images.

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../../../docs/kiosk/images");
const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

for (const theme of ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"]) {
  test(`README screenshot: ${theme}`, async ({ page }) => {
    await openPage(page, `${VISUAL_PAGE}?sap-ui-theme=${theme}`);
    // Disable pointer interactions on keyboard roots so the virtual cursor does
    // not trigger :hover and produce non-deterministic key colors.
    await page.evaluate((rootSel) => {
      for (const el of document.querySelectorAll<HTMLElement>(rootSel)) {
        el.style.pointerEvents = "none";
      }
    }, DOM.selectors.root);
    await keyboardRoot(page, "kb-wide").screenshot({ path: path.join(OUTPUT_DIR, `kiosk-inline-wide-${theme}.png`) });
  });
}
