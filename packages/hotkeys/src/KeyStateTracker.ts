import { MODIFIER_KEYS } from "./internal/constants";
import { INTERNAL_TOKEN } from "./internal/internal-token";
import Log from "sap/base/Log";
import { Platform } from "./library";

const LOG_COMPONENT = "ui5.hotkeys.KeyStateTracker";

/**
 * Tracks which keys are currently held down.
 *
 * Receives events from EventDispatcher via `processKeyDown`, `processKeyUp`,
 * and `processBlur` — does NOT own any DOM listeners.
 *
 * Includes a macOS fix for stuck keys when a modifier is released
 * (Cmd+Tab swallows the Tab keyup on macOS).
 *
 * Plain class — no UI5 lifecycle dependency.
 *
 * @public — exported for type usage. Obtain an instance via
 * `HotkeyManager.getKeyStateTracker()`.
 */
export default class KeyStateTracker {
  private _heldKeys: Set<string> = new Set();
  private _heldKeyCounts: Map<string, number> = new Map();
  private _heldByCode: Map<string, string> = new Map();
  private _platform: Platform;
  private _changeCallback: ((keys: readonly string[]) => void) | null = null;

  /**
   * @internal — Do not instantiate directly. Use `HotkeyManager.getKeyStateTracker()`.
   */
  constructor(platform: Platform, token: symbol) {
    if (token !== INTERNAL_TOKEN) {
      throw new Error("KeyStateTracker cannot be instantiated directly. Use HotkeyManager.getKeyStateTracker().");
    }
    this._platform = platform;
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
   * Process a keydown event — maps `code` to `key`, ref-counts held keys.
   * Called by EventDispatcher (step 1 of the dispatch pipeline).
   * @internal
   */
  processKeyDown(event: KeyboardEvent): void {
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

  /**
   * Process a keyup event — decrements ref-count, includes macOS stuck-key fix.
   * Called by EventDispatcher.
   * @internal
   */
  processKeyUp(event: KeyboardEvent): void {
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

  /**
   * Process a blur event (window lost focus) — clears all held keys.
   * Called by EventDispatcher.
   * @internal
   */
  processBlur(): void {
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

  /**
   * Reset all state and clear callbacks.
   * @internal — Called by EventDispatcher.destroy(), not by consumers.
   */
  destroy(): void {
    this._heldKeys.clear();
    this._heldKeyCounts.clear();
    this._heldByCode.clear();
    this._changeCallback = null;
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

    for (const [code, held] of Array.from(this._heldByCode)) {
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
