import Log from "sap/base/Log";
import { ConflictBehavior } from "../library";
import type RegistrationStore from "./registration-store";
import type { HotkeyRegistration, ResolvedTarget } from "./types";

// Internal collaborators log under the public HotkeyManager component.
const LOG_COMPONENT = "ui5.hotkeys.HotkeyManager";

/**
 * Resolves registration conflicts (same normalized hotkey, same scope, same
 * target) according to the requested {@link ConflictBehavior}. Operates on the
 * shared registration store.
 */
export default class ConflictResolver {
  constructor(private readonly _store: RegistrationStore) {}

  /**
   * Handle a conflict for a hotkey being registered or retargeted: remove
   * existing matches (Replace), throw (Error), warn (Warn), or do nothing
   * (Allow). `self` is the registration being retargeted; its own entry is
   * never a conflict.
   */
  resolve(
    normalizedHotkey: string,
    scope: string,
    target: ResolvedTarget,
    conflictBehavior: ConflictBehavior,
    self?: HotkeyRegistration,
  ): void {
    if (conflictBehavior === ConflictBehavior.Allow) return;

    // Callback targets resolve to an element only at dispatch time, so they
    // cannot be compared here; skip conflict handling for them.
    if (target?.kind === "callback") {
      Log.debug(
        `Conflict check skipped for callback-target hotkey "${normalizedHotkey}" in scope "${scope}" ` +
          `(callback targets are resolved at dispatch time).`,
        undefined,
        LOG_COMPONENT,
      );
      return;
    }

    const bucket = this._store.getBucket(scope);
    if (!bucket) return;
    const regs = target === null ? bucket.untargeted : this._store.getTargetRegistrations(bucket, target.el);
    if (!regs || regs.size === 0) return;

    const isConflicting = (reg: HotkeyRegistration): boolean =>
      reg !== self && reg.normalizedHotkey === normalizedHotkey;

    if (conflictBehavior === ConflictBehavior.Replace) {
      // Collect ALL matches so we remove every conflicting registration
      const conflicts: HotkeyRegistration[] = [];
      for (const reg of regs) {
        if (isConflicting(reg)) {
          conflicts.push(reg);
        }
      }
      for (const reg of conflicts) {
        this._store.remove(reg);
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
    for (const reg of regs) {
      if (isConflicting(reg)) {
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
