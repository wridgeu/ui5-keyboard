import { getKeyAriaLabel, clearLabelWarnings } from "ui5/kiosk/internal/key-labels";
import type { KeyDefinition } from "ui5/kiosk/types";
import Log from "sap/base/Log";

/** Shared sandbox - restored in afterEach so stubs never leak. */
const sandbox = sinon.createSandbox();

/** Icon-only key (label suppressed) with no ariaLabel and no built-in i18n entry. */
function iconOnlyKey(value: string): KeyDefinition {
  return { value, label: "" };
}

QUnit.module("key-labels - getKeyAriaLabel missing-name warning", {
  afterEach() {
    sandbox.restore();
    clearLabelWarnings();
  },
});

QUnit.test("Falls back to the raw value when there is no accessible name", (assert) => {
  sandbox.spy(Log, "warning");
  assert.strictEqual(getKeyAriaLabel(iconOnlyKey("⚙"), false, false), "⚙", "Returns the raw value");
});

QUnit.test("Per-key ariaLabel takes priority over the visible label", (assert) => {
  assert.strictEqual(
    getKeyAriaLabel({ value: "x", label: "", ariaLabel: "Custom" }, false, false),
    "Custom",
    "ariaLabel wins over both the suppressed label and the raw value",
  );
});

QUnit.test("Icon-only special key resolves its i18n name without warning", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(
    getKeyAriaLabel({ value: "{backspace}", label: "" }, false, false),
    "Backspace",
    "SPECIAL_KEY_I18N supplies the accessible name for an icon-only special key",
  );
  assert.notOk(spy.called, "The i18n entry resolves before the missing-name warning fires");
});

QUnit.test("Warns only once per key value across repeated calls (re-render safe)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  getKeyAriaLabel(iconOnlyKey("⚙"), false, false);
  getKeyAriaLabel(iconOnlyKey("⚙"), false, false);
  getKeyAriaLabel(iconOnlyKey("⚙"), true, false);

  assert.strictEqual(spy.callCount, 1, "Repeated lookups for the same key warn once");
});

QUnit.test("Warns separately for distinct key values", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  getKeyAriaLabel(iconOnlyKey("⚙"), false, false);
  getKeyAriaLabel(iconOnlyKey("⚘"), false, false);

  assert.strictEqual(spy.callCount, 2, "Each distinct icon-only key warns once");
});

QUnit.test("clearLabelWarnings resets the warned-once cache", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  getKeyAriaLabel(iconOnlyKey("⚙"), false, false);
  clearLabelWarnings();
  getKeyAriaLabel(iconOnlyKey("⚙"), false, false);

  assert.strictEqual(spy.callCount, 2, "Warning fires again after the cache is cleared");
});
