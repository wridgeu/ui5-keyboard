import type { ConflictBehavior, UnhandledReason } from "./library";

/**
 * The four canonical modifier keys as reported by KeyboardEvent properties.
 */
export type CanonicalModifier = "Control" | "Shift" | "Alt" | "Meta";

// ──────────────────────────────────────────────
// Type-safe Hotkey string union with IDE autocomplete
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
  // The three-modifier tier leaves the key part open: enumerating keys here
  // would push the union near TypeScript's template-literal expansion cap.
  | `${Modifier}+${Modifier}+${Modifier}+${string}`
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
  readonly modifiers: readonly CanonicalModifier[];
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
   * enables dynamic guards without boilerplate in callbacks - e.g.,
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
   * Whether to suppress this hotkey when a UI5 popup (dialog or popover) is open.
   * Uses `sap.m.InstanceManager.hasOpenDialog()` and `hasOpenPopover()` when available.
   * @default true
   */
  suppressInPopups?: boolean;

  /**
   * Strategy for handling a conflicting registration with the same
   * normalized hotkey string and scope.
   * @default "warn"
   */
  conflictBehavior?: ConflictBehavior;

  /**
   * Bind the hotkey to a specific element instead of the document.
   * The hotkey will only fire when the target element appears in the event's
   * `composedPath()`. Scopes still apply - both target and scope must match.
   *
   * Accepts an `Element` for static targets, or a **callback**
   * `() => Element | null` for lazy resolution. The callback is
   * evaluated on each keydown during target matching. Return `null` to
   * skip the registration for that event (e.g., when `getDomRef()` is
   * not yet available).
   *
   * For nested targets with the same key, the innermost matching target fires.
   *
   * **Dispatch order:** Target-scoped handlers fire before untargeted handlers.
   * A target-scoped match with `stopPropagation: true` (the default) prevents
   * untargeted handlers for the same key from firing. Set `stopPropagation: false`
   * on the target-scoped registration to allow both target and untargeted handlers.
   *
   * **Focus fallback (Escape only):** When the browser moves focus to a generic
   * root node (body, UIArea) before dispatching the keydown, the manager
   * reconstructs the path from the most recently focused element. This
   * fallback is limited to the Escape key and consumed after a single use.
   * Other keys are not affected by this behavior.
   */
  target?: Element | (() => Element | null) | null;

  /**
   * Timeout in ms between sequence steps before the sequence resets.
   * Only applies to multi-key sequences (space-separated hotkey strings).
   * Ignored for single-key hotkeys.
   * @default 1000
   */
  timeout?: number;

  /**
   * Progress callback for intermediate sequence steps.
   * Fires after each intermediate key with progress info.
   * Only applies to multi-key sequences. Ignored for single-key hotkeys.
   */
  onPending?: SequencePendingCallback;
}

/**
 * Options that can be updated on a live registration via `setOptions()`.
 * Excludes `scope` and `conflictBehavior`, which require unregister + re-register.
 */
export type UpdatableHotkeyOptions = Omit<HotkeyOptions, "scope" | "conflictBehavior">;

/**
 * Callback for mid-sequence progress.
 */
export type SequencePendingCallback = (info: {
  sequence: string[];
  completedSteps: number;
  totalSteps: number;
  nextKey: string;
}) => void;

/**
 * Handle returned by `HotkeyManager.register()` for managing a registration's lifecycle.
 */
export interface HotkeyRegistrationHandle {
  /** Unique identifier for this registration. */
  readonly id: string;
  /** Whether this registration is still active (not yet unregistered). */
  readonly isActive: boolean;
  /** The original hotkey string as registered. */
  readonly hotkey: string;
  /** The scope this hotkey belongs to. */
  readonly scope: string;
  /** Human-readable description (current value). */
  readonly description: string;
  /** The sequence steps if this is a sequence registration, or `null` for single-key hotkeys. */
  readonly sequence: readonly string[] | null;
  /** Remove this registration and clean up. */
  unregister(): void;
  /**
   * Update options on a live registration without re-registering.
   * All fields except `scope` and `conflictBehavior` can be changed.
   *
   * @param options - Partial options to merge into the registration.
   * @throws Error if the handle has been unregistered, or if `scope` / `conflictBehavior` is provided.
   */
  setOptions(options: Partial<UpdatableHotkeyOptions>): void;
}

/**
 * Public view of a hotkey registration for introspection (e.g., cheat sheets).
 * Flat, serializable shape - no closures, no DOM references.
 */
export interface HotkeyRegistrationInfo {
  readonly id: string;
  readonly hotkey: string;
  readonly normalizedHotkey: string;
  readonly scope: string;
  readonly description: string;
  /** Resolved to current value (not the closure). */
  readonly enabled: boolean;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
  readonly ignoreInputs: boolean | "auto";
  readonly ignoreRepeat: boolean;
  readonly suppressInPopups: boolean;
  readonly conflictBehavior: ConflictBehavior;
  /** Whether a target element is bound (boolean flag, not DOM reference). */
  readonly hasTarget: boolean;
  /** The sequence steps if this is a sequence registration, or `null` for single-key hotkeys. */
  readonly sequence: readonly string[] | null;
  /** The sequence step timeout in ms, or `null` for single-key hotkeys. */
  readonly timeout: number | null;
}

// ──────────────────────────────────────────────
// Unhandled key callback
// ──────────────────────────────────────────────

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
  /** Whether a UI5 popup (dialog or popover) was open. */
  readonly isPopupOpen: boolean;
  /**
   * The registration that matched the key combination but was skipped.
   * Present for all reasons except `"no_match"` and `"suspended"` (no
   * specific registration is evaluated when dispatch is suspended).
   */
  readonly skippedRegistration?: HotkeyRegistrationInfo;
}

/**
 * Callback invoked when a key event is not handled by any registration.
 *
 * Only fires for events that *could have been* a hotkey (not IME composition
 * or pure modifier presses). Useful for "button not used" feedback or
 * debugging why a shortcut didn't fire.
 */
export type UnhandledCallback = (context: UnhandledContext) => void;

// ──────────────────────────────────────────────
// KeyStateTracker (consumer-facing view)
// ──────────────────────────────────────────────

/**
 * Read-only consumer view of the held-key tracker.
 *
 * The concrete `KeyStateTracker` class exposes additional lifecycle
 * methods (`processKeyDown`, `processKeyUp`, `processBlur`, `destroy`)
 * that are `@internal` - this interface hides them so that callers of
 * `HotkeyManager.getKeyStateTracker()` cannot break dispatcher-owned state.
 */
export interface KeyStateTrackerApi {
  /** Get a snapshot of currently held keys. */
  getHeldKeys(): readonly string[];
  /** Check whether a specific key is currently held. */
  isKeyHeld(key: string): boolean;
  /** Set a callback that fires whenever the held keys change. Pass `null` to remove. */
  setChangeCallback(callback: ((keys: readonly string[]) => void) | null): void;
}

// ──────────────────────────────────────────────
// Suspend guard
// ──────────────────────────────────────────────

/**
 * RAII-style guard handle returned by `HotkeyManager.suspendDispatch()`.
 *
 * While active, all hotkey and sequence callbacks are blocked.
 * Call `release()` to resume dispatch. Release is idempotent.
 */
export interface KeyboardDispatchGuard {
  /** Release this guard. Idempotent - double-release does not throw. */
  release(): void;
  /** Whether this guard is still actively suspending dispatch. */
  readonly isActive: boolean;
}
