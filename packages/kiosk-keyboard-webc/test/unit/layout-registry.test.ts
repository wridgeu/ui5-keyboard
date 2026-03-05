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
      spy.mockRestore();
    });

    it("rejects empty layout name", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("", CUSTOM_LAYOUT);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("rejects invalid layout definition", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLayout("bad", [] as unknown as LayoutDefinition);
      expect(getRegisteredLayout("bad")).toBeUndefined();
      spy.mockRestore();
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
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      unregisterLayout("qwerty");
      expect(getRegisteredLayout("qwerty")).toBeDefined();
      spy.mockRestore();
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
      spy.mockRestore();
    });

    it("registerLocaleLayout does not warn for known layout", () => {
      registerLayout("azerty", CUSTOM_LAYOUT);
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("unregisterLocaleLayout removes a mapping without error", () => {
      registerLocaleLayout("fr", "azerty");
      unregisterLocaleLayout("fr");
      // Re-registering should warn again (mapping was removed)
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown layout"));
      spy.mockRestore();
    });

    it("resetLocaleLayouts restores defaults and removes custom mappings", () => {
      registerLocaleLayout("fr", "azerty");
      resetLocaleLayouts();
      // After reset, re-registering "fr" should warn again (custom removed)
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("fr", "azerty");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("rejects empty locale string", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      registerLocaleLayout("", "qwerty");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("non-empty string"));
      spy.mockRestore();
    });
  });
});
