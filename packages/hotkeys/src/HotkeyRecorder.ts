import { MODIFIER_KEYS } from "./internal/constants";
import { keyboardEventToHotkey } from "./internal/parse";

/**
 * Options for the HotkeyRecorder.
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
 * Not a singleton — multiple recorders may exist (e.g., one per settings row).
 *
 * Usage:
 * 1. Create a recorder with callbacks
 * 2. Call `start()` to begin listening
 * 3. The recorder auto-stops after capturing one hotkey
 *
 * While recording, all keyboard input is blocked (preventDefault + stopPropagation
 * in capture phase). Listener is attached on `window` capture so it runs before
 * `document` capture listeners such as HotkeyManager. Keep the recording window short.
 *
 * Special keys:
 * - Escape → cancels recording
 * - Backspace/Delete (no modifiers) → records empty string (clear)
 * - Modifier-only presses → ignored (waits for action key)
 */
export default class HotkeyRecorder {
  private _options: HotkeyRecorderOptions;
  private _recording = false;
  private _destroyed = false;
  private readonly _keydownHandler = this._onKeyDown.bind(this);

  constructor(options: HotkeyRecorderOptions) {
    this._options = options;
  }

  /**
   * Start recording. Attaches a `window` capture-phase keydown listener.
   */
  start(): void {
    if (this._destroyed || this._recording) return;
    this._recording = true;
    window.addEventListener("keydown", this._keydownHandler, true);
  }

  /**
   * Stop recording silently (no callbacks).
   */
  stop(): void {
    if (!this._recording) return;
    this._recording = false;
    window.removeEventListener("keydown", this._keydownHandler, true);
  }

  /**
   * Cancel recording — calls onCancel if provided.
   */
  cancel(): void {
    this.stop();
    this._options.onCancel?.();
  }

  /**
   * Whether the recorder is currently listening for input.
   */
  get isRecording(): boolean {
    return this._recording;
  }

  /**
   * Whether the recorder has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Destroy the recorder. Stops recording and prevents restart.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
  }

  private _onKeyDown(event: KeyboardEvent): void {
    // Prevent all default behavior while recording
    event.preventDefault();
    event.stopImmediatePropagation();

    const key = event.key;

    // Escape → cancel
    if (key === "Escape") {
      this.cancel();
      return;
    }

    // Backspace/Delete with no modifiers → clear
    const noModifiers = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if ((key === "Backspace" || key === "Delete") && noModifiers) {
      this._stopAndRecord("");
      return;
    }

    // Modifier-only → wait for action key
    if (MODIFIER_KEYS.has(key)) {
      return;
    }

    // Valid combo — convert to hotkey string
    const hotkey = keyboardEventToHotkey(event);
    if (hotkey !== null) {
      this._stopAndRecord(hotkey);
    }
  }

  /** Remove listener BEFORE callback (TanStack pattern — prevents race conditions). */
  private _stopAndRecord(hotkey: string): void {
    this._recording = false;
    window.removeEventListener("keydown", this._keydownHandler, true);
    this._options.onRecord(hotkey);
  }
}
