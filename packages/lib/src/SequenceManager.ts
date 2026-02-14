import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
// Side-effect import: ensures Lib.init() runs when this module is loaded (required for lazy library loading)
import "./library";
import HotkeyManager from "./HotkeyManager";
import { GLOBAL_SCOPE } from "./constants";
import { matchesKeyboardEvent } from "./match";
import { parseHotkey } from "./parse";
import { detectPlatform } from "./platform";
import { getEventTarget, isInputElement } from "./dom";
import type { HotkeyCallback, ParsedHotkey, Platform } from "./types";

const LOG_COMPONENT = "ui5.hotkeys.SequenceManager";
const DEFAULT_TIMEOUT = 1000;

let instance: SequenceManager | null = null;
let nextId = 0;

function generateId(): string {
  return `seq_${++nextId}`;
}

/**
 * Options for registering a key sequence.
 */
export interface SequenceOptions {
  /** Human-readable description. */
  description?: string;
  /** Timeout in ms between keys before the sequence resets. @default 1000 */
  timeout?: number;
  /** Scope — uses HotkeyManager's scope stack. @default "__global__" */
  scope?: string;
  /** Whether the sequence is active. @default true */
  enabled?: boolean | (() => boolean);
  /** Suppress the sequence when an input element is focused. @default true */
  ignoreInputs?: boolean;
}

/**
 * Handle for managing a sequence registration lifecycle.
 */
export interface SequenceRegistrationHandle {
  readonly id: string;
  readonly isActive: boolean;
  unregister(): void;
}

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
 * Internal registration record.
 */
interface SequenceRegistration {
  id: string;
  sequence: string[];
  parsedSteps: ParsedHotkey[];
  callback: HotkeyCallback;
  description: string;
  timeout: number;
  scope: string;
  enabled: boolean | (() => boolean);
  ignoreInputs: boolean;
}

/**
 * Tracks in-progress match state for a registration.
 */
interface ActiveMatch {
  registration: SequenceRegistration;
  stepIndex: number;
  timerId: ReturnType<typeof setTimeout>;
}

/**
 * Singleton key sequence manager for UI5 applications.
 *
 * Attaches a document-level `keydown` listener (capture phase) and matches
 * multi-key sequences (e.g., ["G", "E"] for go-to-editor).
 *
 * Uses HotkeyManager's scope stack for scope filtering.
 */
export default class SequenceManager extends BaseObject {
  static readonly metadata = {
    library: "ui5.hotkeys",
  };

  private _registrations: Map<string, SequenceRegistration> = new Map();
  private _activeMatches: ActiveMatch[] = [];
  private _pendingCallback: SequencePendingCallback | null = null;
  private _platform: Platform;
  private _lastAltLocation = 0;

  private readonly _keydownHandler = this._onKeyDown.bind(this);

  constructor() {
    super();
    this._platform = detectPlatform();
    document.addEventListener("keydown", this._keydownHandler, true);
    Log.info("SequenceManager initialized", undefined, LOG_COMPONENT);
  }

  static getInstance(): SequenceManager {
    if (!instance) {
      instance = new SequenceManager();
    }
    return instance;
  }

  /**
   * Register a key sequence.
   *
   * @param sequence - Array of hotkey strings forming the sequence (e.g., ["G", "E"]).
   * @param callback - Function to invoke when the full sequence is matched.
   * @param options - Optional configuration.
   */
  registerSequence(
    sequence: string[],
    callback: HotkeyCallback,
    options?: SequenceOptions,
  ): SequenceRegistrationHandle {
    if (sequence.length < 2) {
      throw new Error("A sequence must have at least 2 steps");
    }

    const id = generateId();
    const parsedSteps = sequence.map((s) => parseHotkey(s, this._platform));

    const registration: SequenceRegistration = {
      id,
      sequence,
      parsedSteps,
      callback,
      description: options?.description ?? "",
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      scope: options?.scope ?? GLOBAL_SCOPE,
      enabled: options?.enabled ?? true,
      ignoreInputs: options?.ignoreInputs ?? true,
    };

    this._registrations.set(id, registration);

    Log.debug(
      `Registered sequence [${sequence.join(", ")}] (id: ${id}, scope: ${registration.scope})`,
      undefined,
      LOG_COMPONENT,
    );

    let active = true;

    return {
      get id() {
        return id;
      },
      get isActive() {
        return active;
      },
      unregister: () => {
        if (!active) return;
        active = false;
        this._registrations.delete(id);
        // Clear any active matches for this registration
        this._activeMatches = this._activeMatches.filter((m) => {
          if (m.registration.id === id) {
            clearTimeout(m.timerId);
            return false;
          }
          return true;
        });
        Log.debug(`Unregistered sequence (id: ${id})`, undefined, LOG_COMPONENT);
      },
    };
  }

  /**
   * Set a callback for mid-sequence progress updates.
   */
  setPendingCallback(callback: SequencePendingCallback | null): void {
    this._pendingCallback = callback;
  }

  /**
   * Get all active registrations.
   */
  getRegistrations(): SequenceRegistration[] {
    return Array.from(this._registrations.values());
  }

