import { resolveModifier } from "ui5/hotkeys/platform";

QUnit.module("platform - resolveModifier");

QUnit.test("Mod resolves to Meta on macOS", (assert) => {
  assert.strictEqual(resolveModifier("Mod", "mac"), "Meta");
});

QUnit.test("Mod resolves to Control on Windows", (assert) => {
  assert.strictEqual(resolveModifier("Mod", "windows"), "Control");
});

QUnit.test("Mod resolves to Control on Linux", (assert) => {
  assert.strictEqual(resolveModifier("Mod", "linux"), "Control");
});

QUnit.test("Non-Mod modifiers are returned unchanged", (assert) => {
  assert.strictEqual(resolveModifier("Control", "mac"), "Control");
  assert.strictEqual(resolveModifier("Shift", "windows"), "Shift");
  assert.strictEqual(resolveModifier("Alt", "linux"), "Alt");
  assert.strictEqual(resolveModifier("Meta", "mac"), "Meta");
});
