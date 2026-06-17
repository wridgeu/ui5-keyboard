import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";

/** The slice of the host the highlight controller reads and writes back into. */
export interface PhysicalKeyHighlightHost {
  /** Live shadow root accessor (read at event time, never snapshotted). */
  getShadowRoot(): ShadowRoot | null;
  /** Resolves the native input/textarea the physical-key listeners attach to. */
  resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null;
  /**
   * Records the currently highlighted data-key (lowercased) or `null`. Kept on
   * the host because the JSX template binds the highlight class from it.
   */
  setHighlightedKey(value: string | null): void;
  /** Mirrors physical Shift / CapsLock modifier state into the host shift state. */
  syncShiftFromPhysical(shiftKey: boolean, capsLock: boolean): void;
}

/**
 * Owns the physical-keyboard highlight for the web component: while the resolved
 * target input has focus, key presses on the real keyboard light up the matching
 * virtual key for visual feedback, and the host's shift state mirrors the
 * physical Shift / CapsLock modifiers.
 *
 * The keydown/keyup/blur listeners live on the resolved target (not the host),
 * so `sync()` re-binds them whenever the target changes and `teardown()` drops
 * them on disconnect. The highlighted-key value itself stays on the host (the
 * template reads it), updated here through `setHighlightedKey`.
 */
export class PhysicalKeyHighlightController {
  private _abort: AbortController | null = null;
  private _target: HTMLElement | null = null;

  private readonly _onKeyDown = (e: Event): void => {
    if (e instanceof KeyboardEvent) this._onPhysicalKey(e, true);
  };
  private readonly _onKeyUp = (e: Event): void => {
    if (e instanceof KeyboardEvent) this._onPhysicalKey(e, false);
  };
  private readonly _onBlur = (): void => {
    this.clearHighlight();
  };

  /**
   * @param _host Live access to the shadow root, resolved target, highlight slot, and shift sync.
   * @param _nativeDispatchableKeys Function/navigation keys mapped to `{fkey:*}` data-keys.
   */
  constructor(
    private readonly _host: PhysicalKeyHighlightHost,
    private readonly _nativeDispatchableKeys: ReadonlySet<string>,
  ) {}

  private _onPhysicalKey(ev: KeyboardEvent, down: boolean): void {
    this._highlightKey(ev.key, down);

    this._host.syncShiftFromPhysical(ev.shiftKey, ev.getModifierState("CapsLock"));
  }

  /** Maps a physical KeyboardEvent.key to the data-key value used in the layout. */
  private _physicalKeyToDataKey(physicalKey: string): string {
    const lower = physicalKey.toLowerCase();
    if (lower === "backspace") return "{backspace}";
    if (lower === "enter") return "{enter}";
    if (lower === "shift") return "{shift}";
    if (this._nativeDispatchableKeys.has(physicalKey)) return `{fkey:${physicalKey}}`;
    return lower;
  }

  private _highlightKey(physicalKey: string, pressed: boolean): void {
    const dataKey = this._physicalKeyToDataKey(physicalKey);

    // Immediate DOM manipulation for instant visual feedback
    if (pressed) {
      const selector = `${KIOSK_KEYBOARD_DOM.selectors.keyByValue(dataKey)}, ${KIOSK_KEYBOARD_DOM.selectors.keyByShiftValue(physicalKey)}`;
      const el = this._host.getShadowRoot()?.querySelector<HTMLElement>(selector);
      if (el) el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyHighlight);
    } else {
      this.clearHighlight();
    }

    // Track state so it persists across re-renders (lowercased for template comparison)
    this._host.setHighlightedKey(pressed ? dataKey.toLowerCase() : null);
  }

  clearHighlight(): void {
    this._host
      .getShadowRoot()
      ?.querySelectorAll<HTMLElement>(`.${KIOSK_KEYBOARD_DOM.classes.keyHighlight}`)
      .forEach((el) => el.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyHighlight));
    this._host.setHighlightedKey(null);
  }

  /** Re-binds the physical-key listeners to the current resolved target. */
  sync(): void {
    const target = this._host.resolveTarget();

    // Skip if target unchanged and still connected to DOM
    if (target === this._target && (!target || target.isConnected)) return;

    this._abort?.abort();
    this._abort = null;
    this._target = target;

    if (target) {
      this._abort = new AbortController();
      const { signal } = this._abort;
      target.addEventListener("keydown", this._onKeyDown, { signal });
      target.addEventListener("keyup", this._onKeyUp, { signal });
      target.addEventListener("blur", this._onBlur, { signal });
    }
  }

  teardown(): void {
    this._abort?.abort();
    this._abort = null;
    this._target = null;
    this.clearHighlight();
  }
}
