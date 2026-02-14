/**
 * The four canonical modifier keys as reported by KeyboardEvent properties.
 */
export type CanonicalModifier = "Control" | "Shift" | "Alt" | "Meta";

/**
 * Supported platform identifiers for cross-platform modifier resolution.
 */
export type Platform = "mac" | "windows" | "linux";

/**
 * Strategy for handling conflicting hotkey registrations on the same scope.
 *
 * - `"warn"`: Log a console warning but allow both registrations (default).
 * - `"error"`: Throw an error, preventing the new registration.
 * - `"replace"`: Unregister the existing hotkey and register the new one.
 * - `"allow"`: Allow multiple registrations silently.
 */
export type ConflictBehavior = "warn" | "error" | "replace" | "allow";

// ──────────────────────────────────────────────
// Type-safe Hotkey union (Feature 12)
// ──────────────────────────────────────────────

type Letter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type FunctionKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12"
  | "F13"
  | "F14"
  | "F15"
  | "F16"
  | "F17"
  | "F18"
  | "F19"
  | "F20"
  | "F21"
  | "F22"
  | "F23"
  | "F24";
type SpecialKey =
  | "Escape"
  | "Enter"
  | "Space"
  | "Tab"
  | "Backspace"
  | "Delete"
  | "Insert"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "CapsLock"
  | "NumLock"
  | "ScrollLock"
  | "Pause"
  | "PrintScreen"
  | "ContextMenu";
type PunctuationKey = "+" | "-" | "=" | "[" | "]" | "\\" | ";" | "'" | "," | "." | "/" | "`" | "*";
type Key = Letter | Digit | FunctionKey | SpecialKey | PunctuationKey;
type Modifier = "Ctrl" | "Control" | "Shift" | "Alt" | "Meta" | "Mod" | "Cmd" | "Command" | "Option";

/**
 * Type-safe hotkey string with IDE autocomplete for known combinations.
 *
 * The `(string & {})` escape hatch ensures all existing `string` callers
 * still compile, while IDEs suggest known key/modifier combinations.
 */
export type Hotkey =
  | Key
  | `${Modifier}+${Key}`
  | `${Modifier}+${Modifier}+${Key}`
  | `${Modifier}+${Modifier}+${Modifier}+${Key}`
  | (string & {}); // eslint-disable-line @typescript-eslint/ban-types -- intentional escape hatch

/**
 * Result of parsing a hotkey string into its constituent parts.
 */
export interface ParsedHotkey {
  /** The non-modifier key (e.g., "S", "Escape", "F5"). */
  key: string;
  /** Whether Control is required. */
  ctrl: boolean;
  /** Whether Shift is required. */
  shift: boolean;
  /** Whether Alt is required. */
  alt: boolean;
  /** Whether Meta is required. */
  meta: boolean;
  /** Ordered list of active canonical modifiers. */
  modifiers: CanonicalModifier[];
}

/**
 * Details passed to a hotkey callback alongside the keyboard event.
 */
export interface HotkeyCallbackDetails {
  /** The original hotkey string as registered. */
  hotkey: string;
  /** The parsed representation of the hotkey. */
  parsedHotkey: ParsedHotkey;
  /** The scope in which the hotkey was matched. */
  scope: string;
}

/**
 * Signature for hotkey callback functions.
 */
export type HotkeyCallback = (event: KeyboardEvent, details: HotkeyCallbackDetails) => void;

/**
 * Options for registering a hotkey.
 */
export interface HotkeyOptions {
  /**
   * Whether the registration is active. Inactive registrations are skipped
   * during event matching without being removed.
   *
   * When a function is provided, it is evaluated on every keypress. This
   * enables dynamic guards without boilerplate in callbacks — e.g.,
   * `enabled: () => model.getProperty("/canSave")`.
   *
   * @default true
   */
  enabled?: boolean | (() => boolean);

  /**
   * Whether to call `event.preventDefault()` when the hotkey matches.
   * @default true
   */
  preventDefault?: boolean;

  /**
   * Whether to call `event.stopPropagation()` when the hotkey matches.
   * @default true
   */
  stopPropagation?: boolean;

  /**
   * Whether to suppress the hotkey when the event target is an editable input element.
   *
   * - `true`: Always suppress in inputs.
   * - `false`: Never suppress in inputs.
   * - `"auto"`: Suppress for single keys and Alt-only combos; allow for Ctrl/Meta combos and Escape.
   *
   * @default "auto"
   */
  ignoreInputs?: boolean | "auto";

