import BaseObject from "sap/ui/base/Object";
import ResizeHandler from "sap/ui/core/ResizeHandler";
// sap/ui/dom/units/Rem is @ui5-restricted (sap.m); @openui5/types does not
// expose it, so its type lives in restricted-modules.d.ts. toPx(rem) multiplies
// the value by the live root font-size.
import Rem from "sap/ui/dom/units/Rem";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract";
import { KeyboardType } from "../library";

/**
 * Resolves a CSS custom property holding a rem-based threshold to pixels.
 * Accepts values like "16rem" or "20rem"; falls back to `fallbackRem * remPx`
 * when the property is unset or unparseable. `remPx` is the px-per-rem factor,
 * resolved once per pass so the root font-size is read only once.
 */
function resolveRemThreshold(styles: CSSStyleDeclaration, prop: string, fallbackRem: number, remPx: number): number {
  const raw = styles.getPropertyValue(prop).trim();
  if (!raw) return fallbackRem * remPx;
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallbackRem * remPx : value * remPx;
}

interface ResponsiveSizingHost {
  getDomRef(): Element | null;
  getDocked(): boolean;
  getKeyboardType(): KeyboardType;
}

/**
 * Owns height-responsive class application for the keyboard root.
 *
 * Keeps a UI5 ResizeHandler attached to the current DOM element and, on
 * resize (coalesced via rAF), toggles `cqShort` / `cqTiny` classes when the
 * keyboard is externally height-constrained. Width breakpoints are handled
 * by CSS `@container` queries, so no JS width measurement is needed.
 */
export default class ResponsiveSizingController extends BaseObject {
  private _host: ResponsiveSizingHost;
  /** UI5 ResizeHandler registration ID for root size updates. */
  private _resizeHandlerId: string | null = null;
  /** Root DOM element currently observed by the resize handler. */
  private _observedDom: HTMLElement | null = null;
  /** rAF handle used to coalesce responsive class updates from multiple observers. */
  private _syncFrameId: number | null = null;

  constructor(host: ResponsiveSizingHost) {
    super();
    this._host = host;
  }

  /** Ensures a ResizeHandler is attached to the current DOM element. */
  syncObserver(dom: HTMLElement | null): void {
    if (!dom) {
      this._teardown();
      return;
    }

    if (this._observedDom !== dom) {
      this._teardown();
      this._observedDom = dom;
      this._resizeHandlerId = ResizeHandler.register(dom, () => {
        this.scheduleClassUpdate();
      });
    }
  }

  /** Coalesces responsive class updates triggered by root/content resize observers. */
  scheduleClassUpdate(): void {
    if (this._syncFrameId !== null) return;

    this._syncFrameId = requestAnimationFrame(() => {
      this._syncFrameId = null;
      const dom = this._host.getDomRef();
      if (dom instanceof HTMLElement) {
        this._applyClasses(dom);
      }
    });
  }

  /**
   * Applies height-responsive classes to the keyboard root element.
   *
   * Toggles `cqShort` / `cqTiny` classes when the keyboard is externally
   * constrained (host height < natural content height). Skipped for docked and numpad.
   * The +1px tolerance on the constrained check avoids oscillation from sub-pixel rounding.
   *
   * Width breakpoints are handled purely by CSS `@container` queries (see
   * KioskKeyboard.less), so no JS width measurement is needed.
   */
  private _applyClasses(dom: HTMLElement): void {
    const cs = getComputedStyle(dom);

    // Height classes: detect external height constraints by comparing the
    // keyboard's natural (unconstrained) content height against its rendered
    // height. Skip for docked keyboards (viewport-driven) and numpad.
    dom.classList.remove(KIOSK_KEYBOARD_DOM.classes.rootCqShort, KIOSK_KEYBOARD_DOM.classes.rootCqTiny);

    const docked = this._host.getDocked();
    const isNumpad = this._host.getKeyboardType() === KeyboardType.Numpad;
    if (docked || isNumpad) {
      return;
    }

    // scrollHeight reports the full content height even under overflow: hidden.
    // If the element ever uses overflow: clip, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    const naturalHeight = dom.scrollHeight;
    const renderedHeight = dom.getBoundingClientRect().height;

    // Only apply when externally constrained (natural content > rendered).
    // The +1px tolerance avoids oscillation from sub-pixel rounding.
    if (naturalHeight <= renderedHeight + 1) {
      return;
    }

    // px per rem, read once here (Rem.toPx(1) === the live root font-size).
    const remPx = Rem.toPx(1);
    const shortThresh = resolveRemThreshold(cs, "--ui5KioskKeyboard-cqShortThreshold", 16, remPx);
    const tinyThresh = resolveRemThreshold(cs, "--ui5KioskKeyboard-cqTinyThreshold", 12, remPx);
    const isShort = renderedHeight <= shortThresh;
    const isTiny = renderedHeight <= tinyThresh;
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootCqShort, isShort && !isTiny);
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootCqTiny, isTiny);
  }

  /** Deregisters the UI5 ResizeHandler and clears the observed DOM reference. */
  private _teardown(): void {
    if (this._syncFrameId !== null) {
      cancelAnimationFrame(this._syncFrameId);
      this._syncFrameId = null;
    }
    if (this._resizeHandlerId) {
      ResizeHandler.deregister(this._resizeHandlerId);
      this._resizeHandlerId = null;
    }
    this._observedDom = null;
  }

  override destroy(): void {
    this._teardown();
    super.destroy();
  }
}
