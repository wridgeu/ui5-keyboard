import { browser, $ } from "@wdio/globals";

// Re-export shared CDP helpers so consumers import everything from one place
export {
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  setDocumentDirection,
  injectStyleOverride,
  removeStyleOverride,
} from "../../../../tools/wdio-test-helpers.js";

export const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

/** Navigate to the visual test page and wait for UI5 to finish rendering. */
export async function openVisualPage(): Promise<void> {
  await browser.url(VISUAL_PAGE);
  // wdi5 "ui5" service handles UI5 bootstrap sync; additionally wait for
  // the last keyboard on the page to render keys (order-independent)
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const keyboards = document.querySelectorAll(".ui5KioskKeyboard");
        if (keyboards.length === 0) return false;
        const last = keyboards[keyboards.length - 1];
        return last.querySelectorAll('[role="button"]').length > 0;
      }),
    { timeout: 10_000, timeoutMsg: "Keyboard keys not rendered" },
  );
}

/** Get the rendered KioskKeyboard element inside a container. */
export function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
}

/**
 * Force the CSS `:hover` pseudo-state on a DOM element via CDP.
 *
 * WDIO's `moveTo()` positioning can be non-deterministic across
 * multi-worker runs. This uses `CSS.forcePseudoState` (the same
 * mechanism as Chrome DevTools "Force element state") for fully
 * deterministic hover state testing.
 */
export async function forceHoverState(selector: string): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = await page.createCDPSession();

  await cdp.send("DOM.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`Element ${selector} not found`);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
}

/** Clear all forced pseudo-states on a DOM element via CDP. */
export async function clearForcedHoverState(selector: string): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = await page.createCDPSession();

  await cdp.send("DOM.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`Element ${selector} not found`);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
}

/* ---- Progressive enhancement overrides for visual regression testing ---- */

/** CSS override to disable the text-box-trim progressive enhancement. */
export const DISABLE_TEXT_BOX_TRIM = `
  .ui5KioskKey__label,
  .ui5KioskKey__label--glyph {
    text-box-trim: none !important;
    text-box-edge: auto !important;
  }
  .ui5KioskKey__label {
    line-height: 1.2 !important;
  }
  .ui5KioskKey__label--glyph {
    line-height: 1 !important;
  }
`;
