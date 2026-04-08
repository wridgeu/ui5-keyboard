import { describe, it, expect, beforeEach } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareFactory,
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
      const factory = getMiddlewareFactory("ja-kana");
      expect(factory).not.toBeNull();
    });

    it("registers the same factory for multiple layouts", () => {
      _registerMiddleware(["ja-kana", "ja-kana-fk"], mockFactory);
      expect(getMiddlewareFactory("ja-kana")).not.toBeNull();
      expect(getMiddlewareFactory("ja-kana-fk")).not.toBeNull();
    });

    it("is idempotent -- skips if layout already has middleware", () => {
      const first = () => ({ handleKey: () => true, commit: () => "a", reset: () => {} });
      const second = () => ({ handleKey: () => false, commit: () => "b", reset: () => {} });
      _registerMiddleware(["ja-kana"], first);
      _registerMiddleware(["ja-kana"], second);
      const mw = getMiddlewareFactory("ja-kana")!();
      expect(mw.handleKey("x", document.createElement("input"))).toBe(true);
    });

    it("returns null for layouts without middleware", () => {
      expect(getMiddlewareFactory("qwerty")).toBeNull();
    });
  });

  describe("registerMiddleware (public)", () => {
    it("registers middleware that can override built-in", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const override = () => ({ handleKey: () => true, commit: () => "override", reset: () => {} });
      registerMiddleware(["ja-kana"], override);
      const mw = getMiddlewareFactory("ja-kana")!();
      expect(mw.commit()).toBe("override");
    });
  });

  describe("getMiddlewareFactory", () => {
    it("returns the registered factory function", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const factory = getMiddlewareFactory("ja-kana");
      expect(typeof factory).toBe("function");
    });

    it("each factory call creates a fresh instance", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const factory = getMiddlewareFactory("ja-kana")!;
      const a = factory();
      const b = factory();
      expect(a).not.toBe(b);
    });

    it("returns null for unregistered layouts", () => {
      expect(getMiddlewareFactory("nonexistent")).toBeNull();
    });
  });
});
