/**
 * Per-layout attributes of the built-in layouts, in one table keyed by layout name.
 *
 * The rows of a layout live in `layouts/*`. Everything else a layout *is* (whether
 * it is an auxiliary surface, what language its keycaps are written in, which
 * long-press variants its script takes) lives here, so adding an attribute adds a
 * field rather than another name-keyed map parallel to the registry.
 *
 * Names are matched verbatim. Every caller resolves the layout name through the
 * registry first, so no normalization happens here.
 *
 * This module is framework-agnostic and duplicated into the sibling
 * `kiosk-keyboard-webc` package (`src/core/layout-meta.ts`); the two copies
 * are kept in sync, byte-identical apart from the ESM `.js` import suffix
 * (enforced by tools/check-twin-drift.mjs).
 */
import type { VariantTable } from "./latin-variants";

/** The attributes a built-in layout can declare. Every field is optional; an absent field takes the default. */
export interface LayoutMeta {
  /**
   * An auxiliary view (`numeric`, `special`, `fkeys`, `nav`) rather than a base
   * alphabetic layout. A secondary layout is never tracked as the base, so
   * `{layout:base}` returns to the alphabetic layout it was reached from.
   */
  readonly secondary?: boolean;
  /**
   * BCP-47 language of the keycaps, emitted as `lang` on the key labels so
   * assistive tech announces them with the script's own pronunciation rules
   * (WCAG 2.2 SC 3.1.2 Language of Parts). Absent when the layout's keycaps are
   * in the UI language, which is the case for every Latin layout.
   */
  readonly lang?: string;
  /**
   * The built-in long-press variant tier. `null` opts the layout out, for scripts
   * that take no Latin diacritics. Absent, which is distinct from `null`, leaves
   * the Latin default in force.
   */
  readonly variants?: VariantTable | null;
}

/**
 * The built-in layouts that declare attributes. A layout absent from this table
 * takes every default: a base alphabetic layout, keycaps in the UI language, and
 * the Latin variant tier.
 */
export const BUILTIN_LAYOUT_META: ReadonlyMap<string, LayoutMeta> = new Map<string, LayoutMeta>([
  ["numeric", { secondary: true }],
  ["special", { secondary: true }],
  ["fkeys", { secondary: true }],
  ["nav", { secondary: true }],
  // No `lang`: the romaji keycaps are Latin letters and JIS punctuation, and only
  // the text they compose is Japanese.
  ["ja-romaji", { variants: null }],
  ["ja-kana", { lang: "ja", variants: null }],
  ["arabic", { lang: "ar", variants: null }],
  ["ko-hangul", { lang: "ko", variants: null }],
]);

/**
 * Per-instance layout metadata, keyed by normalized layout name. Built from
 * `instanceLayouts`, so a consumer declares a layout's attributes on the layout
 * itself rather than in a parallel map. An entry carries only the attributes its
 * descriptor declared, which is what lets the rest fall back per attribute.
 */
export type InstanceLayoutMeta = ReadonlyMap<string, LayoutMeta>;

/**
 * The metadata in effect for `name`, resolved per attribute: an instance layout
 * declares the attributes it cares about and the built-in of the same name supplies
 * the rest, so overriding `arabic` with different rows keeps announcing them as
 * Arabic until the descriptor says otherwise. Bare rows declare nothing and so
 * resolve to the built-in outright.
 *
 * `variants` is not resolved here. Instance layouts declare no variant tier; that
 * tier is `instanceVariants`, which layers over the built-in table by name.
 */
function resolveLayoutMeta(name: string, instanceMeta?: InstanceLayoutMeta): LayoutMeta | undefined {
  const builtIn = BUILTIN_LAYOUT_META.get(name);
  const instance = instanceMeta?.get(name);
  if (!instance) return builtIn;
  if (!builtIn) return instance;
  return { ...builtIn, ...instance };
}

/** Whether `name` is a secondary (auxiliary) layout rather than a base alphabetic one. */
export function isSecondaryLayout(name: string, instanceMeta?: InstanceLayoutMeta): boolean {
  return resolveLayoutMeta(name, instanceMeta)?.secondary === true;
}

/** The BCP-47 language of `name`'s keycaps, or `undefined` when they are in the UI language. */
export function getLayoutLang(name: string, instanceMeta?: InstanceLayoutMeta): string | undefined {
  return resolveLayoutMeta(name, instanceMeta)?.lang;
}
