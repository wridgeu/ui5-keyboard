import { describe, it, expect, vi } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import { getRegisteredLayout } from "../../src/core/layout-registry.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import {
  BUILTIN_LAYOUT_META,
  getLayoutMeta,
  type InstanceLayoutMeta,
  type LayoutMeta,
} from "../../src/core/layout-meta.js";

// The module exposes the resolved metadata; these name the two reads under test.
const isSecondaryLayout = (name: string, meta?: InstanceLayoutMeta) => getLayoutMeta(name, meta)?.secondary === true;
const getLayoutLang = (name: string, meta?: InstanceLayoutMeta) => getLayoutMeta(name, meta)?.lang;

// Unit coverage for the per-layout attribute table: which built-in layouts are
// auxiliary surfaces, which ones carry keycaps in a language of their own, and
// the per-attribute fallback that lets an instance layout declare one attribute
// without discarding the rest of the built-in of the same name. composeLayout
// sits alongside because it is the other half of authoring a layout by name.

describe("BUILTIN_LAYOUT_META", () => {
  it("marks the auxiliary surfaces as the only secondary entries", () => {
    for (const name of ["numeric", "special", "fkeys", "nav"]) {
      expect(BUILTIN_LAYOUT_META.get(name)?.secondary, `${name} is secondary`).toBe(true);
      expect(BUILTIN_LAYOUT_META.get(name)?.lang, `${name} keycaps stay in the UI language`).toBeUndefined();
    }
    for (const name of ["ja-romaji", "ja-kana", "ja-kana-compact", "arabic", "ko-hangul"]) {
      expect(BUILTIN_LAYOUT_META.get(name)?.secondary, `${name} declares no secondary flag`).toBeUndefined();
    }
  });

  it("declares the keycap language of the non-Latin scripts", () => {
    expect(BUILTIN_LAYOUT_META.get("ja-kana")?.lang).toBe("ja");
    expect(BUILTIN_LAYOUT_META.get("arabic")?.lang).toBe("ar");
    expect(BUILTIN_LAYOUT_META.get("ko-hangul")?.lang).toBe("ko");
  });

  it("opts ja-romaji out of the variant tier without declaring a language", () => {
    const meta = BUILTIN_LAYOUT_META.get("ja-romaji");
    expect(meta?.variants, "no Latin diacritics on the JIS keycaps").toBeNull();
    expect(meta?.lang, "its keycaps are Latin letters, so they stay in the UI language").toBeUndefined();
  });

  it("has no entry for the Latin layouts, which take every default", () => {
    expect(BUILTIN_LAYOUT_META.get("qwerty")).toBeUndefined();
    expect(BUILTIN_LAYOUT_META.get("qwertz-de")).toBeUndefined();
  });
});

describe("KioskKeyboard.isSecondaryLayout", () => {
  it("is true for the auxiliary surfaces and false for the base layouts", () => {
    for (const name of ["numeric", "special", "fkeys", "nav"]) {
      expect(KioskKeyboard.isSecondaryLayout(name), `${name} is secondary`).toBe(true);
    }
    for (const name of ["qwerty", "qwertz-de", "numpad", "arabic"]) {
      expect(KioskKeyboard.isSecondaryLayout(name), `${name} can be the base layout`).toBe(false);
    }
  });
});

describe("instance metadata", () => {
  it("lets a declared attribute win over the built-in", () => {
    const meta = new Map<string, LayoutMeta>([["arabic", { lang: "fa" }]]);
    expect(getLayoutLang("arabic", meta), "the instance language replaces ar").toBe("fa");
    expect(getLayoutLang("arabic"), "without the instance map the built-in still answers").toBe("ar");
  });

  it("falls back per attribute to the built-in of the same name", () => {
    const meta = new Map<string, LayoutMeta>([["arabic", { secondary: true }]]);
    expect(isSecondaryLayout("arabic", meta), "the declared flag takes effect").toBe(true);
    expect(getLayoutLang("arabic", meta), "the undeclared language still resolves from the built-in").toBe("ar");
  });

  it("resolves a bare-rows entry, which declares nothing, as the built-in", () => {
    const meta = new Map<string, LayoutMeta>([["numeric", {}]]);
    expect(isSecondaryLayout("numeric", meta), "numeric stays an auxiliary surface").toBe(true);
    expect(getLayoutLang("ja-kana", new Map<string, LayoutMeta>([["ja-kana", {}]])), "ja-kana stays ja").toBe("ja");
  });

  it("resolves an instance-only name from the instance entry alone", () => {
    const meta = new Map<string, LayoutMeta>([["greek", { lang: "el", secondary: true }]]);
    expect(getLayoutLang("greek", meta), "a name with no built-in still carries its language").toBe("el");
    expect(isSecondaryLayout("greek", meta), "and its secondary flag").toBe(true);
  });

  it("does not leak an instance entry for one name onto another", () => {
    const meta = new Map<string, LayoutMeta>([["greek", { lang: "el" }]]);
    expect(getLayoutLang("qwerty", meta), "an unrelated layout is unaffected").toBeUndefined();
  });
});

describe("name matching", () => {
  it("matches names verbatim", () => {
    expect(isSecondaryLayout("Numeric"), "uppercase name does not resolve the numeric entry").toBe(false);
    expect(isSecondaryLayout(" numeric "), "padded name does not resolve either").toBe(false);
    expect(getLayoutLang("ARABIC"), "uppercase name does not resolve the arabic language").toBeUndefined();
    expect(getLayoutLang(" arabic "), "padded name does not resolve it either").toBeUndefined();
  });
});

describe("composeLayout", () => {
  const EXTRA_ROW: LayoutDefinition = [[{ value: "{nav-left}", type: "action" }, { value: "x" }]];

  it("contributes the rows of a built-in named by string", () => {
    const numeric = getRegisteredLayout("numeric")!;
    expect(numeric.length).toBeGreaterThan(0);
    expect(KioskKeyboard.composeLayout("numeric")).toEqual([...numeric]);
  });

  it("concatenates the sources in the order they are listed", () => {
    const numeric = getRegisteredLayout("numeric")!;
    expect(KioskKeyboard.composeLayout(EXTRA_ROW, "numeric")).toEqual([...EXTRA_ROW, ...numeric]);
    expect(KioskKeyboard.composeLayout("numeric", EXTRA_ROW)).toEqual([...numeric, ...EXTRA_ROW]);
  });

  it("drops an unregistered name with a warning and keeps the other sources", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(KioskKeyboard.composeLayout(EXTRA_ROW, "nope")).toEqual([...EXTRA_ROW]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"nope"'));
  });

  it("does not warn for a registered name", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    KioskKeyboard.composeLayout(EXTRA_ROW, "numeric");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns an empty layout when there are no sources", () => {
    expect(KioskKeyboard.composeLayout()).toEqual([]);
  });
});
