import { describe, it, expect, beforeEach } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareForLayout,
  deactivateMiddleware,
  _resetMiddleware,
} from "../../src/core/middleware-registry.js";

function mockFactory(): CompositionMiddleware {
  return {
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  };
}

describe("middleware-registry", () => {
  beforeEach(() => {
    _resetMiddleware();
  });

  describe("_registerMiddleware", () => {
    it("registers a factory for a layout", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const mw = getMiddlewareForLayout("ja-kana");
      expect(mw).not.toBeNull();
    });

    it("registers the same factory for multiple layouts", () => {
      _registerMiddleware(["ja-kana", "ja-kana-fk"], mockFactory);
      expect(getMiddlewareForLayout("ja-kana")).not.toBeNull();
      expect(getMiddlewareForLayout("ja-kana-fk")).not.toBeNull();
    });

    it("is idempotent -- skips if layout already has middleware", () => {
      const first = () => ({ handleKey: () => true, commit: () => "a", reset: () => {} });
      const second = () => ({ handleKey: () => false, commit: () => "b", reset: () => {} });
      _registerMiddleware(["ja-kana"], first);
      _registerMiddleware(["ja-kana"], second);
      const mw = getMiddlewareForLayout("ja-kana")!;
      expect(mw.handleKey("x", document.createElement("input"))).toBe(true);
    });

    it("returns null for layouts without middleware", () => {
      expect(getMiddlewareForLayout("qwerty")).toBeNull();
    });
  });

  describe("registerMiddleware (public)", () => {
    it("registers middleware that can override built-in", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const override = () => ({ handleKey: () => true, commit: () => "override", reset: () => {} });
      registerMiddleware(["ja-kana"], override);
      const mw = getMiddlewareForLayout("ja-kana")!;
      expect(mw.commit()).toBe("override");
    });
  });

  describe("getMiddlewareForLayout", () => {
    it("creates a fresh instance from factory on first call", () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { handleKey: () => false, commit: () => null, reset: () => {} };
      };
      _registerMiddleware(["ja-kana"], factory);
      getMiddlewareForLayout("ja-kana");
      expect(callCount).toBe(1);
    });

    it("returns the same instance on subsequent calls for same layout", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const a = getMiddlewareForLayout("ja-kana");
      const b = getMiddlewareForLayout("ja-kana");
      expect(a).toBe(b);
    });

    it("creates a new instance after deactivateMiddleware is called", () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { handleKey: () => false, commit: () => null, reset: () => {} };
      };
      _registerMiddleware(["ja-kana"], factory);
      getMiddlewareForLayout("ja-kana");
      deactivateMiddleware("ja-kana");
      getMiddlewareForLayout("ja-kana");
      expect(callCount).toBe(2);
    });
  });
});
