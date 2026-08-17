import Log from "sap/base/Log";
import { GLOBAL_SCOPE } from "./constants";
import { getEventTarget, isInputElement, resolveIgnoreInputs } from "./dom";
import { createIdGenerator } from "./idgen";
import { getCandidateKeys, matchesKeyboardEvent } from "./match";
import { parseHotkey } from "./parse";
import { resolveScopeOrGlobal } from "./scope";
import { resolveEnabled } from "./resolve-enabled";
import type { Platform } from "../library";
import type { HotkeyCallback } from "../types";
import type {
  SequenceOptions,
  SequenceRegistration,
  SequenceRegistrationHandle,
  SequenceRegistrationInfo,
  UpdatableSequenceOptions,
} from "./types";

const LOG_COMPONENT = "ui5.hotkeys.SequenceManager";
const DEFAULT_TIMEOUT = 1000;

const idGen = createIdGenerator("seq_");

function assertValidTimeout(timeout: number): number {
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error(`Invalid sequence timeout "${String(timeout)}": must be a finite number > 0`);
  }
  return timeout;
}

/**
 * Defaults for the options `setOptions` can update in place; the keys are the
 * single definition of that set. `scope` is immutable and `timeout` needs
 * validation, so both sit outside it. The `Omit` type makes a new
 * `SequenceRegistration` field a compile error here until a default is
 * supplied, so the set cannot drift from the registration shape.
 */
const UPDATABLE_OPTION_DEFAULTS: Omit<
  SequenceRegistration,
  "id" | "active" | "sequence" | "parsedSteps" | "callback" | "scope" | "timeout"
> = {
  description: "",
  enabled: true,
  ignoreInputs: "auto",
  preventDefault: true,
  stopPropagation: true,
  onPending: null,
  suppressInPopups: true,
};

type UpdatableOptionKey = keyof typeof UPDATABLE_OPTION_DEFAULTS;

/** Every value an updatable option can hold, as declared on the registration. */
type UpdatableOptionValue = SequenceRegistration[UpdatableOptionKey];

// SAFETY: `UPDATABLE_OPTION_DEFAULTS` is a const object literal that nothing writes to, so
// the strings `Object.keys` returns are exactly the `UpdatableOptionKey` union that
// `keyof typeof` derives from that same literal.
const UPDATABLE_OPTION_KEYS = Object.keys(UPDATABLE_OPTION_DEFAULTS) as UpdatableOptionKey[];

/**
 * Copy every defined updatable option from `source` onto `target`, leaving
 * keys the caller did not set untouched. Drives both `registerSequence`
 * (override defaults) and `setOptions` (live update). `timeout` is validated
 * separately by the callers.
 */
function applyUpdatableOptions(target: SequenceRegistration, source: Partial<UpdatableSequenceOptions>): void {
  for (const key of UPDATABLE_OPTION_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      // SAFETY: `key` ranges over `UPDATABLE_OPTION_KEYS`, so it names a field `target`
      // declares. The assertion restates those fields under their common value type, which
      // is what TypeScript needs to accept a write whose key is a union rather than a single
      // literal; `source` and `target` declare the same type per key.
      (target as Record<UpdatableOptionKey, UpdatableOptionValue>)[key] = value;
    }
  }
}

/**
 * Tracks in-progress match state for a registration.
 */
interface ActiveMatch {
  registration: SequenceRegistration;
  stepIndex: number;
  timerId: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Internal key sequence manager for UI5 applications.
 *
 * Not intended for direct use - access sequence functionality through
 * {@link HotkeyManager.register} with space-separated key format (e.g. `"g i"`).
 *
 * Receives pre-filtered key events from HotkeyManager's document listener
 * (no own listener) and matches multi-key sequences (e.g., ["G", "E"]
 * for go-to-editor).
 *
 * Receives a scope provider callback from HotkeyManager to access the
 * active scope without a reverse singleton dependency.
 */
export default class SequenceManager {
  private _registrations: Map<string, SequenceRegistration> = new Map();
  private _scopeKeyIndex: Map<string, Map<string, Set<SequenceRegistration>>> = new Map();
  private _activeMatches: ActiveMatch[] = [];
  private _platform: Platform;
  private _scopeProvider: () => string;

