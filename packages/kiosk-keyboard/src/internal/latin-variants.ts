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
import { BUILTIN_LAYOUT_META } from "./layout-meta";

/** A variant table: ordered long-press glyphs keyed by lowercase base letter. */
export type VariantTable = Readonly<Record<string, readonly string[]>>;

/**
 * Ordered Latin-diacritic variants keyed by lowercase base letter. The base
 * letter itself is the tap default and is not included in its list.
 */
// Both this table and `VariantTable` are documented-stable exports of `library.ts`, and
// `VariantTable` is what `_resolvedDefaultVariants` and `resolveVariantTable` hand around
// internally. (The XML-facing `defaultVariants` / `variants` properties deliberately use the
// separate `VariantOverrideTable` data type instead.) Inferring the eleven literal base letters
// would narrow the export: the values would lose `readonly`, and the index signature a consumer
// needs to read it by a runtime letter would go with it.
// oxlint-disable-next-line anti-slop/no-known-value-widening
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

/**
 * One tier's contribution to a layout's long-press variants. `replace` discards
 * everything the tiers below contributed before `table` is merged, which is what
 * suppressing the facet on the declaring custom layout means; a `table` of `null`
 * contributes nothing, so `{ replace: true, table: null }` opts the layout out.
 */
export interface VariantOverlay {
  readonly replace: boolean;
  readonly table: VariantTable | null;
}

/** Per-instance, per-layout variant overlays, keyed by normalized layout name. */
export type InstanceVariants = ReadonlyMap<string, VariantOverlay>;

/**
 * Merges `overrides` onto `base` per base letter. A letter mapped to an empty list is
 * dropped, so one built-in entry can be suppressed without restating the rest. The
 * result has a null prototype, so a table keyed `__proto__` contributes an own property
 * rather than reassigning the prototype.
 */
function mergeVariantTables(base: VariantTable | null, overrides: VariantTable): VariantTable {
  const merged: Record<string, readonly string[]> = Object.create(null);
  Object.assign(merged, base);
  for (const [letter, glyphs] of Object.entries(overrides)) {
    if (glyphs.length === 0) delete merged[letter];
    else merged[letter] = glyphs;
  }
  return merged;
}

/** Applies one tier to the table resolved so far. An absent tier is transparent. */
function applyVariantOverlay(base: VariantTable | null, overlay: VariantOverlay | undefined): VariantTable | null {
  if (overlay === undefined) return base;
  const under = overlay.replace ? null : base;
  return overlay.table === null ? null : mergeVariantTables(under, overlay.table);
}

/**
 * The variant table in effect for `layoutName`, layered built-in -> defaults -> named.
 * Each tier merges onto the one below per base letter, so a letter mapped to `[]` drops
 * that letter and a table for one layout extends the tier below instead of replacing it.
 * A named tier that suppresses discards everything below it; one that suppresses and then
 * declares a table stands that table alone. With no tier declared the built-in stands:
 * the layout's own declared table, or the Latin table when it declares none. A `null`
 * result fills no variants, so the keys carry no long-press affordance.
 */
export function resolveVariantTable(
  layoutName: string,
  instanceVariants?: InstanceVariants,
  defaults?: VariantTable | null,
): VariantTable | null {
  const name = layoutName.trim().toLowerCase();
  // A declared `null` opts the layout out; an absent declaration is distinct from it
  // and leaves the Latin table in force.
  const declared = BUILTIN_LAYOUT_META.get(name)?.variants;
  let table: VariantTable | null = declared === undefined ? LATIN_DIACRITIC_VARIANTS : declared;
  // The defaults tier only ever adds, so it is a plain table rather than an overlay:
  // it cannot suppress, and there is no spelling for it to do so.
  if (defaults) table = mergeVariantTables(table, defaults);
  if (instanceVariants !== undefined) table = applyVariantOverlay(table, instanceVariants.get(name));
  return table;
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
