import BaseObject from "sap/ui/base/Object";
import Log from "sap/base/Log";
// Side-effect import: ensures Lib.init() runs even when this module is imported directly
import "./library";
import HotkeyManager from "./HotkeyManager";
import { GLOBAL_SCOPE } from "./constants";
import { getEventTarget, isInputElement, resolveIgnoreInputs, shouldIgnoreKeyEvent } from "./dom";
import { createIdGenerator } from "./idgen";
import { matchesKeyboardEvent } from "./match";
import { parseHotkey } from "./parse";
import { detectPlatform } from "./platform";
import type { HotkeyCallback, ParsedHotkey, Platform } from "./types";

const LOG_COMPONENT = "ui5.hotkeys.SequenceManager";
const DEFAULT_TIMEOUT = 1000;

let instance: SequenceManager | null = null;
const idGen = createIdGenerator("seq_");

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
  /**
   * Suppress the sequence when an input element is focused.
   * - `true`: Always suppress in inputs.
   * - `false`: Never suppress in inputs.
   * - `"auto"`: Suppress for single keys; allow for Ctrl/Meta combos and Escape.
   * @default true
   */
  ignoreInputs?: boolean | "auto";
  /** Prevent default on the final key. @default true */
  preventDefault?: boolean;
  /** Stop propagation on the final key. @default true */
  stopPropagation?: boolean;
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
  readonly id: string;
  readonly isActive: boolean;
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
  ignoreInputs: boolean | "auto";
  preventDefault: boolean;
  stopPropagation: boolean;
}

/**
 * Tracks in-progress match state for a registration.
 */
interface ActiveMatch {
  registration: SequenceRegistration;
  stepIndex: number;
  timerId: ReturnType<typeof setTimeout> | null;
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
  private _destroyed = false;

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

