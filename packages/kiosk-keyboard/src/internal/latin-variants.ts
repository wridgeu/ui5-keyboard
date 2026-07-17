/**
 * Default Latin-diacritic long-press variants and the helpers that apply them.
 *
 * Mirrors the CLDR LDML Part 7 `longPress` lists and the popup sets shipped by
 * iOS / Gboard: a base letter maps to an ordered list of related glyphs, most
 * common first. The base letter is the tap default and is intentionally not
 * repeated in its own list. German ä/ö/ü/ß fall out as a subset (a/o/u/s).
 *
 * This module is framework-agnostic and duplicated into the sibling
 * `kiosk-keyboard-webc` package (`src/core/latin-variants.ts`); the two copies
 * are kept in sync, byte-identical apart from the ESM `.js` import suffix
 * (enforced by tools/check-twin-drift.mjs).
 */
import type { LayoutDefinition } from "../types";

/**
 * Ordered Latin-diacritic variants keyed by lowercase base letter. The base
 * letter itself is the tap default and is not included in its list.
 */
export const LATIN_DIACRITIC_VARIANTS: Readonly<Record<string, readonly string[]>> = {
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
 */
export function applyVariantDefaults(
  layout: LayoutDefinition,
  table: Readonly<Record<string, readonly string[]>> = LATIN_DIACRITIC_VARIANTS,
): LayoutDefinition {
  return layout.map((row) =>
    row.map((key) => {
      if (key.variants !== undefined) return key;
      const base = key.value.toLowerCase();
      // Own properties only: a key valued `constructor` / `toString` must miss
      // the table rather than resolve an inherited Object.prototype member.
      const variants = Object.hasOwn(table, base) ? table[base] : undefined;
      if (!variants || variants.length === 0) return key;
      return { ...key, variants: [...variants] };
    }),
  );
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
