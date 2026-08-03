import { describe, it, expect } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";

const BUILT_IN_LAYOUT = "ko-hangul";

describe("middleware-registry", () => {
  describe("getMiddlewareFactory", () => {
    it("returns the registered factory function for a built-in layout", () => {
      const factory = getMiddlewareFactory(BUILT_IN_LAYOUT);
      expect(typeof factory).toBe("function");
    });

    it("each factory call creates a fresh instance", () => {
      const factory = getMiddlewareFactory(BUILT_IN_LAYOUT)!;
      expect(factory()).not.toBe(factory());
    });

    it("returns null for unregistered layouts", () => {
      expect(getMiddlewareFactory("nonexistent")).toBeNull();
    });

    it("resolves the layout name case- and whitespace-insensitively (matches the layout registry)", () => {
      // The `layout` attribute is normalized to lowercase when resolving the
      // rendered layout, so the middleware lookup must normalize identically -
      // otherwise `<kiosk-keyboard layout="Ko-Hangul">` renders Hangul but never
      // engages composition.
      expect(typeof getMiddlewareFactory("Ko-Hangul")).toBe("function");
      expect(typeof getMiddlewareFactory("  KO-HANGUL  ")).toBe("function");
    });

    it("instance map shadows the built-in factory", () => {
      const instanceFactory = (): CompositionMiddleware => ({
        handleKey: () => true,
        commit: () => "instance",
        reset: () => {},
      });
      const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([[BUILT_IN_LAYOUT, instanceFactory]]));
      expect(factory!().commit()).toBe("instance");
    });

    it("an instance entry of null disables composition for the layout", () => {
      // Distinct from an absent entry: `??` would collapse the two and hand back the
      // built-in Hangul composer, leaving the layout unable to type its rows directly.
      expect(getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([[BUILT_IN_LAYOUT, null]]))).toBeNull();
    });

    it("falls through to built-in when instance map lacks the layout", () => {
      const otherFactory = (): CompositionMiddleware => ({
        handleKey: () => false,
        commit: () => null,
        reset: () => {},
      });
      const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([["other", otherFactory]]));
      expect(factory).not.toBeNull();
      expect(factory).toBe(getMiddlewareFactory(BUILT_IN_LAYOUT));
    });
  });
});
