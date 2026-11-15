import type { ConflictBehavior } from "../library";
import type { HotkeyCallback, HotkeyOptions, ParsedHotkey, SequencePendingCallback } from "../types";

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
 * Resolved target binding for a hotkey registration: untargeted (`null`),
 * a static element, or a callback resolved lazily at dispatch time.
 * @internal
 */
export type ResolvedTarget = { kind: "element"; el: Element } | { kind: "callback"; fn: () => Element | null } | null;

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
  target: ResolvedTarget;
}

/**
 * Internal representation of a fully resolved sequence registration.
 *
 * Extends a record over every {@link SequenceOptions} key, so a field added to
 * `HotkeyOptions` becomes a required member here and fails to compile until
 * the registration stores it.
 * @internal Use {@link HotkeyRegistrationInfo} (from `../types`) for public introspection.
 */
export interface SequenceRegistration extends Record<keyof SequenceOptions, unknown> {
  id: string;
  /** Whether the registration is still active (set to `false` on unregister). */
  active: boolean;
  /** The original hotkey string as provided by the caller. */
  hotkey: string;
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
  suppressInPopups: boolean;
}

/**
 * The hotkey options a sequence registration honours: every `HotkeyOptions`
 * field except those that only apply to a single-key hotkey. A sequence always
 * ignores key repeat, has no conflict handling and no element target.
 * @internal
 */
export type SequenceOptions = Omit<HotkeyOptions, "target" | "conflictBehavior" | "ignoreRepeat">;
