/**
 * Folds a control's custom layouts into the lookup maps the resolution paths read.
 *
 * One custom layout carries everything that belongs to one layout - its rows, the locales
 * that select it, its keycap language, its role, its composition middleware and its
 * long-press variants - and this module turns an ordered list of them into the per-facet
 * maps `layout-registry`, `layout-meta`, `middleware-registry` and `latin-variants`
 * resolve through. Each facet keeps the merge rule it already had: rows and middleware
 * shadow, metadata merges per attribute, locales union, variants merge per base letter.
 *
 * Pure and total: it logs nothing and throws nothing, returning every complaint as a
 * structured `LayoutDiagnostic` for the host to render and cap. `describeDiagnostic`
 * turns one into a sentence, taking the surface names its twin spells differently
 * through a vocabulary so the two hosts cannot disagree on the facts.
 *
 * This module is framework-agnostic and duplicated into the sibling
 * `kiosk-keyboard` package (`src/internal/custom-layout-fold.ts`); the two copies
 * are kept in sync, byte-identical apart from the ESM `.js` import suffix
 * (enforced by tools/check-twin-drift.mjs).
 */
import type { InstanceVariants, VariantOverlay, VariantTable } from "./latin-variants.js";
import type { InstanceLayoutMeta, LayoutMeta } from "./layout-meta.js";
import type { InstanceLayouts, InstanceLocaleLayouts } from "./layout-registry.js";
import type { InstanceMiddleware } from "./middleware-registry.js";
import type { CompositionMiddleware, CustomLayoutSpec, KeyDefinition, LayoutDefinition } from "../types.js";

/** The facets a custom layout can discard the inherited value of. */
export const SUPPRESSIBLE_FACETS = ["Variants", "Middleware"] as const;
export type SuppressibleFacet = (typeof SUPPRESSIBLE_FACETS)[number];

/** What the fold rejected or found ambiguous. Every field but `code` and `layout` is per-code. */
export interface LayoutDiagnostic {
  readonly code: DiagnosticCode;
  /** The layout the offending custom layout names; `""` for an unnamed one, or for the host's own table. */
  readonly layout: string;
  /** The other layout in a collision. */
  readonly other?: string;
  /** The offending token or value. */
  readonly value?: string;
}

export type DiagnosticCode =
  | "empty-name"
  | "invalid-rows"
  | "invalid-variants"
  | "invalid-middleware"
  | "invalid-locale"
  | "unknown-target"
  | "unknown-suppress"
  | "unknown-compact"
  | "duplicate-rows"
  | "duplicate-middleware"
  | "duplicate-locale";

/** How one twin spells the surface names a message has to quote. */
export interface DiagnosticVocabulary {
  /** `"customLayouts aggregation"` / `"customLayouts slot"`. */
  readonly customLayouts: string;
  /** `"<kiosk:CustomLayout>"` / `"<kiosk-keyboard-custom-layout>"`. */
  readonly customLayout: string;
  /** Every built-in layout name, for the closing hint of `unknown-target`. */
  readonly builtInLayouts: readonly string[];
}

/** The lookup maps a control resolves through, folded from its custom layouts. */
export interface CustomLayoutFold {
  readonly layouts?: InstanceLayouts;
  readonly layoutMeta?: InstanceLayoutMeta;
  readonly localeLayouts?: InstanceLocaleLayouts;
  readonly middleware?: InstanceMiddleware;
  readonly variants?: InstanceVariants;
  readonly diagnostics: readonly LayoutDiagnostic[];
}

/** The fold of no custom layouts. Shared, so a control with none allocates nothing. */
export const EMPTY_FOLD: CustomLayoutFold = Object.freeze({ diagnostics: Object.freeze([]) });

/**
 * A layout definition is a non-empty array of non-empty rows in which every key carries a
 * non-empty string `value`. Anything else is rejected outright rather than rendered as a
 * partial layout.
 */
