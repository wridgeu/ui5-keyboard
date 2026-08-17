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
import jaKanaCompact from "../layouts/ja-kana-compact";
import arabic from "../layouts/arabic";
import koHangul from "../layouts/ko-hangul";
import qwertyEs from "../layouts/qwerty-es";

/**
 * Built-in keyboard layouts shipped with the library. The map is sealed
 * at module load: there is no public mutation API. Consumers customize
 * per control via the `customLayouts` aggregation, which shadows entries
 * here without mutating shared state.
 */
const BUILTIN_LAYOUTS: ReadonlyMap<string, LayoutDefinition> = new Map([
  ["qwerty", qwerty],
  ["qwertz-de", qwertzDe],
  ["numeric", numeric],
  ["special", special],
  ["numpad", numpad],
  ["fkeys", fkeys],
  ["nav", nav],
  ["ja-romaji", jaRomaji],
  ["ja-kana", jaKana],
  ["ja-kana-compact", jaKanaCompact],
  ["arabic", arabic],
  ["ko-hangul", koHangul],
  ["qwerty-es", qwertyEs],
]);

/**
 * Built-in BCP-47 prefix → layout name. Sealed at module load. Per-app
 * customization is done with the `locales` of a `customLayouts` entry.
 */
const BUILTIN_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
  ["ko", "ko-hangul"],
  ["es", "qwerty-es"],
]);

/** Per-instance layout map for layered resolution. */
export type InstanceLayouts = ReadonlyMap<string, LayoutDefinition>;

/** Per-instance locale map for layered resolution. */
export type InstanceLocaleLayouts = ReadonlyMap<string, string>;

/**
 * Normalizes an input to a trimmed lowercase string.
 * Returns `undefined` for non-string or empty-after-trim values, logging a warning.
 */
function normalizeLowerString(value: unknown, argName: string): string | undefined {
  // `unknown` because the public statics that funnel here (`KioskKeyboard.getRegisteredLayout`,
  // `.isBuiltInLayout`) are reachable from untyped JS, where `.trim()` on a number would take the
  // whole keyboard down instead of one lookup.
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
  const mappedLayout = instanceLocaleLayouts?.get(locale) ?? BUILTIN_LOCALE_LAYOUT_MAP.get(locale);
  if (!mappedLayout) return null;
  if (instanceLayouts?.has(mappedLayout) || BUILTIN_LAYOUTS.has(mappedLayout)) {
    return mappedLayout;
  }
  return null;
}

/**
 * Returns the layout definition for the given name, or undefined
 * if no such layout exists. Instance overrides take precedence
 * over built-ins.
 */
export function getRegisteredLayout(sName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition | undefined {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return undefined;
  return instanceLayouts?.get(name) ?? BUILTIN_LAYOUTS.get(name);
}

/**
 * Returns the normalized name of the layout that `sName` actually resolves to: the
 * name itself when it is registered (instance map or built-in), else
 * {@link DEFAULT_LAYOUT}. A caller that needs both the layout data and something else
 * keyed by layout name resolves the name once through this, so the two cannot disagree
 * on an unregistered name.
 */
export function resolveLayoutName(sName: string, instanceLayouts?: InstanceLayouts): string {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return DEFAULT_LAYOUT;
  return instanceLayouts?.has(name) || BUILTIN_LAYOUTS.has(name) ? name : DEFAULT_LAYOUT;
}

/**
 * Returns the layout for the given name, falling back to
 * {@link DEFAULT_LAYOUT} when the name is not registered.
 *
 * Resolution order: instance map → built-in registry → default layout.
 */
export function getLayoutOrDefault(sName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition {
  const name = resolveLayoutName(sName, instanceLayouts);
  const def = instanceLayouts?.get(name) ?? BUILTIN_LAYOUTS.get(name);
  if (!def) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
  return def;
}

/**
 * Returns the names of all built-in layouts. Instance-only layouts are
 * intentionally not included here. They are scoped to the control that
 * declared them and are not exposed as a global view.
 */
export function getRegisteredLayoutNames(): string[] {
  return [...BUILTIN_LAYOUTS.keys()];
}

/** Returns whether the given layout name is a built-in layout. */
export function isBuiltInLayout(sName: string): boolean {
  const name = normalizeLowerString(sName, "layout name");
  if (!name) return false;
  return BUILTIN_LAYOUTS.has(name);
}

/**
 * Returns the layout name appropriate for the current UI5 locale.
 *
 * Resolution order:
 * 1. Exact BCP-47 match (e.g. "de-at"), instance map first then built-in
 * 2. Language prefix (e.g. "de"), instance map first then built-in
 * 3. {@link DEFAULT_LAYOUT} fallback ("qwerty")
 */
export function getLocaleLayout(
  instanceLocaleLayouts?: InstanceLocaleLayouts,
  instanceLayouts?: InstanceLayouts,
): string {
  const tag = Localization.getLanguageTag();
  const lang = tag.language.toLowerCase();
  const region = tag.region;

  if (region) {
    const exact = resolveLocaleMappedLayout(`${lang}-${region.toLowerCase()}`, instanceLocaleLayouts, instanceLayouts);
    if (exact) return exact;
  }

  const prefix = resolveLocaleMappedLayout(lang, instanceLocaleLayouts, instanceLayouts);
  if (prefix) return prefix;

  return DEFAULT_LAYOUT;
}
