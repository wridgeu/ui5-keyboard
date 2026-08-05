import path from "node:path";
import { test, type Page } from "@playwright/test";
import { openPage, keyboardRoot, key } from "./helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

// Generates the images embedded in the webc README (the theme previews and the
// numpad / numeric variants) and the key-type table both package READMEs share.
// Not a regression test: run on demand via `npm run test:e2e:docs`
// (playwright.docs.config.ts), it writes into docs/kiosk-webc/images and
// docs/shared/images.

const WEBC_DIR = path.resolve(import.meta.dirname, "../../../../docs/kiosk-webc/images");
const SHARED_DIR = path.resolve(import.meta.dirname, "../../../../docs/shared/images");
const DEMO_PAGE = "/test/pages/key-style-demo.html";

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];

/**
 * Switches theme through the page's own theme buttons rather than calling
 * `setTheme` directly: the click handler also repaints the body and the preview
 * frame, which is the background the qwerty preview is captured against.
 */
async function switchTheme(page: Page, theme: string): Promise<void> {
  await page.locator(`.theme-controls button[data-theme="${theme}"]`).click();
  await page.waitForFunction(
    (t) => getComputedStyle(document.documentElement).getPropertyValue("--sapThemeMetaData-Base-baseLib").includes(t),
    theme,
    { timeout: 10_000 },
  );
}

/**
 * Waits out the reflow that still follows the theme metadata being set: the swapped
 * stylesheet and the `72` webfont both change text metrics, and a capture taken
 * between the two lands the keyboard a pixel off. That is invisible to the eye but
 * rewrites every edge in the PNG, so committed images would churn on each run.
 */
async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/**
 * Playwright places a virtual pointer to take an element screenshot, which can
 * land on a descendant key and trigger `:hover` - non-deterministic colours,
 * most visible in the high-contrast themes. Disabling pointer events on the
 * keyboard roots removes the artifact; the hover captures below turn it back on.
 */
async function setKeyboardPointerEvents(page: Page, value: "none" | ""): Promise<void> {
  await page.evaluate(
    ({ rootSel, pointerEvents }) => {
      for (const el of document.querySelectorAll<HTMLElement>(rootSel)) el.style.pointerEvents = pointerEvents;
    },
    { rootSel: DOM.selectors.root, pointerEvents: value },
  );
}

for (const theme of THEMES) {
  test(`README screenshot: webc-qwerty-${theme}`, async ({ page }) => {
    await openPage(page, DEMO_PAGE);
    await switchTheme(page, theme);
    await settleLayout(page);
    await setKeyboardPointerEvents(page, "none");
    // The framed preview, not the bare keyboard: the padded frame carries the
    // theme background and matches the proportions of the UI5 control's images.
    await page.locator("#preview-qwerty").screenshot({
      path: path.join(WEBC_DIR, `webc-qwerty-${theme}.png`),
      animations: "disabled",
    });
  });
}

test("README screenshot: keyboard-type variants", async ({ page }) => {
  await openPage(page, DEMO_PAGE);
  await settleLayout(page);
  await setKeyboardPointerEvents(page, "none");
  await keyboardRoot(page, "kb-numpad").screenshot({
    path: path.join(WEBC_DIR, "webc-numpad.png"),
    animations: "disabled",
  });
  await keyboardRoot(page, "kb-numeric").screenshot({
    path: path.join(WEBC_DIR, "webc-numeric.png"),
    animations: "disabled",
  });
});

test("README screenshot: key types", async ({ page }) => {
  await openPage(page, DEMO_PAGE);
  await settleLayout(page);

  await setKeyboardPointerEvents(page, "none");
  await keyboardRoot(page, "kb-default").screenshot({
    path: path.join(SHARED_DIR, "key-type-default.png"),
    animations: "disabled",
  });
  await keyboardRoot(page, "kb-modifier").screenshot({
    path: path.join(SHARED_DIR, "key-type-modifier.png"),
    animations: "disabled",
  });

  // The hover pair is the point of these two, so the pointer is let back in and
  // aimed deliberately. `animations: "disabled"` settles the hover transition
  // rather than catching it part-way.
  await setKeyboardPointerEvents(page, "");
  await key(page, "kb-default", "F5").hover();
  await keyboardRoot(page, "kb-default").screenshot({
    path: path.join(SHARED_DIR, "key-type-default-hover.png"),
    animations: "disabled",
  });
  await key(page, "kb-modifier", "F5").hover();
  await keyboardRoot(page, "kb-modifier").screenshot({
    path: path.join(SHARED_DIR, "key-type-modifier-hover.png"),
    animations: "disabled",
  });
});
