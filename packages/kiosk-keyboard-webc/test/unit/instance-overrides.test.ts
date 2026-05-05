import { describe, it, expect, vi } from "vitest";
import { getRegisteredLayout, getLayoutOrDefault, getLocaleLayout } from "../../src/core/layout-registry.js";
import { _registerMiddleware, getMiddlewareFactory } from "../../src/core/middleware-registry.js";
import type { LayoutDefinition, CompositionMiddleware } from "../../src/types.js";

// Pull in built-in layouts so the registry is populated.
import "../../src/layouts/qwerty.js";
import "../../src/layouts/qwertz-de.js";
import "../../src/layouts/numeric.js";
import "../../src/layouts/numpad.js";
import "../../src/layouts/special.js";
import "../../src/layouts/ja-kana.js";

const layoutA: LayoutDefinition = [[{ value: "a" }]];
const layoutB: LayoutDefinition = [[{ value: "b" }]];

const noopFactory = (): CompositionMiddleware => ({
  handleKey: () => false,
  commit: () => null,
  reset: () => {},
});

// _registerMiddleware seals on first write per layout, so each test must use
// a fresh, never-registered layout name.
let nextId = 0;
function freshLayoutName(): string {
  return `instance-overrides-mw-${++nextId}`;
}

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
    const layout = freshLayoutName();
    const builtInFactory = vi.fn(noopFactory);
    const instanceFactory = vi.fn(noopFactory);
    _registerMiddleware([layout], builtInFactory);

    const instanceMap = new Map([[layout, instanceFactory]]);
    const factory = getMiddlewareFactory(layout, instanceMap);
    factory!();

    expect(instanceFactory).toHaveBeenCalled();
    expect(builtInFactory).not.toHaveBeenCalled();
  });

  it("getMiddlewareFactory: falls back to built-in when key missing in instance map", () => {
    const layout = freshLayoutName();
    const builtInFactory = vi.fn(noopFactory);
    _registerMiddleware([layout], builtInFactory);

    const instanceMap = new Map([["other", noopFactory]]);
    const factory = getMiddlewareFactory(layout, instanceMap);
    factory!();

    expect(builtInFactory).toHaveBeenCalled();
  });

  it("getMiddlewareFactory: returns null when neither instance map nor built-in has the layout", () => {
    expect(getMiddlewareFactory("never-registered-layout")).toBeNull();
  });
});
