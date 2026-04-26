import { resolveModifier, detectPlatform } from "ui5/hotkeys/platform";
import { _resetPlatformCache } from "ui5/hotkeys/internal/platform";
import { Platform } from "ui5/hotkeys/library";

QUnit.module("platform - resolveModifier");

QUnit.test("Mod resolves to Meta on macOS", (assert) => {
  assert.strictEqual(resolveModifier("Mod", Platform.Mac), "Meta");
});

QUnit.test("Mod resolves to Control on Windows", (assert) => {
  assert.strictEqual(resolveModifier("Mod", Platform.Windows), "Control");
});

QUnit.test("Mod resolves to Control on Linux", (assert) => {
  assert.strictEqual(resolveModifier("Mod", Platform.Linux), "Control");
});

QUnit.test("Non-Mod modifiers are returned unchanged", (assert) => {
  assert.strictEqual(resolveModifier("Control", Platform.Mac), "Control");
  assert.strictEqual(resolveModifier("Shift", Platform.Windows), "Shift");
  assert.strictEqual(resolveModifier("Alt", Platform.Linux), "Alt");
  assert.strictEqual(resolveModifier("Meta", Platform.Mac), "Meta");
});

// ──────────────────────────────────────────────
// detectPlatform (C4)
// ──────────────────────────────────────────────

QUnit.module("platform - detectPlatform");

QUnit.test("Returns a valid platform", (assert) => {
  const platform = detectPlatform();
  assert.ok([Platform.Mac, Platform.Windows, Platform.Linux].includes(platform), `Platform "${platform}" is valid`);
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
  assert.ok(
    [Platform.Mac, Platform.Windows, Platform.Linux].includes(after),
    `Platform "${after}" is valid after reset`,
  );
  assert.strictEqual(before, after, "Same platform detected after cache reset");
});
