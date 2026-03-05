import type { LayoutDefinition } from "../types.js";
import DEFAULT_LAYOUT from "../layouts/default-layout.js";
import builtInLayouts from "../layouts/index.js";

// Module-level singleton — shared across all component instances (and across
// micro-frontends if they import the same module). This is intentional so
// that layouts registered once are available to all <kiosk-keyboard> elements.
const layouts: Map<string, LayoutDefinition> = new Map(builtInLayouts);

/** Built-in layout names that cannot be overwritten by registerLayout. */
const BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(layouts.keys());

const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([["de", "qwertz-de"]]);

/** BCP-47 language prefix -> layout name. Checked after exact match. */
const LOCALE_LAYOUT_MAP: Map<string, string> = new Map(DEFAULT_LOCALE_LAYOUT_MAP);

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

function resolveLocaleMappedLayout(locale: string): string | null {
  const mappedLayout = LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  return layouts.has(mappedLayout) ? mappedLayout : null;
}

/**
 * Registers a custom keyboard layout.
 *
 * Built-in layouts cannot be overwritten. Attempting to do so logs a warning.
 */
export function registerLayout(sName: string, oDefinition: LayoutDefinition): void {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return;

  if (BUILTIN_LAYOUTS.has(name)) {
    console.warn(
      `[kiosk-keyboard] Cannot overwrite built-in layout "${name}". Use a different name for custom layouts.`,
    );
    return;
  }

  if (
    !Array.isArray(oDefinition) ||
    oDefinition.length === 0 ||
    !oDefinition.every(
      (row) => Array.isArray(row) && row.length > 0 && row.every((key) => typeof key?.value === "string" && key.value),
    )
  ) {
    console.warn(
      `[kiosk-keyboard] Invalid layout "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
    );
    return;
  }

  layouts.set(name, oDefinition);
}

/**
 * Removes a previously registered custom layout.
 * Built-in layouts cannot be removed.
 */
export function unregisterLayout(sName: string): void {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return;

  if (BUILTIN_LAYOUTS.has(name)) {
    console.warn(`[kiosk-keyboard] Cannot remove built-in layout "${name}".`);
    return;
  }

  layouts.delete(name);
}

/**
 * Removes all custom layouts and keeps built-in layouts intact.
 */
export function resetCustomLayouts(): void {
  for (const layoutName of layouts.keys()) {
    if (!BUILTIN_LAYOUTS.has(layoutName)) {
      layouts.delete(layoutName);
    }
  }
}

/**
 * Returns the layout definition for the given name, or undefined
 * if no such layout is registered.
 */
export function getRegisteredLayout(sName: string): LayoutDefinition | undefined {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return undefined;
  return layouts.get(name);
}

/**
 * Returns the layout for the given name, falling back to
 * the default layout when the name is not registered.
 */
export function getLayoutOrDefault(sName: string): LayoutDefinition {
  const fallback = layouts.get(DEFAULT_LAYOUT);
  if (!fallback) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return fallback;
  return layouts.get(name) ?? fallback;
}

/** Returns the names of all registered layouts (built-in + custom). */
export function getRegisteredLayoutNames(): string[] {
  return [...layouts.keys()];
}

/** Returns whether the given layout name is a built-in layout. */
export function isBuiltInLayout(sName: string): boolean {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return false;
  return BUILTIN_LAYOUTS.has(name);
}

/**
 * Registers a mapping from a BCP-47 language tag (or prefix) to a layout name.
 */
export function registerLocaleLayout(sLocale: string, sLayout: string): void {
  const locale = normalizeLowerString(sLocale, "locale map key");
  const layout = normalizeLowerString(sLayout, "layout map value");
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
 */
export function unregisterLocaleLayout(sLocale: string): void {
  const locale = normalizeLowerString(sLocale, "locale map key");
  if (!locale) return;

  LOCALE_LAYOUT_MAP.delete(locale);
}

/**
 * Resets locale mappings to the built-in defaults.
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
 */
export function getLocaleLayout(): string {
  const locale = new Intl.Locale(navigator.language);
  const lang = locale.language.toLowerCase();
  const region = locale.region;

  // Exact match: "de-at", "pt-br", etc.
  if (region) {
    const exact = resolveLocaleMappedLayout(`${lang}-${region.toLowerCase()}`);
    if (exact) return exact;
  }

  // Language prefix: "de", "fr", etc.
  const prefix = resolveLocaleMappedLayout(lang);
  if (prefix) return prefix;

  return DEFAULT_LAYOUT;
}
