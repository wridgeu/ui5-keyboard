import type { UpdatableHotkeyOptions } from "../types";

/**
 * `scope` and `conflictBehavior` are fixed at registration time. Reject any
 * `setOptions` call that tries to change them. Shared by the hotkey and
 * sequence registration handles.
 */
export function assertImmutableSetOptions(newOptions: Partial<UpdatableHotkeyOptions>): void {
  if ("scope" in newOptions) {
    throw new Error("Cannot change scope via setOptions - unregister and re-register instead");
  }
  if ("conflictBehavior" in newOptions) {
    throw new Error("Cannot change conflictBehavior via setOptions - unregister and re-register instead");
  }
}