  constructor(scopeProvider: () => string, platform: Platform) {
    this._scopeProvider = scopeProvider;
    this._platform = platform;
    Log.info("SequenceManager initialized", undefined, LOG_COMPONENT);
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

    const timeout = assertValidTimeout(options?.timeout ?? DEFAULT_TIMEOUT);
    const scope = resolveScopeOrGlobal(options?.scope);
    const sequenceCopy = [...sequence];

    const registration: SequenceRegistration = {
      id,
      active: true,
      sequence: sequenceCopy,
      parsedSteps,
      callback,
      timeout,
      scope,
      ...UPDATABLE_OPTION_DEFAULTS,
    };
    if (options) applyUpdatableOptions(registration, options);

    this._registrations.set(id, registration);
    this._indexRegistration(registration);

    Log.debug(
      `Registered sequence [${sequence.join(", ")}] (id: ${id}, scope: ${registration.scope})`,
      undefined,
      LOG_COMPONENT,
    );

    return {
      get id() {
        return id;
      },
      get isActive() {
        return registration.active;
      },
      get sequence() {
        return [...registration.sequence];
      },
      get scope() {
        return registration.scope;
      },
      get description() {
        return registration.description;
      },
      unregister: () => {
        if (!registration.active) return;
        registration.active = false;
        const reg = this._registrations.get(id);
        if (reg) this._deindexRegistration(reg);
        this._registrations.delete(id);
        this._activeMatches = this._activeMatches.filter((m) => {
          if (m.registration.id === id) {
            clearTimeout(m.timerId);
          }
          return m.registration.id !== id;
        });
        Log.debug(`Unregistered sequence (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<UpdatableSequenceOptions>) => {
        if (!registration.active) {
          throw new Error(`Cannot setOptions on unregistered sequence (id: ${id})`);
        }
        if ("scope" in newOptions) {
          throw new Error("Cannot change scope via setOptions - unregister and re-register instead");
        }
        const reg = this._registrations.get(id);
        if (!reg) return;
        if (newOptions.timeout !== undefined) reg.timeout = assertValidTimeout(newOptions.timeout);
        applyUpdatableOptions(reg, newOptions);
      },
    };
  }

  /**
   * Get all active registrations.
   * Info objects are flat snapshots - no closures or parsed internals leak.
   */
  getRegistrations(): ReadonlyArray<SequenceRegistrationInfo> {
    return Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
  }

  /**
   * Convert an internal registration to the public flat info shape.
   */
  private _toRegistrationInfo(reg: SequenceRegistration): SequenceRegistrationInfo {
    return {
      id: reg.id,
      sequence: [...reg.sequence],
      scope: reg.scope,
      description: reg.description,
      enabled: this._isRegistrationEnabled(reg),
      timeout: reg.timeout,
      ignoreInputs: reg.ignoreInputs,
      preventDefault: reg.preventDefault,
      stopPropagation: reg.stopPropagation,
      suppressInPopups: reg.suppressInPopups,
    };
  }

  destroy(): void {
    for (const match of this._activeMatches) {
      clearTimeout(match.timerId);
    }
    this._activeMatches = [];
    for (const reg of this._registrations.values()) {
      reg.active = false;
    }
    this._registrations.clear();
    this._scopeKeyIndex.clear();

    Log.info("SequenceManager destroyed", undefined, LOG_COMPONENT);
  }

  /**
   * Process a pre-filtered key event from HotkeyManager.
   * The caller is responsible for ignoring IME, modifier-only, and AltGr events.
   */
  processKeyEvent(event: KeyboardEvent, popupOpen: boolean): boolean {
    // Repeated keydown events from a held key must not advance/start sequences.
    if (event.repeat) return false;

    const activeScope = this._scopeProvider();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);
    let consumed = false;

    // 1. Advance or reset existing active matches
    const newActiveMatches: ActiveMatch[] = [];
    let fullMatch: { registration: SequenceRegistration; event: KeyboardEvent } | null = null;

    for (const match of this._activeMatches) {
      clearTimeout(match.timerId);

      const reg = match.registration;
      if (!this._isRegistrationActiveInScope(reg, activeScope)) continue;
      if (!this._isRegistrationEnabled(reg)) continue;
      if (reg.suppressInPopups && popupOpen) continue;

      // match.stepIndex is in [0, parsedSteps.length) by construction.
      const nextStep = reg.parsedSteps[match.stepIndex]!;

      // If focused into an input mid-sequence, drop matches that suppress in inputs
      if (resolveIgnoreInputs(reg.ignoreInputs, nextStep) && isInput) continue;

      if (matchesKeyboardEvent(event, nextStep)) {
        consumed = true;

        // This key advances the sequence
        if (match.stepIndex + 1 >= reg.parsedSteps.length) {
          // Full match! Preserve scope priority: active scope always wins over global.
          if (!fullMatch || (fullMatch.registration.scope !== activeScope && reg.scope === activeScope)) {
            fullMatch = { registration: reg, event };
          }
        } else {
          // Mid-sequence - advance
          const newMatch: ActiveMatch = {
            registration: reg,
            stepIndex: match.stepIndex + 1,
            timerId: undefined,
          };
          newMatch.timerId = setTimeout(() => {
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
        clearTimeout(m.timerId);
      }
      this._activeMatches = [];

      const reg = fullMatch.registration;
      if (reg.preventDefault) event.preventDefault();
      if (reg.stopPropagation) event.stopPropagation();

      try {
        reg.callback(fullMatch.event, {
          hotkey: reg.sequence.join(" "),
          parsedHotkey: reg.parsedSteps.at(-1)!,
          scope: reg.scope,
        });
      } catch (error) {
        Log.error(
          `Sequence callback threw for [${reg.sequence.join(", ")}]`,
          error instanceof Error ? error : String(error),
          LOG_COMPONENT,
        );
      }
      return true;
    }

    // 2. Two-pass: check active scope first, then global.
    // Ensures scoped sequences take priority over global ones.
    let startedMatch = this._startMatchesForScope(event, activeScope, isInput, popupOpen);
    if (activeScope !== GLOBAL_SCOPE) {
      startedMatch = this._startMatchesForScope(event, GLOBAL_SCOPE, isInput, popupOpen) || startedMatch;
    }

    // Fire pending callback for advanced matches (those that progressed from an existing active match)
    for (const match of newActiveMatches) {
      this._firePendingCallback(match.registration, match.stepIndex);
    }

    return consumed || startedMatch;
  }

  private _isRegistrationActiveInScope(reg: SequenceRegistration, activeScope: string): boolean {
    return reg.scope === activeScope || reg.scope === GLOBAL_SCOPE;
  }

  private _isRegistrationEnabled(reg: SequenceRegistration): boolean {
    return resolveEnabled(reg.enabled, `[${reg.sequence.join(", ")}]`, LOG_COMPONENT);
  }

  private _indexRegistration(reg: SequenceRegistration): void {
    // Registrations are guaranteed non-empty: register() rejects empty sequences.
    const firstKey = reg.parsedSteps[0]!.key;
    let keyMap = this._scopeKeyIndex.get(reg.scope);
    if (!keyMap) {
      keyMap = new Map();
      this._scopeKeyIndex.set(reg.scope, keyMap);
    }
    let regSet = keyMap.get(firstKey);
    if (!regSet) {
      regSet = new Set();
      keyMap.set(firstKey, regSet);
    }
    regSet.add(reg);
  }

  private _deindexRegistration(reg: SequenceRegistration): void {
    // Registrations are guaranteed non-empty: register() rejects empty sequences.
    const firstKey = reg.parsedSteps[0]!.key;
    const keyMap = this._scopeKeyIndex.get(reg.scope);
    if (!keyMap) return;
    const regSet = keyMap.get(firstKey);
    if (!regSet) return;
    regSet.delete(reg);
    if (regSet.size === 0) {
      keyMap.delete(firstKey);
      if (keyMap.size === 0) {
        this._scopeKeyIndex.delete(reg.scope);
      }
    }
  }

  /**
   * Start new sequence matches for registrations in the given scope.
   */
  private _startMatchesForScope(event: KeyboardEvent, scope: string, isInput: boolean, popupOpen: boolean): boolean {
    const keyMap = this._scopeKeyIndex.get(scope);
    if (!keyMap) return false;

    let started = false;
    const candidateKeys = getCandidateKeys(event);

    for (const candidateKey of candidateKeys) {
      const regSet = keyMap.get(candidateKey);
      if (!regSet) continue;

      for (const reg of regSet) {
        const firstStep = reg.parsedSteps[0]!;
        if (resolveIgnoreInputs(reg.ignoreInputs, firstStep) && isInput) continue;

        if (!this._isRegistrationEnabled(reg)) continue;
        if (reg.suppressInPopups && popupOpen) continue;

        if (!matchesKeyboardEvent(event, firstStep)) continue;

        const newMatch: ActiveMatch = {
          registration: reg,
          stepIndex: 1,
          timerId: undefined,
        };
        newMatch.timerId = setTimeout(() => {
          this._activeMatches = this._activeMatches.filter((m) => m !== newMatch);
        }, reg.timeout);
        this._activeMatches.push(newMatch);
        started = true;

        this._firePendingCallback(reg, 1);
      }
    }

    return started;
  }

  private _firePendingCallback(reg: SequenceRegistration, stepIndex: number): void {
    const callback = reg.onPending;
    if (!callback) return;

    try {
      callback({
        sequence: [...reg.sequence],
        completedSteps: stepIndex,
        totalSteps: reg.parsedSteps.length,
        // stepIndex is < sequence.length when this fires (callers gate on mid-sequence progress).
        nextKey: reg.sequence[stepIndex]!,
      });
    } catch (error) {
      Log.error(
        `Sequence pending callback threw for [${reg.sequence.join(", ")}], step ${stepIndex}`,
        error instanceof Error ? error : String(error),
        LOG_COMPONENT,
      );
    }
  }
}