    const id = idGen.next();
    const parsedSteps = sequence.map((s, i) => {
      try {
        return parseHotkey(s, this._platform);
      } catch (e) {
        throw new Error(
          `Invalid sequence step ${i} ("${s}") in [${sequence.join(", ")}]: ${e instanceof Error ? e.message : String(e)}`,
          { cause: e },
        );
      }
    });

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
      preventDefault: options?.preventDefault ?? true,
      stopPropagation: options?.stopPropagation ?? true,
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
            if (m.timerId !== null) clearTimeout(m.timerId);
          }
          return m.registration.id !== id;
        });
        Log.debug(`Unregistered sequence (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<UpdatableSequenceOptions>) => {
        if (!active) {
          throw new Error(`Cannot setOptions on unregistered sequence (id: ${id})`);
        }
        if ((newOptions as Record<string, unknown>).scope !== undefined) {
          throw new Error("Cannot change scope via setOptions — unregister and re-register instead");
        }
        const reg = this._registrations.get(id);
        if (!reg) return;
        if (newOptions.enabled !== undefined) reg.enabled = newOptions.enabled;
        if (newOptions.description !== undefined) reg.description = newOptions.description;
        if (newOptions.timeout !== undefined) reg.timeout = newOptions.timeout;
        if (newOptions.ignoreInputs !== undefined) reg.ignoreInputs = newOptions.ignoreInputs;
        if (newOptions.preventDefault !== undefined) reg.preventDefault = newOptions.preventDefault;
        if (newOptions.stopPropagation !== undefined) reg.stopPropagation = newOptions.stopPropagation;
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
    this._destroyed = true;
    document.removeEventListener("keydown", this._keydownHandler, true);

    for (const match of this._activeMatches) {
      if (match.timerId !== null) clearTimeout(match.timerId);
    }
    this._activeMatches = [];
    this._registrations.clear();
    this._pendingCallback = null;
    this._lastAltLocation = 0;
    instance = null;

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
   * Tracks AltGr state and delegates to the shared pure function.
   */
  private _shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
    if (event.key === "Alt") {
      this._lastAltLocation = event.location;
    }
    return shouldIgnoreKeyEvent(event, this._platform, this._lastAltLocation);
  }

  private _onKeyDown(event: KeyboardEvent): void {
    if (this._shouldIgnoreKeyEvent(event)) return;

    const activeScope = this._getActiveScope();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);

    // 1. Advance or reset existing active matches
    const newActiveMatches: ActiveMatch[] = [];
    let fullMatch: { registration: SequenceRegistration; event: KeyboardEvent } | null = null;

    for (const match of this._activeMatches) {
      if (match.timerId !== null) clearTimeout(match.timerId);

      const reg = match.registration;
      const nextStep = reg.parsedSteps[match.stepIndex];

      // If focused into an input mid-sequence, drop matches that suppress in inputs
      if (resolveIgnoreInputs(reg.ignoreInputs, nextStep.ctrl, nextStep.meta, nextStep.key) && isInput) continue;

      if (matchesKeyboardEvent(event, nextStep)) {
        // This key advances the sequence
        if (match.stepIndex + 1 >= reg.parsedSteps.length) {
          // Full match!
          fullMatch = { registration: reg, event };
        } else {
          // Mid-sequence — advance
          const newMatch: ActiveMatch = {
            registration: reg,
            stepIndex: match.stepIndex + 1,
            timerId: null,
          };
          newMatch.timerId = setTimeout(() => {
            if (this._destroyed) return;
            this._activeMatches = this._activeMatches.filter((m) => m !== newMatch);
          }, reg.timeout);
          newActiveMatches.push(newMatch);
        }
      }
      // If doesn't match, the active match is dropped (not re-added)
    }

    this._activeMatches = [...newActiveMatches];

    // If we got a full match, fire it and clear all tracking
    if (fullMatch) {
      for (const m of this._activeMatches) {
        if (m.timerId !== null) clearTimeout(m.timerId);
      }
      this._activeMatches = [];

      const reg = fullMatch.registration;
      if (reg.preventDefault) event.preventDefault();
      if (reg.stopPropagation) event.stopPropagation();

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
    for (const match of newActiveMatches) {
      this._firePendingCallback(match.registration, match.stepIndex);
    }
  }

  /**
   * Start new sequence matches for registrations in the given scope.
   */
  private _startMatchesForScope(event: KeyboardEvent, scope: string, isInput: boolean): void {
    for (const reg of this._registrations.values()) {
      if (reg.scope !== scope) continue;

      const firstStep = reg.parsedSteps[0];
      if (resolveIgnoreInputs(reg.ignoreInputs, firstStep.ctrl, firstStep.meta, firstStep.key) && isInput) continue;

      let enabled: boolean;
      try {
        enabled = typeof reg.enabled === "function" ? reg.enabled() : reg.enabled;
      } catch (error) {
        Log.error(
          `Error evaluating enabled() for sequence [${reg.sequence.join(", ")}]: ${error}`,
          undefined,
          LOG_COMPONENT,
        );
        enabled = false;
      }
      if (!enabled) continue;

      if (!matchesKeyboardEvent(event, firstStep)) continue;
      if (reg.parsedSteps.length === 1) continue;

      const newMatch: ActiveMatch = {
        registration: reg,
        stepIndex: 1,
        timerId: null,
      };
      newMatch.timerId = setTimeout(() => {
        if (this._destroyed) return;
        this._activeMatches = this._activeMatches.filter((m) => m !== newMatch);
      }, reg.timeout);
      this._activeMatches.push(newMatch);

      this._firePendingCallback(reg, 1);
    }
  }

  private _firePendingCallback(reg: SequenceRegistration, stepIndex: number): void {
    this._pendingCallback?.({
      sequence: reg.sequence,
      completedSteps: stepIndex,
      totalSteps: reg.parsedSteps.length,
      nextKey: reg.sequence[stepIndex],
    });
  }
}