  destroy(): void {
    document.removeEventListener("keydown", this._keydownHandler, true);

    for (const match of this._activeMatches) {
      clearTimeout(match.timerId);
    }
    this._activeMatches = [];
    this._registrations.clear();
    this._pendingCallback = null;
    this._lastAltLocation = 0;
    instance = null;
    nextId = 0;

    Log.info("SequenceManager destroyed", undefined, LOG_COMPONENT);
    super.destroy();
  }

  // SequenceManager intentionally couples to HotkeyManager for scope state.
  // getInstance() will create a HotkeyManager if none exists — it never throws.
  private _getActiveScope(): string {
    return HotkeyManager.getInstance().getActiveScope();
  }

  /**
   * Returns true if the event should be ignored entirely (IME, modifier-only, AltGr).
   */
  private _shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
    // IME guard
    if (event.isComposing || event.keyCode === 229) return true;

    const key = event.key;

    // Track Alt key location for AltGr detection (Windows international keyboards).
    // AltGr fires as Ctrl+Alt where the Alt has location === DOM_KEY_LOCATION_RIGHT (2).
    if (key === "Alt") {
      this._lastAltLocation = event.location;
    }

    // Modifier-only guard
    if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return true;

    // AltGr guard — the character key that follows the Ctrl+Alt pair should be ignored
    if (event.ctrlKey && event.altKey && this._lastAltLocation === 2) return true;

    return false;
  }

  private _onKeyDown(event: KeyboardEvent): void {
    if (this._shouldIgnoreKeyEvent(event)) return;

    const activeScope = this._getActiveScope();
    const target = getEventTarget(event);
    const isInput = target !== null && isInputElement(target);

    // 1. Advance or reset existing active matches
    const newActiveMatches: ActiveMatch[] = [];
    let fullMatch: { registration: SequenceRegistration; event: KeyboardEvent } | null = null;

    for (const match of this._activeMatches) {
      clearTimeout(match.timerId);

      const reg = match.registration;

      // If focused into an input mid-sequence, drop matches that suppress in inputs
      if (reg.ignoreInputs && isInput) continue;

      const nextStep = reg.parsedSteps[match.stepIndex];

      if (matchesKeyboardEvent(event, nextStep)) {
        // This key advances the sequence
        if (match.stepIndex + 1 >= reg.parsedSteps.length) {
          // Full match!
          fullMatch = { registration: reg, event };
        } else {
          // Mid-sequence — advance
          const timerId = setTimeout(() => {
            this._activeMatches = this._activeMatches.filter((m) => m !== newMatch);
          }, reg.timeout);
          const newMatch: ActiveMatch = {
            registration: reg,
            stepIndex: match.stepIndex + 1,
            timerId,
          };
          newActiveMatches.push(newMatch);
        }
      }
      // If doesn't match, the active match is dropped (not re-added)
    }

    this._activeMatches = newActiveMatches;

    // If we got a full match, fire it and clear all tracking
    if (fullMatch) {
      for (const m of this._activeMatches) {
        clearTimeout(m.timerId);
      }
      this._activeMatches = [];

      const reg = fullMatch.registration;
      event.preventDefault();
      event.stopPropagation();

      try {
        reg.callback(fullMatch.event, {
          hotkey: reg.sequence.join(" "),
          parsedHotkey: reg.parsedSteps[reg.parsedSteps.length - 1],
          scope: reg.scope,
        });
      } catch (error) {
        Log.error(`Error in sequence callback for [${reg.sequence.join(", ")}]: ${error}`, undefined, LOG_COMPONENT);
      }
      return;
    }

    // 2. Two-pass: check active scope first, then global.
    // Ensures scoped sequences take priority over global ones.
    this._startMatchesForScope(event, activeScope, isInput);
    if (activeScope !== GLOBAL_SCOPE) {
      this._startMatchesForScope(event, GLOBAL_SCOPE, isInput);
    }

    // Fire pending callback for advanced matches (those that progressed from an existing active match)
    if (this._pendingCallback) {
      for (const match of newActiveMatches) {
        this._pendingCallback({
          sequence: match.registration.sequence,
          completedSteps: match.stepIndex,
          totalSteps: match.registration.parsedSteps.length,
          nextKey: match.registration.sequence[match.stepIndex],
        });
      }
    }
  }

  /**
   * Start new sequence matches for registrations in the given scope.
   */
  private _startMatchesForScope(event: KeyboardEvent, scope: string, isInput: boolean): void {
    for (const reg of this._registrations.values()) {
      if (reg.scope !== scope) continue;
      if (reg.ignoreInputs && isInput) continue;

      const enabled = typeof reg.enabled === "function" ? reg.enabled() : reg.enabled;
      if (!enabled) continue;

      const firstStep = reg.parsedSteps[0];
      if (!matchesKeyboardEvent(event, firstStep)) continue;
      if (reg.parsedSteps.length === 1) continue;

      const timerId = setTimeout(() => {
        this._activeMatches = this._activeMatches.filter((m) => m !== newMatch);
      }, reg.timeout);
      const newMatch: ActiveMatch = {
        registration: reg,
        stepIndex: 1,
        timerId,
      };
      this._activeMatches.push(newMatch);

      if (this._pendingCallback) {
        this._pendingCallback({
          sequence: reg.sequence,
          completedSteps: 1,
          totalSteps: reg.parsedSteps.length,
          nextKey: reg.sequence[1],
        });
      }
    }
  }
}
