import { describe, it, expect } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import { _registerMiddleware, getMiddlewareFactory } from "../../src/core/middleware-registry.js";

function mockFactory(): CompositionMiddleware {
  return {
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  };
}

// _registerMiddleware seals on first write per layout, so each test must use
// a fresh, never-registered layout name. The built-in side-effect imports
// already claim "ja-kana" and "ko-hangul".
let nextId = 0;
function freshLayoutName(): string {
  return `test-mw-${++nextId}`;
}

describe("middleware-registry", () => {
  describe("_registerMiddleware", () => {
    it("registers a factory for a layout", () => {
      const layout = freshLayoutName();
      _registerMiddleware([layout], mockFactory);
      expect(getMiddlewareFactory(layout)).not.toBeNull();
    });

    it("registers the same factory for multiple layouts", () => {
      const a = freshLayoutName();
      const b = freshLayoutName();
      _registerMiddleware([a, b], mockFactory);
      expect(getMiddlewareFactory(a)).not.toBeNull();
      expect(getMiddlewareFactory(b)).not.toBeNull();
    });

    it("is idempotent -- first write wins", () => {
      const layout = freshLayoutName();
      const first = (): CompositionMiddleware => ({ handleKey: () => true, commit: () => "a", reset: () => {} });
      const second = (): CompositionMiddleware => ({ handleKey: () => false, commit: () => "b", reset: () => {} });
      _registerMiddleware([layout], first);
      _registerMiddleware([layout], second);
      const mw = getMiddlewareFactory(layout)!();
      expect(mw.commit()).toBe("a");
    });

    it("returns null for layouts without middleware", () => {
      expect(getMiddlewareFactory("not-a-real-layout")).toBeNull();
    });
  });

  describe("getMiddlewareFactory", () => {
    it("returns the registered factory function", () => {
      const layout = freshLayoutName();
      _registerMiddleware([layout], mockFactory);
      const factory = getMiddlewareFactory(layout);
      expect(typeof factory).toBe("function");
    });

    it("each factory call creates a fresh instance", () => {
      const layout = freshLayoutName();
      _registerMiddleware([layout], mockFactory);
      const factory = getMiddlewareFactory(layout)!;
      expect(factory()).not.toBe(factory());
    });

    it("returns null for unregistered layouts", () => {
      expect(getMiddlewareFactory("nonexistent")).toBeNull();
    });

    it("instance map shadows the built-in factory", () => {
      const layout = freshLayoutName();
      _registerMiddleware([layout], mockFactory);
      const instanceFactory = (): CompositionMiddleware => ({
        handleKey: () => true,
        commit: () => "instance",
        reset: () => {},
      });
      const factory = getMiddlewareFactory(layout, new Map([[layout, instanceFactory]]));
      expect(factory!().commit()).toBe("instance");
    });

    it("falls through to built-in when instance map lacks the layout", () => {
      const layout = freshLayoutName();
      _registerMiddleware([layout], mockFactory);
      const factory = getMiddlewareFactory(layout, new Map([["other", () => mockFactory()]]));
      expect(factory).not.toBeNull();
      expect(factory).toBe(getMiddlewareFactory(layout));
    });
  });
});
