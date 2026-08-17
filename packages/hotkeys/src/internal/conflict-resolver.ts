import Log from "sap/base/Log";
import { ConflictBehavior } from "../library";
import type RegistrationIndex from "./registration-index";
import type { HotkeyRegistration, ResolvedTarget } from "./types";

// Internal collaborators log under the public HotkeyManager component.
const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

/**
 * Resolves registration conflicts (same normalized hotkey, same scope, same
 * target) according to the requested {@link ConflictBehavior}. Operates on the
 * shared registration index and registration map.
 */
export default class ConflictResolver {
  constructor(
    private readonly _index: RegistrationIndex,
    private readonly _remove: (reg: HotkeyRegistration) => void,
  ) {}

  /**
   * Handle a conflict for a newly-registering hotkey: remove existing matches
   * (Replace), throw (Error), warn (Warn), or do nothing (Allow).
   */
  resolve(normalizedHotkey: string, scope: string, target: ResolvedTarget, conflictBehavior: ConflictBehavior): void {
    if (conflictBehavior === ConflictBehavior.Allow) return;

    // Callback (lazy) targets resolve to an element only at dispatch time, so two
    // callback-target hotkeys cannot be compared by element here. Matching them by
    // hotkey alone produced false conflicts - a blocking throw (Error) or a silent
    // removal (Replace) of a registration that may target a different element. Skip
    // conflict handling for them; genuine overlaps are resolved at dispatch time.
    if (target?.kind === "callback") {
      Log.debug(
        `Conflict check skipped for callback-target hotkey "${normalizedHotkey}" in scope "${scope}" ` +
          `(callback targets are resolved at dispatch time).`,
        undefined,
        LOG_COMPONENT,
      );
      return;
    }

    // Use scope-bucket lookup instead of iterating all registrations
    const bucket = this._index.getBucket(scope);
    if (!bucket) return;
    const ids = target === null ? bucket.untargetedIds : this._index.getTargetRegistrationIds(bucket, target.el);
    if (!ids || ids.size === 0) return;

    const isConflicting = (reg: HotkeyRegistration): boolean => reg.normalizedHotkey === normalizedHotkey;

    if (conflictBehavior === ConflictBehavior.Replace) {
      // Collect ALL matches so we remove every conflicting registration
      const conflicts: HotkeyRegistration[] = [];
      for (const id of ids) {
        const reg = this._index.getRegistration(id);
        if (reg && isConflicting(reg)) {
          conflicts.push(reg);
        }
      }
      for (const reg of conflicts) {
        this._remove(reg);
        Log.debug(
          `Replaced existing hotkey "${normalizedHotkey}" (id: ${reg.id}) in scope "${scope}"`,
          undefined,
          LOG_COMPONENT,
        );
      }
      return;
    }

    // For "warn" and "error", first match is sufficient
    let conflicting: HotkeyRegistration | null = null;
    for (const id of ids) {
      const reg = this._index.getRegistration(id);
      if (reg && isConflicting(reg)) {
        conflicting = reg;
        break;
      }
    }

    if (!conflicting) return;

    if (conflictBehavior === ConflictBehavior.Error) {
      throw new Error(
        `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}).`,
      );
    }

    // "warn"
    Log.warning(
      `Hotkey "${normalizedHotkey}" is already registered in scope "${scope}" (id: ${conflicting.id}). ` +
        `Existing registration keeps priority unless conflictBehavior is "replace".`,
      undefined,
      LOG_COMPONENT,
    );
  }
}
