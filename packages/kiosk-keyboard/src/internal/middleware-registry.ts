import type { CompositionMiddleware } from "../types";

/** Per-instance middleware factory map (optional) for layered resolution. */
export type InstanceMiddleware = ReadonlyMap<string, () => CompositionMiddleware>;

/** Factory functions keyed by layout name. */
const factories: Map<string, () => CompositionMiddleware> = new Map();

/**
 * Original built-in factory references, captured as a side effect of
 * `_registerMiddleware`. Lets `clearCustomMiddleware` restore an
 * overridden built-in to the original on last-instance auto-cleanup
 * instead of leaving the overriding factory in place.
 *
 * Never cleared by `_resetMiddleware` so it survives test sandboxing.
 */
const BUILTIN_ORIGINALS: Map<string, () => CompositionMiddleware> = new Map();

/**
 * Registers a built-in middleware factory for the given layouts.
 * Idempotent: silently skips layouts that already have middleware.
 * Captures the factory reference so `clearCustomMiddleware` can
 * restore an overridden built-in on auto-cleanup.
 * @internal
 */
export function _registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
    if (!BUILTIN_ORIGINALS.has(layout)) {
      BUILTIN_ORIGINALS.set(layout, factory);
    }
    if (factories.has(layout)) continue;
    factories.set(layout, factory);
  }
}

/**
 * Registers a middleware factory for the given layouts.
 * Can override any existing middleware, including built-ins.
 * @public
 */
export function registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
    factories.set(layout, factory);
  }
}

/**
 * Returns the middleware factory for the given layout, or null.
 * Instance overrides take precedence over the global registry.
 */
export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  return instanceFactories?.get(layout) ?? factories.get(layout) ?? null;
}

/**
 * Clears all consumer-registered middleware factories and restores any
 * overridden built-in middleware to its original factory reference.
 * Used by the UI5 control's `exit()` last-instance auto-cleanup to
 * prevent App A's factories from leaking into App B in launchpad /
 * micro-frontend scenarios.
 * @internal
 */
export function clearCustomMiddleware(): void {
  // eslint-disable-next-line unicorn/no-useless-spread -- snapshot keys before deleting during iteration
  for (const layout of [...factories.keys()]) {
    const original = BUILTIN_ORIGINALS.get(layout);
    if (original) {
      factories.set(layout, original);
    } else {
      factories.delete(layout);
    }
  }
}

/**
 * Resets all middleware state. Test-only.
 *
 * Intentionally does not clear `BUILTIN_ORIGINALS`: side-effect imports
 * register built-ins exactly once per module load, so the original
 * factory snapshot must persist across test resets.
 * @internal
 */
export function _resetMiddleware(): void {
  factories.clear();
}
