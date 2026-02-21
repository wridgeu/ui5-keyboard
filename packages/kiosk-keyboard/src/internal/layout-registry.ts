import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type { LayoutDefinition } from "../types";
import layouts, { DEFAULT_LAYOUT } from "../layouts/index";

/** Built-in layout names that cannot be overwritten by registerLayout. */
const BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(Object.keys(layouts));

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "prototype", "constructor"]);

/** BCP-47 language prefix -> layout name. Checked after exact match. */
const LOCALE_LAYOUT_MAP: Record<string, string> = Object.assign(Object.create(null), {
  de: "qwertz-de",
});

function isSafeMapKey(key: string): boolean {
  return key.length > 0 && !FORBIDDEN_KEYS.has(key);
}

/**
 * Registers a custom keyboard layout that can then be used via
 * `setLayout(name)` or declaratively as `layout="name"` in XML views.
 *
 * Built-in layouts (qwerty, qwertz-de, numeric, special, numpad)
 * cannot be overwritten. Attempting to do so logs a warning and is
 * ignored.
 *
 * @param sName Layout identifier (lowercase, e.g. "azerty-fr")
 * @param oDefinition Array of rows, each containing key definitions
 */
export function registerLayout(sName: string, oDefinition: LayoutDefinition): void {
  const name = sName.toLowerCase();

  if (!isSafeMapKey(name)) {
    Log.warning(`Invalid layout name "${name}".`, undefined, "ui5.kiosk.KioskKeyboard");
    return;
  }

  if (BUILTIN_LAYOUTS.has(name)) {
    Log.warning(
      `Cannot overwrite built-in layout "${name}". Use a different name for custom layouts.`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
    return;
  }

  if (
    !Array.isArray(oDefinition) ||
    oDefinition.length === 0 ||
    !oDefinition.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((key) => key !== null && typeof key === "object" && typeof key.value === "string"),
    )
  ) {
    Log.warning(
      `Invalid layout "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
    return;
  }

  layouts[name] = oDefinition;
}

/**
 * Returns the layout definition for the given name, or undefined
 * if no such layout is registered.
 */
export function getRegisteredLayout(sName: string): LayoutDefinition | undefined {
  return Object.hasOwn(layouts, sName) ? layouts[sName] : undefined;
}

/**
 * Returns the layout for the given name, falling back to
 * {@link DEFAULT_LAYOUT} when the name is not registered.
 */
export function getLayoutOrDefault(sName: string): LayoutDefinition {
  return (Object.hasOwn(layouts, sName) ? layouts[sName] : undefined) ?? layouts[DEFAULT_LAYOUT];
}

/** Returns the names of all registered layouts (built-in + custom). */
export function getRegisteredLayoutNames(): string[] {
  return Object.keys(layouts);
}

/** Returns whether the given layout name is a built-in layout. */
export function isBuiltInLayout(sName: string): boolean {
  return BUILTIN_LAYOUTS.has(sName);
}

/**
 * Registers a mapping from a BCP-47 language tag (or prefix) to a
 * layout name. When no explicit `layout` is provided, the keyboard
 * uses this map to select a locale-appropriate default.
 */
export function registerLocaleLayout(sLocale: string, sLayout: string): void {
  const locale = sLocale.toLowerCase();
  if (!isSafeMapKey(locale)) {
    Log.warning(`Invalid locale map key "${locale}".`, undefined, "ui5.kiosk.KioskKeyboard");
    return;
  }
  LOCALE_LAYOUT_MAP[locale] = sLayout;
}

/**
 * Returns the layout name appropriate for the current UI5 locale.
 *
 * Resolution order:
 * 1. Exact BCP-47 match (e.g. "de-at")
 * 2. Language prefix (e.g. "de")
 * 3. {@link DEFAULT_LAYOUT} fallback ("qwerty")
 */
export function getLocaleLayout(): string {
  const tag = Localization.getLanguageTag();
  const lang = tag.language;
  const region = tag.region;

  // Exact match: "de-at", "pt-br", etc.
  if (region) {
    const exact = LOCALE_LAYOUT_MAP[`${lang}-${region.toLowerCase()}`];
    if (exact) return exact;
  }

  // Language prefix: "de", "fr", etc.
  const prefix = LOCALE_LAYOUT_MAP[lang];
  if (prefix) return prefix;

  return DEFAULT_LAYOUT;
}
