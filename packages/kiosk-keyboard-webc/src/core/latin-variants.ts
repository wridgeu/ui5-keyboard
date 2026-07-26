/**
 * Default Latin-diacritic long-press variants and the helpers that apply them.
 *
 * Mirrors the CLDR LDML Part 7 `longPress` lists and the popup sets shipped by
 * iOS / Gboard: a base letter maps to an ordered list of related glyphs, most
 * common first. The base letter is the tap default and is intentionally not
 * repeated in its own list. German ä/ö/ü/ß fall out as a subset (a/o/u/s).
 *
 * This module is framework-agnostic and duplicated into the sibling
 * `kiosk-keyboard` package (`src/internal/latin-variants.ts`); the two copies
 * are kept in sync, byte-identical apart from the ESM `.js` import suffix
 * (enforced by tools/check-twin-drift.mjs).
 */
import type { LayoutDefinition } from "../types.js";

/** A variant table: ordered long-press glyphs keyed by lowercase base letter. */
export type VariantTable = Readonly<Record<string, readonly string[]>>;

/**
 * Ordered Latin-diacritic variants keyed by lowercase base letter. The base
 * letter itself is the tap default and is not included in its list.
 */
export const LATIN_DIACRITIC_VARIANTS: VariantTable = {
  a: ["à", "á", "â", "ä", "æ", "ã", "å", "ā"],
  c: ["ç", "ć", "č"],
  e: ["è", "é", "ê", "ë", "ē", "ė", "ę"],
  i: ["î", "ï", "í", "ī", "į", "ì"],
  l: ["ł"],
  n: ["ñ", "ń"],
  o: ["ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ"],
  s: ["ß", "ś", "š"],
  u: ["û", "ü", "ù", "ú", "ū"],
  y: ["ÿ", "ý"],
  z: ["ž", "ź", "ż"],
};

/**
 * Returns a copy of `layout` with default `variants` filled in on character keys
 * whose lowercased `value` is a base letter in `table`. Keys that already declare
 * `variants` are left untouched, so author intent always wins; keys whose value is
 * not a table entry (action tokens, digits, multi-glyph values) are never changed.
 * Action, modifier, and space keys never take table variants even when their value
 * is a base letter, so a table keyed to such a value arms nothing.
 */
export function applyVariantDefaults(
  layout: LayoutDefinition,
  table: VariantTable = LATIN_DIACRITIC_VARIANTS,
): LayoutDefinition {
  return layout.map((row) =>
    row.map((key) => {
      if (key.variants !== undefined) return key;
      if (key.type === "action" || key.type === "modifier" || key.type === "space") return key;
      const base = key.value.toLowerCase();
      // Own properties only: a key valued `constructor` / `toString` must miss
      // the table rather than resolve an inherited Object.prototype member.
      const variants = Object.hasOwn(table, base) ? table[base] : undefined;
      if (!variants || variants.length === 0) return key;
      return { ...key, variants: [...variants] };
    }),
  );
}

/** The instance-table key that supplies variants for every layout without its own entry. */
export const WILDCARD_LAYOUT = "*";

/** Per-instance, per-layout variant tables, keyed by normalized layout name. */
export type InstanceVariants = ReadonlyMap<string, VariantTable | null>;

/**
 * Built-in layouts whose scripts have no Latin-diacritic long-press variants, so the
 * built-in tier resolves to `null` for them rather than arming meaningless popups.
 * This is only the shipped default for these built-ins; it binds nothing for consumers,
 * who set the effective table per layout through `instanceVariants` (an entry, a `null`
 * opt-out, or a `*` wildcard) for built-in and custom layouts alike.
 */
const NON_LATIN_VARIANT_LAYOUTS: ReadonlySet<string> = new Set(["ja-romaji", "ja-kana", "arabic", "ko-hangul"]);

/**
 * The variant table in effect for `layoutName`: an instance entry for the layout
 * (an explicit `null` opts it out), else the instance `*` wildcard, else the built-in
 * Latin table (`null` for the non-Latin built-ins). A `null` result fills no variants,
 * so the keys carry no long-press affordance.
 */
export function resolveVariantTable(layoutName: string, instanceVariants?: InstanceVariants): VariantTable | null {
  const name = layoutName.trim().toLowerCase();
  if (instanceVariants) {
    if (instanceVariants.has(name)) return instanceVariants.get(name) ?? null;
    if (instanceVariants.has(WILDCARD_LAYOUT)) return instanceVariants.get(WILDCARD_LAYOUT) ?? null;
  }
  return NON_LATIN_VARIANT_LAYOUTS.has(name) ? null : LATIN_DIACRITIC_VARIANTS;
}

/**
 * Maps a variant glyph to its Shift/Caps form. Uppercasing is Unicode-default,
 * with the one exception German casing needs: `ß` (ß) uppercases to `SS`,
 * but the on-screen popup must surface the capital sharp S `ẞ` (ẞ, standard
 * German orthography since 2017).
 */
export function toShiftVariant(glyph: string): string {
  if (glyph === "ß") return "ẞ";
  return glyph.toUpperCase();
}

/**
 * Returns the Shift/Caps forms of `variants`, order-preserving and de-duplicated
 * so a list that already contains an uppercase form does not repeat it.
 */
export function toShiftVariants(variants: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const glyph of variants) {
    const shifted = toShiftVariant(glyph);
    if (seen.has(shifted)) continue;
    seen.add(shifted);
    out.push(shifted);
  }
  return out;
}

/** A lone cased character: the only shape CapsLock transforms. */
const LONE_CASED = /^\p{Cased}$/u;

/**
 * The Shift/Caps form of a key's base `value`, given its optional explicit
 * `shiftValue`. Shift types the shiftValue verbatim. CapsLock is a case mode
 * rather than a Shift alias: it uppercases the lone cased glyph the key
 * contributes and leaves anything else alone, so a digit row keeps its digits
 * and a caseless script is untouched. `ß` maps to the capital sharp S `ẞ`.
 */
export function shiftedGlyph(value: string, shiftValue: string | undefined, caps: boolean): string {
  if (caps) {
    const glyph = shiftValue !== undefined && LONE_CASED.test(shiftValue) ? shiftValue : value;
    return LONE_CASED.test(glyph) ? toShiftVariant(glyph) : glyph;
  }
  if (shiftValue) return shiftValue;
  return value.length === 1 && value.trim() ? value.toUpperCase() : value;
}
