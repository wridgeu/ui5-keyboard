import type { CompositionMiddleware } from "../types.js";

/** Factory functions keyed by layout name. */
const factories: Map<string, () => CompositionMiddleware> = new Map();

/**
 * Registers a built-in middleware factory for the given layouts.
 * Idempotent: silently skips layouts that already have middleware.
 * @internal
 */
export function _registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
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
 */
export function getMiddlewareFactory(layout: string): (() => CompositionMiddleware) | null {
  return factories.get(layout) ?? null;
}

/**
 * Removes all registered middleware factories (built-in and custom).
 * Used by tests to isolate state between cases.
 * @internal
 */
export function _resetMiddleware(): void {
  factories.clear();
}
