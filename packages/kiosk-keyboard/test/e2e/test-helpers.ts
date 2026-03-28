import { browser, $ } from "@wdio/globals";
import type { SnapshotElement, MatchSnapshotOptions } from "../../../../tools/wdio-test-helpers.js";
import { matchElementSnapshotInSection as _matchBase } from "../../../../tools/wdio-test-helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";

// Re-export shared helpers so consumers import everything from one place
export {
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  setDocumentDirection,
  injectStyleOverride,
  removeStyleOverride,
  isolateSection,
  restoreSections,
  scrollElementIntoView,
} from "../../../../tools/wdio-test-helpers.js";

export const VISUAL_PAGE = "/test-resources/ui5/kiosk/e2e/visual/index.html";

/** Returns the current viewport width in CSS pixels. */
export async function getViewportWidth(): Promise<number> {
  return browser.execute(() => window.innerWidth);
}

/** Wait until the visual page has rendered keyboard roots and their keys. */
export async function waitForVisualKeyboardsReady(): Promise<void> {
  await browser.waitUntil(
    async () =>
      browser.execute((rootSel: string) => {
        const keyboards = document.querySelectorAll(rootSel);
        if (keyboards.length === 0) return false;
        const last = keyboards[keyboards.length - 1];
        return last.querySelectorAll('[role="button"]').length > 0;
      }, DOM.selectors.root),
    { timeout: 10_000, timeoutMsg: "Keyboard keys not rendered" },
  );
}

/** Navigate to the visual test page and wait for UI5 to finish rendering. */
export async function openVisualPage(page = VISUAL_PAGE): Promise<void> {
  await browser.url(page, { wait: "interactive" });
  // wdi5 "ui5" service handles UI5 bootstrap sync; additionally wait for
  // the last keyboard on the page to render keys (order-independent)
  await waitForVisualKeyboardsReady();
}

/** Get the rendered KioskKeyboard element inside a container. */
export function getKeyboard(containerId: string) {
  return $(`#${containerId} ${DOM.selectors.root}`);
}

/**
 * Wrapper around the shared `matchElementSnapshotInSection` that enables the
 * nested `.ui5KioskKeyboard` overflow check by default. The UI5-control
 * package snapshots wrapper containers that hold a keyboard child, so this
 * extra validation catches internal keyboard overflow before a baseline is
 * captured.
 */
export async function matchElementSnapshotInSection(
  element: SnapshotElement,
  name: string,
  options?: MatchSnapshotOptions,
): Promise<void> {
  return _matchBase(element, name, {
    checkNestedKeyboardOverflow: true,
    nestedKeyboardSelector: DOM.selectors.root,
    ...options,
  });
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

/* Progressive enhancement overrides for visual regression testing */

/** CSS override to disable the text-box-trim progressive enhancement. */
export const DISABLE_TEXT_BOX_TRIM = `
  .${DOM.classes.keyLabel},
  .${DOM.classes.keyLabelGlyph} {
    text-box-trim: none !important;
    text-box-edge: auto !important;
  }
  .${DOM.classes.keyLabel} {
    line-height: 1.2 !important;
  }
  .${DOM.classes.keyLabelGlyph} {
    line-height: 1 !important;
  }
  .${DOM.classes.keyLabelEastAsian} {
    line-height: 1.1 !important;
  }
`;
