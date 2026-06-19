import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
import { ConflictBehavior, Platform, UnhandledReason } from "./library";
import RegistrationGroup from "./RegistrationGroup";
import SequenceManager from "./internal/SequenceManager";
import HotkeyRecorder from "./HotkeyRecorder";
import type { HotkeyRecorderOptions } from "./HotkeyRecorder";
import EventDispatcher from "./internal/event-dispatcher";
import type { EventContext, HotkeyDispatchHandler, HotkeyDispatchResult } from "./internal/event-dispatcher";
import { INTERNAL_TOKEN } from "./internal/internal-token";
import { GLOBAL_SCOPE } from "./internal/constants";
import FocusFallbackTracker from "./internal/FocusFallbackTracker";
import { getEventTarget, isInputElement } from "./internal/dom";
import { createIdGenerator } from "./internal/idgen";
import { parseHotkey } from "./internal/parse";
import RegistrationIndex from "./internal/registration-index";
import ConflictResolver from "./internal/conflict-resolver";
import HotkeyMatcher from "./internal/hotkey-matcher";
import { resolveEnabled } from "./internal/resolve-enabled";
import { resolveRequiredScope, resolveScopeOrGlobal } from "./internal/scope";
import { detectPlatform } from "./internal/platform";
import { hasOpenPopup } from "./internal/runtime";
import { validateHotkey } from "./internal/validate";
import type { SkipInfo } from "./internal/skip-reason";
import type {
  Hotkey,
  HotkeyCallback,
  HotkeyOptions,
  HotkeyRegistrationHandle,
  HotkeyRegistrationInfo,
  KeyboardDispatchGuard,
  KeyStateTrackerApi,
  UnhandledContext,
  UnhandledCallback,
  UpdatableHotkeyOptions,
} from "./types";
import type { HotkeyRegistration, ResolvedHotkeyOptions, ResolvedTarget, SequenceOptions } from "./internal/types";

const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

const idGen = createIdGenerator("hk_");

/**
 * Resolve the public target option into the internal discriminated union.
 * Functions become `callback` targets for lazy dispatch-time resolution.
 */
function resolveTarget(target: Element | (() => Element | null) | null | undefined): ResolvedTarget {
  if (target == null) return null; // eslint-disable-line eqeqeq -- intentional nullish check
  if (typeof target === "function") return { kind: "callback", fn: target };
  return { kind: "element", el: target };
}

/**
 * Reference-equal target bindings: same element, same callback, or both unset.
 * Used to skip the deindex/reindex + conflict re-check when a `setOptions`
 * target swap resolves to the binding already in effect.
 */
function sameTarget(a: ResolvedTarget, b: ResolvedTarget): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "element" && b.kind === "element") return a.el === b.el;
  if (a.kind === "callback" && b.kind === "callback") return a.fn === b.fn;
  return false;
}

/**
 * Defaults for the options `setOptions` can update in place; the keys are the
 * single definition of that set. `scope`/`conflictBehavior` are immutable and
 * `target` needs re-indexing, so they sit outside it. The `Omit` type makes a
 * new `ResolvedHotkeyOptions` field a compile error here until a default is
 * supplied, so the set cannot drift from the option shape.
 */
const UPDATABLE_OPTION_DEFAULTS: Omit<ResolvedHotkeyOptions, "scope" | "conflictBehavior" | "target"> = {
  enabled: true,
  preventDefault: true,
  stopPropagation: true,
  ignoreInputs: "auto",
  description: "",
  ignoreRepeat: true,
  suppressInPopups: true,
};

type UpdatableOptionKey = keyof typeof UPDATABLE_OPTION_DEFAULTS;

const UPDATABLE_OPTION_KEYS = Object.keys(UPDATABLE_OPTION_DEFAULTS) as UpdatableOptionKey[];

/**
 * Copy every defined updatable option from `source` onto `target`, leaving
 * keys the caller did not set untouched. Drives both `resolveOptions`
 * (override defaults) and `setOptions` (live update).
 */
function applyUpdatableOptions(target: ResolvedHotkeyOptions, source: Partial<UpdatableHotkeyOptions>): void {
  for (const key of UPDATABLE_OPTION_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      (target as Record<UpdatableOptionKey, unknown>)[key] = value;
    }
  }
}

