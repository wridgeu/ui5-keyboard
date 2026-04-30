import type { LayoutDefinition } from "../types.js";
import DEFAULT_LAYOUT from "../layouts/default-layout.js";

// Module-level singleton - shared across all component instances (and across
// micro-frontends if they import the same module). This is intentional so
// that layouts registered once are available to all <kiosk-keyboard> elements.
const layouts: Map<string, LayoutDefinition> = new Map();

/** Built-in layout names. Used by unregisterLayout and resetCustomLayouts to protect the built-in set. */
const BUILTIN_LAYOUTS: Set<string> = new Set();

/** Original built-in definitions, preserved so overrides can be reverted. */
const BUILTIN_ORIGINALS: Map<string, LayoutDefinition> = new Map();

/**
 * Registers a built-in layout. Idempotent: silently skips if the name
 * is already registered. Used internally by self-registering layout modules.
 * @internal
 */
export function _registerBuiltInLayout(name: string, def: LayoutDefinition): void {
  if (layouts.has(name)) return;
  layouts.set(name, def);
  BUILTIN_LAYOUTS.add(name);
  BUILTIN_ORIGINALS.set(name, def);
}

/** Layouts that serve as secondary views (not base alphabetic layouts). */
export const SECONDARY_LAYOUTS: ReadonlySet<string> = new Set(["numeric", "special", "fkeys", "nav"]);

const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
  ["ko", "ko-hangul"],
  ["es", "qwerty-es"],
]);

/** BCP-47 language prefix -> layout name. Checked after exact match. */
const LOCALE_LAYOUT_MAP: Map<string, string> = new Map(DEFAULT_LOCALE_LAYOUT_MAP);

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
  const mappedLayout = instanceLocaleLayouts?.get(locale) ?? LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  if (instanceLayouts?.has(mappedLayout) || layouts.has(mappedLayout)) {
    return mappedLayout;
  }
  return null;
}

/**
 * Registers a custom keyboard layout. Can override any layout, including
 * built-ins. Validates structure before registering.
 * @internal
 */
export function registerLayout(rawName: string, definition: LayoutDefinition): void {
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return;

  if (
    !Array.isArray(definition) ||
    definition.length === 0 ||
    !definition.every(
      (row) => Array.isArray(row) && row.length > 0 && row.every((key) => typeof key?.value === "string" && key.value),
    )
  ) {
    console.warn(
      `[kiosk-keyboard] Invalid layout "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
    );
    return;
  }

  layouts.set(name, definition);
}

/**
 * Removes a previously registered custom layout. If the name belongs to a
 * built-in layout that was overridden via {@link registerLayout}, the
 * original built-in definition is restored.
 * @internal
 */
export function unregisterLayout(rawName: string): void {
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return;

  const original = BUILTIN_ORIGINALS.get(name);
  if (original) {
    layouts.set(name, original);
    return;
  }

  layouts.delete(name);
}

/**
 * Removes all custom layouts and keeps built-in layouts intact.
 * @internal
 */
export function resetCustomLayouts(): void {
  // eslint-disable-next-line unicorn/no-useless-spread -- snapshot keys before deleting during iteration
  for (const layoutName of [...layouts.keys()]) {
    if (!BUILTIN_LAYOUTS.has(layoutName)) {
      layouts.delete(layoutName);
    }
  }
  // Restore any overridden built-ins to their original definitions
  for (const [name, def] of BUILTIN_ORIGINALS) {
    layouts.set(name, def);
  }
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
 * Resolution order: instance map -> global registry -> default layout.
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
 * Returns the names of all registered layouts (built-in + custom).
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
 * Registers a mapping from a BCP-47 language tag (or prefix) to a layout name.
 * @internal
 */
export function registerLocaleLayout(rawLocale: string, rawLayout: string): void {
  const locale = normalizeLowerString(rawLocale, "locale map key");
  const layout = normalizeLowerString(rawLayout, "layout map value");
  if (!locale || !layout) return;

  if (!layouts.has(layout)) {
    console.warn(
      `[kiosk-keyboard] Locale "${locale}" maps to unknown layout "${layout}". It will be used once the layout is registered.`,
    );
  }

  LOCALE_LAYOUT_MAP.set(locale, layout);
}

/**
 * Removes a locale -> layout mapping.
 * @internal
 */
export function unregisterLocaleLayout(rawLocale: string): void {
  const locale = normalizeLowerString(rawLocale, "locale map key");
  if (!locale) return;

  LOCALE_LAYOUT_MAP.delete(locale);
}

/**
 * Resets locale mappings to the built-in defaults.
 * @internal
 */
export function resetLocaleLayouts(): void {
  LOCALE_LAYOUT_MAP.clear();
  for (const [k, v] of DEFAULT_LOCALE_LAYOUT_MAP) {
    LOCALE_LAYOUT_MAP.set(k, v);
  }
}

/**
 * Returns the layout name appropriate for the current browser locale.
 *
 * Uses `navigator.language` + `Intl.Locale` for BCP47 parsing (replaces
 * `sap/base/i18n/Localization.getLanguageTag()`).
 *
 * Resolution order:
 * 1. Exact BCP-47 match (e.g. "de-at")
 * 2. Language prefix (e.g. "de")
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
