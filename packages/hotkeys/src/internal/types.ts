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
