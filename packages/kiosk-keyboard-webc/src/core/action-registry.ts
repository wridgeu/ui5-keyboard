import type { ActionDefinition } from "../types.js";

/**
 * Per-instance action map for `{action:<name>}` keys.
 *
 * Like the kiosk control, there are **no** built-in actions: the built-in
 * keys (`{shift}`, `{backspace}`, `{enter}`, `{layout:*}`, `{fkey:*}`) stay on
 * the element's hardcoded dispatch path. This map only holds consumer-supplied
 * custom actions, scoped to the element that declared them (the
 * `instanceActions` property).
 */
export type InstanceActions = ReadonlyMap<string, ActionDefinition>;

/**
 * Resolves a registered action by name from a per-instance map. Names are
 * normalized (trim + lowercase) to match the storage normalization, so
 * `{action:Paste}` and `{action:paste}` resolve to the same entry. Returns
 * `undefined` when unregistered.
 */
export function getRegisteredAction(name: string, instanceActions?: InstanceActions): ActionDefinition | undefined {
  if (!instanceActions) return undefined;
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return instanceActions.get(key);
}

/**
 * Parses an `{action:<name>}` / `{action:<name>:<param>}` key token.
 *
 * The trimmed `name` is everything up to the first colon after the prefix
 * (empty for `{action:}`); `param` is everything after it, colons preserved
 * (and may be the empty string for a trailing colon). Returns `null` only when
 * the value is not a complete action token; callers decide how to treat an
 * empty name (dispatch warns, the aria path falls back to the raw value).
 */
export function parseActionToken(value: string): { name: string; param?: string } | null {
  if (!value.startsWith("{action:") || !value.endsWith("}")) return null;
  const raw = value.slice("{action:".length, -1);
  const sep = raw.indexOf(":");
  const name = (sep === -1 ? raw : raw.slice(0, sep)).trim();
  return { name, param: sep === -1 ? undefined : raw.slice(sep + 1) };
}
