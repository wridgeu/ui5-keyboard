import { MODIFIER_KEYS } from "./internal/constants";
import { INTERNAL_TOKEN } from "./internal/internal-token";
import { keyboardEventToHotkey } from "./internal/parse";
import type EventDispatcher from "./internal/event-dispatcher";
import type { KeyEventInterceptor } from "./internal/event-dispatcher";

/**
 * Options for the HotkeyRecorder.
 *
 * @since 0.1.0
 */
export interface HotkeyRecorderOptions {
  /** Called when a hotkey is successfully recorded. Empty string means "cleared" (Backspace/Delete). */
  onRecord: (hotkey: string) => void;
  /** Called when recording is cancelled (Escape). */
  onCancel?: () => void;
}

/**
 * Records a keyboard shortcut from user input.
 *
 * Multiple recorders may exist (e.g., one per settings row).
 * Created via `HotkeyManager.createRecorder()`.
 *
 * Usage:
 * 1. Create a recorder via `manager.createRecorder({ onRecord, onCancel })`
 * 2. Call `start()` to begin listening
 * 3. The recorder auto-stops after capturing one hotkey
 *
 * While recording, all keyboard input is blocked (preventDefault + stopImmediatePropagation)
 * and each consumed key resets any pending sequence.
 *
 * Special keys:
 * - Escape → cancels recording
 * - Backspace/Delete (no modifiers) → records empty string (clear)
 * - Modifier-only presses → ignored (waits for action key)
 *
 * @since 0.1.0
 */
export default class HotkeyRecorder implements KeyEventInterceptor {
  private _options: HotkeyRecorderOptions;
  /** Null once the recorder or its manager is destroyed. */
  private _dispatcher: EventDispatcher | null;

  /**
   * @internal - Do not instantiate directly. Use `HotkeyManager.createRecorder()`.
   */
  constructor(options: HotkeyRecorderOptions, dispatcher: EventDispatcher, token: symbol) {
    if (token !== INTERNAL_TOKEN) {
      throw new Error("HotkeyRecorder cannot be instantiated directly. Use HotkeyManager.createRecorder().");
    }
    this._options = options;
    this._dispatcher = dispatcher;
  }

  /**
   * Start recording. Starting a recorder detaches any other recorder that is currently recording.
   *
   * @since 0.1.0
   */
  start(): void {
    if (this.isRecording) return;
    this._dispatcher?.setInterceptor(this);
  }

  /**
   * Stop recording silently (no callbacks).
   *
   * @since 0.1.0
   */
  stop(): void {
    this._dispatcher?.clearInterceptor(this);
  }

  /**
   * Cancel recording - calls onCancel if provided.
   * No-op if the recorder has been destroyed.
   *
   * @since 0.1.0
   */
  cancel(): void {
    if (this.isDestroyed) return;
    this.stop();
    this._options.onCancel?.();
  }

  /**
   * Whether the recorder is currently listening for input.
   *
   * @since 0.1.0
   */
  get isRecording(): boolean {
    return this._dispatcher?.isInterceptor(this) ?? false;
  }

  /**
   * Whether the recorder has been destroyed.
   *
   * @since 0.1.0
   */
  get isDestroyed(): boolean {
    return this._dispatcher === null;
  }

  /**
   * Destroy the recorder. Stops recording and prevents restart.
   *
   * @since 0.1.0
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.stop();
    this._dispatcher?.untrackRecorder(this);
    this._onDispatcherDestroyed();
  }

  // ──────────────────────────────────────────────
  // KeyEventInterceptor implementation
  // ──────────────────────────────────────────────

  /**
   * Intercept a keydown event during recording.
   * Returns true to consume the event and block further dispatch.
   *
   * @since 0.1.0
   */
  onKeyDown(event: KeyboardEvent): boolean {
    if (!this.isRecording) return false;

    // Block all keyboard input during recording
    event.preventDefault();
    event.stopImmediatePropagation();

    const key = event.key;

    // Escape → cancel
    if (key === "Escape") {
      this.cancel();
      return true;
    }

    // Backspace/Delete with no modifiers → clear
    const noModifiers = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if ((key === "Backspace" || key === "Delete") && noModifiers) {
      this._stopAndRecord("");
      return true;
    }

    // Modifier-only → wait for action key
    if (MODIFIER_KEYS.has(key)) {
      return true;
    }

    // Valid combo - convert to hotkey string
    const hotkey = keyboardEventToHotkey(event);
    if (hotkey !== null) {
      this._stopAndRecord(hotkey);
    }

    return true;
  }

  /**
   * Called by the dispatcher when this interceptor is replaced or the dispatcher is destroyed.
   * Idempotent; by then the dispatcher no longer routes keys here.
   *
   * @since 0.1.0
   */
  onDetached(): void {}

  /**
   * Called by EventDispatcher.destroy() to mark this recorder as destroyed
   * and clear its dispatcher reference.
   * @internal
   */
  _onDispatcherDestroyed(): void {
    this._dispatcher = null;
  }

  /** Clear the interceptor before invoking the callback to prevent re-entrant dispatch races. */
  private _stopAndRecord(hotkey: string): void {
    this.stop();
    this._options.onRecord(hotkey);
  }
}
