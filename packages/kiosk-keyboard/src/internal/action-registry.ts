import type { ActionDefinition } from "../types";

/**
 * Per-instance action map for `{action:<name>}` keys.
 *
 * Unlike the layout and middleware registries, there are **no** built-in
 * actions: the built-in keys (`{shift}`, `{backspace}`, `{enter}`,
 * `{layout:*}`, `{fkey:*}`) stay on the control's hardcoded dispatch path.
 * This map only holds consumer-supplied custom actions, scoped to the control
 * that declared them (supplied via the `instanceActions` setting).
 */
export type InstanceActions = ReadonlyMap<string, ActionDefinition>;

/**
 * Resolves a registered action by name from a per-instance map. Names are
 * normalized (trim + lowercase) to match the storage normalization in
 * `KioskKeyboard._toActionMap`, so `{action:Paste}` and `{action:paste}`
 * resolve to the same entry. Returns `undefined` when unregistered.
 */
export function getRegisteredAction(name: string, instanceActions?: InstanceActions): ActionDefinition | undefined {
  if (!instanceActions) return undefined;
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return instanceActions.get(key);
}
