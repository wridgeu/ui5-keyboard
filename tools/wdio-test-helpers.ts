/**
 * Shared WDIO test helpers for CDP-based media emulation and document direction.
 *
 * These helpers are used by both the kiosk-keyboard and kiosk-keyboard-webc
 * e2e test suites. They rely on the `browser` global from `@wdio/globals`
 * and require a Chrome/Chromium browser with DevTools protocol access.
 *
 * @note This file is excluded from tools/tsconfig.json because it depends on
 *       WDIO types that are only available in the e2e test tsconfigs.
 */
import { browser, expect } from "@wdio/globals";
import type { ChainablePromiseElement } from "webdriverio";

/**
 * Set emulated CSS media features via the Chrome DevTools Protocol.
 *
 * Requires a WDIO browser instance with DevTools protocol access
 * (the default when using `chromedriver` or `devtools` automation).
 */
export async function setEmulatedMediaFeatures(features: Array<{ name: string; value: string }>): Promise<void> {
  const puppeteer = await browser.getPuppeteer();
  // Assumes single-tab - safe because WDIO runs one page per browser instance
  const [page] = await puppeteer.pages();
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setEmulatedMedia", { features });
}

/** Clear all emulated CSS media features via CDP. */
export async function clearEmulatedMediaFeatures(): Promise<void> {
  await setEmulatedMediaFeatures([]);
}

/**
 * Inject a `<style>` override into the document `<head>`.
 *
 * Useful for disabling CSS progressive enhancements (e.g. text-box-trim,
 * container queries) in visual regression tests so that both the enhanced
 * and fallback rendering paths can be captured as separate baselines.
 */
export async function injectStyleOverride(css: string, id = "wdio-css-override"): Promise<void> {
  await browser.execute(
    (cssText: string, styleId: string) => {
      let el = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement("style");
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = cssText;
    },
    css,
    id,
  );
}

/** Remove a previously injected style override by its element ID. */
export async function removeStyleOverride(id = "wdio-css-override"): Promise<void> {
  await browser.execute((styleId: string) => {
    document.getElementById(styleId)?.remove();
  }, id);
}

