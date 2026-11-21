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
import { assertImmutableSetOptions } from "./internal/immutable-options";
import FocusFallbackTracker from "./internal/FocusFallbackTracker";
import { getEventTarget, isInputElement } from "./internal/dom";
import { parseHotkey, formatParsed, parseSequenceSteps } from "./internal/parse";
import RegistrationStore from "./internal/registration-store";
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
  ScopeHandle,
  UnhandledContext,
  UnhandledCallback,
  UpdatableHotkeyOptions,
} from "./types";
import type { HotkeyRegistration, ResolvedHotkeyOptions, ResolvedTarget } from "./internal/types";

const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

/** Monotonic source of registration ids. Never repeats for the page lifetime. */
let idSeq = 0;

/**
 * Resolve the public target option into the internal discriminated union.
 * Functions become `callback` targets for lazy dispatch-time resolution.
 */
function resolveTarget(target: Element | (() => Element | null) | null | undefined): ResolvedTarget {
  if (target == null) return null; // oxlint-disable-line eqeqeq -- intentional nullish check
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

/** Every value an updatable option can hold, as declared on the resolved options. */
type UpdatableOptionValue = ResolvedHotkeyOptions[UpdatableOptionKey];

// SAFETY: `UPDATABLE_OPTION_DEFAULTS` is a const object literal that nothing writes to, so
// the strings `Object.keys` returns are exactly the `UpdatableOptionKey` union that
// `keyof typeof` derives from that same literal.
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
      // SAFETY: `key` ranges over `UPDATABLE_OPTION_KEYS`, so it names a field `target`
      // declares. The assertion restates those fields under their common value type, which
      // is what TypeScript needs to accept a write whose key is a union rather than a single
      // literal; `source` and `target` declare the same type per key.
      (target as Record<UpdatableOptionKey, UpdatableOptionValue>)[key] = value;
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

/** One scope stack entry; its identity, not its id, is what `release()` removes. */
class ScopeEntry implements ScopeHandle {
  active = true;

  constructor(
    readonly id: string,
    private readonly _remove: (entry: ScopeEntry) => void,
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  release(): void {
    this._remove(this);
  }
}

/**
 * Keyboard shortcut manager for UI5 applications.
 *
 * Owns an internal EventDispatcher that attaches `keydown`, `keyup` and `blur`
 * listeners to `window` and dispatches matching hotkeys to registered callbacks
 * based on scope, input state, and dialog state. Focus tracking adds two more
 * on `document`, owned by FocusFallbackTracker.
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
 *
 * @since 0.1.0
 */
export default class HotkeyManager extends BaseObject {
  private _registrations: RegistrationStore = new RegistrationStore();
  /** Bottom entry is always the global scope. */
  private _scopeStack: ScopeEntry[] = [this._createScopeEntry(GLOBAL_SCOPE)];
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
   * @since 0.1.0
   */
  constructor(platform: Platform = detectPlatform()) {
    super();
    this._platform = platform;

    const handler: HotkeyDispatchHandler = {
      processHotkeys: (e) => this._processHotkeys(e),
      processSequences: (e, ctx) => this._processSequences(e, ctx),
      resetSequences: () => this._sequenceManager?.reset(),
      emitSuspended: (e) => this._emitSuspended(e),
      emitUnhandled: (e, ctx) => this._emitUnhandled(e, ctx),
    };
    this._dispatcher = new EventDispatcher(handler, this._platform);
    this._focusFallback = new FocusFallbackTracker();
    this._conflictResolver = new ConflictResolver(this._registrations);
    this._matcher = new HotkeyMatcher(this._registrations, this._focusFallback, (reg) => this._toRegistrationInfo(reg));

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
   * @since 0.1.0
   */
  register(hotkey: Hotkey, callback: HotkeyCallback, options?: HotkeyOptions): HotkeyRegistrationHandle {
    this._assertAlive("register");

    const sequenceSteps = parseSequenceSteps(hotkey);
    if (sequenceSteps) {
      return this._registerSequence(hotkey, sequenceSteps, callback, options);
    }

    const resolved = resolveOptions(options);
    const parsedHotkey = parseHotkey(hotkey, this._platform);
    const normalizedHotkey = formatParsed(parsedHotkey);
    const id = `hk_${++idSeq}`;

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

    this._registrations.add(registration);

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
        if (this._registrations.remove(registration)) {
          Log.debug(`Unregistered hotkey "${normalizedHotkey}" (id: ${id})`, undefined, LOG_COMPONENT);
        }
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if (!registration.active) {
          throw new Error(`Cannot setOptions on unregistered handle (id: ${id})`);
        }
        assertImmutableSetOptions(newOptions);
        const opts = registration.options;
        // Special case: target swap requires normalization + re-indexing + conflict management
        if (newOptions.target !== undefined) {
          const nextTarget = resolveTarget(newOptions.target);
          if (!sameTarget(opts.target, nextTarget)) {
            // A null target is a move into the scope's untargeted bucket,
            // which collides the same way an element bucket does.
            this._conflictResolver.resolve(
              registration.normalizedHotkey,
              opts.scope,
              nextTarget,
              opts.conflictBehavior,
              registration,
            );
            this._registrations.retarget(registration, nextTarget);
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
   *
   * @since 0.1.0
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
   * While any guard is active, all hotkey and sequence callbacks are blocked,
   * including the sequence step of a keydown whose hotkey callback took the
   * guard. A key swallowed while suspended resets any pending sequence, as
   * does a key consumed by a recording `HotkeyRecorder`. Key state tracking
   * continues normally. Browser defaults are NOT suppressed.
   *
   * @param reason - Optional debug metadata.
   * @since 0.1.0
   */
  suspendDispatch(reason?: string): KeyboardDispatchGuard {
    this._assertAlive("suspendDispatch");
    return this._dispatcher.suspendDispatch(reason);
  }

  /**
   * Whether dispatch is currently suspended (any guard active).
   *
   * @since 0.1.0
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
   * @since 0.1.0
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
   *
   * @since 0.1.0
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
   *
   * @returns A handle whose `release()` removes exactly this entry, wherever
   *   it sits in the stack by then.
   * @throws Error for the global scope, or for the scope that is already on top.
   * @since 0.1.0
   */
  pushScope(scopeId: string): ScopeHandle {
    this._assertAlive("pushScope");
    const normalized = this._resolvePushableScope(scopeId);

    if (this.getActiveScope() === normalized) {
      throw new Error(`Cannot push scope "${normalized}": it is already the active scope`);
    }

    const entry = this._createScopeEntry(normalized);
    this._scopeStack.push(entry);
    Log.debug(`Pushed scope "${normalized}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
    return entry;
  }

  /**
   * Remove the topmost stack entry with this scope id, wherever it sits.
   *
   * Entries above it stay in place, so a dialog closing after a route change
   * removes its own scope without disturbing the route's. When no entry has
   * this id (it was already released, popped or reset), the call logs a
   * warning and changes nothing.
   *
   * @param scopeId - The scope to remove.
   * @throws Error for the global scope, which cannot be popped.
   * @since 0.1.0
   */
  popScope(scopeId: string): void {
    this._assertAlive("popScope");
    const normalized = resolveRequiredScope(scopeId);
    if (normalized === GLOBAL_SCOPE) {
      throw new Error("Cannot pop the global scope");
    }

    const index = this.getScopeStack().lastIndexOf(normalized);
    if (index === -1) {
      Log.warning(`Cannot pop scope "${normalized}": it is not on the scope stack`, undefined, LOG_COMPONENT);
      return;
    }
    this._removeScopeEntry(this._scopeStack[index]!);
  }

  /**
   * Get the currently active scope (top of stack).
   *
   * @since 0.1.0
   */
  getActiveScope(): string {
    return this._scopeStack.at(-1)!.id;
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
   *
   * @since 0.1.0
   */
  getScopeStack(): readonly string[] {
    return this._scopeStack.map((e) => e.id);
  }

  /**
   * Pop all non-global scopes, returning the stack to its initial state.
   *
   * Useful for centralized cleanup on route changes, FLP cross-navigation,
   * or any scenario where stale scopes need to be cleared.
   *
   * @since 0.1.0
   */
  resetToGlobalScope(): void {
    this._assertAlive("resetToGlobalScope");
    if (this._scopeStack.length > 1) {
      const depth = this._scopeStack.length - 1;
      this._clearScopeStack();
      Log.debug(`Reset to global scope (popped ${depth} scope(s))`, undefined, LOG_COMPONENT);
    }
  }

  /**
   * Router integration's single scope entry: replace `previous` in place with
   * `scopeId`, so entries pushed above it (open dialogs) stay on top; push
   * when `previous` is no longer on the stack; remove it when `scopeId` is
   * null. Returns the entry now owned by the caller.
   * @internal Called by RegistrationGroup.
   */
  _replaceScope(previous: ScopeHandle | null, scopeId: string | null): ScopeHandle | null {
    this._assertAlive("_replaceScope");
    const index = previous instanceof ScopeEntry && previous.active ? this._scopeStack.indexOf(previous) : -1;
    if (scopeId === null) {
      previous?.release();
      return null;
    }
    const normalized = this._resolvePushableScope(scopeId);
    if (index === -1) {
      const entry = this._createScopeEntry(normalized);
      this._scopeStack.push(entry);
      return entry;
    }
    const current = this._scopeStack[index]!;
    if (current.id === normalized) return current;
    current.active = false;
    const entry = this._createScopeEntry(normalized);
    this._scopeStack[index] = entry;
    Log.debug(`Replaced scope "${current.id}" with "${normalized}"`, undefined, LOG_COMPONENT);
    return entry;
  }

  private _resolvePushableScope(scopeId: string): string {
    const normalized = resolveRequiredScope(scopeId);
    if (normalized === GLOBAL_SCOPE) {
      throw new Error("Cannot push the global scope: it is always at the bottom of the stack");
    }
    return normalized;
  }

  private _createScopeEntry(id: string): ScopeEntry {
    return new ScopeEntry(id, (entry) => this._removeScopeEntry(entry));
  }

  private _removeScopeEntry(entry: ScopeEntry): void {
    if (!entry.active) return;
    entry.active = false;
    this._scopeStack.splice(this._scopeStack.indexOf(entry), 1);
    Log.debug(`Popped scope "${entry.id}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
  }

  /** Drop every entry above the global one, marking their handles released. */
  private _clearScopeStack(): void {
    for (const entry of this._scopeStack.splice(1)) {
      entry.active = false;
    }
  }

  // ──────────────────────────────────────────────
  // Introspection
  // ──────────────────────────────────────────────

  /**
   * Get all active registrations. Returns a new array (safe to iterate).
   * Info objects are flat snapshots - no closures or DOM references leak.
   *
   * @since 0.1.0
   */
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    const hotkeys = Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
    if (!this._sequenceManager) return hotkeys;
    return [...hotkeys, ...this._sequenceManager.getRegistrations()];
  }

  /**
   * Get registrations filtered by scope.
   *
   * @since 0.1.0
   */
  getRegistrationsForScope(scopeId: string): ReadonlyArray<HotkeyRegistrationInfo> {
    const normalizedScope = resolveScopeOrGlobal(scopeId);
    const bucket = this._registrations.getBucket(normalizedScope);
    if (!bucket) return [];

    // The three bucket sections are disjoint: the index files each registration
    // under exactly one of them, and target swaps deindex before reindexing.
    const result: HotkeyRegistrationInfo[] = [];
    const add = (regs: Iterable<HotkeyRegistration>) => {
      for (const reg of regs) {
        result.push(this._toRegistrationInfo(reg));
      }
    };

    add(bucket.untargeted);
    for (const regs of bucket.targets.values()) {
      add(regs);
    }
    add(bucket.callbackTargets.keys());

    if (this._sequenceManager) {
      result.push(...this._sequenceManager.getRegistrations().filter((r) => r.scope === normalizedScope));
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
   *
   * @since 0.1.0
   */
  findRegistrations(predicate: (info: HotkeyRegistrationInfo) => boolean): ReadonlyArray<HotkeyRegistrationInfo> {
    return this.getRegistrations().filter(predicate);
  }

  /**
   * Get the detected platform.
   *
   * @since 0.1.0
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

    return this._getSequenceManager().registerSequence(hotkey, steps, callback, options);
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
   *
   * @since 0.1.0
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
   *
   * @since 0.1.0
   */
  addGenericRootId(id: string): void {
    this._assertAlive("addGenericRootId");
    this._focusFallback.addGenericRootId(id);
  }

  /**
   * Remove a previously registered generic root ID.
   *
   * @since 0.1.0
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
   * After destruction, every method that mutates state throws via `_assertAlive`;
   * the read-only getters keep answering from the cleared state.
   *
   * @since 0.1.0
   */
  override destroy(): void {
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

    this._registrations.clear();
    this._clearScopeStack();
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
   * Emit the unhandled callback for a keydown blocked by suspension. The
   * matching pipeline never ran, so the context is read fresh.
   */
  private _emitSuspended(event: KeyboardEvent): void {
    if (!this._unhandledCallback) return;
    this._invokeUnhandled({
      event,
      reason: UnhandledReason.Suspended,
      activeScope: this.getActiveScope(),
      isInput: isInputElement(getEventTarget(event)),
      isPopupOpen: hasOpenPopup(),
      skippedRegistration: undefined,
    });
  }

  /**
   * Emit the unhandled callback for a keydown nothing consumed, with the
   * most specific skip reason `_processHotkeys` recorded.
   */
  private _emitUnhandled(event: KeyboardEvent, eventContext: EventContext): void {
    if (!this._unhandledCallback) return;
    const { skipInfo } = eventContext;
    this._invokeUnhandled({
      event,
      reason: skipInfo?.reason ?? UnhandledReason.NoMatch,
      activeScope: eventContext.activeScope,
      isInput: eventContext.isInput,
      isPopupOpen: eventContext.popupOpen,
      skippedRegistration: skipInfo?.registration,
    });
  }

  private _invokeUnhandled(context: UnhandledContext): void {
    try {
      this._unhandledCallback?.(context);
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
