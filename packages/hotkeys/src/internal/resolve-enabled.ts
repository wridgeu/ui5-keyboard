import Log from "sap/base/Log";

/**
 * Resolves a registration's `enabled` option to a concrete boolean.
 *
 * `enabled` may be a static boolean or a predicate evaluated on every check
 * (`enabled: () => model.getProperty("/canSave")`). A predicate that throws is
 * treated as disabled (returns `false`) and logged once at warning level: the
 * throw is handled - the registration is skipped, dispatch continues - rather
 * than fatal. `label` identifies the registration in the log message (e.g. the
 * quoted normalized hotkey, or the bracketed sequence steps); `logComponent` is
 * the caller's UI5 log component.
 */
export function resolveEnabled(enabled: boolean | (() => boolean), label: string, logComponent: string): boolean {
  if (enabled === true || enabled === false) return enabled;
  try {
    return enabled();
  } catch (error) {
    Log.warning(`enabled() threw for ${label}`, error instanceof Error ? error : String(error), logComponent);
    return false;
  }
}
