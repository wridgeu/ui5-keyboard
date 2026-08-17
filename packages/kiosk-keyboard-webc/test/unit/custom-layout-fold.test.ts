import { describe, it, expect } from "vitest";
import type { CustomLayoutSpec, LayoutDefinition } from "../../src/types.js";
import {
  EMPTY_FOLD,
  SUPPRESSIBLE_FACETS,
  describeDiagnostic,
  foldCustomLayouts,
  isValidLayoutDefinition,
  isValidVariantTable,
  type CustomLayoutFold,
  type DiagnosticCode,
  type DiagnosticVocabulary,
} from "../../src/core/custom-layout-fold.js";

// Unit coverage for the fold that turns an ordered list of custom layouts into
// the per-facet lookup maps the resolution paths read: the merge rule each facet
// keeps, the suppression that discards an inherited value at one custom layout's
// position, and every diagnostic the fold can raise.

const ROWS: LayoutDefinition = [[{ value: "a" }]];
const OTHER_ROWS: LayoutDefinition = [[{ value: "b" }]];
const mw = (): never => {
  throw new Error("the fold must never call a middleware factory");
};
const otherMw = (): never => {
  throw new Error("the fold must never call a middleware factory");
};

/** Only these two names resolve without rows, so everything else is an `unknown-target`. */
const isBuiltIn = (name: string): boolean => name === "qwerty" || name === "ja-kana";

/**
 * A spec as the slot delivers it. `middleware` reaches the fold from an attribute
 * or from plain JS, where nothing has checked it is callable, which is what the
 * `invalid-middleware` diagnostic exists for.
 */
type DeclaredSpec = Omit<CustomLayoutSpec, "middleware"> & {
  readonly middleware?: CustomLayoutSpec["middleware"] | string | number;
};

const fold = (...specs: DeclaredSpec[]): CustomLayoutFold => foldCustomLayouts(specs as CustomLayoutSpec[], isBuiltIn);
const codes = (f: CustomLayoutFold): DiagnosticCode[] => f.diagnostics.map((d) => d.code);

const VOCAB: DiagnosticVocabulary = {
  customLayouts: "customLayouts slot",
  customLayout: "<kiosk-keyboard-custom-layout>",
  builtInLayouts: ["qwerty", "ja-kana"],
};

describe("custom-layout-fold shape", () => {
  it("no custom layouts folds to the shared empty result", () => {
    expect(foldCustomLayouts([], isBuiltIn), "the same frozen object").toBe(EMPTY_FOLD);
    expect(EMPTY_FOLD.diagnostics).toEqual([]);
  });

  it("a facet nothing declared is absent rather than an empty map", () => {
    const f = fold({ name: "qwerty", rows: ROWS });
    expect(f.layouts).toBeInstanceOf(Map);
    expect(f.layoutMeta).toBeUndefined();
    expect(f.localeLayouts).toBeUndefined();
    expect(f.middleware).toBeUndefined();
    expect(f.variants).toBeUndefined();
  });

  it("names are matched after trim and lowercase", () => {
    const f = fold({ name: "  QWERTY ", rows: ROWS, locales: [" PL "] });
    expect([...f.layouts!.keys()]).toEqual(["qwerty"]);
    expect([...f.localeLayouts!]).toEqual([["pl", "qwerty"]]);
  });
});

