import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
import type Router from "sap/ui/core/routing/Router";
import { ConflictBehavior, UnhandledReason } from "./library";
import RegistrationGroup from "./RegistrationGroup";
import SequenceManager from "./SequenceManager";
import KeyStateTracker from "./KeyStateTracker";
import HotkeyRecorder from "./HotkeyRecorder";
import type { HotkeyRecorderOptions } from "./HotkeyRecorder";
import EventDispatcher from "./internal/event-dispatcher";
import type { HotkeyDispatchHandler } from "./internal/event-dispatcher";
import { INTERNAL_TOKEN } from "./internal/internal-token";
import { GLOBAL_SCOPE } from "./internal/constants";
import { getEventTarget, isInputElement } from "./internal/dom";
import { createIdGenerator } from "./internal/idgen";
import { keyboardEventToHotkey, parseHotkey } from "./internal/parse";
import { resolveRequiredScope, resolveScopeOrGlobal } from "./internal/scope";
import { resetRuntimeCaches, runtimeHooks } from "./internal/runtime";
import { findMatchInScope } from "./internal/dispatch-core";
import { matchesKeyboardEvent } from "./internal/match";
import { recordSkip, type DebugSkipEntry, type SkipInfo } from "./internal/skip-reason";
import type {
  Hotkey,
  HotkeyCallback,
  HotkeyOptions,
  HotkeyRegistration,
  HotkeyRegistrationHandle,
  HotkeyRegistrationInfo,
  KeyboardDispatchGuard,
  Platform,
  ResolvedHotkeyOptions,
  SequenceOptions,
  SequencePendingCallback,
  SequenceRegistrationHandle,
  SequenceRegistrationInfo,
  UnhandledContext,
  UnhandledCallback,
  UpdatableHotkeyOptions,
} from "./types";

type ValidateModule = typeof import("./validate");

type RouteMatchedEvent = Parameters<Parameters<Router["attachBeforeRouteMatched"]>[0]>[0];

const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

let instance: HotkeyManager | null = null;
const idGen = createIdGenerator("hk_");

interface ScopeRegistrationBucket {
  documentIds: Set<string>;
  targets: Map<EventTarget, Set<string>>;
}

/**
 * Merge user-provided options with defaults.
 */
function resolveOptions(options?: HotkeyOptions): ResolvedHotkeyOptions {
  const scope = resolveScopeOrGlobal(options?.scope);

  return {
    enabled: options?.enabled ?? true,
    preventDefault: options?.preventDefault ?? true,
    stopPropagation: options?.stopPropagation ?? true,
    ignoreInputs: options?.ignoreInputs ?? "auto",
    scope,
    description: options?.description ?? "",
    ignoreRepeat: options?.ignoreRepeat ?? true,
    suppressInPopups: options?.suppressInPopups ?? false,
    conflictBehavior: options?.conflictBehavior ?? ConflictBehavior.Warn,
    target: options?.target ?? null,
  };
}

/**
 * Singleton keyboard shortcut manager for UI5 applications.
 *
 * Owns an internal EventDispatcher that attaches a single `window`-level
 * `keydown` listener and dispatches matching hotkeys to registered callbacks
 * based on scope, input state, and dialog state.
 *
 * Extends `sap.ui.base.Object` for proper UI5 lifecycle integration
 * (metadata, destroy pattern).
 *
 * @example
 * ```ts
 * import HotkeyManager from "ui5/hotkeys/HotkeyManager";
 *
 * // In Component.init():
 * const manager = HotkeyManager.getInstance();
 * manager.enableRouterIntegration(this.getRouter());
 *
 * manager.register("Mod+S", (event) => { ... }, {
 *   description: "Save",
 *   scope: "editor", // scope name = route name
 * });
 * ```
 */
export default class HotkeyManager extends BaseObject {
  static readonly metadata = {
    library: "ui5.hotkeys",
  };

  private _registrations: Map<string, HotkeyRegistration> = new Map();
  private _registrationState: Map<string, { active: boolean }> = new Map();
  private _registrationsByScope: Map<string, ScopeRegistrationBucket> = new Map();
  private _scopeStack: string[] = [GLOBAL_SCOPE];
  private _platform: Platform;
  private _groups: Set<RegistrationGroup> = new Set();

  // Router integration cleanup
  private _routerCleanup: (() => void) | null = null;

  // Optional callback for unhandled key events
  private _unhandledCallback: UnhandledCallback | null = null;

  // Debug mode
  private _debugMode = false;

  // Centralized event dispatcher — owns all DOM listeners
  private _dispatcher: EventDispatcher;

  // Lazily created SequenceManager (created on first registerSequence call)
  private _sequenceManager: SequenceManager | null = null;

  // Skip info from the most recent _processHotkeys call — read by _emitUnhandled.
  private _lastSkipInfo: SkipInfo | null = null;

