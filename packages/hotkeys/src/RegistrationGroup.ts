import Log from "sap/base/Log";
import type Router from "sap/ui/core/routing/Router";
import type { Router$BeforeRouteMatchedEvent } from "sap/ui/core/routing/Router";
import type HotkeyManager from "./HotkeyManager";
import type { Hotkey, HotkeyCallback, HotkeyOptions, HotkeyRegistrationInfo, HotkeyRegistrationHandle } from "./types";

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
 *   this._hotkeys.register("g i", handler, { scope: "main" });
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
  private _destroyed = false;
  private _onDispose: (() => void) | null;
  private _routerCleanup: (() => void) | null = null;

  constructor(manager: HotkeyManager, onDispose?: () => void) {
    this._manager = manager;
    this._onDispose = onDispose ?? null;
  }

  /**
   * Register a hotkey and track its handle in this group.
   *
   * The returned handle is the manager's handle. Handles whose registrations
   * are unregistered individually are pruned lazily from the group's tracking.
   *
   * @param hotkey - Hotkey string (e.g. "Mod+S", "Escape").
   * @param callback - Callback invoked when the hotkey matches.
   * @param options - Optional registration options.
   * @returns A lifecycle handle for the new registration.
   * @throws Error if this group has already been destroyed.
   */
  register(hotkey: Hotkey, callback: HotkeyCallback, options?: HotkeyOptions): HotkeyRegistrationHandle {
    if (this._destroyed) throw new Error("Cannot register on a destroyed RegistrationGroup");
    const handle = this._manager.register(hotkey, callback, options);
    this._handles.add(handle);
    return handle;
  }

  /**
   * Enable automatic scope management via a UI5 Router.
   *
   * Attaches a `beforeRouteMatched` listener that resets the scope stack
   * and pushes the matched route name as the active scope. The listener
   * is automatically detached when `destroyAll()` is called.
   *
   * Calling this again silently replaces the previous router.
   *
   * @param router - A UI5 Router or any object with `attachBeforeRouteMatched` / `detachBeforeRouteMatched`.
   */
  enableRouterIntegration(router: Router): void {
    if (this._destroyed) throw new Error("Cannot enableRouterIntegration on a destroyed RegistrationGroup");

    if (this._routerCleanup) {
      this._routerCleanup();
      this._routerCleanup = null;
    }

    const handler = (event: Router$BeforeRouteMatchedEvent) => {
      this._manager.resetToGlobalScope();
      const routeName = event.getParameter("name");
      if (typeof routeName === "string" && routeName) {
        this._manager.pushScope(routeName);
      }
    };

    router.attachBeforeRouteMatched(handler, this);
    this._routerCleanup = () => {
      router.detachBeforeRouteMatched(handler, this);
    };

    Log.info("Router integration enabled (via group)", undefined, "ui5.hotkeys.RegistrationGroup");
  }

  /** Unregister all tracked handles and detach router integration. Safe to call multiple times. */
  destroyAll(): void {
    if (this._destroyed) return;

    if (this._routerCleanup) {
      this._routerCleanup();
      this._routerCleanup = null;
    }

    for (const h of this._handles) {
      if (h.isActive) h.unregister();
    }
    this._handles.clear();
    this._destroyed = true;
    this._dispose();
  }

  /** @internal Called by HotkeyManager.destroy() to finalize lifecycle-bound groups. */
  _onManagerDestroy(): void {
    if (this._destroyed) return;

    if (this._routerCleanup) {
      this._routerCleanup();
      this._routerCleanup = null;
    }

    this._handles.clear();
    this._destroyed = true;
    this._dispose();
  }

  /** Whether destroyAll() has been called. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Number of active registrations (hotkeys + sequences) in this group. */
  get size(): number {
    this._pruneInactive();
    return this._handles.size;
  }

  /**
   * Get the group's currently active registrations (hotkeys and sequences).
   */
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    this._pruneInactive();
    if (this._handles.size === 0) return [];
    const ids = new Set<string>();
    for (const handle of this._handles) {
      ids.add(handle.id);
    }
    return this._manager.getRegistrations().filter((info) => ids.has(info.id));
  }

  /** Drop handles whose registrations were unregistered individually. */
  private _pruneInactive(): void {
    for (const handle of this._handles) {
      if (!handle.isActive) this._handles.delete(handle);
    }
  }

  private _dispose(): void {
    this._onDispose?.();
    this._onDispose = null;
  }
}
