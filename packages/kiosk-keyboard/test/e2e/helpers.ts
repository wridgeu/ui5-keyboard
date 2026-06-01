import { type Page, type Locator } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";

/**
 * Minimal e2e helpers for the kiosk-keyboard UI5 control. Only the few things
 * Playwright does not already provide natively live here. For open/closed state
 * use native assertions on `CLOSED_CLASS` (expect(locator).toHaveClass /
 * not.toHaveClass); for media use page.emulateMedia; for one-off styles use
 * page.addStyleTag (test isolation means no teardown is needed).
 *
 * The control renders into light DOM, so locators query the document directly.
 */

const ROOT = DOM.selectors.root; // .ui5KioskKeyboard

/** The "closed" docked-keyboard class, for native toHaveClass assertions. */
export const CLOSED_CLASS = DOM.classes.rootClosed; // ui5KioskKeyboard--closed

export const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

/**
 * Navigate and wait until the last keyboard root is attached. Works for both the
 * visual pages (inline keyboards) and the behavioral pages (docked keyboards that
 * start closed and render keys only once opened). Visual specs additionally rely
 * on toHaveScreenshot's built-in stability retries.
 */
export async function openPage(page: Page, pagePath: string = VISUAL_PAGE): Promise<void> {
  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await page.locator(ROOT).last().waitFor({ state: "attached", timeout: 20_000 });
}

/** The keyboard root element inside a container (light DOM). */
export function keyboardRoot(page: Page, containerId: string): Locator {
  return page.locator(`#${containerId} ${ROOT}`);
}

/** A key inside a container by its data-key value. */
export function key(page: Page, containerId: string, dataKey: string): Locator {
  return page.locator(`#${containerId}`).locator(`[data-key="${dataKey}"]`);
}

/** Set `dir`/`lang` on <html> and toggle the UI5 RTL body class (no native API for this). */
export async function setDocumentDirection(page: Page, dir: "ltr" | "rtl"): Promise<void> {
  await page.evaluate((d) => {
    document.documentElement.setAttribute("dir", d);
    document.documentElement.setAttribute("lang", d === "rtl" ? "ar" : "en");
    document.body.classList.toggle("sapUiRtl", d === "rtl");
  }, dir);
}

/** CSS override disabling the text-box-trim progressive enhancement (fallback baseline). */
export const DISABLE_TEXT_BOX_TRIM = `
  .${DOM.classes.keyLabel},
  .${DOM.classes.keyLabelGlyph} {
    text-box-trim: none !important;
    text-box-edge: auto !important;
  }
  .${DOM.classes.keyLabel} { line-height: 1.2 !important; }
  .${DOM.classes.keyLabelGlyph} { line-height: 1 !important; }
`;
