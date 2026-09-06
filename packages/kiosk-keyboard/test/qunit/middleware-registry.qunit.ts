import { getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";
import type { CompositionMiddleware } from "ui5/kiosk/types";

const BUILT_IN_LAYOUT = "ko-hangul";

QUnit.module("middleware-registry - getMiddlewareFactory");

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
  // Pinned as a function before anything is compared against it: an emptied
  // registry answers every lookup with null, which satisfies an equality
  // between two lookups without either one having normalized anything.
  const builtIn = getMiddlewareFactory(BUILT_IN_LAYOUT);
  assert.strictEqual(typeof builtIn, "function", "The built-in layout has a registered factory");
  assert.strictEqual(
    getMiddlewareFactory("Ko-Hangul "),
    builtIn,
    "Trailing space + mixed case resolves to the same built-in factory",
  );
  assert.strictEqual(getMiddlewareFactory(" KO-HANGUL"), builtIn, "Leading space + uppercase resolves to the same one");
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

QUnit.test("An instance entry of null disables composition for the layout", (assert) => {
  // Distinct from an absent entry: `??` would collapse the two and hand back the
  // built-in Hangul composer, leaving the layout unable to type its rows directly.
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([[BUILT_IN_LAYOUT, null]]));
  assert.strictEqual(factory, null, "the built-in factory is not reached");
});

QUnit.test("Falls through to built-in when instance map lacks the layout", (assert) => {
  const otherFactory = (): CompositionMiddleware => ({
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  });
  const factory = getMiddlewareFactory(BUILT_IN_LAYOUT, new Map([["other", otherFactory]]));
  assert.strictEqual(factory, getMiddlewareFactory(BUILT_IN_LAYOUT), "Returns the exact registered built-in factory");
});
