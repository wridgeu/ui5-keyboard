import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Log from "sap/base/Log";
import type { LayoutDefinition } from "ui5/kiosk/types";

// Coverage for the static `composeLayout` splice helper: it reads the global
// registry only, so it is independent of any control's custom layouts.

function makeLayout(label: string): LayoutDefinition {
  return [[{ value: label }]];
}

const sandbox = sinon.createSandbox();

QUnit.module("compose-layout", {
  afterEach() {
    sandbox.restore();
  },
});

QUnit.test("a string source contributes the named built-in's rows", (assert) => {
  const numeric = KioskKeyboard.getRegisteredLayout("numeric")!;
  assert.ok(numeric.length > 0, "the built-in has rows to contribute");
  assert.deepEqual(KioskKeyboard.composeLayout("numeric"), [...numeric], "composed from the registry");
});

QUnit.test("sources are spliced in the order they are listed", (assert) => {
  const extra = makeLayout("x");
  const numeric = KioskKeyboard.getRegisteredLayout("numeric")!;
  assert.deepEqual(KioskKeyboard.composeLayout(extra, "numeric"), [...extra, ...numeric], "rows first");
  assert.deepEqual(KioskKeyboard.composeLayout("numeric", extra), [...numeric, ...extra], "built-in first");
});

QUnit.test("an unregistered name warns and contributes nothing", (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const extra = makeLayout("x");

  assert.deepEqual(KioskKeyboard.composeLayout(extra, "nope"), [...extra], "the other sources survive the typo");
  assert.ok(warn.called, "the dropped source is logged");
});

QUnit.test("composing nothing yields an empty layout", (assert) => {
  assert.deepEqual(KioskKeyboard.composeLayout(), [], "no sources, no rows");
});
