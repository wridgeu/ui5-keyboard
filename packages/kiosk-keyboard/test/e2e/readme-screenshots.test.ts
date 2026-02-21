import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { browser, $ } from "@wdio/globals";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "docs", "kiosk", "images");
const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];

describe("README screenshots", () => {
  it("captures full-size inline and docked keyboards across themes", async () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const theme of THEMES) {
      await browser.url(`${VISUAL_PAGE}?sap-ui-theme=${theme}`);

      const readyMarker = await $("#kb-stable-height .ui5KioskKeyboard");
      await readyMarker.waitForExist({ timeout: 20_000 });

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

      const toggleDocked = await $("#toggle-docked");
      await toggleDocked.click();

      const docked = await $("#kb-docked .ui5KioskKeyboard");
      await docked.waitForDisplayed({ timeout: 20_000 });
      await docked.waitUntil(
        async () => {
          const classes = (await docked.getAttribute("class")) ?? "";
          const size = await docked.getSize();
          return !classes.includes("ui5KioskKeyboard--closed") && size.height > 80;
        },
        { timeout: 20_000, timeoutMsg: `Docked keyboard did not open in theme ${theme}` },
      );
      await browser.saveScreenshot(path.join(OUTPUT_DIR, `kiosk-docked-${theme}.png`));
    }
  });
});
