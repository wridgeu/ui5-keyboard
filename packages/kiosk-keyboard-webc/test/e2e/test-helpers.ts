import { browser, $ } from "@wdio/globals";
import type { SnapshotElement, MatchSnapshotOptions } from "../../../../tools/wdio-test-helpers.js";
import {
  matchElementSnapshotInSection as _matchBase,
  getSharedCDPSession,
} from "../../../../tools/wdio-test-helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

// Re-export shared helpers so consumers import everything from one place
export {
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  setDocumentDirection,
  injectStyleOverride,
  removeStyleOverride,
} from "../../../../tools/wdio-test-helpers.js";

/** Navigate to the visual test page and wait for all keyboards to fully render. */
export async function openVisualPage(): Promise<void> {
  await browser.url("/test/pages/visual.html", { wait: "interactive" });
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
  return $(`#${hostId}`).$(`>>>${DOM.selectors.root}`);
}

type DockedKeyboardState = {
  open: boolean;
  hiddenClass: boolean;
  visibility: string;
  pointerEvents: string;
};

async function readDockedKeyboardState(hostId: string): Promise<DockedKeyboardState> {
  return browser.execute((id: string) => {
    type DomContract = {
      selectors?: { root?: string };
      classes?: { rootHidden?: string };
    };

    const host = document.getElementById(id) as (HTMLElement & { open?: boolean }) | null;
    if (!host) {
      throw new Error(`Docked keyboard host #${id} not found`);
    }

    const ctor = customElements.get(host.localName) as { DOM?: DomContract } | undefined;
    const rootSelector = ctor?.DOM?.selectors?.root ?? ".kiosk-keyboard";
    const hiddenClass = ctor?.DOM?.classes?.rootHidden ?? "kiosk-keyboard--hidden";
    const root = host.shadowRoot?.querySelector<HTMLElement>(rootSelector);
    if (!root) {
      throw new Error(`Docked keyboard root for #${id} not found`);
    }

    const styles = getComputedStyle(root);
    return {
      open: Boolean(host.open),
      hiddenClass: root.classList.contains(hiddenClass),
      visibility: styles.visibility,
      pointerEvents: styles.pointerEvents,
    };
  }, hostId);
}

export async function waitForDockedKeyboardOpen(hostId: string, timeout = 5_000): Promise<DockedKeyboardState> {
  await browser.waitUntil(
    async () => {
      const state = await readDockedKeyboardState(hostId);
      return state.open && !state.hiddenClass && state.visibility !== "hidden" && state.pointerEvents !== "none";
    },
    {
      timeout,
      timeoutMsg: `Docked keyboard #${hostId} did not become visibly open`,
    },
  );

  return readDockedKeyboardState(hostId);
}

export async function waitForDockedKeyboardClosed(hostId: string, timeout = 5_000): Promise<DockedKeyboardState> {
  await browser.waitUntil(
    async () => {
      const state = await readDockedKeyboardState(hostId);
      return !state.open && state.hiddenClass && state.visibility === "hidden" && state.pointerEvents === "none";
    },
    {
      timeout,
      timeoutMsg: `Docked keyboard #${hostId} did not become visibly closed`,
    },
  );

  return readDockedKeyboardState(hostId);
}

/**
 * Wrapper around the shared `matchElementSnapshotInSection` that enables
 * shadow host traversal by default. The web component's snapshot targets
 * live inside shadow DOM and cannot reach light-DOM `.section` ancestors
 * via `closest()` without first stepping out through the shadow host.
 */
export async function matchElementSnapshotInSection(
  element: SnapshotElement,
  name: string,
  options?: MatchSnapshotOptions,
): Promise<void> {
  return _matchBase(element, name, {
    traverseShadowHosts: true,
    ...options,
  });
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
  const cdp = await getSharedCDPSession();
  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
}

/** Clear all forced pseudo-states on a shadow DOM element via CDP. */
export async function clearForcedHoverState(hostId: string, selector: string): Promise<void> {
  const cdp = await getSharedCDPSession();
  await cdp.send("DOM.enable");
  const nodeId = await resolveShadowNodeId(cdp, hostId, selector);
  await cdp.send("CSS.enable");
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
}

/* Progressive enhancement overrides for visual regression testing */

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
`;

/**
 * CSS override that emulates the static shadow fallbacks used when color-mix()
 * is unavailable.
 *
 * Browser support itself cannot be disabled in Chrome, so the visual fallback
 * baseline re-applies the same public shadow tokens a non-supporting browser
 * would keep after skipping the guarded @supports block.
 *
 * SYNC SOURCE: The rgba() values below must match the static fallback
 * shadow declarations in the `:host` block of `src/themes/KioskKeyboard.css`.
 * If those CSS rules change, update this constant to match.
 */
export const DISABLE_COLOR_MIX = `
  :host {
    --kiosk-keyboard-key-shadow: 0 1px 2px rgba(34, 53, 72, 0.1) !important;
    --kiosk-keyboard-key-shadow-hover: 0 2px 4px rgba(34, 53, 72, 0.15) !important;
    --kiosk-keyboard-docked-shadow: 0 -4px 20px rgba(34, 53, 72, 0.2) !important;
    --kiosk-keyboard-modifier-shadow: 0 1px 2px rgba(34, 53, 72, 0.14) !important;
    --kiosk-keyboard-modifier-shadow-hover: 0 2px 4px rgba(34, 53, 72, 0.18) !important;
  }
`;
