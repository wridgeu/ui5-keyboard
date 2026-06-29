import { getText, setI18nResolver } from "ui5/kiosk/internal/i18n-registry";
import Lib from "sap/ui/core/Lib";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type ResourceBundle from "sap/base/i18n/ResourceBundle";

const sandbox = sinon.createSandbox();

function stubBaseBundle(texts: Record<string, string>): void {
  sandbox.stub(Lib, "getResourceBundleFor").returns({
    getText(key: string) {
      return texts[key] ?? null;
    },
  } as unknown as ResourceBundle);
}

QUnit.module("i18n-registry", {
  afterEach() {
    sandbox.restore();
    setI18nResolver(null);
  },
});

// getText

QUnit.test("getText returns base bundle text for known key", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtuelle Tastatur" });
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtuelle Tastatur");
});

QUnit.test("getText returns fallback when bundle has no key", (assert) => {
  stubBaseBundle({});
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtual Keyboard");
});

QUnit.test("getText returns fallback when no bundle available", (assert) => {
  sandbox.stub(Lib, "getResourceBundleFor").returns(null as never);
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtual Keyboard");
});

// resolver

QUnit.test("resolver overrides base bundle text", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtual Keyboard" });
  setI18nResolver(() => "Custom Label");
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Custom Label");
});

QUnit.test("resolver receives key, locale, and resolved base text", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtuelle Tastatur" });
  sandbox.stub(Localization, "getLanguageTag").returns({ toString: () => "de" } as never);

  let receivedArgs: [string, string, string] | null = null;
  setI18nResolver((key, locale, resolvedText) => {
    receivedArgs = [key, locale, resolvedText];
    return undefined;
  });

  getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");

  assert.deepEqual(receivedArgs, ["KIOSK_KEYBOARD_LABEL", "de", "Virtuelle Tastatur"]);
});

QUnit.test("resolver returning undefined keeps base text", (assert) => {
  stubBaseBundle({ KEY_SHIFT: "Umschalt" });
  setI18nResolver(() => undefined);
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Umschalt");
});

QUnit.test("resolver error is logged and base text returned", (assert) => {
  stubBaseBundle({ KEY_SHIFT: "Umschalt" });
  const warnSpy = sandbox.spy(Log, "warning");

  setI18nResolver(() => {
    throw new Error("resolver broke");
  });

  const result = getText("KEY_SHIFT", "Shift");
  assert.strictEqual(result, "Umschalt", "Base text used after error");
  assert.ok(warnSpy.calledOnce, "Warning logged");
});

QUnit.test("setting resolver to null clears it", (assert) => {
  stubBaseBundle({ KEY_SHIFT: "Shift" });
  setI18nResolver(() => "override");
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "override", "Resolver active");

  setI18nResolver(null);
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Shift", "Base text used after clear");
});

QUnit.test("non-function argument to setI18nResolver is rejected", (assert) => {
  const resolver = sandbox.spy(() => "override");
  setI18nResolver(resolver);

  const warnSpy = sandbox.spy(Log, "warning");
  setI18nResolver("not a function" as never);

  stubBaseBundle({ KEY_SHIFT: "Shift" });
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "override", "Previous resolver still active");
  assert.ok(warnSpy.calledOnce, "Warning logged");
});

QUnit.test("resolver works with fallback when bundle returns null for key", (assert) => {
  stubBaseBundle({});
  setI18nResolver((_key, _locale, resolvedText) => resolvedText + " (custom)");
  assert.strictEqual(
    getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
    "Virtual Keyboard (custom)",
    "Resolver receives fallback as resolvedText when bundle has no key",
  );
});