describe("custom-layout-fold per-facet merge rules", () => {
  it("rows: the last declaration wins and the earlier one is reported", () => {
    const f = fold({ name: "x", rows: ROWS }, { name: "x", rows: OTHER_ROWS });
    expect(f.layouts!.get("x")).toBe(OTHER_ROWS);
    expect(codes(f)).toEqual(["duplicate-rows"]);
  });

  it("rows: a custom layout that declares none leaves the previous standing", () => {
    const f = fold({ name: "x", rows: ROWS }, { name: "x", keycapLang: "pl" });
    expect(f.layouts!.get("x"), "the rows survive the overlay").toBe(ROWS);
    expect(f.layoutMeta!.get("x")!.lang).toBe("pl");
    expect(codes(f)).toEqual([]);
  });

  it("metadata: attributes merge per attribute across custom layouts", () => {
    const f = fold(
      { name: "x", rows: ROWS, keycapLang: "pl", secondary: true },
      { name: "x", secondary: false },
      { name: "x", keycapLang: "cs" },
    );
    expect(f.layoutMeta!.get("x")).toEqual({ lang: "cs", secondary: false });
  });

  it("metadata: an absent attribute contributes nothing, so the tier below shows through", () => {
    expect(fold({ name: "qwerty", locales: ["pl"] }).layoutMeta).toBeUndefined();
  });

  it("metadata: secondary false is a declaration, not an absence", () => {
    expect(fold({ name: "ja-kana", secondary: false }).layoutMeta!.get("ja-kana")).toEqual({ secondary: false });
  });

  it("locales: prefixes union, and the last claim on one prefix wins", () => {
    const f = fold(
      { name: "qwerty", locales: ["pl", "pl-pl"] },
      { name: "ja-kana", rows: ROWS, locales: ["ja"] },
      { name: "ja-kana", locales: ["pl"] },
    );
    expect(f.localeLayouts!.get("pl"), "the later claim wins").toBe("ja-kana");
    expect(f.localeLayouts!.get("pl-pl")).toBe("qwerty");
    expect(f.localeLayouts!.get("ja")).toBe("ja-kana");
    expect(codes(f)).toEqual(["duplicate-locale"]);
  });

  it("locales: a prefix re-claimed by the same layout is not a collision", () => {
    expect(codes(fold({ name: "qwerty", locales: ["pl"] }, { name: "qwerty", locales: ["pl"] }))).toEqual([]);
  });

  it("middleware: the last declaration wins and the earlier one is reported", () => {
    const f = fold({ name: "qwerty", middleware: mw }, { name: "qwerty", middleware: otherMw });
    expect(f.middleware!.get("qwerty")).toBe(otherMw);
    expect(codes(f)).toEqual(["duplicate-middleware"]);
  });

  it("variants: tables accumulate per base letter across custom layouts", () => {
    const f = fold({ name: "qwerty", variants: { a: ["ą"] } }, { name: "qwerty", variants: { z: ["ź"] } });
    expect(f.variants!.get("qwerty")).toEqual({ replace: false, table: { a: ["ą"], z: ["ź"] } });
  });

  it("variants: a letter mapped to an empty list keeps its marker in the overlay", () => {
    // The overlay is still a patch: the deletion happens when it meets a real table, so
    // dropping the marker here would lose a suppression aimed at the built-in tier.
    const f = fold({ name: "qwerty", variants: { a: ["ą"], z: ["ź"] } }, { name: "qwerty", variants: { a: [] } });
    expect(f.variants!.get("qwerty")!.table, "the marker survives accumulation").toEqual({ a: [], z: ["ź"] });
  });
});

describe("custom-layout-fold suppress", () => {
  it("Variants alone opts the layout out of every tier below it", () => {
    expect(fold({ name: "qwerty", suppress: ["Variants"] }).variants!.get("qwerty")).toEqual({
      replace: true,
      table: null,
    });
  });

  it("Variants discards what an earlier custom layout contributed", () => {
    const f = fold({ name: "qwerty", variants: { a: ["ą"] } }, { name: "qwerty", suppress: ["Variants"] });
    expect(f.variants!.get("qwerty")).toEqual({ replace: true, table: null });
  });

  it("a table on the same custom layout that suppresses stands alone", () => {
    const f = fold({ name: "qwerty", suppress: ["Variants"], variants: { a: ["ą"] } });
    expect(f.variants!.get("qwerty")).toEqual({ replace: true, table: { a: ["ą"] } });
  });

  it("Middleware alone disables the built-in factory for the layout", () => {
    const f = fold({ name: "ja-kana", suppress: ["Middleware"] });
    expect(f.middleware!.get("ja-kana"), "a stored null, distinct from an absent entry").toBeNull();
    expect(f.middleware!.has("ja-kana"), "which is why the read side must use has(), not ??").toBe(true);
  });

  it("a factory on the same custom layout that suppresses still applies", () => {
    const f = fold({ name: "ja-kana", suppress: ["Middleware"], middleware: mw });
    expect(f.middleware!.get("ja-kana")).toBe(mw);
  });

  it("both facets are suppressible at once", () => {
    const f = fold({ name: "qwerty", suppress: [...SUPPRESSIBLE_FACETS] });
    expect(f.middleware!.get("qwerty")).toBeNull();
    expect(f.variants!.get("qwerty")).toEqual({ replace: true, table: null });
    expect(codes(f)).toEqual([]);
  });
});