/**
 * Merge user-provided options with defaults.
 */
function resolveOptions(options?: HotkeyOptions): ResolvedHotkeyOptions {
  const resolved: ResolvedHotkeyOptions = {
    ...UPDATABLE_OPTION_DEFAULTS,
    scope: resolveScopeOrGlobal(options?.scope),
    conflictBehavior: options?.conflictBehavior ?? ConflictBehavior.Warn,
    target: resolveTarget(options?.target),
  };
  if (options) applyUpdatableOptions(resolved, options);
  return resolved;
}

/**
 * Split a hotkey string into sequence steps.
 * Returns null if the string is a single-key hotkey.
 * Whitespace between key descriptors separates steps (matching tinykeys/@github/hotkey convention).
 */
function parseSequenceSteps(hotkey: string): string[] | null {
  const steps = hotkey.trim().split(/\s+/);
  return steps.length > 1 ? steps : null;
}

/**
 * Keyboard shortcut manager for UI5 applications.
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
 * const manager = new HotkeyManager();
 *
 * manager.register("Mod+S", (event) => { ... }, {
 *   description: "Save",
 *   scope: "editor",
 * });
 * ```
 */
export default class HotkeyManager extends BaseObject {
  private _registrations: Map<string, HotkeyRegistration> = new Map();
  private _registrationIndex: RegistrationIndex = new RegistrationIndex((id) => this._registrations.get(id));
  private _scopeStack: string[] = [GLOBAL_SCOPE];
  private _platform: Platform;
  private _groups: Set<RegistrationGroup> = new Set();
  private _destroyed = false;

  // Optional callback for unhandled key events
  private _unhandledCallback: UnhandledCallback | null = null;

  // Centralized event dispatcher - owns all DOM listeners
  private _dispatcher: EventDispatcher;

  // Lazily created SequenceManager (created on first sequence registration via register())
  private _sequenceManager: SequenceManager | null = null;

  private _focusFallback: FocusFallbackTracker;

  private _conflictResolver: ConflictResolver;
  private _matcher: HotkeyMatcher;

  /**
   * Create a new HotkeyManager instance.
   *
   * Typically created once in `Component.init()` and destroyed in
   * `Component.exit()`. Controllers access it via
   * `getOwnerComponent().getHotkeyManager()`.
   *
   * @param platform - Platform driving `Mod` resolution and platform-specific
   *   dispatch quirks. Defaults to auto-detection from the browser.
   */
  constructor(platform: Platform = detectPlatform()) {
    super();
    this._platform = platform;

    const handler: HotkeyDispatchHandler = {
      processHotkeys: (e) => this._processHotkeys(e),
      processSequences: (e, ctx) => this._processSequences(e, ctx),
      emitUnhandled: (e, r, ctx) => this._emitUnhandled(e, r, ctx),
    };
    this._dispatcher = new EventDispatcher(handler, this._platform);
    this._focusFallback = new FocusFallbackTracker();
    this._conflictResolver = new ConflictResolver(this._registrationIndex, (reg) => this._removeRegistration(reg));
    this._matcher = new HotkeyMatcher(this._registrationIndex, this._focusFallback, (reg) =>
      this._toRegistrationInfo(reg),
    );

    Log.info("HotkeyManager initialized", undefined, LOG_COMPONENT);
  }

  /**
   * Guard: throw if the manager has been destroyed.
   */
  private _assertAlive(method: string): void {
    if (this._destroyed) {
      throw new Error(`Cannot call ${method}() on a destroyed HotkeyManager`);
    }
  }

