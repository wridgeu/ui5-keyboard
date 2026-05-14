import fs from "node:fs";
import path from "node:path";
import { browser, $ } from "@wdio/globals";
import { VISUAL_PAGE, openVisualPage } from "./test-helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";

const __dirname = import.meta.dirname;
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "docs", "kiosk", "images");

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];

describe("README screenshots", () => {
  it("captures full-size inline keyboards across themes", async () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const theme of THEMES) {
      await openVisualPage(`${VISUAL_PAGE}?sap-ui-theme=${theme}`);

      // Element screenshots can place the virtual pointer on descendant keys,
      // which may trigger :hover and create non-deterministic key colors
      // (notably visible in high-contrast themes). Disable pointer interactions
      // on keyboard roots during capture to keep screenshots stable.
      await browser.execute((rootSel: string) => {
        const keyboards = document.querySelectorAll(rootSel);
        for (const el of keyboards) {
          (el as HTMLElement).style.pointerEvents = "none";
        }
      }, DOM.selectors.root);

      const inlineWide = await $(`#kb-wide ${DOM.selectors.root}`);
      await inlineWide.waitForDisplayed({ timeout: 20_000 });
      await inlineWide.saveScreenshot(path.join(OUTPUT_DIR, `kiosk-inline-wide-${theme}.png`));
    }
  });
});
