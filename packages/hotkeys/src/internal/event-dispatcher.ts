import Log from "sap/base/Log";
import { Platform, UnhandledReason } from "../library";
import { MODIFIER_KEYS } from "./constants";
import { INTERNAL_TOKEN } from "./internal-token";
import KeyStateTracker from "../KeyStateTracker";
import type { KeyboardDispatchGuard } from "../types";
import type HotkeyRecorder from "../HotkeyRecorder";

const LOG_COMPONENT = "ui5.hotkeys.EventDispatcher";

/**
 * Interface that an interceptor must implement.
 * Used internally by HotkeyRecorder.
 * @internal
 */
export interface KeyEventInterceptor {
  /** Return true to consume the event and block further dispatch. */
  onKeyDown(event: KeyboardEvent): boolean;
  /** Called when this interceptor is replaced by another or cleared by destroy(). */
  onDetached(): void;
}

/**
 * Interface implemented by HotkeyManager (via anonymous handler object)
 * to receive dispatched events from the pipeline.
 * @internal
 */
export interface HotkeyDispatchHandler {
  /** Hotkey dispatch — receives pre-filtered, non-suspended keydowns. Returns true if consumed. */
  processHotkeys(event: KeyboardEvent): boolean;
  /** Sequence dispatch — same contract. Returns true if consumed (full match OR partial advance). */
  processSequences(event: KeyboardEvent): boolean;
  /**
   * Unhandled emission — called when the event was not consumed.
   * `forcedReason` is set by the dispatcher when the event was blocked before reaching
   * the matching pipeline (e.g., `Suspended`). When null, HotkeyManager uses its own
   * skip tracking to determine the most specific reason.
   */
  emitUnhandled(event: KeyboardEvent, forcedReason: UnhandledReason | null): void;
}

/**
 * Internal guard implementation for suspend guards.
 * @internal
 */
class DispatchGuard implements KeyboardDispatchGuard {
  private _active = true;
  private _owner: EventDispatcher | null;
  readonly reason: string;

  constructor(owner: EventDispatcher, reason: string) {
    this._owner = owner;
    this.reason = reason;
  }

  release(): void {
    if (!this._active) return;
    this._active = false;
    this._owner?._releaseGuard(this);
    this._owner = null;
  }

  get isActive(): boolean {
    return this._active;
  }

  /**
   * Called by EventDispatcher.destroy() to invalidate without triggering release logic.
   * @internal
   */
  _invalidate(): void {
    this._active = false;
    this._owner = null;
  }
}

/**
 * Centralized keyboard event dispatcher.
 *
 * Owns all DOM listeners (`window` capture for keydown/keyup, `window` bubble for blur),
 * provides a deterministic 7-step dispatch pipeline, and exposes an RAII-style suspend guard.
 *
 * Instantiated and owned by HotkeyManager — not a singleton.
 *
 * @internal — not part of the public API.
 */
export default class EventDispatcher {
  private _handler: HotkeyDispatchHandler;
  private _keyStateTracker: KeyStateTracker;
  private _destroyed = false;

  // Suspend guard state
  private readonly _guards: Set<DispatchGuard> = new Set();

  // Interceptor slot (e.g., HotkeyRecorder)
  private _interceptor: KeyEventInterceptor | null = null;

  // Recorder tracking for lifecycle management
  private readonly _trackedRecorders: Set<HotkeyRecorder> = new Set();

  // AltGr detection — tracks location of last Alt keydown
  private _lastAltLocation = 0;
  private _platform: Platform;

  // Bound handlers for reliable addEventListener/removeEventListener pairing
  private readonly _keydownHandler = this._onKeyDown.bind(this);
  private readonly _keyupHandler = this._onKeyUp.bind(this);
  private readonly _blurHandler = this._onBlur.bind(this);

  constructor(handler: HotkeyDispatchHandler, platform: Platform) {
    this._handler = handler;
    this._platform = platform;

    // Create and own the KeyStateTracker
    this._keyStateTracker = new KeyStateTracker(platform, INTERNAL_TOKEN);

    // Attach window listeners
    window.addEventListener("keydown", this._keydownHandler, true);
    window.addEventListener("keyup", this._keyupHandler, true);
    window.addEventListener("blur", this._blurHandler);
  }

  /**
   * Access the owned KeyStateTracker instance.
   */
  get keyStateTracker(): KeyStateTracker {
    return this._keyStateTracker;
  }

  // ──────────────────────────────────────────────
  // Suspend guard API
  // ──────────────────────────────────────────────

  /**
   * Suspend hotkey/sequence dispatch. Returns an RAII guard handle.
   *
   * While any guard is active, steps 5–7 of the pipeline are skipped
   * and unhandled fires with `Suspended` reason.
   *
   * @param reason - Debug-only metadata (no runtime behavior change).
   * @throws Error if the dispatcher has been destroyed.
   */
  suspendDispatch(reason?: string): KeyboardDispatchGuard {
    if (this._destroyed) {
      throw new Error("Cannot suspend dispatch on a destroyed EventDispatcher");
    }
    const guard = new DispatchGuard(this, reason ?? "");
    this._guards.add(guard);
    Log.debug(
      `Dispatch suspended (reason: "${guard.reason}", active guards: ${this._guards.size})`,
      undefined,
      LOG_COMPONENT,
    );
    return guard;
  }

  /**
   * Whether dispatch is currently suspended (any guard active).
   */
  isDispatchSuspended(): boolean {
    if (this._destroyed) return false;
    return this._guards.size > 0;
  }