  /**
   * Canonical registration removal: mark inactive, then drop from the scope
   * index and the id map. Returns `false` (a no-op) when the registration is
   * already inactive. The single removal path shared by `unregister()` and the
   * conflict resolver's "replace" policy, so the multi-store update cannot
   * desync.
   */
  private _removeRegistration(registration: HotkeyRegistration): boolean {
    if (!registration.active) return false;
    registration.active = false;
    this._registrationIndex.deindex(registration);
    this._registrations.delete(registration.id);
    return true;
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
    this._assertAlive("register");

    const sequenceSteps = parseSequenceSteps(hotkey);
    if (sequenceSteps) {
      return this._registerSequence(hotkey, sequenceSteps, callback, options);
    }

    const resolved = resolveOptions(options);
    const parsedHotkey = parseHotkey(hotkey, this._platform);
    const normalizedHotkey = [...parsedHotkey.modifiers, parsedHotkey.key].join("+");
    const id = idGen.next();

    // Conflict detection within the same scope
    this._conflictResolver.resolve(normalizedHotkey, resolved.scope, resolved.target, resolved.conflictBehavior);

    this._logValidationWarnings(normalizedHotkey);

    const registration: HotkeyRegistration = {
      id,
      active: true,
      hotkey,
      normalizedHotkey,
      parsedHotkey,
      callback,
      options: resolved,
    };

    this._registrations.set(id, registration);
    this._registrationIndex.index(registration);

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
        return registration.active;
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
      get sequence() {
        return null;
      },
      unregister: () => {
        if (this._removeRegistration(registration)) {
          Log.debug(`Unregistered hotkey "${normalizedHotkey}" (id: ${id})`, undefined, LOG_COMPONENT);
        }
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if (!registration.active) {
          throw new Error(`Cannot setOptions on unregistered handle (id: ${id})`);
        }
        if ("scope" in newOptions) {
          throw new Error("Cannot change scope via setOptions - unregister and re-register instead");
        }
        if ("conflictBehavior" in newOptions) {
          throw new Error("Cannot change conflictBehavior via setOptions - unregister and re-register instead");
        }
        const opts = registration.options;
        // Special case: target swap requires normalization + re-indexing + conflict management
        if (newOptions.target !== undefined) {
          const nextTarget = resolveTarget(newOptions.target);
          if (!sameTarget(opts.target, nextTarget)) {
            if (nextTarget) {
              this._conflictResolver.resolve(
                registration.normalizedHotkey,
                opts.scope,
                nextTarget,
                opts.conflictBehavior,
              );
            }
            this._registrationIndex.deindex(registration);
            opts.target = nextTarget;
            this._registrationIndex.index(registration);
          }
        }
        applyUpdatableOptions(opts, newOptions);
      },
    };

