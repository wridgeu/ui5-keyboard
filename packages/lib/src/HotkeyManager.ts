import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
import type Router from "sap/ui/core/routing/Router";
// Side-effect import: ensures Lib.init() runs when this module is loaded (required for lazy library loading)
import "./library";
import { GLOBAL_SCOPE } from "./constants";
import { getEventTarget, isInputElement } from "./dom";
import { matchesKeyboardEvent } from "./match";
import { keyboardEventToHotkey, parseHotkey } from "./parse";
import { detectPlatform } from "./platform";
import type {
  ConflictBehavior,
  Hotkey,
  HotkeyCallback,
  HotkeyCallbackDetails,
  HotkeyOptions,
  HotkeyRegistration,
  HotkeyRegistrationHandle,
  Platform,
  ResolvedHotkeyOptions,
  UnhandledCallback,
  UnhandledReason,
} from "./types";

const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

let instance: HotkeyManager | null = null;
let nextId = 0;

function generateId(): string {
  return `hk_${++nextId}`;
}

/**
 * Resolve the `ignoreInputs` option for a given hotkey.
 *
 * When set to `"auto"`:
 * - Ctrl/Meta combos and Escape → `false` (allow in inputs)
 * - Single keys and Alt/Shift-only combos → `true` (suppress in inputs)
 */
function resolveIgnoreInputs(option: boolean | "auto", ctrl: boolean, meta: boolean, key: string): boolean {
  if (option !== "auto") {
    return option;
  }
  // Ctrl/Meta combos should work in inputs (e.g., Mod+S for save)
  if (ctrl || meta) {
    return false;
  }
  // Escape should work in inputs (close/cancel)
  if (key === "Escape") {
    return false;
  }
  // Everything else is suppressed in inputs
  return true;
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
    suppressInDialogs: options?.suppressInDialogs ?? false,
    conflictBehavior: options?.conflictBehavior ?? "warn",
    target: options?.target ?? null,
  };
}

/**
 * Tracks why a matching registration was skipped during event processing.
 * Used to provide meaningful context to the unhandled callback.
 */
interface SkipInfo {
  reason: UnhandledReason;
  registration: HotkeyRegistration;
}

/**
 * Debug skip entry for debug mode — records ALL skipped registrations.
 */
interface DebugSkipEntry {
  registration: HotkeyRegistration;
  reason: UnhandledReason;
}

/**
 * Higher number = more specific/useful reason. When multiple registrations
 * are skipped, the most informative reason is reported.
 */