  /**
   * Called by DispatchGuard.release() — removes the guard from the set.
   * @internal
   */
  _releaseGuard(guard: DispatchGuard): void {
    this._guards.delete(guard);
    Log.debug(`Dispatch guard released (remaining: ${this._guards.size})`, undefined, LOG_COMPONENT);
  }

  // ──────────────────────────────────────────────
  // Interceptor API
  // ──────────────────────────────────────────────

  /**
   * Set the active interceptor. Replaces any existing interceptor.
   */
  setInterceptor(interceptor: KeyEventInterceptor): void {
    if (this._destroyed) return;
    if (this._interceptor && this._interceptor !== interceptor) {
      Log.warning("Replacing active interceptor — previous interceptor will be detached", undefined, LOG_COMPONENT);
      this._interceptor.onDetached();
    }
    this._interceptor = interceptor;
  }

  /**
   * Clear the interceptor, but only if the given owner is the current one.
   * Prevents one recorder from accidentally clearing another's interceptor.
   */
  clearInterceptor(owner: KeyEventInterceptor): void {
    if (this._destroyed) return;
    if (this._interceptor === owner) {
      this._interceptor = null;
    }
  }

  // ──────────────────────────────────────────────
  // Recorder tracking
  // ──────────────────────────────────────────────

  /**
   * Track a recorder for lifecycle management.
   */
  trackRecorder(recorder: HotkeyRecorder): void {
    this._trackedRecorders.add(recorder);
  }

  /**
   * Remove a recorder from the tracking set. Called by recorder.destroy().
   */
  untrackRecorder(recorder: HotkeyRecorder): void {
    this._trackedRecorders.delete(recorder);
  }

  // ──────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────

  /**
   * Destroy the dispatcher: remove all listeners, invalidate guards,
   * notify interceptor and tracked recorders, destroy KeyStateTracker.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Remove all DOM listeners first
    window.removeEventListener("keydown", this._keydownHandler, true);
    window.removeEventListener("keyup", this._keyupHandler, true);
    window.removeEventListener("blur", this._blurHandler);

    // Invalidate all outstanding guards
    for (const guard of this._guards) {
      guard._invalidate();
    }
    this._guards.clear();

    // Notify and clear interceptor
    if (this._interceptor) {
      this._interceptor.onDetached();
      this._interceptor = null;
    }

    // Mark all tracked recorders as destroyed
    for (const recorder of this._trackedRecorders) {
      recorder._onDispatcherDestroyed();
    }
    this._trackedRecorders.clear();

    // Destroy owned KeyStateTracker
    this._keyStateTracker.destroy();

    this._lastAltLocation = 0;
  }

  // ──────────────────────────────────────────────
  // Private: Event handlers (the pipeline)
  // ──────────────────────────────────────────────

  private _onKeyDown(event: KeyboardEvent): void {
    // Step 1: Key state tracking — ALWAYS, even for modifiers/IME
    this._keyStateTracker.processKeyDown(event);

    // Step 2: Interceptor (modal capture)
    // Interceptor handles its own DOM event manipulation (preventDefault, etc.)
    // Wrapped in try-catch so a throwing onRecord/onCancel callback does not
    // kill the pipeline — matches the isolation pattern used by _executeMatch.
    if (this._interceptor) {
      try {
        if (this._interceptor.onKeyDown(event)) return;
      } catch (error) {
        Log.error(`Error in interceptor onKeyDown: ${error}`, undefined, LOG_COMPONENT);
        return; // Event was consumed by the interceptor (preventDefault already called)
      }
    }

    // Step 3: Pre-filter: IME, modifier-only, AltGr
    if (this._preFilterEvent(event)) return;

    // Step 4: Suspend guard check
    if (this._guards.size > 0) {
      this._handler.emitUnhandled(event, UnhandledReason.Suspended);
      return;
    }

    // Step 5: Hotkey dispatch
    const hotkeyConsumed = this._handler.processHotkeys(event);

    // Step 6: Sequence dispatch
    const sequenceConsumed = this._handler.processSequences(event);

    // Step 7: Unhandled emission
    if (!hotkeyConsumed && !sequenceConsumed) {
      this._handler.emitUnhandled(event, null);
    }
  }

  private _onKeyUp(event: KeyboardEvent): void {
    this._keyStateTracker.processKeyUp(event);
  }

  private _onBlur(): void {
    this._keyStateTracker.processBlur();
    this._lastAltLocation = 0;
  }

  // ──────────────────────────────────────────────
  // Private: Pre-filter (moved from HotkeyManager)
  // ──────────────────────────────────────────────

  /**
   * Pre-filter and AltGr state tracking.
   *
   * Filters out IME composition, modifier-only presses, and AltGr character
   * input. Also tracks `_lastAltLocation` for the AltGr heuristic.
   *
   * Returns true if the event should be silently dropped.
   */
  private _preFilterEvent(event: KeyboardEvent): boolean {
    // Track AltGr state
    if (event.key === "Alt") {
      this._lastAltLocation = event.location;
    } else if (!event.altKey) {
      this._lastAltLocation = 0;
    }

    // IME composition — not a hotkey attempt
    if (event.isComposing || event.keyCode === 229) return true;

    // Pure modifier key press — not a hotkey attempt
    if (MODIFIER_KEYS.has(event.key)) return true;

    // AltGr guard: on Windows, AltGr sends both ctrlKey+altKey.
    if (this._platform === Platform.Windows && event.getModifierState("AltGraph")) return true;
    if (this._platform === Platform.Windows && event.ctrlKey && event.altKey && this._lastAltLocation === 2)
      return true;

    return false;
  }
}
