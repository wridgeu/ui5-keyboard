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
import jaRomaji from "../layouts/ja-romaji";
import jaKana from "../layouts/ja-kana";
import arabic from "../layouts/arabic";
import koHangul from "../layouts/ko-hangul";
import qwertyEs from "../layouts/qwerty-es";

// ── Middleware self-registration (side-effect imports) ──
import "../middleware/kana-dakuten";
import "../middleware/hangul-compose";

const layouts: Map<string, LayoutDefinition> = new Map([
  ["qwerty", qwerty],
  ["qwertz-de", qwertzDe],
  ["numeric", numeric],
  ["special", special],
  ["numpad", numpad],
  ["fkeys", fkeys],
  ["nav", nav],
  ["ja-romaji", jaRomaji],
  ["ja-kana", jaKana],
  ["arabic", arabic],
  ["ko-hangul", koHangul],
  ["qwerty-es", qwertyEs],
]);

/** Built-in layout names. Used by isBuiltInLayout and unregisterLayout protection. */
const BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(layouts.keys());

/** Original built-in definitions, preserved so overrides can be reverted. */
const BUILTIN_ORIGINALS: ReadonlyMap<string, LayoutDefinition> = new Map(layouts);

const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
  ["ko", "ko-hangul"],
  ["es", "qwerty-es"],
]);

/** BCP-47 language prefix -> layout name. Checked after exact match. */
const LOCALE_LAYOUT_MAP: Map<string, string> = new Map(DEFAULT_LOCALE_LAYOUT_MAP);

function isRegisteredLayout(layout: string): boolean {
  return layouts.has(layout);
}

/** Per-instance layout map (optional) for layered resolution. */
export type InstanceLayouts = ReadonlyMap<string, LayoutDefinition>;

/** Per-instance locale map (optional) for layered resolution. */
export type InstanceLocaleLayouts = ReadonlyMap<string, string>;

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

function resolveLocaleMappedLayout(
  locale: string,
  instanceLocaleLayouts?: InstanceLocaleLayouts,
  instanceLayouts?: InstanceLayouts,
): string | null {
  const mappedLayout = instanceLocaleLayouts?.get(locale) ?? LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  // The mapped layout must resolve to a known layout (instance overrides
  // count as known) to avoid silently selecting an unregistered name.
  if (instanceLayouts?.has(mappedLayout) || isRegisteredLayout(mappedLayout)) {
    return mappedLayout;
  }
  return null;
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

  const original = BUILTIN_ORIGINALS.get(name);
  if (original) {
    layouts.set(name, original);
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
  // Restore any overridden built-ins to their original definitions
  for (const [name, def] of BUILTIN_ORIGINALS) {
    layouts.set(name, def);
  }
}

/**
 * Returns the layout definition for the given name, or undefined
 * if no such layout is registered. Instance overrides take precedence.
 */
export function getRegisteredLayout(sName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition | undefined {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return undefined;
  return instanceLayouts?.get(name) ?? layouts.get(name);
}

/**
 * Returns the layout for the given name, falling back to
 * {@link DEFAULT_LAYOUT} when the name is not registered.
 *
 * Resolution order: instance map -> global registry -> default layout.
 */
export function getLayoutOrDefault(sName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition {
  const name = normalizeLowerString(sName, "layout name");
  const fallback = instanceLayouts?.get(DEFAULT_LAYOUT) ?? layouts.get(DEFAULT_LAYOUT);
  if (!fallback) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
  if (!name) return fallback;
  return instanceLayouts?.get(name) ?? layouts.get(name) ?? fallback;
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
 * 1. Exact BCP-47 match (e.g. "de-at"), instance map first then global
 * 2. Language prefix (e.g. "de"), instance map first then global
 * 3. {@link DEFAULT_LAYOUT} fallback ("qwerty")
 */
export function getLocaleLayout(
  instanceLocaleLayouts?: InstanceLocaleLayouts,
  instanceLayouts?: InstanceLayouts,
): string {
  const tag = Localization.getLanguageTag();
  const lang = tag.language.toLowerCase();
  const region = tag.region;

  // Exact match: "de-at", "pt-br", etc.
  if (region) {
    const exact = resolveLocaleMappedLayout(`${lang}-${region.toLowerCase()}`, instanceLocaleLayouts, instanceLayouts);
    if (exact) return exact;
  }

  // Language prefix: "de", "fr", etc.
  const prefix = resolveLocaleMappedLayout(lang, instanceLocaleLayouts, instanceLayouts);
  if (prefix) return prefix;

  return DEFAULT_LAYOUT;
}
