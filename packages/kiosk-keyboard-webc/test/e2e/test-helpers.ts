import { browser, $ } from "@wdio/globals";

// Re-export shared CDP helpers so consumers import everything from one place
export {
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  setDocumentDirection,
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
type CDPClient = ReturnType<PuppeteerPage["client"]>;

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
  const cdp = page.client();

  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
}

/** Clear all forced pseudo-states on a shadow DOM element via CDP. */
export async function clearForcedHoverState(hostId: string, selector: string): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  const [page] = await puppeteer.pages();
  const cdp = page.client();

  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
}
