import Log from "sap/base/Log";
import { UnhandledReason } from "../library";
import { GLOBAL_SCOPE } from "./constants";
import { findMatchInScope } from "./dispatch-core";
import { matchesKeyboardEvent } from "./match";
import { recordSkip, type SkipInfo } from "./skip-reason";
import type RegistrationIndex from "./registration-index";
import type FocusFallbackTracker from "./FocusFallbackTracker";
import type { HotkeyRegistration } from "./types";
import type { HotkeyRegistrationInfo } from "../types";

// Kept as the HotkeyManager component so existing log output is unchanged.
const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

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
    private readonly _registrations: Map<string, HotkeyRegistration>,
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

    for (const scope of scopesToCheck) {
      const bucket = this._index.getBucket(scope);
      if (!bucket || bucket.targets.size === 0) continue;

      // Iterate composedPath from index 0 (innermost) outward
      for (const node of eventPath) {
        const ids = this._index.getTargetRegistrationIds(bucket, node);
        if (!ids || ids.size === 0) continue;

        // Attempt matching against registrations bound to this target
        const registrations = this._index.getRegistrationsFromIds(ids);
        const matched = findMatchInScope({
          event,
          isInput,
          popupOpen,
          registrations,
          skipInfo,
          toRegistrationInfo: this._toRegistrationInfo,
          logComponent: LOG_COMPONENT,
        });

        if (matched) {
          return matched;
        }
      }
    }

    // Pass 1b: callback-target registrations - resolve lazily and check path.
    for (const scope of scopesToCheck) {
      const bucket = this._index.getBucket(scope);
      if (!bucket || bucket.callbackTargetIds.size === 0) continue;

      for (const id of bucket.callbackTargetIds) {
        const reg = this._registrations.get(id);
        if (!reg) continue;

        let resolved: Element | null;
        try {
          resolved = reg.options.targetCallback!();
        } catch (error) {
          Log.warning(`target callback threw for "${reg.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
          continue;
        }

        if (!resolved || !pathSet.has(resolved)) {
          if (resolved && skipInfo) {
            // Target resolved but not in path
            if (matchesKeyboardEvent(event, reg.parsedHotkey)) {
              recordSkip(skipInfo, UnhandledReason.TargetMismatch, reg, this._toRegistrationInfo);
            }
          }
          continue;
        }

        const matched = findMatchInScope({
          event,
          isInput,
          popupOpen,
          registrations: [reg],
          skipInfo,
          toRegistrationInfo: this._toRegistrationInfo,
          logComponent: LOG_COMPONENT,
        });
        if (matched) return matched;
      }
    }

    // Skip-reason pass for off-path targets: record TargetMismatch for
    // registrations whose key combo matches but target is not in the path.
    if (skipInfo) {
      for (const scope of scopesToCheck) {
        const bucket = this._index.getBucket(scope);
        if (!bucket) continue;

        for (const [targetNode, ids] of bucket.targets) {
          if (pathSet.has(targetNode)) continue; // Already checked in main pass
          if (targetNode instanceof Element && !targetNode.isConnected) continue; // Skip detached DOM refs

          for (const id of ids) {
            const reg = this._registrations.get(id);
            if (reg && matchesKeyboardEvent(event, reg.parsedHotkey)) {
              recordSkip(skipInfo, UnhandledReason.TargetMismatch, reg, this._toRegistrationInfo);
            }
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
