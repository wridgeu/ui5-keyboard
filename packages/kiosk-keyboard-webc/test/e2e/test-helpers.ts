import { browser, $ } from "@wdio/globals";

// Re-export shared CDP helpers so consumers import everything from one place
export {
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  setDocumentDirection,
  injectStyleOverride,
  removeStyleOverride,
} from "../../../../tools/wdio-test-helpers.js";

/** Navigate to the visual test page and wait for all keyboards to fully render. */
export async function openVisualPage(): Promise<void> {
  await browser.url("/test/pages/visual.html");
  await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
    timeout: 10_000,
    timeoutMsg: "kiosk-keyboard not registered",
  });
  // Wait for every keyboard on the page to render at least one key.
  // This ensures custom layouts (e.g. glyph-stress registered via whenDefined)
  // have been applied before any snapshots are taken.
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const keyboards = document.querySelectorAll("kiosk-keyboard");
        if (keyboards.length === 0) return false;
        return [...keyboards].every((kb) => (kb.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0);
      }),
    { timeout: 10_000, timeoutMsg: "Not all keyboards have rendered keys" },
  );
}

/** Get the shadow DOM root element of a kiosk-keyboard by host ID. */
export async function getKeyboardRoot(hostId: string) {
  // WDIO pierces shadow DOM with >>> (deep selector)
  return $(`#${hostId}`).$(">>>.kiosk-keyboard");
}

/**
 * Resolve a shadow DOM element's CDP node ID by traversing the DOM tree.
 *
 * Uses the DOM domain to find the shadow host, descend into its shadow root,
 * and query for the target selector.
 */
type PuppeteerPage = Awaited<ReturnType<Awaited<ReturnType<typeof browser.getPuppeteer>>["pages"]>>[number];
type CDPClient = Awaited<ReturnType<PuppeteerPage["createCDPSession"]>>;

async function resolveShadowNodeId(cdp: CDPClient, hostId: string, selector: string): Promise<number> {
  const { root } = await cdp.send("DOM.getDocument", { depth: 0, pierce: true });
  const { nodeId: hostNodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#${hostId}` });
  if (!hostNodeId) throw new Error(`Shadow host #${hostId} not found in DOM`);
  const { node: hostNode } = await cdp.send("DOM.describeNode", { nodeId: hostNodeId, depth: 1, pierce: true });
  const shadowRootId = hostNode.shadowRoots?.[0]?.nodeId;
  if (!shadowRootId) throw new Error(`No shadow root found on #${hostId}`);
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: shadowRootId, selector });
  if (!nodeId) throw new Error(`Element ${selector} not found in #${hostId} shadow DOM`);
  return nodeId;
}

/**
 * Force the CSS `:hover` pseudo-state on a shadow DOM element via CDP.
 *
 * Synthetic mouse events (both WDIO `moveTo()` and Puppeteer `mouse.move()`)
 * do not reliably trigger `:hover` inside shadow roots in headless Chrome.
 * This helper uses `CSS.forcePseudoState`, the same mechanism Chrome DevTools
 * uses for its "Force element state" feature, which is fully deterministic.
 */
export async function forceHoverState(hostId: string, selector: string): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = await page.createCDPSession();

  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
}

/** Clear all forced pseudo-states on a shadow DOM element via CDP. */
export async function clearForcedHoverState(hostId: string, selector: string): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = await page.createCDPSession();

  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
}

/* ---- Progressive enhancement overrides for visual regression testing ---- */

/**
 * Inject a `<style>` override into all kiosk-keyboard shadow roots.
 *
 * Since the web component's styles live in shadow DOM, document-level
 * overrides have no effect. This helper appends (or updates) a `<style>`
 * element inside each keyboard's shadow root.
 */
export async function injectShadowStyleOverride(css: string, id = "wdio-shadow-css-override"): Promise<void> {
  await browser.execute(
    (cssText: string, styleId: string) => {
      document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
        const root = kb.shadowRoot;
        if (!root) return;
        let el = root.getElementById(styleId) as HTMLStyleElement | null;
        if (!el) {
          el = document.createElement("style");
          el.id = styleId;
          root.appendChild(el);
        }
        el.textContent = cssText;
      });
    },
    css,
    id,
  );
}

/** Remove previously injected shadow style overrides from all kiosk-keyboard elements. */
export async function removeShadowStyleOverride(id = "wdio-shadow-css-override"): Promise<void> {
  await browser.execute((styleId: string) => {
    document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
      kb.shadowRoot?.getElementById(styleId)?.remove();
    });
  }, id);
}

/** CSS override to disable the text-box-trim progressive enhancement. */
export const DISABLE_TEXT_BOX_TRIM = `
  .kiosk-key__label,
  .kiosk-key__label--glyph {
    text-box-trim: none !important;
    text-box-edge: auto !important;
  }
  .kiosk-key__label {
    line-height: 1.2 !important;
  }
  .kiosk-key__label--glyph {
    line-height: 1 !important;
  }
`;

/**
 * CSS override to simulate a browser without container query support.
 *
 * Disabling `container-type` alone is not enough because the real fallback
 * CSS is gated by `@supports not (container-type: inline-size)`, which still
 * evaluates to false in Chrome. Re-declare the class-based fallback rules so
 * the snapshots reflect the same styling a non-CQ browser would get.
 */
export const DISABLE_CONTAINER_QUERIES = `
  .kiosk-keyboard {
    container-type: normal !important;
    container-name: none !important;
  }
  .kiosk-key {
    container-type: normal !important;
  }
  .kiosk-keyboard--cq-sm .kiosk-key {
    --kiosk-keyboard-key-font-size: min(var(--_kiosk-keyboard-key-font-base), 1rem) !important;
  }
  .kiosk-keyboard--cq-xs .kiosk-key {
    --kiosk-keyboard-key-font-size: min(var(--_kiosk-keyboard-key-font-base), 0.875rem) !important;
  }
  .kiosk-keyboard--cq-xs.kiosk-keyboard--cq-short:not(.kiosk-keyboard--numpad) .kiosk-key,
  .kiosk-keyboard--cq-xs.kiosk-keyboard--cq-tiny:not(.kiosk-keyboard--numpad) .kiosk-key {
    --kiosk-keyboard-key-font-size: min(var(--_kiosk-keyboard-key-font-base), 0.75rem) !important;
  }
`;

/**
 * CSS override that emulates the static shadow fallbacks used when color-mix()
 * is unavailable.
 *
 * Browser support itself cannot be disabled in Chrome, so the visual fallback
 * baseline re-applies the same public shadow tokens a non-supporting browser
 * would keep after skipping the guarded @supports block.
 */
export const DISABLE_COLOR_MIX = `
  :host {
    --kiosk-keyboard-key-shadow: 0 1px 2px rgba(34, 53, 72, 0.1) !important;
    --kiosk-keyboard-key-shadow-hover: 0 2px 4px rgba(34, 53, 72, 0.15) !important;
    --kiosk-keyboard-docked-shadow: 0 -4px 20px rgba(34, 53, 72, 0.12) !important;
    --kiosk-keyboard-modifier-shadow: 0 1px 2px rgba(34, 53, 72, 0.14) !important;
    --kiosk-keyboard-modifier-shadow-hover: 0 2px 4px rgba(34, 53, 72, 0.18) !important;
  }
`;
