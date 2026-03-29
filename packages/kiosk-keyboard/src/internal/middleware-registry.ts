import type { CompositionMiddleware } from "../types";

/** Factory functions keyed by layout name. */
const factories: Map<string, () => CompositionMiddleware> = new Map();

/** Active middleware instances keyed by layout name. Lazily created. */
const instances: Map<string, CompositionMiddleware> = new Map();

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
    instances.delete(layout);
  }
}

/**
 * Returns the active middleware instance for the given layout, or null.
 * Lazily creates the instance from the registered factory on first call.
 */
export function getMiddlewareForLayout(layout: string): CompositionMiddleware | null {
  if (!factories.has(layout)) return null;
  let instance = instances.get(layout);
  if (!instance) {
    instance = factories.get(layout)!();
    instances.set(layout, instance);
  }
  return instance;
}

/**
 * Deactivates middleware for a layout: commits any pending composition
 * and discards the instance.
 */
export function deactivateMiddleware(layout: string): void {
  const instance = instances.get(layout);
  if (instance) {
    instance.commit();
    instances.delete(layout);
  }
}

/**
 * Resets all middleware state. Test-only.
 * @internal
 */
export function _resetMiddleware(): void {
  for (const instance of instances.values()) {
    instance.reset();
  }
  instances.clear();
  factories.clear();
}
