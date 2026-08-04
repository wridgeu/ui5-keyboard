import { describe, it, expect, vi } from "vitest";

// Drive locale resolution through the framework's getLocale(). The same mock
// pattern (controlling the UI5 WC dependency) is used in i18n.test.ts. getLocale
// itself (configured-language vs browser fallback) is the framework's concern;
// here we only assert that getLocaleLayout maps its language/region to a layout.
const localeState = vi.hoisted(() => ({ language: "en", region: "", throws: false }));
vi.mock("@ui5/webcomponents-base/dist/locale/getLocale.js", () => ({
  default: () => {
    if (localeState.throws) throw new Error("malformed locale");
    return { getLanguage: () => localeState.language, getRegion: () => localeState.region };
  },
}));

import {
  getRegisteredLayout,
  getLayoutOrDefault,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  getLocaleLayout,
} from "../../src/core/layout-registry.js";
import type { LayoutDefinition } from "../../src/types.js";

const CUSTOM_LAYOUT: LayoutDefinition = [[{ value: "a" }, { value: "b" }, { value: "c" }]];

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
      // Instance-only names are scoped per element and never appear globally.
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
      const layout = getLayoutOrDefault(undefined as unknown as string);
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
    function withLocale<T>(language: string, region: string, fn: () => T): T {
      const prevLang = localeState.language;
      const prevRegion = localeState.region;
      localeState.language = language;
      localeState.region = region;
      try {
        return fn();
      } finally {
        localeState.language = prevLang;
        localeState.region = prevRegion;
      }
    }

    it("returns default layout when getLocale throws", () => {
      localeState.throws = true;
      try {
        expect(getLocaleLayout()).toBe("qwerty");
      } finally {
        localeState.throws = false;
      }
    });

    it.each([
      ["en", "", "qwerty"],
      ["de", "", "qwertz-de"],
      ["ja", "JP", "ja-romaji"],
      ["ar", "", "arabic"],
      ["ar", "SA", "arabic"],
      ["ko", "", "ko-hangul"],
      ["ko", "KR", "ko-hangul"],
      ["es", "", "qwerty-es"],
      ["es", "ES", "qwerty-es"],
    ])("resolves %s-%s to %s via built-in locale mapping", (language, region, expected) => {
      withLocale(language, region, () => {
        expect(getLocaleLayout()).toBe(expected);
      });
    });

    it("instance locale map shadows built-in locale map", () => {
      withLocale("de", "", () => {
        const instanceLocale = new Map([["de", "qwerty"]]);
        expect(getLocaleLayout(instanceLocale)).toBe("qwerty");
      });
    });

    it("instance locale map can resolve to instance-only layout", () => {
      withLocale("xx", "", () => {
        const instanceLocale = new Map([["xx", "warehouse"]]);
        const instanceLayouts = new Map([["warehouse", CUSTOM_LAYOUT]]);
        expect(getLocaleLayout(instanceLocale, instanceLayouts)).toBe("warehouse");
      });
    });

    it("does not resolve mapping when target layout is not registered", () => {
      withLocale("xx", "", () => {
        const instanceLocale = new Map([["xx", "missing-layout"]]);
        expect(getLocaleLayout(instanceLocale)).toBe("qwerty");
      });
    });

    it("exact BCP-47 match takes precedence over language prefix", () => {
      withLocale("de", "CH", () => {
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
      expect(getRegisteredLayout(42 as unknown as string)).toBeUndefined();
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
      expect(isBuiltInLayout(123 as unknown as string)).toBe(false);
    });

    it("returns false for empty string", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(isBuiltInLayout("")).toBe(false);
    });
  });
});
