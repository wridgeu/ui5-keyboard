import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerLayout,
  resetCustomLayouts,
  getRegisteredLayout,
  getLayoutOrDefault,
  getLocaleLayout,
  registerLocaleLayout,
  resetLocaleLayouts,
} from "../../src/core/layout-registry.js";
import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareFactory,
  clearCustomMiddleware,
} from "../../src/core/middleware-registry.js";
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

describe("instance overrides - layout-registry", () => {
  beforeEach(() => {
    resetCustomLayouts();
    resetLocaleLayouts();
    clearCustomMiddleware();
  });

  it("getRegisteredLayout: instance map shadows global", () => {
    registerLayout("shared", layoutA);
    const fromGlobal = getRegisteredLayout("shared");
    expect(fromGlobal).toEqual(layoutA);

    const instanceMap = new Map([["shared", layoutB]]);
    const fromInstance = getRegisteredLayout("shared", instanceMap);
    expect(fromInstance).toEqual(layoutB);
  });

  it("getRegisteredLayout: instance map falls back to global when name missing", () => {
    registerLayout("only-global", layoutA);
    const instanceMap = new Map([["unrelated", layoutB]]);
    expect(getRegisteredLayout("only-global", instanceMap)).toEqual(layoutA);
  });

  it("getLayoutOrDefault: instance-only layout resolves without global registration", () => {
    const instanceMap = new Map([["instance-only", layoutA]]);
    expect(getLayoutOrDefault("instance-only", instanceMap)).toEqual(layoutA);
    // Without instance map, falls back to qwerty default
    expect(getLayoutOrDefault("instance-only")).not.toEqual(layoutA);
  });

  it("getLayoutOrDefault: instance map can override built-in default", () => {
    const instanceMap = new Map([["qwerty", layoutA]]);
    expect(getLayoutOrDefault("qwerty", instanceMap)).toEqual(layoutA);
  });

  it("getLocaleLayout: instance locale map shadows global", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "de", configurable: true });
    try {
      registerLayout("warehouse-pos-de", layoutA);
      const localeMap = new Map([["de", "warehouse-pos-de"]]);
      expect(getLocaleLayout(localeMap)).toBe("warehouse-pos-de");
      // Without override, returns global de mapping
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

  it("getLocaleLayout: falls back to default when neither instance nor global has the locale", () => {
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
  beforeEach(() => {
    clearCustomMiddleware();
  });

  it("getMiddlewareFactory: instance map shadows global", () => {
    const globalFactory = vi.fn(noopFactory);
    const instanceFactory = vi.fn(noopFactory);
    registerMiddleware(["pos-layout"], globalFactory);

    const instanceMap = new Map([["pos-layout", instanceFactory]]);
    const factory = getMiddlewareFactory("pos-layout", instanceMap);
    factory!();

    expect(instanceFactory).toHaveBeenCalled();
    expect(globalFactory).not.toHaveBeenCalled();
  });

  it("getMiddlewareFactory: falls back to global when key missing in instance map", () => {
    const globalFactory = vi.fn(noopFactory);
    registerMiddleware(["pos-layout"], globalFactory);

    const instanceMap = new Map([["other", noopFactory]]);
    const factory = getMiddlewareFactory("pos-layout", instanceMap);
    factory!();

    expect(globalFactory).toHaveBeenCalled();
  });

  it("clearCustomMiddleware: removes consumer registrations", () => {
    registerMiddleware(["consumer-layout"], noopFactory);
    expect(getMiddlewareFactory("consumer-layout")).toBeTypeOf("function");

    clearCustomMiddleware();
    expect(getMiddlewareFactory("consumer-layout")).toBeNull();
  });

  it("clearCustomMiddleware: restores overridden built-in to original", () => {
    const originalKana = noopFactory;
    _registerMiddleware(["test-builtin"], originalKana);
    const overrideFactory = vi.fn(noopFactory);
    registerMiddleware(["test-builtin"], overrideFactory);

    expect(getMiddlewareFactory("test-builtin")).toBe(overrideFactory);

    clearCustomMiddleware();
    expect(getMiddlewareFactory("test-builtin")).toBe(originalKana);
  });
});
