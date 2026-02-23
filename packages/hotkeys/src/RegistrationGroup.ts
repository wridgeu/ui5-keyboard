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
  private _handles: Set<HotkeyRegistrationHandle> = new Set();
  private _sequenceHandles: Set<SequenceRegistrationHandle> = new Set();
  private _destroyed = false;
  private _onDispose: (() => void) | null;

  constructor(manager: HotkeyManager, onDispose?: () => void) {
    this._manager = manager;
    this._onDispose = onDispose ?? null;
  }

  register(hotkey: Hotkey, callback: HotkeyCallback, options?: HotkeyOptions): HotkeyRegistrationHandle {
    if (this._destroyed) throw new Error("Cannot register on a destroyed RegistrationGroup");
    const innerHandle = this._manager.register(hotkey, callback, options);
    const wrappedHandle: HotkeyRegistrationHandle = {
      get id() {
        return innerHandle.id;
      },
      get isActive() {
        return innerHandle.isActive;
      },
      get hotkey() {
        return innerHandle.hotkey;
      },
      get scope() {
        return innerHandle.scope;
      },
      get description() {
        return innerHandle.description;
      },
      unregister: () => {
        innerHandle.unregister();
        this._handles.delete(wrappedHandle);
      },
      setOptions: (newOptions) => {
        innerHandle.setOptions(newOptions);
      },
    };

    this._handles.add(wrappedHandle);
    return wrappedHandle;
  }

  registerSequence(
    sequence: string[],
    callback: HotkeyCallback,
    options?: SequenceOptions,
  ): SequenceRegistrationHandle {
    if (this._destroyed) throw new Error("Cannot registerSequence on a destroyed RegistrationGroup");
    const innerHandle = this._manager.registerSequence(sequence, callback, options);
    const wrappedHandle: SequenceRegistrationHandle = {
      get id() {
        return innerHandle.id;
      },
      get isActive() {
        return innerHandle.isActive;
      },
      get sequence() {
        return innerHandle.sequence;
      },
      get scope() {
        return innerHandle.scope;
      },
      get description() {
        return innerHandle.description;
      },
      unregister: () => {
        innerHandle.unregister();
        this._sequenceHandles.delete(wrappedHandle);
      },
      setOptions: (newOptions) => {
        innerHandle.setOptions(newOptions);
      },
    };

    this._sequenceHandles.add(wrappedHandle);
    return wrappedHandle;
  }

  /** Unregister all tracked handles. Safe to call multiple times. */
  destroyAll(): void {
    if (this._destroyed) return;

    for (const h of this._handles) {
      if (h.isActive) h.unregister();
    }
    this._handles.clear();
    for (const h of this._sequenceHandles) {
      if (h.isActive) h.unregister();
    }
    this._sequenceHandles.clear();
    this._destroyed = true;
    this._dispose();
  }

  /** @internal Called by HotkeyManager.destroy() to finalize lifecycle-bound groups. */
  _onManagerDestroy(): void {
    if (this._destroyed) return;
    this._handles.clear();
    this._sequenceHandles.clear();
    this._destroyed = true;
    this._dispose();
  }

  /** Whether destroyAll() has been called. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Number of active registrations (hotkeys + sequences) in this group. */
  get size(): number {
    return this._handles.size + this._sequenceHandles.size;
  }

  private _dispose(): void {
    this._onDispose?.();
    this._onDispose = null;
  }
}
