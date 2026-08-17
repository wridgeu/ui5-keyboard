import getLocale from "@ui5/webcomponents-base/dist/locale/getLocale.js";
import type { LayoutDefinition } from "../types.js";
import DEFAULT_LAYOUT from "../layouts/default-layout.js";
import qwerty from "../layouts/qwerty.js";
import qwertzDe from "../layouts/qwertz-de.js";
import numeric from "../layouts/numeric.js";
import special from "../layouts/special.js";
import numpad from "../layouts/numpad.js";
import fkeys from "../layouts/fkeys.js";
import nav from "../layouts/nav.js";
import jaRomaji from "../layouts/ja-romaji.js";
import jaKana from "../layouts/ja-kana.js";
import jaKanaCompact from "../layouts/ja-kana-compact.js";
import arabic from "../layouts/arabic.js";
import koHangul from "../layouts/ko-hangul.js";
import qwertyEs from "../layouts/qwerty-es.js";

// Module-level singleton - shared across all component instances (and across
// micro-frontends if they import the same module). Built eagerly from direct
// data imports and sealed at module load: every layout is genuinely referenced
// here, so a bundler cannot drop the definitions. Side-effect imports +
// `_registerBuiltInLayout` self-registration would instead be tree-shaken out
// of the production bundle. There is no public mutation API: per-app
// customization is done with the `customLayouts` slot on the element.
const layouts: ReadonlyMap<string, LayoutDefinition> = new Map([
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
 * Built-in BCP-47 prefix -> layout name. Sealed at module load. Per-app
 * customization is done with the `locales` of a slotted custom layout.
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
  // `unknown` because the public statics that funnel here (`KioskKeyboard.getRegisteredLayout`,
  // `.isBuiltInLayout`) are reachable from untyped JS, where `.trim()` on a number would take the
  // whole keyboard down instead of one lookup.
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
 * Returns the normalized name of the layout that `rawName` actually resolves to: the
 * name itself when it is registered (instance map or built-in), else the default layout.
 * A caller that needs both the layout data and something else keyed by layout name
 * resolves the name once through this, so the two cannot disagree on an unregistered name.
 * @internal
 */
export function resolveLayoutName(rawName: string, instanceLayouts?: InstanceLayouts): string {
  const name = normalizeLowerString(rawName, "layout name");
  if (!name) return DEFAULT_LAYOUT;
  return instanceLayouts?.has(name) || layouts.has(name) ? name : DEFAULT_LAYOUT;
}

/**
 * Returns the layout for the given name, falling back to
 * the default layout when the name is not registered.
 *
 * Resolution order: instance map -> built-in registry -> default layout.
 * @internal
 */
export function getLayoutOrDefault(rawName: string, instanceLayouts?: InstanceLayouts): LayoutDefinition {
  const name = resolveLayoutName(rawName, instanceLayouts);
  const def = instanceLayouts?.get(name) ?? layouts.get(name);
  if (!def) throw new Error(`Built-in default layout "${DEFAULT_LAYOUT}" is missing`);
  return def;
}

/**
 * Returns the names of all built-in layouts. Instance-only layouts are
 * intentionally not included here. They are scoped to the element that
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
  return layouts.has(name);
}

/**
 * Returns the layout name appropriate for the active locale.
 *
 * Resolves the locale through the framework's `getLocale()`, which honors a
 * language configured on the UI5 Web Components runtime (e.g. via `setLanguage`)
 * and falls back to the browser language. This is the same locale source the
 * component's text i18n bundle uses.
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
    const locale = getLocale();
    const lang = locale.getLanguage().toLowerCase();
    const region = locale.getRegion();

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
    // getLocale resolves the configured or browser locale; guard against a
    // malformed configured language tag.
  }

  return DEFAULT_LAYOUT;
}
