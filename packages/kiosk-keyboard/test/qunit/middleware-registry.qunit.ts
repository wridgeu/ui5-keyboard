import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareForLayout,
  deactivateMiddleware,
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
  const mw = getMiddlewareForLayout("ja-kana");
  assert.notStrictEqual(mw, null, "Middleware returned for registered layout");
});

QUnit.test("Registers the same factory for multiple layouts", (assert) => {
  _registerMiddleware(["ja-kana", "ja-kana-fk"], mockFactory);
  assert.notStrictEqual(getMiddlewareForLayout("ja-kana"), null, "ja-kana has middleware");
  assert.notStrictEqual(getMiddlewareForLayout("ja-kana-fk"), null, "ja-kana-fk has middleware");
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
  const mw = getMiddlewareForLayout("ja-kana")!;
  assert.strictEqual(mw.handleKey("x", document.createElement("input")), true, "First factory is used, not second");
});

QUnit.test("Returns null for layouts without middleware", (assert) => {
  assert.strictEqual(getMiddlewareForLayout("qwerty"), null, "No middleware for unregistered layout");
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
  const mw = getMiddlewareForLayout("ja-kana")!;
  assert.strictEqual(mw.commit(), "override", "Public registerMiddleware overwrites built-in factory");
});

// --- getMiddlewareForLayout ---

QUnit.module("middleware-registry - getMiddlewareForLayout", { afterEach: commonAfterEach });

QUnit.test("Creates a fresh instance from factory on first call", (assert) => {
  let callCount = 0;
  const factory = (): CompositionMiddleware => {
    callCount++;
    return { handleKey: () => false, commit: () => null, reset: () => {} };
  };
  _registerMiddleware(["ja-kana"], factory);
  getMiddlewareForLayout("ja-kana");
  assert.strictEqual(callCount, 1, "Factory called exactly once");
});

QUnit.test("Returns the same instance on subsequent calls", (assert) => {
  _registerMiddleware(["ja-kana"], mockFactory);
  const a = getMiddlewareForLayout("ja-kana");
  const b = getMiddlewareForLayout("ja-kana");
  assert.strictEqual(a, b, "Same instance returned on second call");
});

QUnit.test("Creates a new instance after deactivateMiddleware", (assert) => {
  let callCount = 0;
  const factory = (): CompositionMiddleware => {
    callCount++;
    return { handleKey: () => false, commit: () => null, reset: () => {} };
  };
  _registerMiddleware(["ja-kana"], factory);
  getMiddlewareForLayout("ja-kana");
  deactivateMiddleware("ja-kana");
  getMiddlewareForLayout("ja-kana");
  assert.strictEqual(callCount, 2, "Factory called again after deactivation");
});
