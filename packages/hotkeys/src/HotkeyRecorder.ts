import { keyboardEventToHotkey } from "./parse";

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
 * Special keys:
 * - Escape → cancels recording
 * - Backspace/Delete (no modifiers) → records empty string (clear)
 * - Modifier-only presses → ignored (waits for action key)
 */
export default class HotkeyRecorder {
  private _options: HotkeyRecorderOptions;
  private _recording = false;
  private readonly _keydownHandler = this._onKeyDown.bind(this);

  constructor(options: HotkeyRecorderOptions) {
    this._options = options;
  }

  /**
   * Start recording. Attaches a capture-phase keydown listener.
   */
  start(): void {
    if (this._recording) return;
    this._recording = true;
    document.addEventListener("keydown", this._keydownHandler, true);
  }

  /**
   * Stop recording silently (no callbacks).
   */
  stop(): void {
    if (!this._recording) return;
    this._recording = false;
    document.removeEventListener("keydown", this._keydownHandler, true);
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

  private _onKeyDown(event: KeyboardEvent): void {
    // Prevent all default behavior while recording
    event.preventDefault();
    event.stopPropagation();

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
    if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") {
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
    document.removeEventListener("keydown", this._keydownHandler, true);
    this._options.onRecord(hotkey);
  }
}
