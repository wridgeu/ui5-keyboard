import { resolveModifier, detectPlatform } from "ui5/hotkeys/platform";
import { Platform } from "ui5/hotkeys/library";
import Device from "sap/ui/Device";

const sandbox = sinon.createSandbox();

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

QUnit.module("platform - detectPlatform mapping", {
  afterEach() {
    sandbox.restore();
  },
});

/** Stand in for the framework's OS detection, which reads the real user agent. */
function stubOs(os: Partial<typeof Device.os>): void {
  sandbox.stub(Device, "os").value({ macintosh: false, ios: false, windows: false, linux: false, ...os });
}

QUnit.test("macOS resolves to Mac, so Mod means Command", (assert) => {
  stubOs({ macintosh: true });
  assert.strictEqual(detectPlatform(), Platform.Mac);
});

QUnit.test("iOS resolves to Mac: an iPad keyboard carries Command, not Ctrl", (assert) => {
  stubOs({ ios: true });
  assert.strictEqual(detectPlatform(), Platform.Mac);
});

QUnit.test("Windows resolves to Windows", (assert) => {
  stubOs({ windows: true });
  assert.strictEqual(detectPlatform(), Platform.Windows);
});

QUnit.test("Anything else falls through to Linux", (assert) => {
  stubOs({ linux: true });
  assert.strictEqual(detectPlatform(), Platform.Linux);
  stubOs({ android: true } as Partial<typeof Device.os>);
  assert.strictEqual(detectPlatform(), Platform.Linux, "an unlisted OS takes the same fallback");
});
