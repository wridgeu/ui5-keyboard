import type { CompositionMiddleware } from "../types.js";

/** Per-instance middleware factory map (optional) for layered resolution. */
export type InstanceMiddleware = ReadonlyMap<string, () => CompositionMiddleware>;

/**
 * Built-in composition middleware factories keyed by layout name.
 *
 * Sealed after the side-effect imports of the built-in middleware modules
 * run during module load. There is no public mutation API: per-app
 * middleware is supplied via the `instanceMiddleware` property on the element.
 */
const factories: Map<string, () => CompositionMiddleware> = new Map();

/**
 * Registers a built-in middleware factory for the given layout.
 * Idempotent: silently skips a layout that already has middleware. Only the
 * built-in middleware modules call this -- it is not part of the public API.
 * @internal
 */
export function _registerMiddleware(layout: string, factory: () => CompositionMiddleware): void {
  if (factories.has(layout)) return;
  factories.set(layout, factory);
}

/**
 * Returns the middleware factory for the given layout, or null.
 * Instance overrides take precedence over built-ins.
 */
export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  return instanceFactories?.get(layout) ?? factories.get(layout) ?? null;
}
