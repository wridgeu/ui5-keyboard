import BaseObject from "sap/ui/base/Object";
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
 * Observes the current DOM element with a `ResizeObserver` and, on resize
 * (coalesced via rAF), toggles `cqShort` / `cqTiny` classes when the keyboard
 * is externally height-constrained. Width breakpoints are handled by CSS
 * `@container` queries, so no JS width measurement is needed.
 *
 * Sizes are compared in untransformed layout pixels (`scrollHeight` vs
 * `clientHeight`), so ancestor transforms do not shift breakpoints and the
 * root border cancels out of the comparison. The webc twin detects the same
 * clipping from its host's content box, because its root is auto-height and
 * only the host reflects the constraint.
 *
 * The rAF is not just coalescing: the classes change the height of the very
 * element being observed, so applying them straight from the callback re-enters
 * observation in the same frame and trips the observer's depth limit
 * ("ResizeObserver loop completed with undelivered notifications"). Deferring
 * the write breaks that cycle. It also keeps the forced reflow out of the
 * render frame for the callers that run while layout is dirty.
 */
export default class ResponsiveSizingController extends BaseObject {
  private _host: ResponsiveSizingHost;
  /** ResizeObserver driving root size updates. */
  private _resizeObserver: ResizeObserver | null = null;
  /** Root DOM element currently observed. */
  private _observedDom: HTMLElement | null = null;
  /** rAF handle used to coalesce responsive class updates from multiple observers. */
  private _syncFrameId: number | null = null;
  /**
   * Border box (untransformed layout px) the last applied pass measured, or
   * `null` when that pass returned before measuring (no DOM, docked, numpad).
   * An observation reporting this box carries no new information and is
   * dropped. Width is part of the key because the natural height depends on it
   * (container queries wrap rows), so a width-only change must still recompute.
   */
  private _appliedBox: { blockSize: number; inlineSize: number } | null = null;

  constructor(host: ResponsiveSizingHost) {
    super();
    this._host = host;
  }

  /** Ensures a ResizeObserver is attached to the current DOM element. */
  syncObserver(dom: HTMLElement | null): void {
    if (!dom) {
      this._teardown();
      return;
    }

    if (this._observedDom !== dom) {
      this._teardown();
      this._observedDom = dom;
      this._resizeObserver = new ResizeObserver((entries) => {
        if (this._reportsAppliedBox(entries)) return;
        this.scheduleClassUpdate();
      });
      this._resizeObserver.observe(dom);
    }
  }

  /**
   * Whether an observation carries the box the last applied pass already
   * measured, in which case recomputing would produce the same classes.
   *
   * Filters two cases. `observe()` always delivers an initial observation of
   * the current size, which the priming `scheduleClassUpdate()` that follows
   * every `syncObserver()` call has already accounted for. And clearing a class
   * resizes the observed element, so the pass that cleared it is reported back
   * on the next frame. Reading `borderBoxSize` off the entry costs no layout.
   *
   * Border boxes are compared because the root is `box-sizing: border-box`,
   * which makes the `getComputedStyle` used height/width the pass records the
   * same untransformed border box the entries carry. The 0.1px tolerance
   * absorbs their differing float serialisations; a drop below it cannot flip
   * a verdict that carries its own +1px tolerance.
   */
  private _reportsAppliedBox(entries: ResizeObserverEntry[]): boolean {
    if (this._appliedBox === null) return false;

    const box = entries[0]?.borderBoxSize?.[0];
    if (!box) return false;

    const same = (a: number, b: number) => Math.abs(a - b) < 0.1;
    return same(box.blockSize, this._appliedBox.blockSize) && same(box.inlineSize, this._appliedBox.inlineSize);
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

    // Both heights below must be read with these classes cleared: they change
    // key sizing, so measuring while they are applied makes the outcome depend
    // on the previous outcome, which oscillates.
    dom.classList.remove(KIOSK_KEYBOARD_DOM.classes.rootCqShort, KIOSK_KEYBOARD_DOM.classes.rootCqTiny);

    const docked = this._host.getDocked();
    const isNumpad = this._host.getKeyboardType() === KeyboardType.Numpad;
    if (docked || isNumpad) {
      this._appliedBox = null;
      return;
    }

    // scrollHeight reports the full content height even under overflow: hidden.
    // If the element ever uses overflow: clip, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    const naturalHeight = dom.scrollHeight;
    // clientHeight is the same untransformed layout-pixel space scrollHeight
    // reports, so the root border cancels out of the comparison.
    const renderedHeight = dom.clientHeight;
    this._appliedBox = { blockSize: Number.parseFloat(cs.height), inlineSize: Number.parseFloat(cs.width) };

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

  /** Disconnects the ResizeObserver and clears the observed DOM reference. */
  private _teardown(): void {
    if (this._syncFrameId !== null) {
      cancelAnimationFrame(this._syncFrameId);
      this._syncFrameId = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._observedDom = null;
    // A later element carries its own box; a stale one would suppress its first
    // real observation.
    this._appliedBox = null;
  }

  override destroy(): void {
    this._teardown();
    super.destroy();
  }
}