  /**
   * The scope this hotkey belongs to. Only hotkeys in the active scope
   * (or the global scope) are matched.
   * @default "__global__"
   */
  scope?: string;

  /**
   * Human-readable description for display in a shortcut cheatsheet.
   */
  description?: string;

  /**
   * Whether to ignore repeated keydown events from holding a key.
   * @default true
   */
  ignoreRepeat?: boolean;

  /**
   * Whether to suppress this hotkey when a UI5 dialog is open.
   * Uses `sap.m.InstanceManager.hasOpenDialog()` when available.
   * @default false
   */
  suppressInDialogs?: boolean;

  /**
   * Strategy for handling a conflicting registration with the same
   * normalized hotkey string and scope.
   * @default "warn"
   */
  conflictBehavior?: ConflictBehavior;

  /**
   * Bind the hotkey to a specific element instead of the document.
   * The hotkey will only fire for events dispatched on this element.
   * Scopes still apply — both target and scope must match.
   */
  target?: HTMLElement | Document;
}

/**
 * Handle returned by `HotkeyManager.register()` for managing a registration's lifecycle.
 */
export interface HotkeyRegistrationHandle {
  /** Unique identifier for this registration. */
  readonly id: string;
  /** Whether this registration is still active (not yet unregistered). */
  readonly isActive: boolean;
  /** Remove this registration and clean up. */
  unregister(): void;
  /**
   * Update options on a live registration without re-registering.
   * All fields except `scope` can be changed.
   *
   * @param options - Partial options to merge into the registration.
   * @throws Error if the handle has been unregistered or if `scope` is provided.
   */
  setOptions(options: Partial<HotkeyOptions>): void;
}

/**
 * Internal representation of a fully resolved hotkey registration.
 */
export interface HotkeyRegistration {
  /** Unique identifier. */
  id: string;
  /** The original hotkey string as provided by the caller. */
  hotkey: string;
  /** The normalized hotkey string (canonical modifier order, resolved Mod). */
  normalizedHotkey: string;
  /** Parsed hotkey for efficient event matching. */
  parsedHotkey: ParsedHotkey;
  /** The callback to invoke when the hotkey matches. */
  callback: HotkeyCallback;
  /** Fully resolved options (no undefined values). */
  options: ResolvedHotkeyOptions;
}

/**
 * Hotkey options with all defaults resolved — no optional fields.
 */
export interface ResolvedHotkeyOptions {
  enabled: boolean | (() => boolean);
  preventDefault: boolean;
  stopPropagation: boolean;
  ignoreInputs: boolean | "auto";
  scope: string;
  description: string;
  ignoreRepeat: boolean;
  suppressInDialogs: boolean;
  conflictBehavior: ConflictBehavior;
  target: HTMLElement | Document | null;
}

// ──────────────────────────────────────────────
// Unhandled key callback
// ──────────────────────────────────────────────

/**
 * Reason why a key event was not handled by any registration.
 *
 * - `"no_match"`: No registration matched the key combination in any scope.
 * - `"disabled"`: A registration matched, but its `enabled` option resolved to `false`.
 * - `"input_suppressed"`: A registration matched, but was suppressed because the target is an input element.
 * - `"dialog_suppressed"`: A registration matched, but was suppressed because a dialog is open.
 * - `"repeat_ignored"`: A registration matched, but was skipped because the key is held (`event.repeat`).
 */
export type UnhandledReason = "no_match" | "disabled" | "input_suppressed" | "dialog_suppressed" | "repeat_ignored";

/**
 * Context passed to the unhandled key callback.
 */
export interface UnhandledContext {
  /** The keyboard event that was not handled. */
  readonly event: KeyboardEvent;
  /** Why the event was not handled. */
  readonly reason: UnhandledReason;
  /** The active scope when the event occurred. */
  readonly activeScope: string;
  /** Whether the event target was an editable input element. */
  readonly isInput: boolean;
  /** Whether a UI5 dialog was open. */
  readonly isDialogOpen: boolean;
  /**
   * The registration that matched the key combination but was skipped.
   * Present for all reasons except `"no_match"`.
   */
  readonly skippedRegistration?: HotkeyRegistration;
}

/**
 * Callback invoked when a key event is not handled by any registration.
 *
 * Only fires for events that *could have been* a hotkey (not IME composition
 * or pure modifier presses). Useful for "button not used" feedback or
 * debugging why a shortcut didn't fire.
 */
export type UnhandledCallback = (context: UnhandledContext) => void;
