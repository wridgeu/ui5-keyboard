import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
import type Router from "sap/ui/core/routing/Router";
import { ConflictBehavior, UnhandledReason } from "./library";
import RegistrationGroup from "./RegistrationGroup";
import SequenceManager from "./SequenceManager";
import { GLOBAL_SCOPE } from "./internal/constants";
import { getEventTarget, isInputElement, shouldIgnoreKeyEvent } from "./internal/dom";
import { createIdGenerator } from "./internal/idgen";
import { keyboardEventToHotkey, parseHotkey } from "./internal/parse";
import { resetRuntimeCaches, runtimeHooks } from "./internal/runtime";
import ListenerRegistry from "./internal/listener-registry";
import { resolveMatchedRegistration } from "./internal/dispatch-core";
import type { DebugSkipEntry, SkipInfo } from "./internal/skip-reason";
import type {
  Hotkey,
  HotkeyCallback,
  HotkeyCallbackDetails,
  HotkeyOptions,
  HotkeyRegistration,
  HotkeyRegistrationHandle,
  HotkeyRegistrationInfo,
  Platform,
  ResolvedHotkeyOptions,
  SequenceOptions,
  SequencePendingCallback,
  SequenceRegistrationHandle,
  SequenceRegistrationInfo,
  UnhandledCallback,
  UpdatableHotkeyOptions,
} from "./types";

type ValidateModule = typeof import("./validate");

type RouteMatchedEvent = Parameters<Parameters<Router["attachBeforeRouteMatched"]>[0]>[0];

const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

let instance: HotkeyManager | null = null;
const idGen = createIdGenerator("hk_");

interface ScopeRegistrationBucket {
  document: Set<string>;
  targets: Map<EventTarget, Set<string>>;
}

/**
 * Merge user-provided options with defaults.
 */
