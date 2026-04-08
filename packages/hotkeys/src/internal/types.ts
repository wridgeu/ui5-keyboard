import type { ConflictBehavior, HotkeyCallback, ParsedHotkey, SequencePendingCallback } from "../types";

/**
 * Internal representation of a fully resolved hotkey registration.
 * @internal Use {@link HotkeyRegistrationInfo} for public introspection.
 */
export interface HotkeyRegistration {
  /** Unique identifier. */
  id: string;
  /** Whether the registration is still active (set to `false` on unregister). */
  active: boolean;
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
 * Hotkey options with all defaults resolved - no optional fields.
 * @internal
 */
export interface ResolvedHotkeyOptions {
  enabled: boolean | (() => boolean);
  preventDefault: boolean;
  stopPropagation: boolean;
  ignoreInputs: boolean | "auto";
  scope: string;
  description: string;
  ignoreRepeat: boolean;
  suppressInPopups: boolean;
  conflictBehavior: ConflictBehavior;
  target: Element | null;
  targetCallback: (() => Element | null) | null;
}

/**
 * Internal representation of a fully resolved sequence registration.
 * @internal Use {@link SequenceRegistrationInfo} for public introspection.
 */
export interface SequenceRegistration {
  id: string;
  /** Whether the registration is still active (set to `false` on unregister). */
  active: boolean;
  sequence: string[];
  parsedSteps: ParsedHotkey[];
  callback: HotkeyCallback;
  description: string;
  timeout: number;
  scope: string;
  enabled: boolean | (() => boolean);
  ignoreInputs: boolean | "auto";
  preventDefault: boolean;
  stopPropagation: boolean;
  onPending: SequencePendingCallback | null;
}

// ──────────────────────────────────────────────
// Sequence types (internal)
// ──────────────────────────────────────────────

/**
 * Options for registering a key sequence.
 */
export interface SequenceOptions {
  /** Human-readable description. */
  description?: string;
  /** Timeout in ms between keys before the sequence resets. @default 1000 */
  timeout?: number;
  /** Scope - uses HotkeyManager's scope stack. @default "__global__" */
  scope?: string;
  /** Whether the sequence is active. @default true */
  enabled?: boolean | (() => boolean);
  /**
   * Suppress the sequence when an input element is focused.
   * - `true`: Always suppress in inputs.
   * - `false`: Never suppress in inputs.
   * - `"auto"`: Suppress for single keys; allow for Ctrl/Meta combos and Escape.
   * @default "auto"
   */
  ignoreInputs?: boolean | "auto";
  /** Prevent default on the final key. @default true */
  preventDefault?: boolean;
  /** Stop propagation on the final key. @default true */
  stopPropagation?: boolean;
  /**
   * Per-registration callback for mid-sequence progress.
   *
   * Fires after each intermediate key with progress info (completed steps,
   * total steps, next expected key).
   *
   * Dies with the registration - no manual cleanup needed.
   */
  onPending?: SequencePendingCallback;
}

/**
 * Options that can be updated on a live sequence registration via `setOptions()`.
 * Excludes `scope`, which requires unregister + re-register.
 */
export type UpdatableSequenceOptions = Omit<SequenceOptions, "scope">;

/**
 * Handle for managing a sequence registration lifecycle.
 */
export interface SequenceRegistrationHandle {
  /** Unique identifier for this registration. */
  readonly id: string;
  /** Whether this registration is still active (not yet unregistered). */
  readonly isActive: boolean;
  /** The original sequence keys as registered. */
  readonly sequence: string[];
  /** The scope this sequence belongs to. */
  readonly scope: string;
  /** Human-readable description (current value). */
  readonly description: string;
  /** Remove this registration and clean up. */
  unregister(): void;
  /**
   * Update options on a live registration without re-registering.
   * All fields except `scope` can be changed.
   *
   * @param options - Partial options to merge into the registration.
   * @throws Error if the handle has been unregistered or if `scope` is provided.
   */
  setOptions(options: Partial<UpdatableSequenceOptions>): void;
}

/**
 * Public view of a sequence registration for introspection.
 * Flat, serializable shape - no closures, no parsed internals.
 */
export interface SequenceRegistrationInfo {
  readonly id: string;
  readonly sequence: readonly string[];
  readonly scope: string;
  readonly description: string;
  /** Resolved to current value (not the closure). */
  readonly enabled: boolean;
  readonly timeout: number;
  readonly ignoreInputs: boolean | "auto";
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
}