  /**
   * Private constructor — use `HotkeyManager.getInstance()`.
   */
  constructor() {
    super();
    this._platform = runtimeHooks.detectPlatform();

    const handler: HotkeyDispatchHandler = {
      processHotkeys: (e) => this._processHotkeys(e),
      processSequences: (e) => this._processSequences(e),
      emitUnhandled: (e, r) => this._emitUnhandled(e, r),
    };
    this._dispatcher = new EventDispatcher(handler, this._platform);

    Log.info("HotkeyManager initialized", undefined, LOG_COMPONENT);
  }

  /**
   * Get or create the singleton HotkeyManager instance.
   */
  static getInstance(): HotkeyManager {
    if (!instance) {
      instance = new HotkeyManager();
    }
    return instance;
  }

  // ──────────────────────────────────────────────
  // Registration
  // ──────────────────────────────────────────────

  /**
   * Register a keyboard shortcut.
   *
   * @param hotkey - The hotkey string (e.g., "Mod+S", "Ctrl+Shift+K", "Escape").
   * @param callback - Function to invoke when the hotkey matches.
   * @param options - Optional configuration.
   * @returns A handle for managing the registration lifecycle.
   */
  register(hotkey: Hotkey, callback: HotkeyCallback, options?: HotkeyOptions): HotkeyRegistrationHandle {
    const resolved = resolveOptions(options);
    const parsedHotkey = parseHotkey(hotkey, this._platform);
    const normalizedHotkey = [...parsedHotkey.modifiers, parsedHotkey.key].join("+");
    const id = idGen.next();

    // Conflict detection within the same scope
    this._handleConflict(normalizedHotkey, resolved.scope, resolved.target, resolved.conflictBehavior);

    this._logValidationWarnings(normalizedHotkey);

    const registration: HotkeyRegistration = {
      id,
      hotkey,
      normalizedHotkey,
      parsedHotkey,
      callback,
      options: resolved,
    };

    this._registrations.set(id, registration);
    const state = { active: true };
    this._registrationState.set(id, state);
    this._indexRegistration(registration);

    Log.debug(
      `Registered hotkey "${normalizedHotkey}" (id: ${id}, scope: ${resolved.scope})`,
      undefined,
      LOG_COMPONENT,
    );

    const handle: HotkeyRegistrationHandle = {
      get id() {
        return id;
      },
      get isActive() {
        return state.active;
      },
      get hotkey() {
        return registration.hotkey;
      },
      get scope() {
        return registration.options.scope;
      },
      get description() {
        return registration.options.description;
      },
      unregister: () => {
        if (!state.active) return;
        state.active = false;

        this._deindexRegistration(registration);

        this._registrations.delete(id);
        this._registrationState.delete(id);
        Log.debug(`Unregistered hotkey "${normalizedHotkey}" (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if (!state.active) {
          throw new Error(`Cannot setOptions on unregistered handle (id: ${id})`);
        }
        const optionRecord = newOptions as Record<string, unknown>;
        if (optionRecord.scope !== undefined) {
          throw new Error("Cannot change scope via setOptions — unregister and re-register instead");
        }
        if (optionRecord.conflictBehavior !== undefined) {
          throw new Error("Cannot change conflictBehavior via setOptions — unregister and re-register instead");
        }
        const opts = registration.options;
        // Special case: target swap requires re-indexing + conflict management
        if (newOptions.target !== undefined) {
          const currentTarget = opts.target;
          const nextTarget = newOptions.target ?? null;
          if (currentTarget !== nextTarget) {
            this._handleConflict(registration.normalizedHotkey, opts.scope, nextTarget, opts.conflictBehavior);
            this._deindexRegistration(registration);
            opts.target = nextTarget;
            this._indexRegistration(registration);
          }
        }
        // Type-safe field merge — no casts, compiler catches typos
        if (newOptions.enabled !== undefined) opts.enabled = newOptions.enabled;
        if (newOptions.preventDefault !== undefined) opts.preventDefault = newOptions.preventDefault;
        if (newOptions.stopPropagation !== undefined) opts.stopPropagation = newOptions.stopPropagation;
        if (newOptions.ignoreInputs !== undefined) opts.ignoreInputs = newOptions.ignoreInputs;
        if (newOptions.ignoreRepeat !== undefined) opts.ignoreRepeat = newOptions.ignoreRepeat;
        if (newOptions.suppressInPopups !== undefined) opts.suppressInPopups = newOptions.suppressInPopups;
        if (newOptions.description !== undefined) opts.description = newOptions.description;
      },
    };

    return handle;
  }

  /**
   * Create a registration group for collective lifecycle management.
   *
   * All registrations made through the group can be cleaned up with a single
   * `destroyAll()` call — ideal for controller `onExit()` cleanup.
   */
  createGroup(): RegistrationGroup {
    const group = new RegistrationGroup(this, () => {
      this._groups.delete(group);
    });
    this._groups.add(group);
    return group;
  }

  // ──────────────────────────────────────────────
  // Suspend guard API
  // ──────────────────────────────────────────────

  /**
   * Suspend hotkey/sequence dispatch. Returns an RAII guard handle.
   *
   * While any guard is active, all hotkey and sequence callbacks are blocked.
   * Key state tracking continues normally. Browser defaults are NOT suppressed.
   *
   * @param reason - Optional debug metadata.
   */
  suspendDispatch(reason?: string): KeyboardDispatchGuard {
    return this._dispatcher.suspendDispatch(reason);
  }

  /**
   * Whether dispatch is currently suspended (any guard active).
   */
  isDispatchSuspended(): boolean {
    return this._dispatcher.isDispatchSuspended();
  }

  // ──────────────────────────────────────────────
  // Recorder factory
  // ──────────────────────────────────────────────

  /**
   * Create a HotkeyRecorder. Keeps EventDispatcher internal.
   *
   * @param options - Recorder callbacks (onRecord, onCancel).
   */
  createRecorder(options: HotkeyRecorderOptions): HotkeyRecorder {
    const recorder = new HotkeyRecorder(options, this._dispatcher, INTERNAL_TOKEN);
    this._dispatcher.trackRecorder(recorder);
    return recorder;
  }

  // ──────────────────────────────────────────────
  // KeyStateTracker access
  // ──────────────────────────────────────────────

  /**
   * Access held-key state. Replaces `KeyStateTracker.getInstance()`.
   */
  getKeyStateTracker(): KeyStateTracker {
    return this._dispatcher.keyStateTracker;
  }

  // ──────────────────────────────────────────────
  // Scope management
  // ──────────────────────────────────────────────

  /**
   * Push a new scope onto the stack. Hotkeys registered in this scope
   * become active, while non-global hotkeys in other scopes are paused.
   */
  pushScope(scopeId: string): void {
    const normalized = resolveRequiredScope(scopeId);
    this._scopeStack.push(normalized);
    Log.debug(`Pushed scope "${normalized}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
  }

  /**
   * Pop the top scope from the stack.
   *
   * @param scopeId - The scope to pop. Must match the top of the stack
   *   (prevents mismatched push/pop pairs).
   * @throws Error if the stack would be emptied (global scope cannot be popped)
   *   or if the scopeId does not match the top.
   */
  popScope(scopeId: string): void {
    const normalized = resolveRequiredScope(scopeId);
    if (this._scopeStack.length <= 1) {
      throw new Error("Cannot pop the global scope");
    }

    const top = this._scopeStack[this._scopeStack.length - 1];
    if (top !== normalized) {
      throw new Error(`Cannot pop scope "${normalized}": current top of stack is "${top}"`);
    }

    this._scopeStack.pop();
    Log.debug(`Popped scope "${top}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
  }

  /**
   * Get the currently active scope (top of stack).
   */
  getActiveScope(): string {
    return this._scopeStack.at(-1) ?? GLOBAL_SCOPE;
  }

  /**
   * Pop all non-global scopes, returning the stack to its initial state.
   *
   * Useful for centralized cleanup on route changes, FLP cross-navigation,
   * or any scenario where stale scopes need to be cleared.
   */
  resetToGlobalScope(): void {
    if (this._scopeStack.length > 1) {
      const depth = this._scopeStack.length - 1;
      this._scopeStack = [GLOBAL_SCOPE];
      Log.debug(`Reset to global scope (popped ${depth} scope(s))`, undefined, LOG_COMPONENT);
    }
  }

  // ──────────────────────────────────────────────
  // Router integration
  // ──────────────────────────────────────────────

  /**
   * Enable automatic scope management via a UI5 Router.
   *
   * Attaches to the router's `beforeRouteMatched` event. On each route change:
   * 1. All non-global scopes are popped (handles browser back/forward, FLP cross-nav)
   * 2. The matched route's name is pushed as the new active scope
   *
   * This means controllers don't need to manage view-level scopes at all —
   * just register hotkeys with `scope` matching the route name.
   *
   * **Dialog scopes** still require manual `pushScope`/`popScope` since
   * they are not route-based.
   *
   * Call before `router.initialize()`.
   *
   * @param router - A `sap.ui.core.routing.Router` or `sap.m.routing.Router` instance.
   * @throws Error if router integration is already enabled.
   *
   * @example
   * ```ts
   * // Component.init()
   * const manager = HotkeyManager.getInstance();
   * manager.enableRouterIntegration(this.getRouter());
   * this.getRouter().initialize();
   *
   * // Controller — just register, no scope management needed:
   * manager.register("F5", handler, { scope: "main" }); // "main" = route name
   * ```
   */
  enableRouterIntegration(router: Router): void {
    if (this._routerCleanup) {
      throw new Error("Router integration is already enabled");
    }

    const handler = (event: RouteMatchedEvent) => {
      this.resetToGlobalScope();
      const routeName = event.getParameter("name");
      if (routeName) {
        this.pushScope(routeName);
      }
    };

    router.attachBeforeRouteMatched(handler, this);
    this._routerCleanup = () => {
      router.detachBeforeRouteMatched(handler, this);
    };

    Log.info("Router integration enabled", undefined, LOG_COMPONENT);
  }

  /**
   * Disable router integration without destroying the manager.
   *
   * Detaches the `beforeRouteMatched` handler. The scope stack is left
   * in its current state — call `resetToGlobalScope()` if needed.
   *
   * @throws Error if router integration is not enabled.
   */
  disableRouterIntegration(): void {
    if (!this._routerCleanup) {
      throw new Error("Router integration is not enabled");
    }

    this._routerCleanup();
    this._routerCleanup = null;

    Log.info("Router integration disabled", undefined, LOG_COMPONENT);
  }

  /**
   * Whether router integration is currently active.
   */
  hasRouterIntegration(): boolean {
    return this._routerCleanup !== null;
  }

  // ──────────────────────────────────────────────
  // Introspection
  // ──────────────────────────────────────────────

  /**
   * Get all active registrations. Returns a new array (safe to iterate).
   * Info objects are flat snapshots — no closures or DOM references leak.
   */
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    return Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
  }

  /**
   * Get registrations filtered by scope.
   */
  getRegistrationsForScope(scopeId: string): ReadonlyArray<HotkeyRegistrationInfo> {
    const normalizedScope = resolveScopeOrGlobal(scopeId);
    return Array.from(this._registrations.values())
      .filter((r) => r.options.scope === normalizedScope)
      .map((r) => this._toRegistrationInfo(r));
  }

  /**
   * Get the detected platform.
   */
  getPlatform(): Platform {
    return this._platform;
  }

  /**
   * Convert an internal registration to the public flat info shape.
   */
  private _toRegistrationInfo(reg: HotkeyRegistration): HotkeyRegistrationInfo {
    const opts = reg.options;
    let enabled: boolean;
    try {
      enabled = typeof opts.enabled === "function" ? opts.enabled() : opts.enabled;
    } catch (error) {
      Log.warning(`Error evaluating enabled() for "${reg.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
      enabled = false;
    }
    return {
      id: reg.id,
      hotkey: reg.hotkey,
      normalizedHotkey: reg.normalizedHotkey,
      scope: opts.scope,
      description: opts.description,
      enabled,
      preventDefault: opts.preventDefault,
      stopPropagation: opts.stopPropagation,
      ignoreInputs: opts.ignoreInputs,
      ignoreRepeat: opts.ignoreRepeat,
      suppressInPopups: opts.suppressInPopups,
      conflictBehavior: opts.conflictBehavior,
      hasTarget: opts.target !== null,
    };
  }

  // ──────────────────────────────────────────────
  // Sequence facade
  // ──────────────────────────────────────────────

  /**
   * Register a multi-key sequence (e.g., `["G", "I"]` for go-to-inbox).
   *
   * Lazily creates the internal SequenceManager on first call. The
   * sequence manager uses this HotkeyManager's scope stack for scope
   * filtering, so scoped sequences and scoped hotkeys share the same
   * scope lifecycle.
   *
   * @param sequence - Array of hotkey strings forming the sequence.
   * @param callback - Function to invoke when the full sequence is matched.
   * @param options - Optional configuration (scope, timeout, ignoreInputs, etc.).
   * @returns A handle for managing the registration lifecycle.
   */
  registerSequence(
    sequence: string[],
    callback: HotkeyCallback,
    options?: SequenceOptions,
  ): SequenceRegistrationHandle {
    return this._getSequenceManager().registerSequence(sequence, callback, options);
  }

  /**
   * Set a callback for mid-sequence progress updates.
   *
   * The callback fires after each intermediate key in a sequence,
   * providing information about how many steps are completed and
   * what key is expected next — useful for "waiting for next key…" UI.
   *
   * Pass `null` to remove the callback.
   */
  setSequencePendingHandler(callback: SequencePendingCallback | null): void {
    this._getSequenceManager().setPendingCallback(callback);
  }

  /**
   * Get all active sequence registrations.
   */
  getSequenceRegistrations(): ReadonlyArray<SequenceRegistrationInfo> {
    if (!this._sequenceManager) return [];
    return this._sequenceManager.getRegistrations();
  }

  /**
   * Get sequence registrations filtered by scope.
   */
  getSequenceRegistrationsForScope(scopeId: string): ReadonlyArray<SequenceRegistrationInfo> {
    if (!this._sequenceManager) return [];
    const normalizedScope = resolveScopeOrGlobal(scopeId);
    return this._sequenceManager.getRegistrations().filter((r) => r.scope === normalizedScope);
  }

  /**
   * Get or create the internal SequenceManager.
   */
  private _getSequenceManager(): SequenceManager {
    if (!this._sequenceManager) {
      this._sequenceManager = new SequenceManager(() => this.getActiveScope(), this._platform);
    }
    return this._sequenceManager;
  }

  // ──────────────────────────────────────────────
  // Unhandled key callback
  // ──────────────────────────────────────────────

  /**
   * Set a callback to be invoked when a key event is not handled.
   *
   * The callback fires for events that *could have been* a hotkey but weren't:
   * no matching registration, matched but disabled, suppressed in inputs, etc.
   * It does NOT fire for IME composition events or pure modifier presses.
   *
   * Pass `null` to remove the callback.
   *
   * @example
   * ```ts
   * manager.setUnhandledHandler((ctx) => {
   *   if (ctx.reason === "no_match") {
   *     MessageToast.show("No action for this key");
   *   }
   * });
   * ```
   */
  setUnhandledHandler(callback: UnhandledCallback | null): void {
    this._unhandledCallback = callback;
  }

  // ──────────────────────────────────────────────
  // Debug mode
  // ──────────────────────────────────────────────

  /**
   * Enable or disable debug mode.
   *
   * When enabled, every key event is logged with detailed information:
   * - Key pressed + modifiers, active scope, input/dialog state
   * - Matched registration (if any) with scope, id, description
   * - All skipped registrations with reasons
   * - External conflicts from browser/SAP blocklists
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
    Log.info(`Debug mode ${enabled ? "enabled" : "disabled"}`, undefined, LOG_COMPONENT);
  }

  /**
   * Whether debug mode is currently enabled.
   */
  isDebugMode(): boolean {
    return this._debugMode;
  }

  // ──────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────

  /**
   * Destroy the manager: remove all listeners, clear registrations,
   * and null the singleton reference.
   *
   * Follows UI5 `BaseObject.destroy()` pattern.
   */
  destroy(): void {
    if (this._routerCleanup) {
      this._routerCleanup();
      this._routerCleanup = null;
    }

    // Destroy the dispatcher first — removes all DOM listeners, invalidates
    // guards, notifies interceptor/recorders, destroys KeyStateTracker.
    this._dispatcher.destroy();

    for (const group of Array.from(this._groups)) {
      group._onManagerDestroy();
    }
    this._groups.clear();

    if (this._sequenceManager) {
      this._sequenceManager.destroy();
      this._sequenceManager = null;
    }

    for (const state of this._registrationState.values()) {
      state.active = false;
    }

    this._registrations.clear();
    this._registrationState.clear();
    this._registrationsByScope.clear();
    this._scopeStack = [GLOBAL_SCOPE];
    resetRuntimeCaches();
    this._unhandledCallback = null;
    this._debugMode = false;
    this._lastSkipInfo = null;
    instance = null;

    Log.info("HotkeyManager destroyed", undefined, LOG_COMPONENT);

    super.destroy();
  }

  // ──────────────────────────────────────────────
  // Private: HotkeyDispatchHandler implementation
  // ──────────────────────────────────────────────

  /**
   * Process hotkeys for a pre-filtered, non-suspended keydown event.
   *
   * Two-pass matching:
   *   Pass 1: document-level registrations (active scope → global)
   *   Pass 2: target-scoped registrations via composedPath() (active scope → global)
   *
   * Returns true if any registration consumed the event.
   */
  private _processHotkeys(event: KeyboardEvent): boolean {
    // Defensive reset — prevents stale data from a previous event leaking
    // into _emitUnhandled if a future code path reads it unexpectedly.
    this._lastSkipInfo = null;

    const eventPath = this._getEventPath(event);
    const activeScope = this.getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);

    // Check popup state (lazy-loaded)
    const popupOpen = this._checkPopupOpen();

    const skipInfo: SkipInfo | null = this._unhandledCallback ? { reason: UnhandledReason.NoMatch } : null;
    const debugSkips: DebugSkipEntry[] | null = this._debugMode ? [] : null;

    // Pass 1: document-level registrations (no target)
    const docMatch = this._matchDocumentRegistrations(event, activeScope, isInput, popupOpen, skipInfo, debugSkips);

    if (docMatch) {
      this._executeMatch(event, docMatch);
      if (this._debugMode) {
        this._logDebugEvent(event, activeScope, isInput, popupOpen, docMatch, debugSkips);
      }
      // If matched with stopPropagation, skip target-scoped registrations entirely.
      if (docMatch.options.stopPropagation) return true;
      // Document match WITHOUT stopPropagation allows target-scoped matching to proceed.
    }

    // Pass 2: target-scoped registrations — innermost target in composedPath wins.
    const targetMatch = this._matchTargetRegistrations(
      event,
      eventPath,
      activeScope,
      isInput,
      popupOpen,
      skipInfo,
      debugSkips,
    );

    if (targetMatch) {
      if (this._debugMode) {
        this._logDebugEvent(event, activeScope, isInput, popupOpen, targetMatch, debugSkips);
      }
      return true;
    }

    // Document match without stopPropagation still counts as consumed — callback already fired.
    if (docMatch) {
      return true;
    }

    // Nothing matched at all
    if (this._debugMode) {
      this._logDebugEvent(event, activeScope, isInput, popupOpen, null, debugSkips);
    }

    // Store skipInfo for _emitUnhandled (called by EventDispatcher in step 7)
    this._lastSkipInfo = skipInfo;

    return false;
  }

  /**
   * Process sequences for a pre-filtered, non-suspended keydown event.
   * Delegates to the lazy SequenceManager.
   */
  private _processSequences(event: KeyboardEvent): boolean {
    return this._sequenceManager?.processKeyEvent(event) ?? false;
  }

  /**
   * Emit an unhandled callback.
   *
   * When `forcedReason` is non-null (e.g., Suspended), it is used directly
   * with no `skippedRegistration`. When null, uses `_lastSkipInfo` from
   * the most recent `_processHotkeys` call.
   */
  private _emitUnhandled(event: KeyboardEvent, forcedReason: UnhandledReason | null): void {
    if (!this._unhandledCallback) return;

    const activeScope = this.getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);
    const popupOpen = this._checkPopupOpen();

    let reason: UnhandledReason;
    let skippedRegistration: HotkeyRegistrationInfo | undefined;

    if (forcedReason !== null) {
      reason = forcedReason;
      // No specific registration was evaluated for forced reasons
    } else if (this._lastSkipInfo) {
      reason = this._lastSkipInfo.reason;
      skippedRegistration =
        this._lastSkipInfo.reason !== UnhandledReason.NoMatch ? this._lastSkipInfo.registration : undefined;
    } else {
      reason = UnhandledReason.NoMatch;
    }

    const context: UnhandledContext = {
      event,
      reason,
      activeScope,
      isInput,
      isPopupOpen: popupOpen,
      skippedRegistration,
    };

    this._unhandledCallback(context);
  }

  // ──────────────────────────────────────────────
  // Private: Match helpers
  // ──────────────────────────────────────────────

  /**
   * Get the event's composed path with a defensive fallback.
   */
  private _getEventPath(event: KeyboardEvent): EventTarget[] {
    const path = event.composedPath?.();
    if (Array.isArray(path) && path.length > 0) {
      return path;
    }
    // Fallback for environments where composedPath() is unavailable or empty
    return [event.target, document, window].filter(Boolean) as EventTarget[];
  }

  /**
   * Execute a matched registration: preventDefault, stopPropagation, callback.
   */
  private _executeMatch(event: KeyboardEvent, matched: HotkeyRegistration): void {
    const opts = matched.options;
    if (opts.preventDefault) event.preventDefault();
    if (opts.stopPropagation) event.stopPropagation();
    try {
      matched.callback(event, {
        hotkey: matched.hotkey,
        parsedHotkey: matched.parsedHotkey,
        scope: opts.scope,
      });
    } catch (error) {
      Log.error(`Error in hotkey callback for "${matched.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
    }
  }

  /**
   * Match document-level registrations (two-pass: active scope → global).
   */
  private _matchDocumentRegistrations(
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
    skipInfo: SkipInfo | null,
    debugSkips: DebugSkipEntry[] | null,
  ): HotkeyRegistration | null {
    const matchOpts = {
      event,
      isInput,
      popupOpen,
      toRegistrationInfo: (reg: HotkeyRegistration) => this._toRegistrationInfo(reg),
      logComponent: LOG_COMPONENT,
    };

    // Active scope first
    const activeScopeMatch = findMatchInScope({
      ...matchOpts,
      registrations: this._getScopeRegistrations(activeScope, null),
      skipInfo,
      debugSkips,
    });
    if (activeScopeMatch) return activeScopeMatch;

    // Global scope fallback
    if (activeScope !== GLOBAL_SCOPE) {
      return findMatchInScope({
        ...matchOpts,
        registrations: this._getScopeRegistrations(GLOBAL_SCOPE, null),
        skipInfo,
        debugSkips,
      });
    }

    return null;
  }

  /**
   * Match target-scoped registrations via composedPath(), innermost-first.
   *
   * Scope-first ordering: active scope targets checked before global scope targets.
   * Within a scope, the first (innermost) matching target wins.
   *
   * Returns the matched registration (already executed via _executeMatch) or null.
   */
  private _matchTargetRegistrations(
    event: KeyboardEvent,
    eventPath: EventTarget[],
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
    skipInfo: SkipInfo | null,
    debugSkips: DebugSkipEntry[] | null,
  ): HotkeyRegistration | null {
    const pathSet = new Set(eventPath);
    const scopesToCheck = activeScope !== GLOBAL_SCOPE ? [activeScope, GLOBAL_SCOPE] : [GLOBAL_SCOPE];

    for (const scope of scopesToCheck) {
      const bucket = this._registrationsByScope.get(scope);
      if (!bucket || bucket.targets.size === 0) continue;

      // Iterate composedPath from index 0 (innermost) outward
      for (const node of eventPath) {
        const ids = bucket.targets.get(node);
        if (!ids || ids.size === 0) continue;

        // Attempt matching against registrations bound to this target
        const registrations = this._getRegistrationsFromIds(ids);
        const matched = findMatchInScope({
          event,
          isInput,
          popupOpen,
          registrations,
          skipInfo,
          debugSkips,
          toRegistrationInfo: (reg) => this._toRegistrationInfo(reg),
          logComponent: LOG_COMPONENT,
        });

        if (matched) {
          this._executeMatch(event, matched);
          return matched;
        }
      }
    }

    // Skip-reason pass for off-path targets: record TargetMismatch for
    // registrations whose key combo matches but target is not in the path.
    if (skipInfo) {
      for (const scope of scopesToCheck) {
        const bucket = this._registrationsByScope.get(scope);
        if (!bucket) continue;

        for (const [targetNode, ids] of bucket.targets) {
          if (pathSet.has(targetNode)) continue; // Already checked in main pass

          for (const id of ids) {
            const reg = this._registrations.get(id);
            if (reg && matchesKeyboardEvent(event, reg.parsedHotkey)) {
              recordSkip(skipInfo, UnhandledReason.TargetMismatch, reg, (r) => this._toRegistrationInfo(r));
              if (debugSkips) debugSkips.push({ registration: reg, reason: UnhandledReason.TargetMismatch });
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Look up registrations by their IDs.
   */
  private _getRegistrationsFromIds(ids: Set<string>): ReadonlyArray<HotkeyRegistration> {
    const registrations: HotkeyRegistration[] = [];
    for (const id of ids) {
      const reg = this._registrations.get(id);
      if (reg) registrations.push(reg);
    }
    return registrations;
  }

  // ──────────────────────────────────────────────
  // Private: Debug logging
  // ──────────────────────────────────────────────

  private _logDebugEvent(
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
    matched: HotkeyRegistration | null,
    debugSkips: DebugSkipEntry[] | null,
  ): void {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.metaKey) modifiers.push("Meta");
    const keyCombo = [...modifiers, event.key].join("+");

    const lines: string[] = [
      `[HotkeyDebug] Key: ${keyCombo}`,
      `  Scope: ${activeScope} | Input: ${isInput} | Popup: ${popupOpen} | Repeat: ${event.repeat}`,
    ];

    if (matched) {
      lines.push(
        `  MATCHED: "${matched.normalizedHotkey}" (id: ${matched.id}, scope: ${matched.options.scope}` +
          `${matched.options.description ? `, desc: "${matched.options.description}"` : ""})`,
      );
    } else {
      lines.push("  NO MATCH");
    }

    if (debugSkips && debugSkips.length > 0) {
      lines.push("  Skipped:");
      for (const skip of debugSkips) {
        lines.push(`    - "${skip.registration.normalizedHotkey}" (id: ${skip.registration.id}): ${skip.reason}`);
      }
    }

    const validate = this._getValidateModule();
    if (validate) {
      const normalized = keyboardEventToHotkey(event);
      if (normalized) {
        const browserConflict = validate.BROWSER_SHORTCUTS.get(normalized);
        const sapConflict = validate.SAP_SHORTCUTS.get(normalized);
        if (browserConflict) lines.push(`  Browser conflict: ${browserConflict}`);
        if (sapConflict) lines.push(`  SAP conflict: ${sapConflict}`);
      }
    }

    Log.debug(lines.join("\n"), undefined, LOG_COMPONENT);
  }

  /** Lazy import to avoid circular deps at module level. */
  private _getValidateModule(): ValidateModule | undefined {
    return sap.ui.require("ui5/hotkeys/validate") as ValidateModule | undefined;
  }

  // ──────────────────────────────────────────────
  // Private: Validation warnings
  // ──────────────────────────────────────────────

  private _logValidationWarnings(normalizedHotkey: string): void {
    const validate = this._getValidateModule();
    if (!validate) return;

    const browserConflict = validate.BROWSER_SHORTCUTS.get(normalizedHotkey);
    if (browserConflict) {
      Log.warning(
        `Hotkey "${normalizedHotkey}" conflicts with browser shortcut: ${browserConflict}`,
        undefined,
        LOG_COMPONENT,
      );
    }

    const sapConflict = validate.SAP_SHORTCUTS.get(normalizedHotkey);
    if (sapConflict) {
      Log.warning(`Hotkey "${normalizedHotkey}" conflicts with SAP shortcut: ${sapConflict}`, undefined, LOG_COMPONENT);
    }

    const parts = normalizedHotkey.split("+");
    const key = parts[parts.length - 1];
    if (!validate.KNOWN_KEYS.has(key)) {
      Log.warning(
        `Hotkey "${normalizedHotkey}" uses unknown key "${key}" — may not match keyboard events correctly`,
        undefined,
        LOG_COMPONENT,
      );
    }
  }

  // ──────────────────────────────────────────────
  // Private: Popup check (dialogs + popovers)
  // ──────────────────────────────────────────────

  /**
   * Lazy-load `sap.m.InstanceManager` to avoid a hard dependency on `sap.m`.
   * Returns whether any UI5 popup (dialog or popover) is currently open.
   */
  private _checkPopupOpen(): boolean {
    return runtimeHooks.hasOpenPopup();
  }

  // ──────────────────────────────────────────────
  // Private: Conflict handling
  // ──────────────────────────────────────────────

  private _isConflictingRegistration(
    reg: HotkeyRegistration,
    normalizedHotkey: string,
    scope: string,
    target: EventTarget | null,
  ): boolean {
    return reg.normalizedHotkey === normalizedHotkey && reg.options.scope === scope && reg.options.target === target;
  }

  private _handleConflict(
    normalizedHotkey: string,
    scope: string,
    target: EventTarget | null,
    conflictBehavior: ConflictBehavior,
  ): void {
    if (conflictBehavior === ConflictBehavior.Allow) return;

    if (conflictBehavior === ConflictBehavior.Replace) {
      // Collect ALL matches so we remove every conflicting registration
      const conflicts: HotkeyRegistration[] = [];
      for (const reg of this._registrations.values()) {
        if (this._isConflictingRegistration(reg, normalizedHotkey, scope, target)) {
          conflicts.push(reg);
        }
      }
      for (const reg of conflicts) {
        this._deindexRegistration(reg);
        const state = this._registrationState.get(reg.id);
        if (state) {
          state.active = false;
          this._registrationState.delete(reg.id);
        }
        this._registrations.delete(reg.id);
        Log.debug(
          `Replaced existing hotkey "${normalizedHotkey}" (id: ${reg.id}) in scope "${scope}"`,
          undefined,
          LOG_COMPONENT,
        );
      }
      return;
    }

    // For "warn" and "error", first match is sufficient
    let conflicting: HotkeyRegistration | null = null;
    for (const reg of this._registrations.values()) {
      if (this._isConflictingRegistration(reg, normalizedHotkey, scope, target)) {
        conflicting = reg;
        break;
      }
    }

    if (!conflicting) return;

    if (conflictBehavior === ConflictBehavior.Error) {
      throw new Error(
        `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}).`,
      );
    }

    // "warn"
    Log.warning(
      `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}). ` +
        `Existing registration keeps priority unless conflictBehavior is "replace".`,
      undefined,
      LOG_COMPONENT,
    );
  }

  private _getScopeBucket(scope: string): ScopeRegistrationBucket {
    let bucket = this._registrationsByScope.get(scope);
    if (!bucket) {
      bucket = {
        documentIds: new Set<string>(),
        targets: new Map<EventTarget, Set<string>>(),
      };
      this._registrationsByScope.set(scope, bucket);
    }
    return bucket;
  }

  private _indexRegistration(registration: HotkeyRegistration): void {
    const bucket = this._getScopeBucket(registration.options.scope);
    const target = registration.options.target;
    if (target) {
      let ids = bucket.targets.get(target);
      if (!ids) {
        ids = new Set<string>();
        bucket.targets.set(target, ids);
      }
      ids.add(registration.id);
      return;
    }

    bucket.documentIds.add(registration.id);
  }

  private _deindexRegistration(registration: HotkeyRegistration): void {
    const scope = registration.options.scope;
    const bucket = this._registrationsByScope.get(scope);
    if (!bucket) return;

    const target = registration.options.target;
    if (target) {
      const ids = bucket.targets.get(target);
      if (ids) {
        ids.delete(registration.id);
        if (ids.size === 0) {
          bucket.targets.delete(target);
        }
      }
    } else {
      bucket.documentIds.delete(registration.id);
    }

    if (bucket.documentIds.size === 0 && bucket.targets.size === 0) {
      this._registrationsByScope.delete(scope);
    }
  }

  private _getScopeRegistrations(scope: string, targetElement: EventTarget | null): ReadonlyArray<HotkeyRegistration> {
    const bucket = this._registrationsByScope.get(scope);
    if (!bucket) return [];

    const ids = targetElement === null ? bucket.documentIds : bucket.targets.get(targetElement);
    if (!ids || ids.size === 0) return [];

    const registrations: HotkeyRegistration[] = [];
    for (const id of ids) {
      const registration = this._registrations.get(id);
      if (registration) {
        registrations.push(registration);
      }
    }
    return registrations;
  }
}
