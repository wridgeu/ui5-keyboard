import type { LayoutDefinition } from "../types.js";
import DEFAULT_LAYOUT from "../layouts/default-layout.js";

// Module-level singleton - shared across all component instances (and across
// micro-frontends if they import the same module). Sealed at module load by
// the side-effect `_registerBuiltInLayout` calls in `layouts/*.ts`. There is
// no public mutation API: per-app customization is done via the
// `instanceLayouts` / `instanceLocaleLayouts` properties on the element.
const layouts: Map<string, LayoutDefinition> = new Map();

/** Built-in layout names. Populated by `_registerBuiltInLayout`. */
const BUILTIN_LAYOUTS: Set<string> = new Set();

/**
 * Registers a built-in layout. Idempotent: silently skips if the name
 * is already registered. Used internally by self-registering layout modules.
 * @internal
 */
export function _registerBuiltInLayout(name: string, def: LayoutDefinition): void {
  if (layouts.has(name)) return;
  layouts.set(name, def);
  BUILTIN_LAYOUTS.add(name);
}

/**
 * Layouts that serve as secondary views (not base alphabetic layouts).
 *
 * Keep in sync with `packages/kiosk-keyboard/src/internal/types.ts`. The kiosk
 * package re-declares the same set; sharing is intentionally avoided so each
 * package owns its module graph.
 */
export const SECONDARY_LAYOUTS: ReadonlySet<string> = new Set(["numeric", "special", "fkeys", "nav"]);

/**
 * Built-in BCP-47 prefix -> layout name. Sealed at module load. Per-app
 * customization is done via the `instanceLocaleLayouts` property.
 */
const BUILTIN_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
  ["ko", "ko-hangul"],
  ["es", "qwerty-es"],
]);

/** Per-instance layout map (optional) for layered resolution. */
export type InstanceLayouts = ReadonlyMap<string, LayoutDefinition>;

/** Per-instance locale map (optional) for layered resolution. */
export type InstanceLocaleLayouts = ReadonlyMap<string, string>;

/**
 * Normalizes an input to a trimmed lowercase string.
 * Returns `undefined` for non-string or empty-after-trim values, logging a warning.
 * Used by public APIs to guard against plain-JS callers passing non-strings.
 */
function normalizeLowerString(value: unknown, argName: string): string | undefined {
  if (typeof value !== "string") {
    console.warn(`[kiosk-keyboard] Invalid ${argName}: expected a string.`);
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    console.warn(`[kiosk-keyboard] Invalid ${argName}: must be a non-empty string.`);
    return undefined;
  }
  return trimmed;
}

function resolveLocaleMappedLayout(
  locale: string,
  instanceLocaleLayouts?: InstanceLocaleLayouts,
  instanceLayouts?: InstanceLayouts,
): string | null {
  const mappedLayout = instanceLocaleLayouts?.get(locale) ?? BUILTIN_LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  if (instanceLayouts?.has(mappedLayout) || layouts.has(mappedLayout)) {
    return mappedLayout;
  }
  return null;
}

/**
 * Returns the layout definition for the given name, or undefined
 * if no such layout is registered. Instance overrides take precedence.
 * @internal
 */
export function getRegisteredLayout(rawName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition | undefined {
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return undefined;
  return instanceLayouts?.get(name) ?? layouts.get(name);
}

/**
 * Returns the layout for the given name, falling back to
 * the default layout when the name is not registered.
 *
 * Resolution order: instance map -> built-in registry -> default layout.
 * @internal
 */
export function getLayoutOrDefault(rawName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition {
  const fallback = instanceLayouts?.get(DEFAULT_LAYOUT) ?? layouts.get(DEFAULT_LAYOUT);
  if (!fallback) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return fallback;
  return instanceLayouts?.get(name) ?? layouts.get(name) ?? fallback;
}

/**
 * Returns the names of all built-in layouts. Instance-only layouts are
 * intentionally not included here -- they are scoped to the element that
 * declared them and are not exposed as a global view.
 * @internal
 */
export function getRegisteredLayoutNames(): string[] {
  return [...layouts.keys()];
}

/**
 * Returns whether the given layout name is a built-in layout.
 * @internal
 */
export function isBuiltInLayout(rawName: string): boolean {
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return false;
  return BUILTIN_LAYOUTS.has(name);
}

/**
 * Returns the layout name appropriate for the current browser locale.
 *
 * Uses `navigator.language` + `Intl.Locale` for BCP47 parsing (replaces
 * `sap/base/i18n/Localization.getLanguageTag()`).
 *
 * Resolution order:
 * 1. Exact BCP-47 match (e.g. "de-at"), instance map first then built-in
 * 2. Language prefix (e.g. "de"), instance map first then built-in
 * 3. Default layout fallback ("qwerty")
 * @internal
 */
export function getLocaleLayout(
  instanceLocaleLayouts?: InstanceLocaleLayouts,
  instanceLayouts?: InstanceLayouts,
): string {
  try {
    const locale = new Intl.Locale(navigator.language);
    const lang = locale.language.toLowerCase();
    const region = locale.region;

    // Exact match: "de-at", "pt-br", etc.
    if (region) {
      const exact = resolveLocaleMappedLayout(
        `${lang}-${region.toLowerCase()}`,
        instanceLocaleLayouts,
        instanceLayouts,
      );
      if (exact) return exact;
    }

    // Language prefix: "de", "fr", etc.
    const prefix = resolveLocaleMappedLayout(lang, instanceLocaleLayouts, instanceLayouts);
    if (prefix) return prefix;
  } catch {
    // navigator.language can be empty or malformed in embedded contexts;
    // Intl.Locale() throws RangeError for invalid BCP-47 tags.
  }

  return DEFAULT_LAYOUT;
}
