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
  /**
   * Reports each measured verdict, or `null` once `autoCompact` is off. The host
   * holds the verdict and owns which layout it resolves to.
   */
  applyTier(narrow: boolean | null): void;
}

/**
 * Owns the width measurement behind the `autoCompact` property.
 *
 * Separate from `ResponsiveSizingController`, which bails for docked, numpad and
 * unconstrained keyboards exactly when this tier must still resolve, and whose
 * measurement pass a width read would add forced layout to; allocates nothing
 * while `autoCompact` is off.
 *
 * The tier is applied from a `requestAnimationFrame`, coalescing a frame's
 * observations into one application.
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

  constructor(private readonly _host: AutoCompactHost) {}

  /**
   * Ensures the observer is attached to the current root element while `autoCompact`
   * is on, and torn down while it is off. Called after every render, so both
   * transitions are covered by the re-render the property change triggers.
   */
  syncObserver(root: HTMLElement | null): void {
    if (!root || !this._host.isEnabled()) {
      this.teardown();
      // Off withdraws the verdict, so the requested layout comes back rather than
      // the keyboard being stranded on the arrangement a width picked.
      if (!this._host.isEnabled()) this._host.applyTier(null);
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
  }

  private _applyTier(): void {
    const root = this._observedRoot;
    if (!root || !this._host.isEnabled() || this._observedInline === null) return;

    // A box of zero is an element that lost its layout (a display:none ancestor,
    // a collapsed panel), not a narrow keyboard; tiering on it would swap while
    // invisible and swap back on reveal.
    if (this._observedInline <= 0) return;

    const raw = getComputedStyle(root).getPropertyValue("--kiosk-keyboard-auto-compact-threshold").trim();
    const rem = Number.parseFloat(raw);
    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const threshold = (Number.isNaN(rem) ? DEFAULT_THRESHOLD_REM : rem) * remPx;

    this._host.applyTier(this._observedInline <= threshold);
  }
}
