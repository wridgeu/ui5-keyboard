import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { browser, $ } from "@wdio/globals";
import { VISUAL_PAGE, openVisualPage } from "./test-helpers.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
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
      await browser.execute(() => {
        const keyboards = document.querySelectorAll(".ui5KioskKeyboard");
        for (const el of keyboards) {
          (el as HTMLElement).style.pointerEvents = "none";
        }
      });

      const inlineWide = await $("#kb-wide .ui5KioskKeyboard");
      await inlineWide.waitForDisplayed({ timeout: 20_000 });
      await inlineWide.saveScreenshot(path.join(OUTPUT_DIR, `kiosk-inline-wide-${theme}.png`));
    }
  });
});
