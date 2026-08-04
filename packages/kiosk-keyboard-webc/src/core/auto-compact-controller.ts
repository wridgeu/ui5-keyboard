/**
 * Width tier, in rem, at or below which a layout yields to its compact form.
 * 22rem is where the keyboard already starts tightening its inter-key gap, and it
 * sits clear of the ~20.5rem at which the densest built-in rows drop under the
 * 24 CSS px spacing WCAG 2.2 SC 2.5.8 accepts. Overridable per keyboard with the
 * `--kiosk-keyboard-auto-compact-threshold` custom property.
 */
const DEFAULT_THRESHOLD_REM = 22;

/** The slice of the component the controller drives. */
export interface AutoCompactHost {
  /** Whether `autoCompact` is on. */
  isEnabled(): boolean;
  /** Applies the tier. The host owns which layout that resolves to. */
  /**
   * Applies the tier. The host owns which layout that resolves to. `crossed` is
   * whether this verdict replaces a known previous one, which is what separates a
   * width the user just crossed from the first resolution of a keyboard that was
   * always this wide.
   */
  applyTier(narrow: boolean, crossed: boolean): void;
}

/**
 * Owns the width measurement behind the `autoCompact` property.
 *
 * Layout data is the one responsive dimension CSS cannot reach: a `@container`
 * rule can restyle a row but not re-seat its keys, and arrow-key navigation moves
 * on the resolved layout's coordinates rather than on rendered geometry. So the
 * tier that picks between a layout and its compact counterpart is measured here
 * and applied by the host.
 *
 * Deliberately a second `ResizeObserver` rather than a branch inside
 * {@link ResponsiveSizingController}. That controller returns early for docked and
 * numpad keyboards and again when the keyboard is not height-constrained, which is
 * the common case and exactly when this tier still has to resolve; and its
 * measurement pass is pinned by a "no forced layout reads during shift toggle"
 * perf test that a width read would break. Keeping the two apart also keeps this
 * one dormant: it observes nothing, and allocates no observer, while `autoCompact`
 * is off, which is the default.
 *
 * The tier is applied from a `requestAnimationFrame`, never from the observation
 * callback, which coalesces several observations in one frame into a single
 * application. It is not a guard against the "ResizeObserver loop completed with
 * undelivered notifications" failure #180 recorded against the height tiers:
 * applying the tier synchronously was measured to produce none, because #180 wrote
 * `classList` inside the callback and resized the observed box within the same
 * delivery, whereas a layout swap re-renders asynchronously in both frameworks and
 * so never re-enters observation. That measurement proves the absence of a symptom,
 * not of the hazard, so the frame stays.
 */
export class AutoCompactController {
  private _resizeObserver: ResizeObserver | null = null;
  /** Keyboard root element currently observed. */
  private _observedRoot: HTMLElement | null = null;
  /** rAF handle coalescing tier evaluation. */
  private _syncFrame: number | null = null;
  /**
   * Border-box inline size of the last observation, read off the entry rather than
   * measured, which costs no layout. `null` until the first observation lands.
   */
  private _observedInline: number | null = null;
  /** Last tier applied, so an observation that does not cross the threshold is dropped. */
  private _appliedNarrow: boolean | null = null;

  constructor(private readonly _host: AutoCompactHost) {}

  /**
   * Ensures the observer is attached to the current root element while `autoCompact`
   * is on, and torn down while it is off. Called after every render, so both
   * transitions are covered by the re-render the property change triggers.
   */
  syncObserver(root: HTMLElement | null): void {
    if (!root || !this._host.isEnabled()) {
      // Switching the feature off gives the requested layout back rather than
      // stranding the keyboard on the arrangement a width picked, which with the
      // observer gone nothing else could undo.
      const restore = this._appliedNarrow === true && !this._host.isEnabled();
      this.teardown();
      if (restore) this._host.applyTier(false, false);
      return;
    }
    if (this._observedRoot === root) return;

    this.teardown();
    this._observedRoot = root;
    this._resizeObserver = new ResizeObserver((entries) => {
      const inline = entries[0]?.borderBoxSize?.[0]?.inlineSize;
      if (inline === undefined) return;
      this._observedInline = inline;
      this.scheduleTierUpdate();
    });
    this._resizeObserver.observe(root);
  }

  /** Coalesces tier evaluation into the next frame. */
  private scheduleTierUpdate(): void {
    if (this._syncFrame !== null) return;

    this._syncFrame = requestAnimationFrame(() => {
      this._syncFrame = null;
      this._applyTier();
    });
  }

  /**
   * Re-evaluates the tier against the last observed width. The host calls this when
   * the layout it should resolve against changes, which a resize would not report.
   */
  reapply(): void {
    this._appliedNarrow = null;
    this.scheduleTierUpdate();
  }

  /** Disconnects and releases the observer. */
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
    this._observedInline = null;
    // A later element carries its own width; a stale verdict would suppress its
    // first real observation.
    this._appliedNarrow = null;
  }

  private _applyTier(): void {
    const root = this._observedRoot;
    if (!root || !this._host.isEnabled() || this._observedInline === null) return;

    const raw = getComputedStyle(root).getPropertyValue("--kiosk-keyboard-auto-compact-threshold").trim();
    const rem = Number.parseFloat(raw);
    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const threshold = (Number.isNaN(rem) ? DEFAULT_THRESHOLD_REM : rem) * remPx;

    // A box of zero is an element that lost its layout (a display:none ancestor,
    // a collapsed panel), not a narrow keyboard; tiering on it would swap while
    // invisible and swap back on reveal.
    if (this._observedInline <= 0) return;
    const narrow = this._observedInline <= threshold;
    if (narrow === this._appliedNarrow) return;
    const crossed = this._appliedNarrow !== null;
    this._appliedNarrow = narrow;
    this._host.applyTier(narrow, crossed);
  }
}