describe("custom-layout-fold diagnostics", () => {
  it("empty-name: a custom layout with no name resolves nothing", () => {
    const f = fold({ name: "   ", rows: ROWS });
    expect(codes(f)).toEqual(["empty-name"]);
    expect(f.layouts).toBeUndefined();
  });

  it("invalid-rows: a rejected rows drops only that facet, and reports alone", () => {
    const f = fold({ name: "notalayout", rows: [], keycapLang: "pl" });
    expect(codes(f), "never also unknown-target: one mistake, one warning").toEqual(["invalid-rows"]);
    expect(f.layouts).toBeUndefined();
    expect(f.layoutMeta!.get("notalayout")!.lang, "the other facets still apply").toBe("pl");
  });

  it("invalid-variants: a table that is not a variant table is dropped", () => {
    const f = fold({ name: "qwerty", variants: { A: ["ą"] } });
    expect(codes(f)).toEqual(["invalid-variants"]);
    expect(f.variants).toBeUndefined();
  });

  it("invalid-middleware: a non-function factory is dropped", () => {
    const f = fold({ name: "qwerty", middleware: "nope" });
    expect(codes(f)).toEqual(["invalid-middleware"]);
    expect(f.middleware).toBeUndefined();
  });

  it("invalid-locale: an empty prefix is dropped without touching its siblings", () => {
    const f = fold({ name: "qwerty", locales: ["pl", "  "] });
    expect(codes(f)).toEqual(["invalid-locale"]);
    expect([...f.localeLayouts!.keys()]).toEqual(["pl"]);
  });

  it("unknown-suppress: a token outside the facet set is dropped", () => {
    const f = fold({ name: "qwerty", suppress: ["Varients"] });
    expect(codes(f)).toEqual(["unknown-suppress"]);
    expect(f.variants).toBeUndefined();
  });

  it("unknown-target: an overlay on a layout that does not exist", () => {
    expect(codes(fold({ name: "typo", locales: ["pl"] }))).toEqual(["unknown-target"]);
  });

  it("unknown-target: rows still waiting on a binding are declared, not unresolvable", () => {
    // Only the UI5 twin can produce this, but the fold is shared, so it is pinned here too.
    const f = fold({ name: "bound-layout", rowsPending: true, keycapLang: "pl" });
    expect(codes(f)).toEqual([]);
    expect(f.layouts).toBeUndefined();
    expect(f.layoutMeta!.get("bound-layout")!.lang).toBe("pl");
  });

  it("unknown-target: resolvability is read from the complete list, not the prefix", () => {
    const f = fold({ name: "x", locales: ["pl"] }, { name: "x", rows: ROWS });
    expect(codes(f), "an overlay may precede the custom layout declaring its rows").toEqual([]);
  });

  it("unknown-target: a built-in name needs no rows", () => {
    expect(codes(fold({ name: "ja-kana", suppress: ["Middleware"] }))).toEqual([]);
  });
});

describe("describeDiagnostic", () => {
  it("every code renders a sentence naming the twin's own surface", () => {
    const f = fold(
      { name: "" },
      { name: "typo", locales: ["pl", " "], suppress: ["Varients"], middleware: 1 },
      { name: "x", rows: [] },
      { name: "x", rows: ROWS, variants: { A: [] } },
      { name: "x", rows: ROWS, middleware: mw },
      { name: "x", middleware: otherMw, locales: ["pl"] },
    );
    const expected: DiagnosticCode[] = [
      "empty-name",
      "invalid-rows",
      "invalid-variants",
      "invalid-middleware",
      "invalid-locale",
      "unknown-target",
      "unknown-suppress",
      "duplicate-rows",
      "duplicate-middleware",
      "duplicate-locale",
    ];
    const seen = new Set(codes(f));
    for (const code of expected) expect(seen.has(code), `${code} is triggered by the fixture`).toBe(true);
    expect(seen.size, "and the fixture triggers nothing else").toBe(expected.length);
    for (const d of f.diagnostics) {
      const message = describeDiagnostic(d, VOCAB);
      expect(message.endsWith("."), `${d.code} renders a complete sentence`).toBe(true);
      expect(message.includes("undefined"), `${d.code} interpolates no missing field`).toBe(false);
    }
  });

  it("the vocabulary is what the twins spell differently", () => {
    const message = describeDiagnostic({ code: "unknown-target", layout: "typo" }, VOCAB);
    expect(message).toContain("<kiosk-keyboard-custom-layout>");
    expect(message).toContain("qwerty, ja-kana");
  });

  it("the host's own table is named rather than attributed to a layout", () => {
    const message = describeDiagnostic({ code: "invalid-variants", layout: "" }, VOCAB);
    expect(message.startsWith('"defaultVariants"')).toBe(true);
    expect(message).not.toContain('for ""');
  });
});

describe("custom-layout-fold validators", () => {
  it("isValidLayoutDefinition rejects the shapes that are not rows", () => {
    expect(isValidLayoutDefinition(ROWS)).toBe(true);
    expect(isValidLayoutDefinition([]), "empty").toBe(false);
    expect(isValidLayoutDefinition([[]]), "an empty row").toBe(false);
    expect(isValidLayoutDefinition([[null]]), "a null key").toBe(false);
    expect(isValidLayoutDefinition([[{ value: "" }]]), "an empty key value").toBe(false);
    expect(isValidLayoutDefinition("rows"), "a string").toBe(false);
  });

  it("isValidVariantTable rejects the shapes that are not tables", () => {
    expect(isValidVariantTable({ a: ["ą"] })).toBe(true);
    expect(isValidVariantTable({ a: [] }), "an empty list suppresses that letter").toBe(true);
    expect(isValidVariantTable({}), "empty").toBe(false);
    expect(isValidVariantTable([]), "an array").toBe(false);
    expect(isValidVariantTable(new Map()), "an exotic object").toBe(false);
    expect(isValidVariantTable({ A: ["ą"] }), "an uppercased base letter").toBe(false);
    expect(isValidVariantTable({ a: [""] }), "an empty glyph").toBe(false);
  });
});