function resolveOptions(options?: HotkeyOptions): ResolvedHotkeyOptions {
  return {
    enabled: options?.enabled ?? true,
    preventDefault: options?.preventDefault ?? true,
    stopPropagation: options?.stopPropagation ?? true,
    ignoreInputs: options?.ignoreInputs ?? "auto",
    scope: options?.scope ?? GLOBAL_SCOPE,
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
 * Attaches a single document-level `keydown` listener and dispatches matching
 * hotkeys to registered callbacks based on scope, input state, and dialog state.
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

  // Bound handler reference for reliable addEventListener/removeEventListener pairing
  private readonly _keydownHandler = this._onKeyDown.bind(this);

  // Router integration cleanup
  private _routerCleanup: (() => void) | null = null;

  // Optional callback for unhandled key events
  private _unhandledCallback: UnhandledCallback | null = null;

  // Debug mode
  private _debugMode = false;

  // AltGr detection — tracks location of last Alt keydown
  private _lastAltLocation = 0;

  // Target element listeners — ref-counted per EventTarget
  // Kept on manager for debugging/tests and delegated via ListenerRegistry.
  private _targetListeners: Map<EventTarget, { handler: EventListener; count: number }> = new Map();

  // Document + target listener bookkeeping
  private readonly _listenerRegistry: ListenerRegistry;

  // Lazily created SequenceManager (created on first registerSequence call)
  private _sequenceManager: SequenceManager | null = null;

  /**
   * Private constructor — use `HotkeyManager.getInstance()`.
   */
  constructor() {
    super();
    this._platform = runtimeHooks.detectPlatform();
    this._listenerRegistry = new ListenerRegistry(
      (event) => this._shouldIgnoreKeyEvent(event),
      (event, target) => this._processKeyEvent(event, target),
      this._targetListeners,
    );
    this._attachListeners();

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

    // Attach target listener if needed
    if (resolved.target) {
      this._attachTargetListener(resolved.target);
    }

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

        // Detach target listener if needed
        if (registration.options.target) {
          this._detachTargetListener(registration.options.target);
        }

        this._deindexRegistration(registration);

        this._registrations.delete(id);
        this._registrationState.delete(id);
        Log.debug(`Unregistered hotkey "${normalizedHotkey}" (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if (!state.active) {
          throw new Error(`Cannot setOptions on unregistered handle (id: ${id})`);
        }
        if ((newOptions as Record<string, unknown>).scope !== undefined) {
          throw new Error("Cannot change scope via setOptions — unregister and re-register instead");
        }
        const opts = registration.options;
        // Special case: target swap requires listener management
        if (newOptions.target !== undefined) {
          const currentTarget = opts.target;
          const nextTarget = newOptions.target ?? null;
          if (currentTarget !== nextTarget) {
            this._deindexRegistration(registration);
            if (currentTarget) this._detachTargetListener(currentTarget);
            opts.target = nextTarget;
            if (nextTarget) this._attachTargetListener(nextTarget);
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
        if (newOptions.conflictBehavior !== undefined) opts.conflictBehavior = newOptions.conflictBehavior;
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
  // Scope management
  // ──────────────────────────────────────────────

  /**
   * Push a new scope onto the stack. Hotkeys registered in this scope
   * become active, while non-global hotkeys in other scopes are paused.
   */
  pushScope(scopeId: string): void {
    this._scopeStack.push(scopeId);
    Log.debug(`Pushed scope "${scopeId}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
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
    if (this._scopeStack.length <= 1) {
      throw new Error("Cannot pop the global scope");
    }

    const top = this._scopeStack[this._scopeStack.length - 1];
    if (top !== scopeId) {
      throw new Error(`Cannot pop scope "${scopeId}": current top of stack is "${top}"`);
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
    return Array.from(this._registrations.values())
      .filter((r) => r.options.scope === scopeId)
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
    return this._sequenceManager.getRegistrations().filter((r) => r.scope === scopeId);
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

    for (const group of Array.from(this._groups)) {
      group._onManagerDestroy();
    }
    this._groups.clear();

    if (this._sequenceManager) {
      this._sequenceManager.destroy();
      this._sequenceManager = null;
    }

    this._detachListeners();

    this._listenerRegistry.detachAllTargets();

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
    this._lastAltLocation = 0;
    instance = null;

    Log.info("HotkeyManager destroyed", undefined, LOG_COMPONENT);

    super.destroy();
  }

  // ──────────────────────────────────────────────
  // Private: Event handling
  // ──────────────────────────────────────────────

  private _attachListeners(): void {
    this._listenerRegistry.attachDocument(this._keydownHandler);
  }

  private _detachListeners(): void {
    this._listenerRegistry.detachDocument(this._keydownHandler);
  }

  private _onKeyDown(event: KeyboardEvent): void {
    if (this._shouldIgnoreKeyEvent(event)) return;

    // Single-key hotkey matching
    this._processKeyEvent(event, null, !this._hasTargetListenerInPath(event));

    // Multi-key sequence matching (if any sequences registered)
    this._sequenceManager?.processKeyEvent(event);
  }

  private _hasTargetListenerInPath(event: KeyboardEvent): boolean {
    const path = event.composedPath?.();
    if (Array.isArray(path)) {
      for (const node of path) {
        if (this._targetListeners.has(node as EventTarget)) {
          return true;
        }
      }
    }

    const target = getEventTarget(event);
    return target ? this._targetListeners.has(target) : false;
  }

  /**
   * Shared guard for all keydown listeners (document + target elements).
   * Tracks AltGr state and delegates to the shared pure function.
   */
  private _shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
    if (event.key === "Alt") {
      this._lastAltLocation = event.location;
    }
    return shouldIgnoreKeyEvent(event, this._platform, this._lastAltLocation);
  }

  /**
   * Process a key event from either the document listener or a target element listener.
   * When `targetElement` is null, processes document-level registrations (those without a target).
   * When `targetElement` is set, only processes registrations bound to that target.
   */
  private _processKeyEvent(event: KeyboardEvent, targetElement: EventTarget | null, emitUnhandled = true): void {
    const activeScope = this.getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);

    // Check popup state (lazy-loaded)
    const popupOpen = this._checkPopupOpen();

    // Debug mode: collect all skips
    const debugSkips: DebugSkipEntry[] | null = this._debugMode ? [] : null;

    // Collect skip info for the unhandled callback
    const skipInfo: SkipInfo | null = this._unhandledCallback ? { reason: UnhandledReason.NoMatch } : null;

    // Two-pass matching: active scope first, then global.
    // This ensures scoped handlers always take priority over global ones.
    const matched = resolveMatchedRegistration({
      event,
      isInput,
      popupOpen,
      activeScope,
      targetElement,
      getScopeRegistrations: (scope, target) => this._getScopeRegistrations(scope, target),
      skipInfo,
      debugSkips,
      toRegistrationInfo: (reg) => this._toRegistrationInfo(reg),
      logComponent: LOG_COMPONENT,
    });

    // Debug logging
    if (this._debugMode) {
      this._logDebugEvent(event, activeScope, isInput, popupOpen, matched, debugSkips);
    }

    if (!matched) {
      if (emitUnhandled && this._unhandledCallback && skipInfo) {
        this._unhandledCallback({
          event,
          reason: skipInfo.reason,
          activeScope,
          isInput,
          isPopupOpen: popupOpen,
          skippedRegistration: skipInfo.reason !== UnhandledReason.NoMatch ? skipInfo.registration : undefined,
        });
      }
      return;
    }

    const opts = matched.options;

    // All checks passed — execute the callback
    if (opts.preventDefault) {
      event.preventDefault();
    }
    if (opts.stopPropagation) {
      event.stopPropagation();
    }

    const details: HotkeyCallbackDetails = {
      hotkey: matched.hotkey,
      parsedHotkey: matched.parsedHotkey,
      scope: opts.scope,
    };

    try {
      matched.callback(event, details);
    } catch (error) {
      Log.error(`Error in hotkey callback for "${matched.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
    }
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

    // Check external conflicts (lazy import to avoid circular deps at module level)
    const validate = sap.ui.require("ui5/hotkeys/validate") as ValidateModule | undefined;
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

  // ──────────────────────────────────────────────
  // Private: Validation warnings
  // ──────────────────────────────────────────────

  private _logValidationWarnings(normalizedHotkey: string): void {
    const validate = sap.ui.require("ui5/hotkeys/validate") as ValidateModule | undefined;
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
   *
   * Only caches the positive result (module found). Negative results are retried
   * on each call because `sap.m` may load asynchronously after the first keypress.
   * `sap.ui.require()` is an O(1) lookup once the module is loaded.
   */
  private _checkPopupOpen(): boolean {
    return runtimeHooks.hasOpenPopup();
  }

  // ──────────────────────────────────────────────
  // Private: Target element listeners
  // ──────────────────────────────────────────────

  private _attachTargetListener(target: EventTarget): void {
    this._listenerRegistry.attachTarget(target);
  }

  private _detachTargetListener(target: EventTarget): void {
    this._listenerRegistry.detachTarget(target);
  }

  // ──────────────────────────────────────────────
  // Private: Conflict handling
  // ──────────────────────────────────────────────

  private _isSameConflictBucket(
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
        if (this._isSameConflictBucket(reg, normalizedHotkey, scope, target)) {
          conflicts.push(reg);
        }
      }
      for (const reg of conflicts) {
        if (reg.options.target) {
          this._detachTargetListener(reg.options.target);
        }
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
      if (this._isSameConflictBucket(reg, normalizedHotkey, scope, target)) {
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
        document: new Set<string>(),
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

    bucket.document.add(registration.id);
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
      bucket.document.delete(registration.id);
    }

    if (bucket.document.size === 0 && bucket.targets.size === 0) {
      this._registrationsByScope.delete(scope);
    }
  }

  private _getScopeRegistrations(scope: string, targetElement: EventTarget | null): ReadonlyArray<HotkeyRegistration> {
    const bucket = this._registrationsByScope.get(scope);
    if (!bucket) return [];

    const ids = targetElement === null ? bucket.document : bucket.targets.get(targetElement);
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