export function isValidLayoutDefinition(def: unknown): def is LayoutDefinition {
  return (
    Array.isArray(def) &&
    def.length > 0 &&
    def.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((key: unknown) => {
          const value = (key as KeyDefinition | null | undefined)?.value;
          return typeof value === "string" && value.length > 0;
        }),
    )
  );
}

/**
 * A variant table is a non-empty plain object mapping lowercase base letters to glyph
 * lists. Arrays and exotic objects (`Map`, `Date`) are rejected rather than read as an
 * empty table, and an uppercased or padded base letter is rejected rather than
 * normalized: the letters are matched against `key.value.toLowerCase()`, so a mis-keyed
 * table would arm nothing while shadowing the tier below.
 */
export function isValidVariantTable(table: unknown): table is VariantTable {
  if (typeof table !== "object" || table === null || Array.isArray(table)) return false;
  const entries = Object.entries(table);
  return (
    entries.length > 0 &&
    entries.every(
      ([base, glyphs]) =>
        base === base.trim().toLowerCase() &&
        Array.isArray(glyphs) &&
        glyphs.every((glyph) => typeof glyph === "string" && glyph),
    )
  );
}

/** The facets `suppress` names, reporting the tokens that are not facets. */
function readSuppress(
  suppress: readonly string[] | undefined,
  layout: string,
  diagnostics: LayoutDiagnostic[],
): ReadonlySet<SuppressibleFacet> {
  const facets = new Set<SuppressibleFacet>();
  for (const token of suppress ?? []) {
    const facet = SUPPRESSIBLE_FACETS.find((candidate) => candidate === token);
    if (facet === undefined) diagnostics.push({ code: "unknown-suppress", layout, value: token });
    else facets.add(facet);
  }
  return facets;
}

/** The variant table a custom layout declares, or `undefined` when it declares none. */
function readVariants(
  variants: VariantTable | undefined,
  layout: string,
  diagnostics: LayoutDiagnostic[],
): VariantTable | undefined {
  if (variants === undefined) return undefined;
  if (isValidVariantTable(variants)) return variants;
  diagnostics.push({ code: "invalid-variants", layout });
  return undefined;
}

/**
 * Composes one variant patch onto another. Unlike `mergeVariantTables` this keeps a
 * letter mapped to `[]`, because the accumulated overlay is still a patch: the deletion
 * only happens when the overlay is finally applied to a real table, and dropping the
 * marker here would silently lose a suppression the resolver never got to act on.
 */
function composeVariantPatches(base: VariantTable | null, patch: VariantTable): VariantTable {
  const composed: Record<string, readonly string[]> = Object.create(null);
  Object.assign(composed, base, patch);
  return composed;
}

/** Folds one custom layout's variant declaration onto the overlay accumulated so far. */
function foldVariantOverlay(
  acc: VariantOverlay | undefined,
  suppressed: boolean,
  table: VariantTable | undefined,
): VariantOverlay | undefined {
  if (!suppressed && table === undefined) return acc;
  const replace = suppressed || (acc?.replace ?? false);
  if (table === undefined) return { replace, table: null };
  const under = suppressed || acc === undefined ? null : acc.table;
  return { replace, table: composeVariantPatches(under, table) };
}

/**
 * Folds `specs`, in order, into the maps the resolution paths read. Later declarations
 * of a facet win; long-press variants accumulate per base letter instead, and a facet a
 * custom layout suppresses resolves to nothing at that custom layout's position.
 *
 * `isBuiltIn` is injected rather than imported so this module stays clear of the layout
 * registry, whose normalization logs.
 */
