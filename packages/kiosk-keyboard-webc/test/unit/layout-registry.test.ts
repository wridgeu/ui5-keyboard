import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerLayout,
  unregisterLayout,
  resetCustomLayouts,
  getRegisteredLayout,
  getLayoutOrDefault,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLocaleLayout,
  unregisterLocaleLayout,
  resetLocaleLayouts,
  getLocaleLayout,
  _registerBuiltInLayout,
} from "../../src/core/layout-registry.js";
import type { LayoutDefinition } from "../../src/types.js";

const CUSTOM_LAYOUT: LayoutDefinition = [[{ value: "a" }, { value: "b" }, { value: "c" }]];

describe("layout-registry", () => {
  beforeEach(() => {
    resetCustomLayouts();
    resetLocaleLayouts();
  });

  describe("built-in layouts", () => {
    it("has qwerty as a built-in layout", () => {
      expect(isBuiltInLayout("qwerty")).toBe(true);
    });

    it("has numeric as a built-in layout", () => {
      expect(isBuiltInLayout("numeric")).toBe(true);
    });

    it("has numpad as a built-in layout", () => {
      expect(isBuiltInLayout("numpad")).toBe(true);
    });

    it("has ja-romaji as a built-in layout", () => {
      expect(isBuiltInLayout("ja-romaji")).toBe(true);
    });

    it("has ja-kana as a built-in layout", () => {
      expect(isBuiltInLayout("ja-kana")).toBe(true);
    });

    it("has arabic as a built-in layout", () => {
      expect(isBuiltInLayout("arabic")).toBe(true);
    });

    it("returns false for unknown layouts", () => {
      expect(isBuiltInLayout("nonexistent")).toBe(false);
    });

    it("getRegisteredLayoutNames includes built-in layouts", () => {
      const names = getRegisteredLayoutNames();
      expect(names).toContain("qwerty");
      expect(names).toContain("numeric");
      expect(names).toContain("numpad");
    });
  });

  describe("registerLayout", () => {
    it("registers a custom layout", () => {
      registerLayout("custom", CUSTOM_LAYOUT);
      expect(getRegisteredLayout("custom")).toBe(CUSTOM_LAYOUT);
    });

    it("cannot overwrite built-in layouts", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("qwerty", CUSTOM_LAYOUT);
      expect(spy).toHaveBeenCalled();
    });

    it("rejects empty layout name", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("", CUSTOM_LAYOUT);
      expect(spy).toHaveBeenCalled();
    });

    it("rejects invalid layout definition", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("bad", [] as unknown as LayoutDefinition);
      expect(getRegisteredLayout("bad")).toBeUndefined();
    });

    it("normalizes name to lowercase", () => {
      registerLayout("MyLayout", CUSTOM_LAYOUT);
      expect(getRegisteredLayout("mylayout")).toBe(CUSTOM_LAYOUT);
    });
  });

  describe("unregisterLayout", () => {
    it("removes a custom layout", () => {
      registerLayout("custom", CUSTOM_LAYOUT);
      unregisterLayout("custom");
      expect(getRegisteredLayout("custom")).toBeUndefined();
    });

    it("cannot remove built-in layouts", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      unregisterLayout("qwerty");
      expect(getRegisteredLayout("qwerty")).toBeDefined();
    });
  });

  describe("resetCustomLayouts", () => {
    it("removes all custom layouts", () => {
      registerLayout("a", CUSTOM_LAYOUT);
      registerLayout("b", CUSTOM_LAYOUT);
      resetCustomLayouts();
      expect(getRegisteredLayout("a")).toBeUndefined();
      expect(getRegisteredLayout("b")).toBeUndefined();
    });

    it("keeps built-in layouts", () => {
      resetCustomLayouts();
      expect(getRegisteredLayout("qwerty")).toBeDefined();
    });
  });

  describe("getLayoutOrDefault", () => {
    it("returns the named layout when it exists", () => {
      registerLayout("custom", CUSTOM_LAYOUT);
      expect(getLayoutOrDefault("custom")).toBe(CUSTOM_LAYOUT);
    });

    it("returns default layout for unknown name", () => {
      const layout = getLayoutOrDefault("nonexistent");
      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);
    });
  });

  describe("locale layouts", () => {
    it("registerLocaleLayout warns for unknown layout but does not throw", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown layout"));
    });

    it("registerLocaleLayout does not warn for known layout", () => {
      registerLayout("azerty", CUSTOM_LAYOUT);
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).not.toHaveBeenCalled();
    });

    it("unregisterLocaleLayout removes a mapping without error", () => {
      registerLocaleLayout("fr", "azerty");
      unregisterLocaleLayout("fr");
      // Re-registering should warn again (mapping was removed)
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown layout"));
    });

    it("resetLocaleLayouts restores defaults and removes custom mappings", () => {
      registerLocaleLayout("fr", "azerty");
      resetLocaleLayouts();
      // After reset, re-registering "fr" should warn again (custom removed)
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).toHaveBeenCalled();
    });

    it("rejects empty locale string", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("", "qwerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("non-empty string"));
    });
  });

  describe("getLocaleLayout", () => {
    it("returns default layout when navigator.language is malformed", () => {
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: "", configurable: true });
      try {
        expect(getLocaleLayout()).toBe("qwerty");
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });

    it("resolves ja-JP to ja-romaji via built-in locale mapping", () => {
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: "ja-JP", configurable: true });
      try {
        expect(getLocaleLayout()).toBe("ja-romaji");
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });

    it("resolves ar to arabic via built-in locale mapping", () => {
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: "ar", configurable: true });
      try {
        expect(getLocaleLayout()).toBe("arabic");
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });

    it("resolves ar-SA to arabic via language prefix", () => {
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: "ar-SA", configurable: true });
      try {
        expect(getLocaleLayout()).toBe("arabic");
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });

    it("resolves a registered locale mapping", () => {
      registerLayout("azerty", CUSTOM_LAYOUT);
      registerLocaleLayout("fr", "azerty");
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: "fr-FR", configurable: true });
      try {
        expect(getLocaleLayout()).toBe("azerty");
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });
  });

  describe("registerLayout - negative paths", () => {
    it("rejects non-string name", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout(42 as unknown as string, CUSTOM_LAYOUT);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
      expect(getRegisteredLayout("42")).toBeUndefined();
    });

    it("rejects whitespace-only name", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("   ", CUSTOM_LAYOUT);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("non-empty string"));
    });

    it("rejects layout with empty row", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("bad-rows", [[]] as unknown as LayoutDefinition);
      expect(getRegisteredLayout("bad-rows")).toBeUndefined();
      expect(spy).toHaveBeenCalled();
    });

    it("rejects layout with key missing value", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("bad-key", [[{ label: "x" }]] as unknown as LayoutDefinition);
      expect(getRegisteredLayout("bad-key")).toBeUndefined();
      expect(spy).toHaveBeenCalled();
    });

    it("rejects non-array layout definition", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("bad-type", "not-an-array" as unknown as LayoutDefinition);
      expect(getRegisteredLayout("bad-type")).toBeUndefined();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("unregisterLayout - negative paths", () => {
    it("rejects non-string name", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      unregisterLayout(null as unknown as string);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
    });

    it("is a no-op for unregistered layout name", () => {
      // Should not throw
      unregisterLayout("does-not-exist");
    });
  });

  describe("getLayoutOrDefault - negative paths", () => {
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

  describe("isBuiltInLayout - negative paths", () => {
    it("returns false for non-string argument", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(isBuiltInLayout(123 as unknown as string)).toBe(false);
    });
  });

  describe("locale layouts - negative paths", () => {
    it("registerLocaleLayout rejects non-string locale", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout(42 as unknown as string, "qwerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
    });

    it("registerLocaleLayout rejects non-string layout", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", null as unknown as string);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
    });

    it("unregisterLocaleLayout rejects non-string locale", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      unregisterLocaleLayout(undefined as unknown as string);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("expected a string"));
    });
  });

  describe("_registerBuiltInLayout", () => {
    it("registers a layout and marks it as built-in", () => {
      _registerBuiltInLayout("test-builtin", CUSTOM_LAYOUT);
      expect(getRegisteredLayout("test-builtin")).toBe(CUSTOM_LAYOUT);
      expect(isBuiltInLayout("test-builtin")).toBe(true);
    });

    it("is idempotent -- silently skips if name already exists", () => {
      const first: LayoutDefinition = [[{ value: "x" }]];
      const second: LayoutDefinition = [[{ value: "y" }]];
      _registerBuiltInLayout("idem-test", first);
      _registerBuiltInLayout("idem-test", second);
      expect(getRegisteredLayout("idem-test")).toBe(first);
    });

    it("does not warn on duplicate registration", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      _registerBuiltInLayout("no-warn-test", CUSTOM_LAYOUT);
      _registerBuiltInLayout("no-warn-test", CUSTOM_LAYOUT);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
