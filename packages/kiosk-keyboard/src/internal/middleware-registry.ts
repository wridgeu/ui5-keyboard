import type { CompositionMiddleware } from "../types";
import { createKanaDakutenMiddleware } from "../middleware/kana-dakuten";
import { createHangulComposeMiddleware } from "../middleware/hangul-compose";

/** Per-instance middleware factory map for layered resolution. */
export type InstanceMiddleware = ReadonlyMap<string, () => CompositionMiddleware>;

/**
 * Built-in composition middleware factories keyed by layout name.
 *
 * Built eagerly from direct factory imports and sealed at module load: each
 * factory is genuinely referenced here, so a bundler cannot drop it. (The
 * prior side-effect-import self-registration scheme is the pattern that
 * broke in the webc sibling; see issue #108.) There is no public mutation
 * API: per-app middleware is supplied via the `instanceMiddleware` setting
 * on the control.
 */
const BUILTIN_FACTORIES: ReadonlyMap<string, () => CompositionMiddleware> = new Map([
  ["ja-kana", createKanaDakutenMiddleware],
  ["ko-hangul", createHangulComposeMiddleware],
]);

/**
 * Returns the middleware factory for the given layout, or null.
 * Instance overrides take precedence over built-ins.
 *
 * The layout name is normalized (trim + lowercase) to match the layout
 * registry's contract, so a non-normalized `layout` value (e.g. "Ko-Hangul ")
 * renders and composes consistently. Built-in and instance factories are both
 * registered under lowercase keys.
 */
export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  const name = layout.trim().toLowerCase();
  return instanceFactories?.get(name) ?? BUILTIN_FACTORIES.get(name) ?? null;
}
