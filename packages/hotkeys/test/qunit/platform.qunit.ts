import { resolveModifier, detectPlatform, _resetPlatformCache } from "ui5/hotkeys/platform";

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

// ──────────────────────────────────────────────
// detectPlatform (C4)
// ──────────────────────────────────────────────

QUnit.module("platform - detectPlatform");

QUnit.test("Returns a valid platform", (assert) => {
  const platform = detectPlatform();
  assert.ok(["mac", "windows", "linux"].includes(platform), `Platform "${platform}" is valid`);
});

QUnit.test("Caching: returns same result on repeated calls", (assert) => {
  const first = detectPlatform();
  const second = detectPlatform();
  assert.strictEqual(first, second, "Cached result returned");
});

QUnit.test("_resetPlatformCache: after reset, still returns valid platform", (assert) => {
  const before = detectPlatform();
  _resetPlatformCache();
  const after = detectPlatform();
  assert.ok(["mac", "windows", "linux"].includes(after), `Platform "${after}" is valid after reset`);
  assert.strictEqual(before, after, "Same platform detected after cache reset");
});
