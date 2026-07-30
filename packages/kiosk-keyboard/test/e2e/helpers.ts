import { expect, type Page, type Locator, type PageAssertionsToHaveScreenshotOptions } from "@playwright/test";
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

/** Pixel-tolerance options a visual spec may pass through; `fullPage`/`clip` are set here. */
type VisualMatchOptions = Omit<PageAssertionsToHaveScreenshotOptions, "fullPage" | "clip">;

/**
 * Compare an in-flow element against its committed visual baseline.
 *
 * Crops a full-page capture, which is in document coordinates, rather than
 * taking an element screenshot. #204: the fixture page pins fixtures to
 * 320/400/600px, so it overflows horizontally and an element screenshot's
 * viewport-relative box no longer maps to what is captured (mobile emulation
 * inflates the layout viewport; RTL moves the scroll origin to the right).
 *
 * Only for in-flow elements: a `position: fixed` element has no document box.
 * The clip is measured once, so callers must have already awaited whatever
 * state change they are capturing.
 */
export async function expectVisualMatch(
  page: Page,
  locator: Locator,
  name: string,
  options?: VisualMatchOptions,
): Promise<void> {
  // toHaveScreenshot retries the capture but not this measurement, so settle
  // what still moves the element (layout, late web fonts) before reading the box.
  await locator.waitFor({ state: "visible" });
  const clip = await locator.evaluate(async (el) => {
    await document.fonts.ready;
    const rect = el.getBoundingClientRect();
    const root = document.documentElement;
    const origin = root.getBoundingClientRect();
    // A full-page capture starts at the leftmost edge of the scrollable overflow.
    // In LTR that is the root's own left edge; in RTL the overflow grows leftwards,
    // so the capture starts that much further left than the root box.
    const overflowLeft =
      getComputedStyle(root).direction === "rtl" ? Math.max(0, root.scrollWidth - root.clientWidth) : 0;
    // Enclosing integer box, matching how an element screenshot rounds a
    // fractional layout box outwards; a fractional clip rounds inwards and
    // shifts the image by a pixel.
    const left = rect.left - origin.left + overflowLeft;
    const top = rect.top - origin.top;
    const x = Math.floor(left);
    const y = Math.floor(top);
    return {
      x,
      y,
      width: Math.ceil(left + rect.width) - x,
      height: Math.ceil(top + rect.height) - y,
    };
  });
  await expect(page).toHaveScreenshot(name, { ...options, fullPage: true, clip });
}

/** {@link expectVisualMatch} against the keyboard root inside a container. */
export async function expectKeyboardVisualMatch(
  page: Page,
  containerId: string,
  name: string,
  options?: VisualMatchOptions,
): Promise<void> {
  await expectVisualMatch(page, keyboardRoot(page, containerId), name, options);
}

/**
 * Set `dir`/`lang` on <html>, which is how OpenUI5 signals RTL
 * (`sap/ui/core/boot/initDOM.js`); there is no native API to drive it from here.
 * Nothing else is set: `sapUiRtl` is a configuration parameter name rather than
 * a class the framework applies, so adding it would let a rule keyed on it pass
 * a test it cannot pass in a real app.
 */
export async function setDocumentDirection(page: Page, dir: "ltr" | "rtl"): Promise<void> {
  await page.evaluate((d) => {
    document.documentElement.setAttribute("dir", d);
    document.documentElement.setAttribute("lang", d === "rtl" ? "ar" : "en");
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
