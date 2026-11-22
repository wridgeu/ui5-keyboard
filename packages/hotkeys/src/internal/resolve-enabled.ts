import Log from "sap/base/Log";

/**
 * Resolves a registration's `enabled` option to a concrete boolean.
 *
 * `enabled` may be a static boolean or a predicate evaluated on every check
 * (`enabled: () => model.getProperty("/canSave")`). A predicate that throws
 * counts as disabled and logs a warning on each evaluation. `label` names the
 * registration in that log; `logComponent` is the caller's.
 */
export function resolveEnabled(enabled: boolean | (() => boolean), label: string, logComponent: string): boolean {
  if (typeof enabled !== "function") return enabled;
  try {
    return enabled();
  } catch (error) {
    Log.warning(`enabled() threw for ${label}`, error instanceof Error ? error : String(error), logComponent);
    return false;
  }
}