    return handle;
  }

  /**
   * Create a registration group for collective lifecycle management.
   *
   * All registrations made through the group can be cleaned up with a single
   * `destroyAll()` call - ideal for controller `onExit()` cleanup.
   */
  createGroup(): RegistrationGroup {
    this._assertAlive("createGroup");
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
    this._assertAlive("suspendDispatch");
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
    this._assertAlive("createRecorder");
    const recorder = new HotkeyRecorder(options, this._dispatcher, INTERNAL_TOKEN);
    this._dispatcher.trackRecorder(recorder);
    return recorder;
  }

  // ──────────────────────────────────────────────
  // KeyStateTracker access
  // ──────────────────────────────────────────────

  /**
   * Access held-key state.
   *
   * The tracker is owned by the manager and shares its lifecycle - it is
   * created and destroyed automatically. Returns the consumer-facing
   * `KeyStateTrackerApi` interface; internal lifecycle methods
   * (`processKeyDown`, `destroy`, etc.) are not exposed.
   */
  getKeyStateTracker(): KeyStateTrackerApi {
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
    this._assertAlive("pushScope");
    const normalized = resolveRequiredScope(scopeId);

    if (normalized === GLOBAL_SCOPE) {
      throw new Error("Cannot push the global scope -- it is always at the bottom of the stack");
    }

    const top = this._scopeStack.at(-1);
    if (top === normalized) {
      throw new Error(`Cannot push scope "${normalized}": it is already the active scope`);
    }

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
    this._assertAlive("popScope");
    const normalized = resolveRequiredScope(scopeId);
    if (this._scopeStack.length <= 1) {
      throw new Error("Cannot pop the global scope");
    }

    const top = this._scopeStack.at(-1)!;
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
   * Get a snapshot of the current scope stack (bottom-to-top).
   *
   * The first element is always `GLOBAL_SCOPE`. Each subsequent entry
   * is a scope pushed via `pushScope()` or router integration.
   *
   * Returns a copy - mutating the array has no effect on the manager.
   *
   * @example
   * ```ts
   * manager.pushScope("editor");
   * manager.pushScope("dialog");
   * manager.getScopeStack(); // ["__global__", "editor", "dialog"]
   * ```
   */
  getScopeStack(): readonly string[] {
    return [...this._scopeStack];
  }

  /**
   * Pop all non-global scopes, returning the stack to its initial state.
   *
   * Useful for centralized cleanup on route changes, FLP cross-navigation,
   * or any scenario where stale scopes need to be cleared.
   */
  resetToGlobalScope(): void {
    this._assertAlive("resetToGlobalScope");
    if (this._scopeStack.length > 1) {
      const depth = this._scopeStack.length - 1;
      this._scopeStack = [GLOBAL_SCOPE];
      Log.debug(`Reset to global scope (popped ${depth} scope(s))`, undefined, LOG_COMPONENT);
    }
  }

  // ──────────────────────────────────────────────
  // Introspection
  // ──────────────────────────────────────────────

  /**
   * Get all active registrations. Returns a new array (safe to iterate).
   * Info objects are flat snapshots - no closures or DOM references leak.
   */
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    const hotkeys = Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
    if (!this._sequenceManager) return hotkeys;
    const sequences = this._sequenceManager.getRegistrations().map((s) => this._sequenceRegToInfo(s));
    return [...hotkeys, ...sequences];
  }

  /**
   * Get registrations filtered by scope.
   */
  getRegistrationsForScope(scopeId: string): ReadonlyArray<HotkeyRegistrationInfo> {
    const normalizedScope = resolveScopeOrGlobal(scopeId);
    const bucket = this._registrationIndex.getBucket(normalizedScope);
    if (!bucket) return [];

    // The three bucket sections are disjoint: the index files each id under
    // exactly one of them, and target swaps deindex before reindexing.
    const result: HotkeyRegistrationInfo[] = [];
    const addFromIds = (ids: Iterable<string>) => {
      for (const id of ids) {
        const reg = this._registrations.get(id);
        if (reg) result.push(this._toRegistrationInfo(reg));
      }
    };

    addFromIds(bucket.untargetedIds);
    for (const ids of bucket.targets.values()) {
      addFromIds(ids);
    }
    addFromIds(bucket.callbackTargetIds);

    if (this._sequenceManager) {
      const seqRegs = this._sequenceManager.getRegistrations().filter((r) => r.scope === normalizedScope);
      for (const s of seqRegs) {
        result.push(this._sequenceRegToInfo(s));
      }
    }

    return result;
  }

  /**
   * Find registrations matching a predicate.
   *
   * Useful for checking if a specific hotkey is registered or for building
   * filtered shortcut cheatsheets.
   *
   * @example
   * ```ts
   * // Find all Mod+S registrations
   * const saves = manager.findRegistrations(r => r.normalizedHotkey === "Control+S");
   *
   * // Check if F5 is registered in any scope
   * const hasF5 = manager.findRegistrations(r => r.hotkey === "F5").length > 0;
   * ```
   */
  findRegistrations(predicate: (info: HotkeyRegistrationInfo) => boolean): ReadonlyArray<HotkeyRegistrationInfo> {
    return this.getRegistrations().filter(predicate);
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
    const enabled = resolveEnabled(opts.enabled, `"${reg.normalizedHotkey}"`, LOG_COMPONENT);
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
      sequence: null,
      timeout: null,
    };
  }

  private _registerSequence(
    hotkey: string,
    steps: string[],
    callback: HotkeyCallback,
    options?: HotkeyOptions,
  ): HotkeyRegistrationHandle {
    // Warn about options that are not applicable to sequences
    if (options?.target) {
      Log.warning(
        `Option "target" is ignored for sequence "${hotkey}" - element targeting is not supported for sequences`,
        undefined,
        LOG_COMPONENT,
      );
    }

    const seqOptions: SequenceOptions = {
      description: options?.description,
      timeout: options?.timeout,
      scope: options?.scope,
      enabled: options?.enabled,
      ignoreInputs: options?.ignoreInputs,
      preventDefault: options?.preventDefault,
      stopPropagation: options?.stopPropagation,
      onPending: options?.onPending,
      suppressInPopups: options?.suppressInPopups,
    };

    const innerHandle = this._getSequenceManager().registerSequence(steps, callback, seqOptions);

    const handle: HotkeyRegistrationHandle = {
      get id() {
        return innerHandle.id;
      },
      get isActive() {
        return innerHandle.isActive;
      },
      get hotkey() {
        return hotkey;
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
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if ("scope" in newOptions) {
          throw new Error("Cannot change scope via setOptions - unregister and re-register instead");
        }
        if ("conflictBehavior" in newOptions) {
          throw new Error("Cannot change conflictBehavior via setOptions - unregister and re-register instead");
        }
        innerHandle.setOptions({
          description: newOptions.description,
          timeout: newOptions.timeout,
          enabled: newOptions.enabled,
          ignoreInputs: newOptions.ignoreInputs,
          preventDefault: newOptions.preventDefault,
          stopPropagation: newOptions.stopPropagation,
          onPending: newOptions.onPending,
          suppressInPopups: newOptions.suppressInPopups,
        });
      },
    };

    return handle;
  }

  private _sequenceRegToInfo(s: {
    id: string;
    sequence: readonly string[];
    scope: string;
    description: string;
    enabled: boolean;
    timeout: number;
    ignoreInputs: boolean | "auto";
    preventDefault: boolean;
    stopPropagation: boolean;
    suppressInPopups: boolean;
  }): HotkeyRegistrationInfo {
    return {
      id: s.id,
      hotkey: s.sequence.join(" "),
      normalizedHotkey: s.sequence.join(" "),
      scope: s.scope,
      description: s.description,
      enabled: s.enabled,
      preventDefault: s.preventDefault,
      stopPropagation: s.stopPropagation,
      ignoreInputs: s.ignoreInputs,
      ignoreRepeat: true,
      suppressInPopups: s.suppressInPopups,
      conflictBehavior: ConflictBehavior.Warn,
      hasTarget: false,
      sequence: s.sequence,
      timeout: s.timeout,
    };
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
    this._assertAlive("setUnhandledHandler");
    this._unhandledCallback = callback;
  }

  /**
   * Register an element ID as a generic root node.
   *
   * Generic root nodes are ignored by the focus-tracking logic: when focus
   * bounces to one of these elements (e.g. during rendering transitions),
   * the hotkey manager treats it as if focus did not move.
   *
   * `document`, `window`, `<html>`, `<body>`, and elements with
   * `data-sap-ui-area` are detected automatically. Use this method
   * to register additional custom IDs (e.g. `"content"`).
   */
  addGenericRootId(id: string): void {
    this._assertAlive("addGenericRootId");
    this._focusFallback.addGenericRootId(id);
  }

  /**
   * Remove a previously registered generic root ID.
   */
  removeGenericRootId(id: string): void {
    this._assertAlive("removeGenericRootId");
    this._focusFallback.removeGenericRootId(id);
  }

  // ──────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────

  /**
   * Destroy the manager: remove all DOM listeners, finalize all groups,
   * clear all registrations, and reset internal state.
   *
   * Call from `Component.exit()` to ensure proper cleanup.
   * After destruction, all methods throw via `_assertAlive`.
   */
  destroy(): void {
    this._destroyed = true;

    // Destroy the dispatcher first - removes all DOM listeners, invalidates
    // guards, notifies interceptor/recorders, destroys KeyStateTracker.
    this._dispatcher.destroy();
    this._focusFallback.destroy();

    for (const group of Array.from(this._groups)) {
      group._onManagerDestroy();
    }
    this._groups.clear();

    if (this._sequenceManager) {
      this._sequenceManager.destroy();
      this._sequenceManager = null;
    }

    for (const reg of this._registrations.values()) {
      reg.active = false;
    }

    this._registrations.clear();
    this._registrationIndex.clear();
    this._scopeStack = [GLOBAL_SCOPE];
    this._unhandledCallback = null;

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
   *   Pass 1: target-scoped registrations via composedPath() (active scope → global)
   *   Pass 2: untargeted registrations (active scope → global)
   *
   * Returns a result with the consumed flag and event context for the later
   * pipeline steps (_processSequences, _emitUnhandled).
   */
  private _processHotkeys(event: KeyboardEvent): HotkeyDispatchResult {
    const activeScope = this.getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);

    // Check popup state (lazy-loaded)
    const popupOpen = hasOpenPopup();

    const skipInfo: SkipInfo | null = this._unhandledCallback !== null ? { reason: UnhandledReason.NoMatch } : null;
    const eventContext: EventContext = { activeScope, isInput, popupOpen, skipInfo };

    // Pass 1: target-scoped registrations - innermost match wins.
    const targetMatch = this._matcher.matchTargeted(event, activeScope, isInput, popupOpen, skipInfo);

    if (targetMatch) {
      this._executeMatch(event, targetMatch);
    }

    // Pass 2: untargeted registrations (only if no target match stopped propagation)
    if (!targetMatch || !targetMatch.options.stopPropagation) {
      const untargetedMatch = this._matcher.matchUntargeted(event, activeScope, isInput, popupOpen, skipInfo);
      if (untargetedMatch) {
        this._executeMatch(event, untargetedMatch);
        return { consumed: true, eventContext };
      }
    }

    return { consumed: targetMatch !== null, eventContext };
  }

  /**
   * Process sequences for a pre-filtered, non-suspended keydown event.
   * Delegates to the lazy SequenceManager, reusing the popup state from
   * _processHotkeys via the dispatcher pipeline.
   */
  private _processSequences(event: KeyboardEvent, eventContext: EventContext): boolean {
    return this._sequenceManager?.processKeyEvent(event, eventContext.popupOpen) ?? false;
  }

  /**
   * Emit an unhandled callback.
   *
   * When `forcedReason` is non-null (e.g., Suspended), it is used directly
   * with no `skippedRegistration`. When null, uses `hotkeyContext` forwarded
   * from `_processHotkeys` via the dispatcher pipeline return value.
   */
  private _emitUnhandled(
    event: KeyboardEvent,
    forcedReason: UnhandledReason | null,
    hotkeyContext: EventContext | null,
  ): void {
    if (!this._unhandledCallback) return;

    let reason: UnhandledReason;
    let skippedRegistration: HotkeyRegistrationInfo | undefined;
    let activeScope: string;
    let isInput: boolean;
    let popupOpen: boolean;

    if (forcedReason !== null) {
      // Forced reason (e.g., Suspended) - compute fresh context since
      // _processHotkeys was never called for this event.
      reason = forcedReason;
      activeScope = this.getActiveScope();
      const target = getEventTarget(event);
      isInput = isInputElement(target);
      popupOpen = hasOpenPopup();
    } else {
      // Use context forwarded from _processHotkeys - the dispatcher always
      // provides it when no forced reason is set.
      const context = hotkeyContext!;
      activeScope = context.activeScope;
      isInput = context.isInput;
      popupOpen = context.popupOpen;
      const skipInfo = context.skipInfo;
      reason = skipInfo?.reason ?? UnhandledReason.NoMatch;
      skippedRegistration = skipInfo && skipInfo.reason !== UnhandledReason.NoMatch ? skipInfo.registration : undefined;
    }

    const context: UnhandledContext = {
      event,
      reason,
      activeScope,
      isInput,
      isPopupOpen: popupOpen,
      skippedRegistration,
    };

    try {
      this._unhandledCallback(context);
    } catch (error) {
      Log.error("Unhandled-key callback threw", error instanceof Error ? error : String(error), LOG_COMPONENT);
    }
  }

  // ──────────────────────────────────────────────
  // Private: Match execution
  // ──────────────────────────────────────────────

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
      Log.error(
        `Hotkey callback threw for "${matched.normalizedHotkey}"`,
        error instanceof Error ? error : String(error),
        LOG_COMPONENT,
      );
    }
  }

  // ──────────────────────────────────────────────
  // Private: Validation warnings
  // ──────────────────────────────────────────────

  private _logValidationWarnings(normalizedHotkey: string): void {
    const { warnings } = validateHotkey(normalizedHotkey, this._platform);
    for (const warning of warnings) {
      Log.warning(`Hotkey "${normalizedHotkey}": ${warning}`, undefined, LOG_COMPONENT);
    }
  }
}