export function foldCustomLayouts(
  specs: readonly CustomLayoutSpec[],
  isBuiltIn: (name: string) => boolean,
): CustomLayoutFold {
  if (specs.length === 0) return EMPTY_FOLD;

  const layouts = new Map<string, LayoutDefinition>();
  const meta = new Map<string, LayoutMeta>();
  const localeLayouts = new Map<string, string>();
  const middleware = new Map<string, (() => CompositionMiddleware) | null>();
  const variants = new Map<string, VariantOverlay>();
  const diagnostics: LayoutDiagnostic[] = [];
  const rowsDeclared = new Set<string>();
  const middlewareDeclared = new Set<string>();
  const addressed = new Set<string>();
  const compactTargets = new Map<string, string>();

  for (const spec of specs) {
    const name = spec.name.trim().toLowerCase();
    if (!name) {
      diagnostics.push({ code: "empty-name", layout: "" });
      continue;
    }
    addressed.add(name);
    const facets = readSuppress(spec.suppress, name, diagnostics);

    if (spec.rows !== undefined) {
      // `rowsDeclared` records that a `rows` was present, not that it was accepted. A
      // rejected `rows` therefore reports `invalid-rows` alone: recording only the valid
      // branch would let the second pass add `unknown-target` for the same fault, two
      // warnings for one mistake.
      if (rowsDeclared.has(name)) diagnostics.push({ code: "duplicate-rows", layout: name });
      rowsDeclared.add(name);
      if (!isValidLayoutDefinition(spec.rows)) diagnostics.push({ code: "invalid-rows", layout: name });
      else layouts.set(name, spec.rows);
    } else if (spec.rowsPending) {
      // Declared, but the binding has not delivered. Registering nothing is right - there
      // are no rows to resolve yet - while still counting the name as addressed, because
      // the author did declare it and the value arrives on the next fold.
      rowsDeclared.add(name);
    }

    // The three guards below degrade one facet rather than throwing. `@property()` neither
    // coerces nor validates and `isCustomLayout` is a duck-typed check, so `el.keycapLang = 42`
    // or a `toSpec()` from a foreign bundle reaches them unvalidated; `spec.compact?.trim()`
    // would throw and take the whole custom layout down with it. The kiosk twin coerces at the
    // setter, so there the same guards stand for parity and for hand-built specs.
    const lang = typeof spec.keycapLang === "string" ? spec.keycapLang.trim() : "";
    // Names a layout, so it is normalized the way every layout name is.
    const compact = typeof spec.compact === "string" ? spec.compact.trim().toLowerCase() : "";
    const patch: LayoutMeta = {
      ...(lang && { lang }),
      ...(compact && { compact }),
      // `boolean`, not truthy and not `!== undefined`: `false` is a role the author chose, while
      // `null` has to leave the tier below standing.
      ...(typeof spec.secondary === "boolean" && { secondary: spec.secondary }),
    };
    if (Object.keys(patch).length > 0) meta.set(name, { ...meta.get(name), ...patch });
    if (compact) compactTargets.set(name, compact);

    for (const raw of spec.locales ?? []) {
      const tag = raw.trim().toLowerCase();
      if (!tag) {
        diagnostics.push({ code: "invalid-locale", layout: name });
        continue;
      }
      const owner = localeLayouts.get(tag);
      if (owner !== undefined && owner !== name) {
        diagnostics.push({ code: "duplicate-locale", layout: owner, other: name, value: tag });
      }
      localeLayouts.set(tag, name);
    }

    if (facets.has("Middleware")) middleware.set(name, null);
    if (spec.middleware !== undefined) {
      // A diagnostic rather than a `TypeError` at composition time, for the same reason as above.
      if (typeof spec.middleware !== "function") diagnostics.push({ code: "invalid-middleware", layout: name });
      else {
        if (middlewareDeclared.has(name)) diagnostics.push({ code: "duplicate-middleware", layout: name });
        middlewareDeclared.add(name);
        middleware.set(name, spec.middleware);
      }
    }

    const table = readVariants(spec.variants, name, diagnostics);
    const overlay = foldVariantOverlay(variants.get(name), facets.has("Variants"), table);
    if (overlay !== undefined) variants.set(name, overlay);
  }

  // Resolvability is a property of the complete list: an overlay may precede the custom
  // layout that declares its rows.
  for (const name of addressed) {
    if (!rowsDeclared.has(name) && !isBuiltIn(name)) diagnostics.push({ code: "unknown-target", layout: name });
  }

  // A compact counterpart is resolved the same way, and separately: it is a layout this
  // list points at rather than one it addresses, so reporting it through `addressed` would
  // name a custom layout the author never wrote.
  for (const [layout, target] of compactTargets) {
    if (!rowsDeclared.has(target) && !isBuiltIn(target)) {
      diagnostics.push({ code: "unknown-compact", layout, value: target });
    }
  }

  return {
    ...(layouts.size > 0 && { layouts }),
    ...(meta.size > 0 && { layoutMeta: meta }),
    ...(localeLayouts.size > 0 && { localeLayouts }),
    ...(middleware.size > 0 && { middleware }),
    ...(variants.size > 0 && { variants }),
    diagnostics,
  };
}

