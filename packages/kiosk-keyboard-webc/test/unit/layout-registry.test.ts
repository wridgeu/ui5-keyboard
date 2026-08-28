import { describe, it, expect, vi } from "vitest";
import { getLanguage, setLanguage } from "@ui5/webcomponents-base/dist/config/Language.js";
import getLocale from "@ui5/webcomponents-base/dist/locale/getLocale.js";
import {
  getRegisteredLayout,
  getLayoutOrDefault,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  getLocaleLayout,
} from "../../src/core/layout-registry.js";
import type { LayoutDefinition } from "../../src/types.js";

const CUSTOM_LAYOUT: LayoutDefinition = [[{ value: "a" }, { value: "b" }, { value: "c" }]];

/**
 * Configures the framework language. `setLanguage` is typed for a language tag,
 * but `undefined` is what restores the unconfigured state `getLanguage()` reports
 * before any test has run.
 */
function applyLanguage(language: string | undefined): Promise<void> {
  return setLanguage(language as string);
}

const BUILTIN_NAMES = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "ja-romaji",
  "ja-kana",
  "ja-kana-compact",
  "arabic",
  "ko-hangul",
  "qwerty-es",
];

describe("layout-registry", () => {
  describe("built-in layouts", () => {
    it.each(BUILTIN_NAMES)("recognizes %s as a built-in", (name) => {
      expect(isBuiltInLayout(name)).toBe(true);
    });

    it("returns false for unknown layouts", () => {
      expect(isBuiltInLayout("nonexistent")).toBe(false);
    });

    it("getRegisteredLayoutNames includes built-in layouts", () => {
      const names = getRegisteredLayoutNames();
      for (const name of BUILTIN_NAMES) {
        expect(names).toContain(name);
      }
    });

    it("does not include instance-only names in getRegisteredLayoutNames", () => {
      // Resolved through the instance map first, so the exclusion has something
      // to exclude: the guard is that the lookup does not write the name into
      // the module-level map behind it.
      const custom: LayoutDefinition = [[{ value: "x" }]];
      const instanceMap = new Map([["instance-only", custom]]);
      expect(getRegisteredLayout("instance-only", instanceMap)).toBe(custom);
      expect(getRegisteredLayoutNames()).not.toContain("instance-only");
    });
  });

  describe("instance map - shadows built-ins", () => {
    it("instance map shadows built-in layout of same name", () => {
      const custom: LayoutDefinition = [[{ value: "instance" }]];
      const instanceMap = new Map([["qwerty", custom]]);
      expect(getRegisteredLayout("qwerty", instanceMap)).toBe(custom);
    });

    it("falls through to built-in when instance map lacks the name", () => {
      const instanceMap = new Map([["unrelated", CUSTOM_LAYOUT]]);
      const result = getRegisteredLayout("qwerty", instanceMap);
      expect(result).toBeDefined();
      expect(result).not.toBe(CUSTOM_LAYOUT);
    });

    it("accepts __proto__ / prototype / constructor in instance map", () => {
      for (const name of ["__proto__", "prototype", "constructor"]) {
        const layout: LayoutDefinition = [[{ value: name }]];
        const instanceMap = new Map([[name, layout]]);
        expect(getRegisteredLayout(name, instanceMap)).toBe(layout);
      }
    });
  });

  describe("getLayoutOrDefault", () => {
    it("returns the built-in layout when it exists", () => {
      const layout = getLayoutOrDefault("qwerty");
      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);
    });

    it("returns default for unknown name", () => {
      const fallback = getRegisteredLayout("qwerty");
      expect(getLayoutOrDefault("unknown-name")).toBe(fallback);
    });

    it("instance map shadows built-in for known name", () => {
      const custom: LayoutDefinition = [[{ value: "custom" }]];
      const instanceMap = new Map([["qwerty", custom]]);
      expect(getLayoutOrDefault("qwerty", instanceMap)).toBe(custom);
    });

    it("falls back to instance default when both built-in default and instance entry exist", () => {
      const customDefault: LayoutDefinition = [[{ value: "custom-default" }]];
      const instanceMap = new Map([["qwerty", customDefault]]);
      expect(getLayoutOrDefault("unknown-name", instanceMap)).toBe(customDefault);
    });

    it("returns default for non-string argument", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      // @ts-expect-error a name only plain JS can supply, which is what the guard covers
      const layout = getLayoutOrDefault(undefined);
      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);
    });

    it("returns default for whitespace-only name", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const layout = getLayoutOrDefault("   ");
      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);
    });
  });

  describe("getLocaleLayout", () => {
    /**
     * Configures the framework language `getLocaleLayout` resolves through, then
     * restores the one that was configured before. `setLanguage` is the runtime's
     * own entry point, so `getLocale()` reports the tag exactly as production does.
     */
    async function withLanguage<T>(tag: string, fn: () => T): Promise<T> {
      const previous = getLanguage();
      await applyLanguage(tag);
      try {
        return fn();
      } finally {
        await applyLanguage(previous);
      }
    }

    it("returns default layout when getLocale throws", async () => {
      await withLanguage("!!", () => {
        // getLocale() builds a Locale from the configured tag without guarding it,
        // so a tag that is not BCP-47 throws out of it. Pinned here, or the case
        // below would pass on a tag that merely maps to no layout.
        expect(() => getLocale()).toThrow();
        expect(getLocaleLayout()).toBe("qwerty");
      });
    });

    it.each([
      ["en", "qwerty"],
      ["de", "qwertz-de"],
      ["ja-JP", "ja-romaji"],
      ["ar", "arabic"],
      ["ar-SA", "arabic"],
      ["ko", "ko-hangul"],
      ["ko-KR", "ko-hangul"],
      ["es", "qwerty-es"],
      ["es-ES", "qwerty-es"],
    ])("resolves %s to %s via built-in locale mapping", async (tag, expected) => {
      await withLanguage(tag, () => {
        expect(getLocaleLayout()).toBe(expected);
      });
    });

    it("instance locale map shadows built-in locale map", async () => {
      await withLanguage("de", () => {
        const instanceLocale = new Map([["de", "qwerty"]]);
        expect(getLocaleLayout(instanceLocale)).toBe("qwerty");
      });
    });

    it("instance locale map can resolve to instance-only layout", async () => {
      await withLanguage("xx", () => {
        const instanceLocale = new Map([["xx", "warehouse"]]);
        const instanceLayouts = new Map([["warehouse", CUSTOM_LAYOUT]]);
        expect(getLocaleLayout(instanceLocale, instanceLayouts)).toBe("warehouse");
      });
    });

    it("does not resolve mapping when target layout is not registered", async () => {
      await withLanguage("xx", () => {
        const instanceLocale = new Map([["xx", "missing-layout"]]);
        expect(getLocaleLayout(instanceLocale)).toBe("qwerty");
      });
    });

    it("exact BCP-47 match takes precedence over language prefix", async () => {
      await withLanguage("de-CH", () => {
        const instanceLocale = new Map([
          ["de", "qwertz-de"],
          ["de-ch", "qwerty"],
        ]);
        expect(getLocaleLayout(instanceLocale)).toBe("qwerty");
      });
    });
  });

  describe("getRegisteredLayout - normalization", () => {
    it("rejects non-string name and warns", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // @ts-expect-error a name only plain JS can supply, which is what the guard covers
      expect(getRegisteredLayout(42)).toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
    });

    it("rejects whitespace-only name and warns", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(getRegisteredLayout("   \t  ")).toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("non-empty string"));
    });

    it("trims and lowercases input when matching built-ins", () => {
      expect(getRegisteredLayout("  QWERTY  ")).toBeDefined();
    });
  });

  describe("isBuiltInLayout - negative paths", () => {
    it("returns false for non-string argument", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      // @ts-expect-error a name only plain JS can supply, which is what the guard covers
      expect(isBuiltInLayout(123)).toBe(false);
    });

    it("returns false for empty string", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(isBuiltInLayout("")).toBe(false);
    });
  });
});
