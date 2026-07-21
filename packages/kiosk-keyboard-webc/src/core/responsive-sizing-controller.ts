import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";
import type { KeyboardType } from "../types.js";

/**
 * Resolves a CSS custom property holding a rem-based threshold to pixels.
 * Accepts values like "16rem" or "20rem"; falls back to `fallbackRem * remPx`
 * when the property is unset or unparseable.
 */
function resolveRemThreshold(
  computedStyle: CSSStyleDeclaration,
  prop: string,
  fallbackRem: number,
  remPx: number,
): number {
  const raw = computedStyle.getPropertyValue(prop).trim();
  if (!raw) return fallbackRem * remPx;
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallbackRem * remPx : value * remPx;
}

/** The slice of the host element the responsive controller reads. */
export type ResponsiveSizingHost = HTMLElement & {
  readonly docked: boolean;
  readonly keyboardType: `${KeyboardType}`;
};

/**
 * Owns height-responsive class application for the web component.
 *
 * Observes the host element (and the rendered shadow root) with a
 * ResizeObserver and, on resize (coalesced via rAF), toggles `hostCqShort` /
 * `hostCqTiny` classes on the host when it is externally height-constrained.
 * The classes live on the host (not in shadow DOM) so consumer overrides win
 * and they survive template re-renders. Width breakpoints are handled by CSS
 * `@container` queries, so no JS width measurement is needed.
 */
export class ResponsiveSizingController {
  /** ResizeObserver for height-responsive class updates. */
  private _resizeObserver: ResizeObserver | null = null;
  /** The current root element observed for intrinsic content size changes. */
  private _observedRoot: HTMLElement | null = null;
  /** rAF handle that coalesces responsive class updates from multiple observers. */
  private _syncFrame: number | null = null;

  constructor(private readonly _host: ResponsiveSizingHost) {}

  /** Attaches a ResizeObserver to the host element for responsive class updates. */
  setup(): void {
    this._resizeObserver = new ResizeObserver(() => {
      this.scheduleClassUpdate();
    });
    this._resizeObserver.observe(this._host);

    // `connectedCallback` renders (ending in `onAfterRendering`) before it calls
    // `onEnterDOM`, so a root is already recorded by the time this runs.
    if (this._observedRoot) {
      this._resizeObserver.observe(this._observedRoot);
    }
  }

  /** Disconnects and releases the ResizeObserver. */
  teardown(): void {
    if (this._syncFrame !== null) {
      cancelAnimationFrame(this._syncFrame);
      this._syncFrame = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._observedRoot = null;
  }

  /** Keeps the root element observed so style-only intrinsic size changes trigger a re-sync. */
  syncObserverTargets(root: HTMLElement | null): void {
    if (root === this._observedRoot) return;

    // Recorded even before `setup()` has run, so the first render's root is not
    // lost; `setup()` observes whatever is recorded here.
    if (this._resizeObserver) {
      if (this._observedRoot) {
        this._resizeObserver.unobserve(this._observedRoot);
      }
      if (root) {
        this._resizeObserver.observe(root);
      }
    }

    this._observedRoot = root;
  }

  /** Coalesces responsive class updates triggered by host/content observation. */
  scheduleClassUpdate(): void {
    if (this._syncFrame !== null) return;

    this._syncFrame = requestAnimationFrame(() => {
      this._syncFrame = null;
      this._applyClasses();
    });
  }

  /** Returns the current host content-box height available to the keyboard root. */
  private _getHostContentHeight(): number {
    const hostStyle = getComputedStyle(this._host);
    const paddingTop = Number.parseFloat(hostStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(hostStyle.paddingBottom) || 0;
    return Math.max(0, this._host.clientHeight - paddingTop - paddingBottom);
  }

  /**
   * Applies height responsive classes to the host element.
   *
   * Width responsiveness is handled purely by CSS @container queries.
   *
   * Height: applied in all browsers. Detects external height constraints
   * (host height < natural content height) and applies compact layout.
   *
   * Called from scheduleClassUpdate() (coalesced from ResizeObserver via rAF)
   * and from the host's refreshResponsiveState() (invoked by onAfterRendering
   * and public callers) to survive template re-renders that reconcile the
   * class attribute.
   */
  private _applyClasses(): void {
    const root = this._host.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (!root) return;

    const cs = getComputedStyle(root);

    // ── Height ── (classes live on host so consumer overrides always win)
    //
    // Both heights below must be read with these classes cleared: they change
    // key sizing, so measuring while they are applied makes the outcome depend
    // on the previous outcome, which oscillates.
    this._host.classList.remove(KIOSK_KEYBOARD_DOM.classes.hostCqShort, KIOSK_KEYBOARD_DOM.classes.hostCqTiny);

    // Skip for docked keyboards (viewport-driven, not container-constrained)
    // and numpad (already compact, shouldn't shrink further).
    if (this._host.docked || this._host.keyboardType === "Numpad") {
      return;
    }

    // scrollHeight reports full content height even under overflow: hidden.
    // If root ever uses overflow: clip instead, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    const naturalHeight = root.scrollHeight;

    // Compare against the host content box, not the host border box. This
    // keeps height breakpoints accurate when consumers add host padding/borders.
    const hostHeight = this._getHostContentHeight();

    // Only apply when externally constrained (host height < natural content height).
    // Prevents naturally short keyboards (F-Keys, Nav) from triggering.
    // The +1px tolerance avoids oscillation from sub-pixel rounding differences.
    if (naturalHeight <= hostHeight + 1) {
      return;
    }

    // px per rem, read once here from the root font-size.
    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const shortThresh = resolveRemThreshold(cs, "--kiosk-keyboard-cq-short-threshold", 16, remPx);
    const tinyThresh = resolveRemThreshold(cs, "--kiosk-keyboard-cq-tiny-threshold", 12, remPx);
    const isTiny = hostHeight <= tinyThresh;
    const isShort = hostHeight <= shortThresh;
    this._host.classList.toggle(KIOSK_KEYBOARD_DOM.classes.hostCqShort, isShort && !isTiny);
    this._host.classList.toggle(KIOSK_KEYBOARD_DOM.classes.hostCqTiny, isTiny);
  }
}
