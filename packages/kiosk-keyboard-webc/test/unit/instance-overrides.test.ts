import { describe, it, expect } from "vitest";
import { getRegisteredLayout, getLayoutOrDefault, getLocaleLayout } from "../../src/core/layout-registry.js";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";
import type { LayoutDefinition, CompositionMiddleware } from "../../src/types.js";

const BUILT_IN_MW_LAYOUT = "ko-hangul";

const layoutA: LayoutDefinition = [[{ value: "a" }]];
const layoutB: LayoutDefinition = [[{ value: "b" }]];

const instanceFactory = (): CompositionMiddleware => ({
  handleKey: () => true,
  commit: () => "instance",
  reset: () => {},
});

describe("instance overrides - layout-registry", () => {
  it("getRegisteredLayout: instance map shadows built-in", () => {
    // qwerty is a built-in
    const fromBuiltIn = getRegisteredLayout("qwerty");
    expect(fromBuiltIn).toBeDefined();

    const instanceMap = new Map([["qwerty", layoutB]]);
    expect(getRegisteredLayout("qwerty", instanceMap)).toEqual(layoutB);
  });

  it("getRegisteredLayout: instance map falls back to built-in when name missing", () => {
    const instanceMap = new Map([["unrelated", layoutB]]);
    const result = getRegisteredLayout("qwerty", instanceMap);
    expect(result).toBeDefined();
    expect(result).not.toEqual(layoutB);
  });

  it("getLayoutOrDefault: instance-only layout resolves without built-in registration", () => {
    const instanceMap = new Map([["instance-only", layoutA]]);
    expect(getLayoutOrDefault("instance-only", instanceMap)).toEqual(layoutA);
    // Without instance map, falls back to qwerty default
    expect(getLayoutOrDefault("instance-only")).not.toEqual(layoutA);
  });

  it("getLayoutOrDefault: instance map can override built-in default", () => {
    const instanceMap = new Map([["qwerty", layoutA]]);
    expect(getLayoutOrDefault("qwerty", instanceMap)).toEqual(layoutA);
  });

  it("getLocaleLayout: instance locale map shadows built-in", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "de", configurable: true });
    try {
      const instanceLayouts = new Map([["warehouse-pos-de", layoutA]]);
      const localeMap = new Map([["de", "warehouse-pos-de"]]);
      expect(getLocaleLayout(localeMap, instanceLayouts)).toBe("warehouse-pos-de");
      // Without override, returns built-in de mapping
      expect(getLocaleLayout()).toBe("qwertz-de");
    } finally {
      Object.defineProperty(navigator, "language", { value: original, configurable: true });
    }
  });

  it("getLocaleLayout: instance locale map can resolve to instance-only layout", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "de", configurable: true });
    try {
      const localeMap = new Map([["de", "warehouse-de"]]);
      const layoutsMap = new Map([["warehouse-de", layoutA]]);
      expect(getLocaleLayout(localeMap, layoutsMap)).toBe("warehouse-de");
    } finally {
      Object.defineProperty(navigator, "language", { value: original, configurable: true });
    }
  });

  it("getLocaleLayout: falls back to default when neither instance nor built-in has the locale", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "zz", configurable: true });
    try {
      expect(getLocaleLayout(new Map([["yy", "qwerty"]]))).toBe("qwerty");
    } finally {
      Object.defineProperty(navigator, "language", { value: original, configurable: true });
    }
  });
});

describe("instance overrides - middleware-registry", () => {
  it("getMiddlewareFactory: instance map shadows built-in", () => {
    const instanceMap = new Map([[BUILT_IN_MW_LAYOUT, instanceFactory]]);
    const factory = getMiddlewareFactory(BUILT_IN_MW_LAYOUT, instanceMap);
    expect(factory!().commit()).toBe("instance");
  });

  it("getMiddlewareFactory: falls back to built-in when key missing in instance map", () => {
    const instanceMap = new Map([["other", instanceFactory]]);
    const factory = getMiddlewareFactory(BUILT_IN_MW_LAYOUT, instanceMap);
    expect(factory).not.toBeNull();
    expect(factory).toBe(getMiddlewareFactory(BUILT_IN_MW_LAYOUT));
  });

  it("getMiddlewareFactory: returns null when neither instance map nor built-in has the layout", () => {
    expect(getMiddlewareFactory("never-registered-layout")).toBeNull();
  });
});