/** Set the `dir` and `lang` attributes on the document root element and wait for layout reflow. */
export async function setDocumentDirection(dir: "ltr" | "rtl"): Promise<void> {
  await browser.execute((d: "ltr" | "rtl") => {
    document.documentElement.setAttribute("dir", d);
    document.documentElement.setAttribute("lang", d === "rtl" ? "ar" : "en");
    // UI5 gates RTL styles on .sapUiRtl on <body> (set by Core at bootstrap).
    // Toggling it here ensures the UI5-control e2e tests activate the real RTL CSS path.
    document.body.classList.toggle("sapUiRtl", d === "rtl");
  }, dir);
  // Wait for the browser to reflow after the direction change
  await browser.execute(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/* ---------------------------------------------------------------------------
 * Shared snapshot test helpers
 *
 * Used by both kiosk-keyboard and kiosk-keyboard-webc visual regression tests.
 * Variations between the two packages are controlled via options parameters.
 * ------------------------------------------------------------------------- */

export type SnapshotElement = WebdriverIO.Element | ChainablePromiseElement;

export type SnapshotGeometry = {
  position: string;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

export async function readSnapshotGeometry(element: SnapshotElement): Promise<SnapshotGeometry> {
  const target = await element;
  return browser.execute((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return {
      position: getComputedStyle(el).position,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }, target);
}

export type AssertSnapshotOptions = {
  /**
   * When true, checks for overflow inside a nested `.ui5KioskKeyboard`
   * child element. Relevant for the UI5-control package where the snapshot
   * target is a wrapper around the keyboard.
   */
  checkNestedKeyboardOverflow?: boolean;
  /** CSS class selector used for the nested keyboard overflow check. */
  nestedKeyboardSelector?: string;
};

export async function assertSnapshotTargetIsUsable(
  element: SnapshotElement,
  name: string,
  options?: AssertSnapshotOptions,
): Promise<void> {
  const geometry = await readSnapshotGeometry(element);
  const tolerancePx = 2;

  if (geometry.clientWidth <= 0 || geometry.clientHeight <= 0) {
    throw new Error(
      `Snapshot target '${name}' has zero size (${geometry.clientWidth}x${geometry.clientHeight}). ` +
        `Visible element snapshots require a rendered target.`,
    );
  }

  if (
    geometry.position !== "fixed" &&
    (geometry.rect.left < -tolerancePx ||
      geometry.rect.top < -tolerancePx ||
      geometry.rect.right > geometry.viewportWidth + tolerancePx ||
      geometry.rect.bottom > geometry.viewportHeight + tolerancePx)
  ) {
    throw new Error(
      `Snapshot target '${name}' does not fully fit inside the viewport after scrolling. ` +
        `rect=${geometry.rect.width}x${geometry.rect.height}@(${geometry.rect.left},${geometry.rect.top}) ` +
        `viewport=${geometry.viewportWidth}x${geometry.viewportHeight}.`,
    );
  }

  if (
    geometry.scrollWidth > geometry.clientWidth + tolerancePx ||
    geometry.scrollHeight > geometry.clientHeight + tolerancePx
  ) {
    throw new Error(
      `Snapshot target '${name}' is internally clipped or overflowing. ` +
        `client=${geometry.clientWidth}x${geometry.clientHeight} ` +
        `scroll=${geometry.scrollWidth}x${geometry.scrollHeight}.`,
    );
  }

  if (options?.checkNestedKeyboardOverflow) {
    const selector = options.nestedKeyboardSelector ?? ".ui5KioskKeyboard";
    const isKeyboard = await browser.execute(
      (el: HTMLElement, sel: string) => el.matches(sel),
      await element,
      selector,
    );
    if (!isKeyboard) {
      // Wait briefly for responsive sizing to stabilize. UI5's ResizeHandler
      // and the WebC ResizeObserver + rAF coalescing may not have fired yet
      // when the test reaches the snapshot. Retry for up to 2 seconds.
      const resolved = await element;
      let lastOverflow: {
        clientWidth: number;
        clientHeight: number;
        scrollWidth: number;
        scrollHeight: number;
      } | null = null;
      try {
        await browser.waitUntil(
          async () => {
            lastOverflow = await browser.execute(
              (el: HTMLElement, sel: string) => {
                const kb = el.querySelector(sel) as HTMLElement | null;
                if (!kb) return null;
                const tolerance = 2;
                if (kb.scrollWidth > kb.clientWidth + tolerance || kb.scrollHeight > kb.clientHeight + tolerance) {
                  return {
                    clientWidth: kb.clientWidth,
                    clientHeight: kb.clientHeight,
                    scrollWidth: kb.scrollWidth,
                    scrollHeight: kb.scrollHeight,
                  };
                }
                return null;
              },
              resolved,
              selector,
            );
            return lastOverflow === null;
          },
          { timeout: 2000, interval: 100, timeoutMsg: "" },
        );
      } catch {
        // timeout -- lastOverflow holds the final measured state
      }

      if (lastOverflow) {
        throw new Error(
          `Snapshot target '${name}' contains a keyboard child with internal overflow. ` +
            `keyboard client=${lastOverflow.clientWidth}x${lastOverflow.clientHeight} ` +
            `scroll=${lastOverflow.scrollWidth}x${lastOverflow.scrollHeight}.`,
        );
      }
    }
  }
}

export async function shouldScrollSnapshotTarget(element: SnapshotElement): Promise<boolean> {
  const target = await element;
  return browser.execute((el: HTMLElement) => getComputedStyle(el).position !== "fixed", target);
}

export type IsolateSectionOptions = {
  /**
   * When true, traverse from the element's shadow root host before
   * calling `closest(".section")`. Required for web components whose
   * snapshot target lives inside a shadow DOM.
   */
  traverseShadowHosts?: boolean;
};

export async function isolateSection(element: SnapshotElement, options?: IsolateSectionOptions): Promise<void> {
  const target = await element;
  const traverse = options?.traverseShadowHosts ?? false;
  await browser.execute(
    (el: HTMLElement, traverseShadow: boolean) => {
      let anchor: Element = el;
      if (traverseShadow) {
        const root = el.getRootNode();
        anchor = root instanceof ShadowRoot ? root.host : el;
      }
      const activeSection = anchor.closest(".section");
      if (!activeSection) return;

      document.querySelectorAll<HTMLElement>(".section").forEach((section) => {
        if (section === activeSection) return;
        if (!("snapshotPrevDisplay" in section.dataset)) {
          section.dataset.snapshotPrevDisplay = section.style.display;
        }
        section.style.display = "none";
      });
    },
    target,
    traverse,
  );
}

export async function restoreSections(): Promise<void> {
  await browser.execute(() => {
    document.querySelectorAll<HTMLElement>(".section").forEach((section) => {
      if (!("snapshotPrevDisplay" in section.dataset)) return;
      const previousDisplay = section.dataset.snapshotPrevDisplay ?? "";
      if (previousDisplay) {
        section.style.display = previousDisplay;
      } else {
        section.style.removeProperty("display");
      }
      delete section.dataset.snapshotPrevDisplay;
    });
  });
}

export async function scrollElementIntoView(element: SnapshotElement): Promise<void> {
  const target = await element;
  await browser.execute((el: HTMLElement) => {
    el.scrollIntoView({ block: "center", inline: "center" });
  }, target);
}

export type MatchSnapshotOptions = {
  /**
   * Ignore sub-pixel antialiasing differences between baseline and actual
   * screenshots. Defaults to `true` because antialiasing varies across OS
   * and GPU configurations, producing false-positive diffs that do not
   * reflect real visual regressions.
   */
  ignoreAntialiasing?: boolean;
} & IsolateSectionOptions &
  AssertSnapshotOptions;

export async function matchElementSnapshotInSection(
  element: SnapshotElement,
  name: string,
  options?: MatchSnapshotOptions,
): Promise<void> {
  const target = await element;
  await isolateSection(target, options);
  try {
    if (await shouldScrollSnapshotTarget(target)) {
      await scrollElementIntoView(target);
    }
    await browser.executeAsync((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    await assertSnapshotTargetIsUsable(target, name, options);
    await expect(target).toMatchElementSnapshot(name, {
      ignoreAntialiasing: options?.ignoreAntialiasing ?? true,
    });
  } finally {
    await restoreSections();
  }
}
