import { expect, type Page, type Locator } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

/**
 * Playwright e2e helpers for kiosk-keyboard-webc.
 *
 * Playwright locators pierce open shadow DOM automatically, so shadow queries
 * need no special combinator. Media emulation, direction, style injection and
 * forced pseudo-states map to native Playwright or CDP calls.
 */

const ROOT = DOM.selectors.root;
const ROOT_HIDDEN = DOM.classes.rootHidden;

/** Navigate to a test page and wait until every kiosk-keyboard has rendered keys. */
export async function openPage(page: Page, pagePath: string): Promise<void> {
  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => customElements.get("kiosk-keyboard") !== undefined, null, { timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const keyboards = document.querySelectorAll("kiosk-keyboard");
      if (keyboards.length === 0) return false;
      return [...keyboards].every((kb) => (kb.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0);
    },
    null,
    { timeout: 10_000 },
  );
}

/** Wait until a specific keyboard host has rendered at least one key. */
export async function waitForKeys(page: Page, hostId: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const host = document.getElementById(id);
      return (host?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0;
    },
    hostId,
    { timeout: 10_000 },
  );
}

/** The shadow root element of a keyboard host (Playwright pierces shadow DOM). */
export function keyboardRoot(page: Page, hostId: string): Locator {
  return page.locator(`#${hostId}`).locator(ROOT);
}

/** A key inside a keyboard host by its data-key value. */
export function key(page: Page, hostId: string, dataKey: string): Locator {
  return page.locator(`#${hostId}`).locator(`[data-key="${dataKey}"]`);
}

type DockedState = { open: boolean; hiddenClass: boolean; visibility: string; pointerEvents: string };

async function readDockedState(page: Page, hostId: string): Promise<DockedState> {
  return page.evaluate(
    ({ id, rootSel, hiddenClass }) => {
      const host = document.getElementById(id) as (HTMLElement & { open?: boolean }) | null;
      const root = host?.shadowRoot?.querySelector(rootSel) as HTMLElement | null;
      const style = root ? getComputedStyle(root) : null;
      return {
        open: !!host?.open,
        hiddenClass: !!root?.classList.contains(hiddenClass),
        visibility: style?.visibility ?? "",
        pointerEvents: style?.pointerEvents ?? "",
      };
    },
    { id: hostId, rootSel: ROOT, hiddenClass: ROOT_HIDDEN },
  );
}

export async function waitForDockedOpen(page: Page, hostId: string): Promise<DockedState> {
  await page.waitForFunction(
    ({ id, rootSel, hiddenClass }) => {
      const host = document.getElementById(id) as (HTMLElement & { open?: boolean }) | null;
      const root = host?.shadowRoot?.querySelector(rootSel) as HTMLElement | null;
      if (!host || !root) return false;
      const style = getComputedStyle(root);
      return (
        !!host.open &&
        !root.classList.contains(hiddenClass) &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none"
      );
    },
    { id: hostId, rootSel: ROOT, hiddenClass: ROOT_HIDDEN },
    { timeout: 5_000 },
  );
  return readDockedState(page, hostId);
}

export async function waitForDockedClosed(page: Page, hostId: string): Promise<DockedState> {
  await page.waitForFunction(
    ({ id, rootSel, hiddenClass }) => {
      const host = document.getElementById(id) as (HTMLElement & { open?: boolean }) | null;
      const root = host?.shadowRoot?.querySelector(rootSel) as HTMLElement | null;
      if (!host || !root) return false;
      const style = getComputedStyle(root);
      return (
        !host.open &&
        root.classList.contains(hiddenClass) &&
        style.visibility === "hidden" &&
        style.pointerEvents === "none"
      );
    },
    { id: hostId, rootSel: ROOT, hiddenClass: ROOT_HIDDEN },
    { timeout: 5_000 },
  );
  return readDockedState(page, hostId);
}

/**
 * Wait until a docked keyboard is shown by open state + visible class only.
 * Used for the disabled docked keyboard, which keeps pointer-events:none even
 * when shown, so the stricter waitForDockedOpen would never resolve.
 */
export async function waitForDockedShown(page: Page, hostId: string): Promise<void> {
  await page.waitForFunction(
    ({ id, rootSel, hiddenClass }) => {
      const host = document.getElementById(id) as (HTMLElement & { open?: boolean }) | null;
      const root = host?.shadowRoot?.querySelector(rootSel) as HTMLElement | null;
      return !!host?.open && !!root && !root.classList.contains(hiddenClass);
    },
    { id: hostId, rootSel: ROOT, hiddenClass: ROOT_HIDDEN },
    { timeout: 5_000 },
  );
}

/** Whether the running project emulates a coarse (touch) pointer. */
export function isCoarsePointer(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia("(pointer: coarse)").matches);
}

/** Whether the running project supports hover. */
export function isHoverCapable(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia("(hover: hover)").matches);
}

// ── Visual helpers ──

/**
 * Compare an element against its committed visual baseline.
 *
 * The wait is the render gate for the `--ignore-snapshots` CI run, where
 * `toHaveScreenshot` returns without ever resolving the locator. It is
 * redundant wherever pixels are compared, since the capture waits for
 * visibility and settles web fonts itself.
 */
export async function expectVisualMatch(locator: Locator, name: string): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveScreenshot(name);
}

/** Set `dir`/`lang` on <html>, which is what `:dir(rtl)` resolves against, then wait for reflow. */
export async function setDocumentDirection(page: Page, dir: "ltr" | "rtl"): Promise<void> {
  await page.evaluate((d) => {
    document.documentElement.setAttribute("dir", d);
    document.documentElement.setAttribute("lang", d === "rtl" ? "ar" : "en");
  }, dir);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

/** Append or update a `<style>` inside every kiosk-keyboard shadow root. */
export async function injectShadowStyleOverride(page: Page, css: string, id: string): Promise<void> {
  await page.evaluate(
    ({ cssText, styleId }) => {
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
    { cssText: css, styleId: id },
  );
}

/** Remove a previously injected shadow style override by id. */
export async function removeShadowStyleOverride(page: Page, id: string): Promise<void> {
  await page.evaluate((styleId) => {
    document.querySelectorAll("kiosk-keyboard").forEach((kb) => kb.shadowRoot?.getElementById(styleId)?.remove());
  }, id);
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
