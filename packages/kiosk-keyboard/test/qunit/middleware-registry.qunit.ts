import { getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";
import type { CompositionMiddleware } from "ui5/kiosk/types";

const BUILT_IN_LAYOUT = "ko-hangul";

QUnit.module("middleware-registry - getMiddlewareFactory");

QUnit.test("Returns the registered factory function for a built-in layout", (assert) => {
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT);
  assert.strictEqual(typeof factory, "function", "Factory is a function");
});

QUnit.test("Each factory call creates a fresh instance", (assert) => {
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT)!;
  const a = factory();
  const b = factory();
  assert.notStrictEqual(a, b, "Each call returns a new instance");
});

QUnit.test("Returns null for unregistered layouts", (assert) => {
  assert.strictEqual(getMiddlewareFactory("nonexistent"), null, "No factory for unregistered layout");
});

QUnit.test("Lookup normalizes the layout name (trim + lowercase)", (assert) => {
  assert.strictEqual(
    getMiddlewareFactory("Ko-Hangul "),
    getMiddlewareFactory(BUILT_IN_LAYOUT),
    "Trailing space + mixed case resolves to the same built-in factory",
  );
  assert.notStrictEqual(getMiddlewareFactory(" KO-HANGUL"), null, "Leading space + uppercase still resolves");
});

QUnit.test("Instance map shadows the built-in factory", (assert) => {
  const instanceFactory = (): CompositionMiddleware => ({
    handleKey: () => true,
    commit: () => "instance",
    reset: () => {},
  });
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([[BUILT_IN_LAYOUT, instanceFactory]]));
  assert.strictEqual(factory!().commit(), "instance", "Instance map shadows built-in factory");
});

QUnit.test("Falls through to built-in when instance map lacks the layout", (assert) => {
  const otherFactory = (): CompositionMiddleware => ({
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  });
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([["other", otherFactory]]));
  assert.notStrictEqual(factory, null, "Falls through to built-in factory");
  assert.strictEqual(factory, getMiddlewareFactory(BUILT_IN_LAYOUT), "Returns the exact registered built-in factory");
});
