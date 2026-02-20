import { MODIFIER_KEYS } from "./internal/constants";
import { Platform } from "./library";
import { detectPlatform } from "./internal/platform";

let instance: KeyStateTracker | null = null;

/**
 * Tracks which keys are currently held down.
 *
 * Listens to `keydown`, `keyup`, and `blur` events to maintain an accurate
 * set of held keys. Includes a macOS fix for stuck keys when a modifier
 * is released (Cmd+Tab swallows the Tab keyup on macOS).
 *
 * Plain class — no UI5 lifecycle dependency.
 */
export default class KeyStateTracker {
  private _heldKeys: Set<string> = new Set();
  private _platform: Platform;
  private _changeCallback: ((keys: readonly string[]) => void) | null = null;

  private readonly _keydownHandler = this._onKeyDown.bind(this);
  private readonly _keyupHandler = this._onKeyUp.bind(this);
  private readonly _blurHandler = this._onBlur.bind(this);

  constructor() {
    this._platform = detectPlatform();
    document.addEventListener("keydown", this._keydownHandler, true);
    document.addEventListener("keyup", this._keyupHandler, true);
    window.addEventListener("blur", this._blurHandler);
  }

  static getInstance(): KeyStateTracker {
    if (!instance) {
      instance = new KeyStateTracker();
    }
    return instance;
  }

  /**
   * Get a snapshot of currently held keys.
   */
  getHeldKeys(): readonly string[] {
    return Array.from(this._heldKeys);
  }

  /**
   * Check whether a specific key is currently held.
   */
  isKeyHeld(key: string): boolean {
    return this._heldKeys.has(key);
  }

  /**
   * Set a callback that fires whenever the held keys change.
   */
  setChangeCallback(callback: ((keys: readonly string[]) => void) | null): void {
    this._changeCallback = callback;
  }

  destroy(): void {
    document.removeEventListener("keydown", this._keydownHandler, true);
    document.removeEventListener("keyup", this._keyupHandler, true);
    window.removeEventListener("blur", this._blurHandler);
    this._heldKeys.clear();
    this._changeCallback = null;
    instance = null;
  }

  private _onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (!this._heldKeys.has(key)) {
      this._heldKeys.add(key);
      this._notifyChange();
    }
  }

  private _onKeyUp(event: KeyboardEvent): void {
    const key = event.key;

    // macOS stuck-key fix (from TanStack): When a modifier is released,
    // clear all non-modifier keys. On macOS, Cmd+Tab swallows the Tab keyup,
    // leaving it permanently "stuck".
    if (this._platform === Platform.Mac && MODIFIER_KEYS.has(key)) {
      let changed = false;
      for (const held of this._heldKeys) {
        if (!MODIFIER_KEYS.has(held)) {
          this._heldKeys.delete(held);
          changed = true;
        }
      }
      this._heldKeys.delete(key);
      if (changed || this._heldKeys.size === 0) {
        this._notifyChange();
      }
      return;
    }

    if (this._heldKeys.has(key)) {
      this._heldKeys.delete(key);
      this._notifyChange();
    }
  }

  private _onBlur(): void {
    if (this._heldKeys.size > 0) {
      this._heldKeys.clear();
      this._notifyChange();
    }
  }

  private _notifyChange(): void {
    if (this._changeCallback) {
      this._changeCallback(this.getHeldKeys());
    }
  }
}
