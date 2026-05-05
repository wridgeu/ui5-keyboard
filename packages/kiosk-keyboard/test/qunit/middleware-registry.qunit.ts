import { _registerMiddleware, getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";
import type { CompositionMiddleware } from "ui5/kiosk/types";

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

QUnit.module("middleware-registry - _registerMiddleware");

QUnit.test("Registers a factory for a layout", (assert) => {
  const layout = freshLayoutName();
  _registerMiddleware([layout], mockFactory);
  const factory = getMiddlewareFactory(layout);
  assert.notStrictEqual(factory, null, "Factory returned for registered layout");
});

QUnit.test("Registers the same factory for multiple layouts", (assert) => {
  const a = freshLayoutName();
  const b = freshLayoutName();
  _registerMiddleware([a, b], mockFactory);
  assert.notStrictEqual(getMiddlewareFactory(a), null, "First layout has factory");
  assert.notStrictEqual(getMiddlewareFactory(b), null, "Second layout has factory");
});

QUnit.test("Is idempotent -- first write wins", (assert) => {
  const layout = freshLayoutName();
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
  _registerMiddleware([layout], first);
  _registerMiddleware([layout], second);
  const mw = getMiddlewareFactory(layout)!();
  assert.strictEqual(mw.commit(), "a", "First factory is used, not second");
});

QUnit.test("Returns null for layouts without middleware", (assert) => {
  assert.strictEqual(getMiddlewareFactory("not-a-real-layout"), null, "No factory for unregistered layout");
});

QUnit.module("middleware-registry - getMiddlewareFactory");

QUnit.test("Returns the registered factory function", (assert) => {
  const layout = freshLayoutName();
  _registerMiddleware([layout], mockFactory);
  const factory = getMiddlewareFactory(layout);
  assert.strictEqual(typeof factory, "function", "Factory is a function");
});

QUnit.test("Each factory call creates a fresh instance", (assert) => {
  const layout = freshLayoutName();
  _registerMiddleware([layout], mockFactory);
  const factory = getMiddlewareFactory(layout)!;
  const a = factory();
  const b = factory();
  assert.notStrictEqual(a, b, "Each call returns a new instance");
});

QUnit.test("Returns null for unregistered layouts", (assert) => {
  assert.strictEqual(getMiddlewareFactory("nonexistent"), null, "No factory for unregistered layout");
});

QUnit.test("Instance map shadows the built-in factory", (assert) => {
  const layout = freshLayoutName();
  _registerMiddleware([layout], mockFactory);
  const instanceFactory = (): CompositionMiddleware => ({
    handleKey: () => true,
    commit: () => "instance",
    reset: () => {},
  });
  const factory = getMiddlewareFactory(layout, new Map([[layout, instanceFactory]]));
  assert.strictEqual(factory!().commit(), "instance", "Instance map shadows built-in factory");
});

QUnit.test("Falls through to built-in when instance map lacks the layout", (assert) => {
  const layout = freshLayoutName();
  _registerMiddleware([layout], mockFactory);
  const factory = getMiddlewareFactory(layout, new Map([["other", () => mockFactory()]]));
  assert.notStrictEqual(factory, null, "Falls through to built-in factory");
  assert.strictEqual(factory, getMiddlewareFactory(layout), "Returns the exact registered built-in factory");
});
