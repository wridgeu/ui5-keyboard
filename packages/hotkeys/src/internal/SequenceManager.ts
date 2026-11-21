import Log from "sap/base/Log";
import { GLOBAL_SCOPE } from "./constants";
import { assertImmutableSetOptions } from "./immutable-options";
import { getEventTarget, isInputElement, resolveIgnoreInputs } from "./dom";
import { getCandidateKeys, matchesKeyboardEvent } from "./match";
import { parseHotkey } from "./parse";
import { resolveScopeOrGlobal } from "./scope";
import { resolveEnabled } from "./resolve-enabled";
import { ConflictBehavior } from "../library";
import type { Platform } from "../library";
import type {
  HotkeyCallback,
  HotkeyRegistrationHandle,
  HotkeyRegistrationInfo,
  UpdatableHotkeyOptions,
} from "../types";
import type { SequenceOptions, SequenceRegistration } from "./types";

const LOG_COMPONENT = "ui5.hotkeys.SequenceManager";
const DEFAULT_TIMEOUT = 1000;

/** Monotonic source of sequence-registration ids. Never repeats for the page lifetime. */
let idSeq = 0;

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
  "id" | "active" | "hotkey" | "sequence" | "parsedSteps" | "callback" | "scope" | "timeout"
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
function applyUpdatableOptions(target: SequenceRegistration, source: SequenceOptions): void {
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
 * Receives pre-filtered key events from the EventDispatcher's `window` listener
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
   * @param hotkey - The hotkey string as provided by the caller (e.g., "G E").
   * @param sequence - Array of hotkey strings forming the sequence (e.g., ["G", "E"]).
   * @param callback - Function to invoke when the full sequence is matched.
   * @param options - Optional configuration.
   */
  registerSequence(
    hotkey: string,
    sequence: string[],
    callback: HotkeyCallback,
    options?: SequenceOptions,
  ): HotkeyRegistrationHandle {
    const id = `seq_${++idSeq}`;
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
      hotkey,
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
      get hotkey() {
        return registration.hotkey;
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
        this._deindexRegistration(registration);
        this._registrations.delete(id);
        this._activeMatches = this._activeMatches.filter((m) => {
          if (m.registration.id === id) {
            clearTimeout(m.timerId);
          }
          return m.registration.id !== id;
        });
        Log.debug(`Unregistered sequence (id: ${id})`, undefined, LOG_COMPONENT);
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        assertImmutableSetOptions(newOptions);
        if (!registration.active) {
          throw new Error(`Cannot setOptions on unregistered sequence (id: ${id})`);
        }
        if (newOptions.timeout !== undefined) registration.timeout = assertValidTimeout(newOptions.timeout);
        applyUpdatableOptions(registration, newOptions);
      },
    };
  }

  /**
   * Get all active registrations.
   * Info objects are flat snapshots - no closures or parsed internals leak.
   */
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    return Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
  }

  /**
   * Convert an internal registration to the public flat info shape. The
   * hotkey-only fields hold the fixed values a sequence always has: repeats
   * ignored, the default conflict behavior, no element target.
   */
  private _toRegistrationInfo(reg: SequenceRegistration): HotkeyRegistrationInfo {
    const hotkey = reg.sequence.join(" ");
    return {
      id: reg.id,
      hotkey,
      normalizedHotkey: hotkey,
      scope: reg.scope,
      description: reg.description,
      enabled: this._isRegistrationEnabled(reg),
      preventDefault: reg.preventDefault,
      stopPropagation: reg.stopPropagation,
      ignoreInputs: reg.ignoreInputs,
      ignoreRepeat: true,
      suppressInPopups: reg.suppressInPopups,
      conflictBehavior: ConflictBehavior.Warn,
      hasTarget: false,
      sequence: [...reg.sequence],
      timeout: reg.timeout,
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
   *
   * The next match state is computed and committed before any sequence or
   * `onPending` callback runs, so a callback that unregisters a sequence or
   * destroys the manager acts on settled state.
   */
  processKeyEvent(event: KeyboardEvent, popupOpen: boolean): boolean {
    // Repeated keydown events from a held key must not advance/start sequences.
    if (event.repeat) return false;

    const activeScope = this._scopeProvider();
    const target = getEventTarget(event);
    const isInput = isInputElement(target);
    let consumed = false;

    const advanced: ActiveMatch[] = [];
    let fullMatch: SequenceRegistration | null = null;

    for (const match of this._activeMatches) {
      clearTimeout(match.timerId);
      // A match this key does not advance is dropped (not re-added).
      if (!this._stepMatches(match, event, activeScope, isInput, popupOpen)) continue;
      consumed = true;

      const reg = match.registration;
      if (match.stepIndex + 1 >= reg.parsedSteps.length) {
        // An active-scope registration beats a global one.
        if (!fullMatch || (fullMatch.scope !== activeScope && reg.scope === activeScope)) {
          fullMatch = reg;
        }
      } else {
        advanced.push(this._createMatch(reg, match.stepIndex + 1));
      }
    }

    if (fullMatch) {
      for (const m of advanced) {
        clearTimeout(m.timerId);
      }
      this._activeMatches = [];
      this._fireSequence(fullMatch, event);
      return true;
    }

    // Active scope first, so scoped sequences report progress before global ones.
    const started = this._startMatchesForScope(event, activeScope, isInput, popupOpen);
    if (activeScope !== GLOBAL_SCOPE) {
      started.push(...this._startMatchesForScope(event, GLOBAL_SCOPE, isInput, popupOpen));
    }

    this._activeMatches = [...advanced, ...started];

    for (const match of [...started, ...advanced]) {
      this._firePendingCallback(match.registration, match.stepIndex);
    }

    return consumed || started.length > 0;
  }

  /** A match at `stepIndex` that drops itself from the active matches after the registration's timeout. */
  private _createMatch(registration: SequenceRegistration, stepIndex: number): ActiveMatch {
    const match: ActiveMatch = { registration, stepIndex, timerId: undefined };
    match.timerId = setTimeout(() => {
      this._activeMatches = this._activeMatches.filter((m) => m !== match);
    }, registration.timeout);
    return match;
  }

  /**
   * Whether `event` is the next step of `match`, for a registration that is
   * live in the active scope, enabled, and not suppressed by an open popup or
   * a focused input.
   */
  private _stepMatches(
    match: ActiveMatch,
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
  ): boolean {
    const reg = match.registration;
    if (!this._isRegistrationActiveInScope(reg, activeScope)) return false;
    if (!this._isRegistrationEnabled(reg)) return false;
    if (reg.suppressInPopups && popupOpen) return false;
    // match.stepIndex is in [0, parsedSteps.length) by construction.
    const nextStep = reg.parsedSteps[match.stepIndex]!;
    // If focused into an input mid-sequence, drop matches that suppress in inputs
    if (resolveIgnoreInputs(reg.ignoreInputs, nextStep) && isInput) return false;
    return matchesKeyboardEvent(event, nextStep);
  }

  /** Runs a completed sequence's callback, honoring its preventDefault/stopPropagation options. */
  private _fireSequence(reg: SequenceRegistration, event: KeyboardEvent): void {
    if (reg.preventDefault) event.preventDefault();
    if (reg.stopPropagation) event.stopPropagation();
    try {
      reg.callback(event, {
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
   * New matches for the registrations in `scope` whose first step is `event`.
   */
  private _startMatchesForScope(
    event: KeyboardEvent,
    scope: string,
    isInput: boolean,
    popupOpen: boolean,
  ): ActiveMatch[] {
    const started: ActiveMatch[] = [];
    const keyMap = this._scopeKeyIndex.get(scope);
    if (!keyMap) return started;

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

        started.push(this._createMatch(reg, 1));
      }
    }

    return started;
  }

  /**
   * Skips a registration that an earlier callback of the same keydown
   * unregistered, directly or by destroying the manager.
   */
  private _firePendingCallback(reg: SequenceRegistration, stepIndex: number): void {
    if (!reg.active) return;
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
