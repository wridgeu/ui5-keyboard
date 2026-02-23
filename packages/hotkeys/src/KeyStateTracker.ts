import { MODIFIER_KEYS } from "./internal/constants";
import Log from "sap/base/Log";
import { Platform } from "./library";
import { runtimeHooks } from "./internal/runtime";

const LOG_COMPONENT = "ui5.hotkeys.KeyStateTracker";

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
  private _heldKeyCounts: Map<string, number> = new Map();
  private _heldByCode: Map<string, string> = new Map();
  private _platform: Platform;
  private _changeCallback: ((keys: readonly string[]) => void) | null = null;

  private readonly _keydownHandler = this._onKeyDown.bind(this);
  private readonly _keyupHandler = this._onKeyUp.bind(this);
  private readonly _blurHandler = this._onBlur.bind(this);

  constructor() {
    this._platform = runtimeHooks.detectPlatform();
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
   *
   * Returns a new array on each call, so callers can safely iterate and cache
   * it without mutating the internal tracker state.
   */
  getHeldKeys(): readonly string[] {
    return Array.from(this._heldKeys);
  }

  /**
   * Check whether a specific key is currently held.
   *
   * @param key - KeyboardEvent.key name to check (e.g. "Control", "a").
   */
  isKeyHeld(key: string): boolean {
    return this._heldKeys.has(key);
  }

  /**
   * Set a callback that fires whenever the held keys change.
   *
   * Pass `null` to remove a previously registered callback.
   */
  setChangeCallback(callback: ((keys: readonly string[]) => void) | null): void {
    this._changeCallback = callback;
  }

  /**
   * Remove all event listeners and reset singleton state.
   *
   * Safe to call multiple times; after destroy, `getInstance()` creates a new,
   * fresh tracker instance.
   */
  destroy(): void {
    document.removeEventListener("keydown", this._keydownHandler, true);
    document.removeEventListener("keyup", this._keyupHandler, true);
    window.removeEventListener("blur", this._blurHandler);
    this._heldKeys.clear();
    this._heldKeyCounts.clear();
    this._heldByCode.clear();
    this._changeCallback = null;
    instance = null;
  }

  private _onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    const code = event.code;
    let changed = false;

    if (code) {
      const previousKey = this._heldByCode.get(code);
      if (previousKey === key) return;

      if (previousKey !== undefined) {
        changed = this._decrementHeldKey(previousKey) || changed;
      }

      this._heldByCode.set(code, key);
      changed = this._incrementHeldKey(key) || changed;
    } else {
      if (this._heldKeys.has(key)) return;
      changed = this._incrementHeldKey(key);
    }

    if (changed) {
      this._notifyChange();
    }
  }

  private _onKeyUp(event: KeyboardEvent): void {
    const key = event.key;

    // macOS stuck-key fix (from TanStack): When a modifier is released,
    // clear all non-modifier keys. On macOS, Cmd+Tab swallows the Tab keyup,
    // leaving it permanently "stuck".
    if (this._platform === Platform.Mac && MODIFIER_KEYS.has(key)) {
      let changed = this._clearNonModifierKeys();
      changed = this._releaseKeyEventIdentity(event) || changed;
      if (changed) {
        this._notifyChange();
      }
      return;
    }

    let changed = this._releaseKeyEventIdentity(event);

    // Fallback for synthetic events without `code` where key casing can differ
    // between keydown/keyup (e.g., Shift released before keyup).
    if (!changed && key.length === 1) {
      const alternateCaseKey = key === key.toLowerCase() ? key.toUpperCase() : key.toLowerCase();
      changed = this._decrementHeldKey(alternateCaseKey);
    }

    if (changed) {
      this._notifyChange();
    }
  }

  private _onBlur(): void {
    if (this._heldKeys.size > 0) {
      this._heldKeys.clear();
      this._heldKeyCounts.clear();
      this._heldByCode.clear();
      this._notifyChange();
      return;
    }

    this._heldKeyCounts.clear();
    this._heldByCode.clear();
  }

  private _releaseKeyEventIdentity(event: KeyboardEvent): boolean {
    const code = event.code;
    if (code) {
      const keyFromCode = this._heldByCode.get(code);
      if (keyFromCode !== undefined) {
        this._heldByCode.delete(code);
        return this._decrementHeldKey(keyFromCode);
      }
    }

    return this._decrementHeldKey(event.key);
  }

  private _clearNonModifierKeys(): boolean {
    let changed = false;

    for (const held of Array.from(this._heldKeys)) {
      if (MODIFIER_KEYS.has(held)) continue;
      changed = this._clearHeldKeyCompletely(held) || changed;
    }

    for (const [code, held] of this._heldByCode) {
      if (!MODIFIER_KEYS.has(held)) {
        this._heldByCode.delete(code);
      }
    }

    return changed;
  }

  private _clearHeldKeyCompletely(key: string): boolean {
    const removed = this._heldKeys.delete(key);
    this._heldKeyCounts.delete(key);
    return removed;
  }

  private _incrementHeldKey(key: string): boolean {
    const current = this._heldKeyCounts.get(key) ?? 0;
    this._heldKeyCounts.set(key, current + 1);

    if (current === 0) {
      this._heldKeys.add(key);
      return true;
    }

    return false;
  }

  private _decrementHeldKey(key: string): boolean {
    const current = this._heldKeyCounts.get(key);
    if (!current) return false;

    if (current > 1) {
      this._heldKeyCounts.set(key, current - 1);
      return false;
    }

    this._heldKeyCounts.delete(key);
    return this._heldKeys.delete(key);
  }

  private _notifyChange(): void {
    if (this._changeCallback) {
      try {
        this._changeCallback(this.getHeldKeys());
      } catch (error) {
        Log.error(`Error in KeyStateTracker change callback: ${error}`, undefined, LOG_COMPONENT);
      }
    }
  }
}
