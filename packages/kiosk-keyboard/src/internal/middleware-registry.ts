import type { CompositionMiddleware } from "../types";

/** Per-instance middleware factory map for layered resolution. */
export type InstanceMiddleware = ReadonlyMap<string, () => CompositionMiddleware>;

/**
 * Built-in composition middleware factories keyed by layout name.
 *
 * Sealed after the side-effect imports of `../middleware/kana-dakuten` and
 * `../middleware/hangul-compose` run during module load. There is no public
 * mutation API: per-app middleware is supplied via the `instanceMiddleware`
 * setting on the control / element.
 */
const BUILTIN_FACTORIES: Map<string, () => CompositionMiddleware> = new Map();

/**
 * Registers a built-in middleware factory for the given layouts. Idempotent:
 * silently skips layouts that already have middleware. Only the built-in
 * middleware modules call this -- it is not part of the public API.
 * @internal
 */
export function _registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
    if (BUILTIN_FACTORIES.has(layout)) continue;
    BUILTIN_FACTORIES.set(layout, factory);
  }
}

/**
 * Returns the middleware factory for the given layout, or null.
 * Instance overrides take precedence over built-ins.
 */
export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  return instanceFactories?.get(layout) ?? BUILTIN_FACTORIES.get(layout) ?? null;
}
