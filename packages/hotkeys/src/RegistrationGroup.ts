import type HotkeyManager from "./HotkeyManager";
import type {
  Hotkey,
  HotkeyCallback,
  HotkeyOptions,
  HotkeyRegistrationHandle,
  SequenceOptions,
  SequenceRegistrationHandle,
} from "./types";

/**
 * Groups hotkey and sequence registrations for collective lifecycle management.
 *
 * Created via `HotkeyManager.createGroup()`. Tracks all registrations made
 * through it, enabling single-call cleanup via `destroyAll()`.
 *
 * Lifecycle behavior:
 * - Calling `destroyAll()` finalizes the group (idempotent).
 * - `HotkeyManager.destroy()` also finalizes all groups created from that manager.
 *   This prevents stale group/handle reuse across Component recreation.
 *
 * Recommended for controller code where registrations should be cleaned up
 * in `onExit()`:
 *
 * @example
 * ```ts
 * private _hotkeys = this._manager.createGroup();
 *
 * onInit(): void {
 *   this._hotkeys.register("F5", handler, { scope: "main" });
 *   this._hotkeys.registerSequence(["G", "I"], handler, { scope: "main" });
 * }
 *
 * onExit(): void {
 *   this._hotkeys.destroyAll();
 * }
 * ```
 */
export default class RegistrationGroup {
  private _manager: HotkeyManager;
  private _handles: HotkeyRegistrationHandle[] = [];
  private _sequenceHandles: SequenceRegistrationHandle[] = [];
  private _destroyed = false;
  private _onDispose: (() => void) | null;

  constructor(manager: HotkeyManager, onDispose?: () => void) {
    this._manager = manager;
    this._onDispose = onDispose ?? null;
  }

  register(hotkey: Hotkey, callback: HotkeyCallback, options?: HotkeyOptions): HotkeyRegistrationHandle {
    if (this._destroyed) throw new Error("Cannot register on a destroyed RegistrationGroup");
    const handle = this._manager.register(hotkey, callback, options);
    this._handles.push(handle);
    return handle;
  }

  registerSequence(
    sequence: string[],
    callback: HotkeyCallback,
    options?: SequenceOptions,
  ): SequenceRegistrationHandle {
    if (this._destroyed) throw new Error("Cannot registerSequence on a destroyed RegistrationGroup");
    const handle = this._manager.registerSequence(sequence, callback, options);
    this._sequenceHandles.push(handle);
    return handle;
  }

  /** Unregister all tracked handles. Safe to call multiple times. */
  destroyAll(): void {
    if (this._destroyed) return;

    for (const h of this._handles) {
      if (h.isActive) h.unregister();
    }
    this._handles = [];
    for (const h of this._sequenceHandles) {
      if (h.isActive) h.unregister();
    }
    this._sequenceHandles = [];
    this._destroyed = true;
    this._dispose();
  }

  /** @internal Called by HotkeyManager.destroy() to finalize lifecycle-bound groups. */
  _onManagerDestroy(): void {
    if (this._destroyed) return;
    this._handles = [];
    this._sequenceHandles = [];
    this._destroyed = true;
    this._dispose();
  }

  /** Whether destroyAll() has been called. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Number of active registrations (hotkeys + sequences) in this group. */
  get size(): number {
    return this._handles.filter((h) => h.isActive).length + this._sequenceHandles.filter((h) => h.isActive).length;
  }

  private _dispose(): void {
    this._onDispose?.();
    this._onDispose = null;
  }
}
