import type { CompositionMiddleware } from "../types.js";
import { createKanaDakutenMiddleware } from "../middleware/kana-dakuten.js";
import { createHangulComposeMiddleware } from "../middleware/hangul-compose.js";

/**
 * Per-instance middleware factory map (optional) for layered resolution. A stored `null`
 * disables composition for that layout, which is distinct from an absent entry: it is
 * what a custom layout suppressing the `Middleware` facet folds into.
 */
export type InstanceMiddleware = ReadonlyMap<string, (() => CompositionMiddleware) | null>;

/**
 * Built-in composition middleware factories keyed by layout name.
 *
 * Built eagerly from direct factory imports and sealed at module load: each
 * factory is genuinely referenced here, so a bundler cannot drop it. Side-effect
 * imports + `_registerMiddleware` self-registration would not be wired into the
 * production bundle, leaving built-in composition silently unregistered. There
 * is no public mutation API: per-app middleware is supplied via the
 * `instanceMiddleware` property on the element.
 */
const factories: ReadonlyMap<string, () => CompositionMiddleware> = new Map([
  ["ja-kana", createKanaDakutenMiddleware],
  ["ko-hangul", createHangulComposeMiddleware],
]);

/**
 * Returns the middleware factory for the given layout, or null.
 * Instance overrides take precedence over built-ins.
 *
 * The layout name is normalized (trim + lowercase) to match the layout
 * registry's contract, so a mixed-case `layout` attribute (e.g. "Ko-Hangul")
 * renders and composes consistently. Built-in and instance factories are both
 * registered under lowercase keys.
 */
export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  const name = layout.trim().toLowerCase();
  // A declared `null` disables composition for the layout; an absent entry is distinct
  // from it and leaves the built-in factory in force. `??` would collapse the two.
  if (instanceFactories?.has(name)) return instanceFactories.get(name) ?? null;
  return factories.get(name) ?? null;
}
