import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareFactory,
  _resetMiddleware,
} from "ui5/kiosk/internal/middleware-registry";
import type { CompositionMiddleware } from "ui5/kiosk/types";

// --- Helpers ---

function mockFactory(): CompositionMiddleware {
  return {
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  };
}

const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
  _resetMiddleware();
}

// --- _registerMiddleware ---

QUnit.module("middleware-registry - _registerMiddleware", { afterEach: commonAfterEach });

QUnit.test("Registers a factory for a layout", (assert) => {
  _registerMiddleware(["ja-kana"], mockFactory);
  const factory = getMiddlewareFactory("ja-kana");
  assert.notStrictEqual(factory, null, "Factory returned for registered layout");
});

QUnit.test("Registers the same factory for multiple layouts", (assert) => {
  _registerMiddleware(["ja-kana", "ja-kana-fk"], mockFactory);
  assert.notStrictEqual(getMiddlewareFactory("ja-kana"), null, "ja-kana has factory");
  assert.notStrictEqual(getMiddlewareFactory("ja-kana-fk"), null, "ja-kana-fk has factory");
});

QUnit.test("Is idempotent -- first write wins", (assert) => {
  const first = (): CompositionMiddleware => ({
    handleKey: () => true,
    commit: () => "a",
    reset: () => {},
  });
  const second = (): CompositionMiddleware => ({
    handleKey: () => false,
    commit: () => "b",
    reset: () => {},
  });
  _registerMiddleware(["ja-kana"], first);
  _registerMiddleware(["ja-kana"], second);
  const mw = getMiddlewareFactory("ja-kana")!();
  assert.strictEqual(mw.handleKey("x", document.createElement("input")), true, "First factory is used, not second");
});

QUnit.test("Returns null for layouts without middleware", (assert) => {
  assert.strictEqual(getMiddlewareFactory("qwerty"), null, "No factory for unregistered layout");
});

// --- registerMiddleware (public, can override) ---

QUnit.module("middleware-registry - registerMiddleware", { afterEach: commonAfterEach });

QUnit.test("Can override built-in middleware", (assert) => {
  _registerMiddleware(["ja-kana"], mockFactory);
  const override = (): CompositionMiddleware => ({
    handleKey: () => true,
    commit: () => "override",
    reset: () => {},
  });
  registerMiddleware(["ja-kana"], override);
  const mw = getMiddlewareFactory("ja-kana")!();
  assert.strictEqual(mw.commit(), "override", "Public registerMiddleware overwrites built-in factory");
});

// --- getMiddlewareFactory ---

QUnit.module("middleware-registry - getMiddlewareFactory", { afterEach: commonAfterEach });

QUnit.test("Returns the registered factory function", (assert) => {
  _registerMiddleware(["ja-kana"], mockFactory);
  const factory = getMiddlewareFactory("ja-kana");
  assert.strictEqual(typeof factory, "function", "Factory is a function");
});

QUnit.test("Each factory call creates a fresh instance", (assert) => {
  _registerMiddleware(["ja-kana"], mockFactory);
  const factory = getMiddlewareFactory("ja-kana")!;
  const a = factory();
  const b = factory();
  assert.notStrictEqual(a, b, "Each call returns a new instance");
});

QUnit.test("Returns null for unregistered layouts", (assert) => {
  assert.strictEqual(getMiddlewareFactory("nonexistent"), null, "No factory for unregistered layout");
});
