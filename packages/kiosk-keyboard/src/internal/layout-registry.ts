import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type { LayoutDefinition } from "../types";
import DEFAULT_LAYOUT from "../layouts/default-layout";
import qwerty from "../layouts/qwerty";
import qwertzDe from "../layouts/qwertz-de";
import numeric from "../layouts/numeric";
import special from "../layouts/special";
import numpad from "../layouts/numpad";
import fkeys from "../layouts/fkeys";
import nav from "../layouts/nav";
import qwertyFk from "../layouts/qwerty-fk";
import qwertzDeFk from "../layouts/qwertz-de-fk";
import qwertyNav from "../layouts/qwerty-nav";
import qwertzDeNav from "../layouts/qwertz-de-nav";
import jaRomaji from "../layouts/ja-romaji";
import jaKana from "../layouts/ja-kana";
import arabic from "../layouts/arabic";

// ── Middleware self-registration (side-effect imports) ──
import "../middleware/kana-dakuten";

const layouts: Map<string, LayoutDefinition> = new Map([
  ["qwerty", qwerty],
  ["qwertz-de", qwertzDe],
  ["numeric", numeric],
  ["special", special],
  ["numpad", numpad],
  ["fkeys", fkeys],
  ["nav", nav],
  ["qwerty-fk", qwertyFk],
  ["qwertz-de-fk", qwertzDeFk],
  ["qwerty-nav", qwertyNav],
  ["qwertz-de-nav", qwertzDeNav],
  ["ja-romaji", jaRomaji],
  ["ja-kana", jaKana],
  ["arabic", arabic],
]);

/** Built-in layout names. Used by isBuiltInLayout and unregisterLayout protection. */
const BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(layouts.keys());

const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
]);

/** BCP-47 language prefix -> layout name. Checked after exact match. */
const LOCALE_LAYOUT_MAP: Map<string, string> = new Map(DEFAULT_LOCALE_LAYOUT_MAP);

function isRegisteredLayout(layout: string): boolean {
  return layouts.has(layout);
}

/**
 * Normalizes an input to a trimmed lowercase string.
 * Returns `undefined` for non-string or empty-after-trim values, logging a warning.
 */
function normalizeLowerString(value: unknown, argName: string): string | undefined {
  if (typeof value !== "string") {
    Log.warning(`Invalid ${argName}: expected a string.`, undefined, "ui5.kiosk.KioskKeyboard");
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    Log.warning(`Invalid ${argName}: must be a non-empty string.`, undefined, "ui5.kiosk.KioskKeyboard");
    return undefined;
  }
  return trimmed;
}

function resolveLocaleMappedLayout(locale: string): string | null {
  const mappedLayout = LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  return isRegisteredLayout(mappedLayout) ? mappedLayout : null;
}

/**
 * Registers a custom keyboard layout that can then be used via
 * `setLayout(name)` or declaratively as `layout="name"` in XML views.
 *
 * Can override any layout, including built-ins. Validates structure
 * before registering.
 *
 * @param sName Layout identifier (lowercase, e.g. "azerty-fr")
 * @param oDefinition Array of rows, each containing key definitions
 */
export function registerLayout(sName: string, oDefinition: LayoutDefinition): void {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return;

  if (
    !Array.isArray(oDefinition) ||
    oDefinition.length === 0 ||
    !oDefinition.every(
      (row) => Array.isArray(row) && row.length > 0 && row.every((key) => typeof key?.value === "string" && key.value),
    )
  ) {
    Log.warning(
      `Invalid layout "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
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
    Log.warning(`Cannot remove built-in layout "${name}".`, undefined, "ui5.kiosk.KioskKeyboard");
    return;
  }

  layouts.delete(name);
}

/**
 * Removes all custom layouts and keeps built-in layouts intact.
 */
export function resetCustomLayouts(): void {
  // eslint-disable-next-line unicorn/no-useless-spread -- snapshot keys before deleting during iteration
  for (const layoutName of [...layouts.keys()]) {
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
 * {@link DEFAULT_LAYOUT} when the name is not registered.
 */
export function getLayoutOrDefault(sName: string): LayoutDefinition {
  const name = normalizeLowerString(sName, "layout name");
  const fallback = layouts.get(DEFAULT_LAYOUT);
  if (!fallback) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
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
 * Registers a mapping from a BCP-47 language tag (or prefix) to a
 * layout name. When no explicit `layout` is provided, the keyboard
 * uses this map to select a locale-appropriate default.
 *
 * The mapping is stored even if `sLayout` does not refer to a currently
 * registered layout (a warning is logged in that case). This allows
 * locale mappings to be set up before the custom layout is registered
 * via {@link registerLayout}. The mapping takes effect as soon as the
 * target layout exists.
 */
export function registerLocaleLayout(sLocale: string, sLayout: string): void {
  const locale = normalizeLowerString(sLocale, "locale map key");
  const layout = normalizeLowerString(sLayout, "layout map value");
  if (!locale || !layout) return;

  if (!isRegisteredLayout(layout)) {
    Log.warning(
      `Locale "${locale}" maps to unknown layout "${layout}". It will be used once the layout is registered.`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
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
 * Returns the layout name appropriate for the current UI5 locale.
 *
 * Resolution order:
 * 1. Exact BCP-47 match (e.g. "de-at")
 * 2. Language prefix (e.g. "de")
 * 3. {@link DEFAULT_LAYOUT} fallback ("qwerty")
 */
export function getLocaleLayout(): string {
  const tag = Localization.getLanguageTag();
  const lang = tag.language.toLowerCase();
  const region = tag.region;

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
