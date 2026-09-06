import Log from "sap/base/Log";
import { UnhandledReason } from "../library";
import { GLOBAL_SCOPE } from "./constants";
import { findMatchInScope, type FindMatchOptions } from "./dispatch-core";
import { matchesKeyboardEvent } from "./match";
import { recordSkip, type SkipInfo } from "./skip-reason";
import type RegistrationIndex from "./registration-index";
import type FocusFallbackTracker from "./FocusFallbackTracker";
import type { HotkeyRegistration } from "./types";
import type { HotkeyRegistrationInfo } from "../types";

// Internal collaborators log under the public HotkeyManager component.
const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

/** The per-event half of `findMatchInScope`'s options; each pass supplies its own registrations. */
type MatchOptions = Omit<FindMatchOptions, "registrations">;

/**
 * The keydown matching engine. Finds the single winning registration for an
 * event (target-scoped innermost-first, then untargeted), records skip reasons
 * for the unhandled-callback, and leaves execution
 * (preventDefault/stopPropagation/callback) to the manager.
 *
 * Reads the shared registration index and map; resolves the event path through
 * the focus-fallback tracker; maps registrations to public info via the
 * injected callback (the manager owns that conversion).
 */
export default class HotkeyMatcher {
  constructor(
    private readonly _index: RegistrationIndex,
    private readonly _focusFallback: FocusFallbackTracker,
    private readonly _toRegistrationInfo: (reg: HotkeyRegistration) => HotkeyRegistrationInfo,
  ) {}

  /**
   * Match target-scoped registrations via composedPath(), innermost-first.
   *
   * Scope-first ordering: active scope targets checked before global scope targets.
   * The innermost matching target wins - once a match is found, return immediately.
   *
   * Returns the single matched registration, or null.
   */
  matchTargeted(
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
    skipInfo: SkipInfo | null,
  ): HotkeyRegistration | null {
    const eventPath = this._getEventPath(event);
    const pathSet = new Set(eventPath);
    const scopesToCheck = activeScope !== GLOBAL_SCOPE ? [activeScope, GLOBAL_SCOPE] : [GLOBAL_SCOPE];
    const matchOpts: MatchOptions = {
      event,
      isInput,
      popupOpen,
      skipInfo,
      toRegistrationInfo: this._toRegistrationInfo,
      logComponent: LOG_COMPONENT,
    };

    return (
      this._matchOnPath(eventPath, scopesToCheck, matchOpts) ??
      this._matchCallbackTargets(pathSet, scopesToCheck, matchOpts) ??
      this._recordOffPathSkips(pathSet, scopesToCheck, event, skipInfo)
    );
  }

  /** Pass 1a: element-target registrations, innermost path node first. */
  private _matchOnPath(eventPath: EventTarget[], scopes: string[], matchOpts: MatchOptions): HotkeyRegistration | null {
    for (const scope of scopes) {
      const bucket = this._index.getBucket(scope);
      if (!bucket || bucket.targets.size === 0) continue;

      // Iterate composedPath from index 0 (innermost) outward
      for (const node of eventPath) {
        const ids = this._index.getTargetRegistrationIds(bucket, node);
        if (!ids || ids.size === 0) continue;

        const matched = findMatchInScope({ ...matchOpts, registrations: this._index.getRegistrationsFromIds(ids) });
        if (matched) return matched;
      }
    }
    return null;
  }

  /** Pass 1b: callback-target registrations, resolved lazily and matched only with the target on the path. */
  private _matchCallbackTargets(
    pathSet: ReadonlySet<EventTarget>,
    scopes: string[],
    matchOpts: MatchOptions,
  ): HotkeyRegistration | null {
    const { event, skipInfo } = matchOpts;
    for (const scope of scopes) {
      const bucket = this._index.getBucket(scope);
      if (!bucket || bucket.callbackTargetIds.size === 0) continue;

      for (const id of bucket.callbackTargetIds) {
        const reg = this._index.getRegistration(id);
        if (!reg) continue;

        // callbackTargetIds only ever holds callback-target registrations.
        const target = reg.options.target;
        if (target?.kind !== "callback") continue;

        let resolved: Element | null;
        try {
          resolved = target.fn();
        } catch (error) {
          Log.warning(`target callback threw for "${reg.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
          continue;
        }

        if (!resolved || !pathSet.has(resolved)) {
          // Target resolved but not in path
          if (resolved && skipInfo && matchesKeyboardEvent(event, reg.parsedHotkey)) {
            recordSkip(skipInfo, UnhandledReason.TargetMismatch, reg, this._toRegistrationInfo);
          }
          continue;
        }

        const matched = findMatchInScope({ ...matchOpts, registrations: [reg] });
        if (matched) return matched;
      }
    }
    return null;
  }

  /**
   * Skip-reason pass for off-path targets: records TargetMismatch for
   * registrations whose key combo matches but whose target is not in the path.
   * Matches nothing, so it always yields `null` for the caller's chain.
   */
  private _recordOffPathSkips(
    pathSet: ReadonlySet<EventTarget>,
    scopes: string[],
    event: KeyboardEvent,
    skipInfo: SkipInfo | null,
  ): null {
    if (!skipInfo) return null;
    for (const scope of scopes) {
      const bucket = this._index.getBucket(scope);
      if (!bucket) continue;

      for (const [targetNode, ids] of bucket.targets) {
        if (pathSet.has(targetNode)) continue; // Already checked in main pass
        if (targetNode instanceof Element && !targetNode.isConnected) continue; // Skip detached DOM refs

        for (const id of ids) {
          const reg = this._index.getRegistration(id);
          if (reg && matchesKeyboardEvent(event, reg.parsedHotkey)) {
            recordSkip(skipInfo, UnhandledReason.TargetMismatch, reg, this._toRegistrationInfo);
          }
        }
      }
    }
    return null;
  }

  /**
   * Match untargeted registrations (two-pass: active scope → global).
   */
  matchUntargeted(
    event: KeyboardEvent,
    activeScope: string,
    isInput: boolean,
    popupOpen: boolean,
    skipInfo: SkipInfo | null,
  ): HotkeyRegistration | null {
    const matchOpts = {
      event,
      isInput,
      popupOpen,
      toRegistrationInfo: this._toRegistrationInfo,
      logComponent: LOG_COMPONENT,
    };

    // Active scope first
    const activeScopeMatch = findMatchInScope({
      ...matchOpts,
      registrations: this._index.getUntargetedRegistrations(activeScope),
      skipInfo,
    });
    if (activeScopeMatch) return activeScopeMatch;

    // Global scope fallback
    if (activeScope !== GLOBAL_SCOPE) {
      return findMatchInScope({
        ...matchOpts,
        registrations: this._index.getUntargetedRegistrations(GLOBAL_SCOPE),
        skipInfo,
      });
    }

    return null;
  }

  /**
   * Get the event's composed path with a defensive fallback.
   */
  private _getEventPath(event: KeyboardEvent): EventTarget[] {
    const path = event.composedPath?.();
    const resolvedPath =
      path && path.length > 0
        ? [...path]
        : [event.target, document, window].filter((x): x is EventTarget => x !== null && x !== undefined);

    this._focusFallback.augmentPath(event, resolvedPath);

    return resolvedPath;
  }
}