/**
 * One diagnostic as a sentence: what was rejected, then how to fix it. `vocab` supplies
 * the surface names the twins spell differently, so the facts stay identical while the
 * remedy names the API the reader actually has.
 */
export function describeDiagnostic(d: LayoutDiagnostic, vocab: DiagnosticVocabulary): string {
  const on = `on the ${vocab.customLayout} for "${d.layout}"`;
  switch (d.code) {
    case "empty-name":
      return (
        `A ${vocab.customLayout} in the ${vocab.customLayouts} declares no name, so nothing resolves it. ` +
        `Set "name" to the layout it declares or overlays.`
      );
    case "invalid-rows":
      return (
        `"rows" ${on} is not a layout definition. Expected a non-empty array of non-empty rows ` +
        `where every key has a non-empty string "value". The custom layout's other facets still apply.`
      );
    case "invalid-variants": {
      const expectation =
        `is not a variant table. Expected a non-empty object mapping lowercase base letters ` +
        `to arrays of non-empty glyph strings; an empty array suppresses that letter.`;
      // The host raises this code for its own `defaultVariants`, which names no layout.
      if (!d.layout) return `"defaultVariants" ${expectation}`;
      return `"variants" ${on} ${expectation} To opt "${d.layout}" out entirely use suppress="Variants".`;
    }
    case "invalid-middleware":
      return (
        `"middleware" ${on} is not a function. Supply a factory returning a CompositionMiddleware; ` +
        `to disable the built-in use suppress="Middleware".`
      );
    case "invalid-locale":
      return `"locales" ${on} contains an empty entry. Every entry must be a non-empty BCP-47 prefix, e.g. "pl" or "de-at".`;
    case "unknown-target":
      return (
        `The ${vocab.customLayout} for "${d.layout}" declares facets but no "rows", and no layout of ` +
        `that name exists, so nothing resolves it. Add "rows", or correct the name - the built-ins ` +
        `are: ${vocab.builtInLayouts.join(", ")}.`
      );
    case "unknown-suppress":
      return (
        `"suppress" ${on} names "${d.value}", which is not a suppressible facet. Valid facets are: ` +
        `${SUPPRESSIBLE_FACETS.join(", ")}. Rows cannot be suppressed: a custom layout shadows a ` +
        `built-in layout, it never removes it.`
      );
    case "unknown-compact":
      return (
        `"compact" ${on} names "${d.value}", and no layout of that name exists, so the keyboard keeps ` +
        `"${d.layout}" however narrow it gets. Declare "${d.value}" with its own "rows", or correct the ` +
        `name - the built-ins are: ${vocab.builtInLayouts.join(", ")}.`
      );
    case "duplicate-rows":
      return `Two custom layouts declare "rows" for "${d.layout}"; the later one wins. Remove one, or give them different names.`;
    case "duplicate-middleware":
      return `Two custom layouts declare "middleware" for "${d.layout}"; the later one wins. Remove one, or give them different names.`;
    case "duplicate-locale":
      return `Both "${d.layout}" and "${d.other}" claim the locale "${d.value}"; "${d.other}" wins. Remove the prefix from one of them.`;
  }
}
