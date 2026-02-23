import { GLOBAL_SCOPE } from "./constants";

/**
 * Resolve optional scope to a trimmed, non-empty scope ID.
 *
 * - `undefined` => global scope
 * - empty/whitespace string => throws
 */
export function resolveScopeOrGlobal(scope: string | undefined): string {
  if (scope === undefined) return GLOBAL_SCOPE;
  return resolveRequiredScope(scope);
}

/**
 * Resolve a required scope to a trimmed, non-empty scope ID.
 *
 * @throws Error when scope is empty or whitespace-only.
 */
export function resolveRequiredScope(scope: string): string {
  const trimmed = scope.trim();
  if (!trimmed) {
    throw new Error("scope must be a non-empty string when provided");
  }

  return trimmed;
}
