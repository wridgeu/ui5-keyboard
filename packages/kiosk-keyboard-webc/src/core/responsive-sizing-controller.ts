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
 * Owns height-responsive tier application for the web component.
 *
 * Observes the host element (and the rendered shadow root) with a
 * ResizeObserver and, on resize (coalesced via rAF), reflects a `cq-tier`
 * attribute (`short` / `tiny`, absent when unconstrained) on the host when it
 * is externally height-constrained. The tier lives on the host (not in shadow
 * DOM) so consumer overrides win; an attribute rather than a class so framework
 * `className` reconciliation cannot clobber it. Width breakpoints are handled
 * by CSS `@container` queries, so no JS width measurement is needed.
 *
 * The block axis cannot follow suit. A block-axis `@container` query needs
 * `container-type: size`, which makes the container's own block size independent
 * of its contents: on this auto-height root that resolves to zero and collapses
 * the keyboard. And the trigger is not "the box is short" but "the content does
 * not fit the box it was granted", which is a comparison against intrinsic size
 * that no size query can express. Hence the observer, and hence the tiers ride a
 * host attribute rather than a query.
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
   * Reflects the height-responsive `cq-tier` attribute on the host.
   *
   * Width responsiveness is handled purely by CSS @container queries.
   *
   * Height: applied in all browsers. Detects external height constraints
   * (host height < natural content height) and applies compact layout.
   *
   * Runs from scheduleClassUpdate(), which coalesces the ResizeObserver
   * callback and the host's refreshResponsiveState() into one animation frame.
   */
  private _applyClasses(): void {
    const root = this._host.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (!root) return;

    const cs = getComputedStyle(root);

    // ── Height ── (the tier lives on the host so consumer overrides always win)
    //
    // Both heights below must be read with the tier cleared: it changes key
    // sizing, so measuring while it is applied makes the outcome depend on the
    // previous outcome, which oscillates.
    this._host.removeAttribute(KIOSK_KEYBOARD_DOM.attributes.cqTier);

    // Skip for docked keyboards (viewport-driven, not container-constrained)
    // and numpad (already compact, shouldn't shrink further).
    if (this._host.docked || this._host.keyboardType === "Numpad") {
      return;
    }

    // scrollHeight reports full content height even under overflow: hidden.
    // If root ever uses overflow: clip instead, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    //
    // scrollHeight never includes the root's own border, but the border box is
    // what must fit into the host content box, so the border is added back;
    // without it, clips of up to the border width go undetected.
    const rootBorderY = (Number.parseFloat(cs.borderTopWidth) || 0) + (Number.parseFloat(cs.borderBottomWidth) || 0);
    const naturalHeight = root.scrollHeight + rootBorderY;

    // Compare against the host content box, not the host border box. This
    // keeps height breakpoints accurate when consumers add host padding/borders,
    // and measures untransformed layout pixels, matching the kiosk twin.
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
    const tier = isTiny ? KIOSK_KEYBOARD_DOM.cqTierValues.tiny : isShort ? KIOSK_KEYBOARD_DOM.cqTierValues.short : null;
    if (tier) this._host.setAttribute(KIOSK_KEYBOARD_DOM.attributes.cqTier, tier);
  }
}