const SKIP_PRIORITY: Record<UnhandledReason, number> = {
  no_match: 0,
  repeat_ignored: 1,
  input_suppressed: 2,
  dialog_suppressed: 3,
  disabled: 4,
};

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
  private _scopeStack: string[] = [GLOBAL_SCOPE];
  private _platform: Platform;

  // Bound handler reference for reliable addEventListener/removeEventListener pairing
  private readonly _keydownHandler = this._onKeyDown.bind(this);

  // Lazy-loaded dialog check function
  private _hasOpenDialog: (() => boolean) | null = null;

  // Router integration cleanup
  private _routerCleanup: (() => void) | null = null;

  // Optional callback for unhandled key events
  private _unhandledCallback: UnhandledCallback | null = null;

  // Debug mode (Feature 3)
  private _debugMode = false;

  // AltGr detection (Feature 5) — tracks location of last Alt keydown
  private _lastAltLocation = 0;

  // Target element listeners (Feature 13) — ref-counted per EventTarget
  private _targetListeners: Map<EventTarget, { handler: (e: KeyboardEvent) => void; count: number }> = new Map();

  /**
   * Private constructor — use `HotkeyManager.getInstance()`.
   */
  constructor() {
    super();
    this._platform = detectPlatform();
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
    const id = generateId();

    // Conflict detection within the same scope
    this._handleConflict(normalizedHotkey, resolved.scope, resolved.conflictBehavior);

    // Validation warnings (Feature 8)
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

    // Attach target listener if needed (Feature 13)
    if (resolved.target) {
      this._attachTargetListener(resolved.target);
    }

    Log.debug(
      `Registered hotkey "${normalizedHotkey}" (id: ${id}, scope: ${resolved.scope})`,
      undefined,
      LOG_COMPONENT,
    );

    let active = true;

    const handle: HotkeyRegistrationHandle = {
      get id() {
        return id;
      },
      get isActive() {
        return active;
      },
      unregister: () => {
        if (!active) return;
        active = false;

        // Detach target listener if needed (Feature 13)
        if (registration.options.target) {
          this._detachTargetListener(registration.options.target);
        }

        this._registrations.delete(id);
        Log.debug(`Unregistered hotkey "${normalizedHotkey}" (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<HotkeyOptions>) => {
        if (!active) {
          throw new Error(`Cannot setOptions on unregistered handle (id: ${id})`);
        }
        if (newOptions.scope !== undefined) {
          throw new Error("Cannot change scope via setOptions — unregister and re-register instead");
        }
        // Merge provided fields into resolved options
        const opts = registration.options;
        if (newOptions.enabled !== undefined) opts.enabled = newOptions.enabled;
        if (newOptions.preventDefault !== undefined) opts.preventDefault = newOptions.preventDefault;
        if (newOptions.stopPropagation !== undefined) opts.stopPropagation = newOptions.stopPropagation;
        if (newOptions.ignoreInputs !== undefined) opts.ignoreInputs = newOptions.ignoreInputs;
        if (newOptions.description !== undefined) opts.description = newOptions.description;
        if (newOptions.ignoreRepeat !== undefined) opts.ignoreRepeat = newOptions.ignoreRepeat;
        if (newOptions.suppressInDialogs !== undefined) opts.suppressInDialogs = newOptions.suppressInDialogs;
        if (newOptions.conflictBehavior !== undefined) opts.conflictBehavior = newOptions.conflictBehavior;
        if (newOptions.target !== undefined) {
          // Swap target listeners
          if (opts.target) this._detachTargetListener(opts.target);
          opts.target = newOptions.target ?? null;
          if (opts.target) this._attachTargetListener(opts.target);
        }
      },
    };

    return handle;
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
   * @param scopeId - If provided, validates that it matches the top of the stack.
   *   Throws if it does not match (prevents mismatched push/pop).
   * @throws Error if the stack would be emptied (global scope cannot be popped)
   *   or if the provided scopeId does not match the top.
   */
  popScope(scopeId?: string): void {
    if (this._scopeStack.length <= 1) {
      throw new Error("Cannot pop the global scope");
    }

    const top = this._scopeStack[this._scopeStack.length - 1];
    if (scopeId !== undefined && top !== scopeId) {
      throw new Error(`Scope mismatch: expected "${scopeId}" but top of stack is "${top}"`);
    }

    this._scopeStack.pop();
    Log.debug(`Popped scope "${top}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
  }

  /**
   * Get the currently active scope (top of stack).
   */
  getActiveScope(): string {
    return this._scopeStack[this._scopeStack.length - 1];
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

    const handler = (event: Parameters<Parameters<Router["attachBeforeRouteMatched"]>[0]>[0]) => {
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
   */
  getRegistrations(): HotkeyRegistration[] {
    return Array.from(this._registrations.values());
  }

  /**
   * Get registrations filtered by scope.
   */
  getRegistrationsForScope(scopeId: string): HotkeyRegistration[] {
    return this.getRegistrations().filter((r) => r.options.scope === scopeId);
  }

  /**
   * Get the detected platform.
   */
  getPlatform(): Platform {
    return this._platform;
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
  // Debug mode (Feature 3)
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

    this._detachListeners();

    // Clean up all target listeners (Feature 13)
    for (const [target, entry] of this._targetListeners) {
      target.removeEventListener("keydown", entry.handler as EventListener, true);
    }
    this._targetListeners.clear();

    this._registrations.clear();
    this._scopeStack = [GLOBAL_SCOPE];
    this._hasOpenDialog = null;
    this._unhandledCallback = null;
    this._debugMode = false;
    this._lastAltLocation = 0;
    instance = null;
    nextId = 0;

    Log.info("HotkeyManager destroyed", undefined, LOG_COMPONENT);

    super.destroy();
  }

  // ──────────────────────────────────────────────
  // Private: Event handling
  // ──────────────────────────────────────────────

  private _attachListeners(): void {
    document.addEventListener("keydown", this._keydownHandler, true);
  }

  private _detachListeners(): void {
    document.removeEventListener("keydown", this._keydownHandler, true);
  }

  private _onKeyDown(event: KeyboardEvent): void {
    if (this._shouldIgnoreKeyEvent(event)) return;
    this._processKeyEvent(event, null);
  }

  /**
   * Shared guard for all keydown listeners (document + target elements).
   * Tracks AltGr state and filters out IME composition, modifier-only presses,
   * and AltGr character input on Windows.
   */
  private _shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
    // Track Alt location for AltGr detection — must happen BEFORE modifier-only guard returns
    if (event.key === "Alt") {
      this._lastAltLocation = event.location;
    }

    // IME composition — not a hotkey attempt
    if (event.isComposing || event.keyCode === 229) return true;

    // Pure modifier key press — not a hotkey attempt
    const key = event.key;
    if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return true;

    // AltGr guard: on Windows, AltGr sends both ctrlKey+altKey.
    // When the last Alt was right-side (location=2), this is AltGr character input.
    if (this._platform === "windows" && event.ctrlKey && event.altKey && this._lastAltLocation === 2) return true;

    return false;
  }

  /**
   * Process a key event from either the document listener or a target element listener.
   * When `targetElement` is null, processes document-level registrations (those without a target).
   * When `targetElement` is set, only processes registrations bound to that target.
   */
  private _processKeyEvent(event: KeyboardEvent, targetElement: EventTarget | null): void {
    const activeScope = this.getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);

    // Check dialog state (lazy-loaded)
    const dialogOpen = this._checkDialogOpen();

    // Debug mode: collect all skips
    const debugSkips: DebugSkipEntry[] | null = this._debugMode ? [] : null;

    // Collect skip info for the unhandled callback
    const skipInfo: SkipInfo | null = this._unhandledCallback ? { reason: "no_match", registration: null! } : null;

    // Two-pass matching: active scope first, then global.
    // This ensures scoped handlers always take priority over global ones.
    const matched =
      this._findMatch(event, isInput, dialogOpen, activeScope, targetElement, skipInfo, debugSkips) ??
      this._findMatch(event, isInput, dialogOpen, GLOBAL_SCOPE, targetElement, skipInfo, debugSkips);

    // Debug logging (Feature 3)
    if (this._debugMode) {
      this._logDebugEvent(event, activeScope, isInput, dialogOpen, matched, debugSkips);
    }

    if (!matched) {
      if (this._unhandledCallback && skipInfo) {
        this._unhandledCallback({
          event,
          reason: skipInfo.reason,
          activeScope,
          isInput,
          isDialogOpen: dialogOpen,
          skippedRegistration: skipInfo.reason !== "no_match" ? skipInfo.registration : undefined,
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

  /**
   * Find the first matching registration for a given target scope.
   *
   * When `skipInfo` is provided, records the most informative reason
   * why a key-matching registration was skipped (for the unhandled callback).
   *
   * When `debugSkips` is provided, records ALL skipped registrations with reasons.
   *
   * When `targetElement` is non-null, only matches registrations with that specific target.
   * When `targetElement` is null, only matches registrations without a target.
   */
  private _findMatch(
    event: KeyboardEvent,
    isInput: boolean,
    dialogOpen: boolean,
    targetScope: string,
    targetElement: EventTarget | null,
    skipInfo?: SkipInfo | null,
    debugSkips?: DebugSkipEntry[] | null,
  ): HotkeyRegistration | null {
    for (const registration of this._registrations.values()) {
      const opts = registration.options;

      // Must match the target scope exactly
      if (opts.scope !== targetScope) continue;

      // Target element filter (Feature 13)
      if (targetElement !== null) {
        // Target-scoped query: only match registrations bound to this target
        if (opts.target !== targetElement) continue;
      } else {
        // Document-scoped query: skip registrations with a target
        if (opts.target !== null) continue;
      }

      // Event matching (key + modifiers)
      if (!matchesKeyboardEvent(event, registration.parsedHotkey)) continue;

      // From here on, the key pattern matched — any skip is reportable.

      // Skip disabled (supports static boolean or dynamic function)
      const enabled = typeof opts.enabled === "function" ? opts.enabled() : opts.enabled;
      if (!enabled) {
        this._recordSkip(skipInfo, "disabled", registration);
        if (debugSkips) debugSkips.push({ registration, reason: "disabled" });
        continue;
      }

      // Key repeat check
      if (opts.ignoreRepeat && event.repeat) {
        this._recordSkip(skipInfo, "repeat_ignored", registration);
        if (debugSkips) debugSkips.push({ registration, reason: "repeat_ignored" });
        continue;
      }

      // Input element check (resolved per-registration)
      const shouldIgnoreInputs = resolveIgnoreInputs(
        opts.ignoreInputs,
        registration.parsedHotkey.ctrl,
        registration.parsedHotkey.meta,
        registration.parsedHotkey.key,
      );
      if (shouldIgnoreInputs && isInput) {
        this._recordSkip(skipInfo, "input_suppressed", registration);
        if (debugSkips) debugSkips.push({ registration, reason: "input_suppressed" });
        continue;
      }

      // Dialog suppression
      if (opts.suppressInDialogs && dialogOpen) {
        this._recordSkip(skipInfo, "dialog_suppressed", registration);
        if (debugSkips) debugSkips.push({ registration, reason: "dialog_suppressed" });
        continue;
      }

      return registration;
    }
    return null;
  }

  /**
   * Record a skip reason if it is more informative than the current one.
   */
  private _recordSkip(skipInfo: SkipInfo | null | undefined, reason: UnhandledReason, reg: HotkeyRegistration): void {
    if (skipInfo && SKIP_PRIORITY[reason] > SKIP_PRIORITY[skipInfo.reason]) {
      skipInfo.reason = reason;
      skipInfo.registration = reg;
    }
  }

  // ──────────────────────────────────────────────
  // Private: Debug logging (Feature 3)
  // ──────────────────────────────────────────────

  private _logDebugEvent(
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    dialogOpen: boolean,
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
      `  Scope: ${activeScope} | Input: ${isInput} | Dialog: ${dialogOpen} | Repeat: ${event.repeat}`,
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
    const validate = sap.ui.require("ui5/hotkeys/validate");
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
  // Private: Validation warnings (Feature 8)
  // ──────────────────────────────────────────────

  private _logValidationWarnings(normalizedHotkey: string): void {
    const validate = sap.ui.require("ui5/hotkeys/validate");
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
  }

  // ──────────────────────────────────────────────
  // Private: Dialog check
  // ──────────────────────────────────────────────

  /**
   * Lazy-load `sap.m.InstanceManager` to avoid a hard dependency on `sap.m`.
   * Returns whether any UI5 dialog is currently open.
   *
   * Only caches the positive result (module found). Negative results are retried
   * on each call because `sap.m` may load asynchronously after the first keypress.
   * `sap.ui.require()` is an O(1) lookup once the module is loaded.
   */
  private _checkDialogOpen(): boolean {
    if (!this._hasOpenDialog) {
      const InstanceManager = sap.ui.require("sap/m/InstanceManager");
      if (InstanceManager && typeof InstanceManager.hasOpenDialog === "function") {
        this._hasOpenDialog = () => InstanceManager.hasOpenDialog();
      }
    }

    return this._hasOpenDialog?.() ?? false;
  }

  // ──────────────────────────────────────────────
  // Private: Target element listeners (Feature 13)
  // ──────────────────────────────────────────────

  private _attachTargetListener(target: EventTarget): void {
    const existing = this._targetListeners.get(target);
    if (existing) {
      existing.count++;
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (this._shouldIgnoreKeyEvent(e)) return;
      this._processKeyEvent(e, target);
    };

    target.addEventListener("keydown", handler as EventListener, true);
    this._targetListeners.set(target, { handler, count: 1 });
  }

  private _detachTargetListener(target: EventTarget): void {
    const existing = this._targetListeners.get(target);
    if (!existing) return;

    existing.count--;
    if (existing.count <= 0) {
      target.removeEventListener("keydown", existing.handler as EventListener, true);
      this._targetListeners.delete(target);
    }
  }

  // ──────────────────────────────────────────────
  // Private: Conflict handling
  // ──────────────────────────────────────────────

  private _handleConflict(normalizedHotkey: string, scope: string, conflictBehavior: ConflictBehavior): void {
    // Find existing registration with same hotkey and scope
    let conflicting: HotkeyRegistration | null = null;
    for (const reg of this._registrations.values()) {
      if (reg.normalizedHotkey === normalizedHotkey && reg.options.scope === scope) {
        conflicting = reg;
        break;
      }
    }

    if (!conflicting) return;

    switch (conflictBehavior) {
      case "allow":
        return;
      case "warn":
        Log.warning(
          `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}). ` +
            `New registration will shadow the existing one.`,
          undefined,
          LOG_COMPONENT,
        );
        return;
      case "error":
        throw new Error(
          `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}).`,
        );
      case "replace":
        this._registrations.delete(conflicting.id);
        Log.debug(
          `Replaced existing hotkey "${normalizedHotkey}" (id: ${conflicting.id}) in scope "${scope}"`,
          undefined,
          LOG_COMPONENT,
        );
        return;
    }
  }
}
