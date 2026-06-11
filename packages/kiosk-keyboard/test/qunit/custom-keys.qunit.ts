import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import Log from "sap/base/Log";
import type { LayoutDefinition, KeyDefinition } from "ui5/kiosk/types";
import { placeAndWait, tapKey, getRequiredKeyElement } from "./test-helpers";

const sandbox = sinon.createSandbox();

function commonAfterEach(): void {
  sandbox.restore();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

/** Build a one-row layout from the given keys (strings become {value,label}). */
function layoutOf(...keys: (string | KeyDefinition)[]): LayoutDefinition {
  return [keys.map((k) => (typeof k === "string" ? { value: k, label: k } : k))];
}

/**
 * Wire up an Input + focused KioskKeyboard rendering the supplied layout under
 * the name "spike". The keyboard targets the input via `controls` + focus.
 */
async function setup(layout: LayoutDefinition): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { spike: layout },
    layout: "spike",
  });
  await placeAndWait(kb);
  input.focus();
  return { kb, input };
}

// ───────────────────────────────────────────────────
// Custom key dispatch via the enriched keyPress contract
// ───────────────────────────────────────────────────

QUnit.module("custom-keys - keyPress contract", { afterEach: commonAfterEach });

QUnit.test("A custom {paste} key fires keyPress with the full token (no literal insertion)", async (assert) => {
  const { kb, input } = await setup(layoutOf("{paste}"));
  let pressedKey = "";
  kb.attachKeyPress((e) => {
    pressedKey = e.getParameter("key") ?? "";
  });

  tapKey(kb, "{paste}");
  assert.strictEqual(pressedKey, "{paste}", "keyPress fired with the full custom token as key");
  assert.strictEqual(input.getValue(), "", "No literal text inserted for the custom token");

  input.destroy();
  kb.destroy();
});

QUnit.test("preventDefault on the custom keyPress suppresses the default no-op warning", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf("{paste}"));
  kb.attachKeyPress((e) => e.preventDefault());

  tapKey(kb, "{paste}");
  assert.notOk(warnSpy.called, "A vetoed custom token is not warned (consumer owns it)");
  assert.strictEqual(input.getValue(), "", "Nothing inserted");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Public input API: insertText / deleteBackward
// ───────────────────────────────────────────────────

QUnit.module("custom-keys - input API", { afterEach: commonAfterEach });

QUnit.test("insertText inserts at the caret of the active target and fires liveChange", async (assert) => {
  const { kb, input } = await setup(layoutOf("{paste}"));
  let liveValue: string | undefined;
  input.attachLiveChange((e: { getParameter(name: string): unknown }) => {
    liveValue = e.getParameter("value") as string;
  });

  kb.attachKeyPress((e) => {
    if (e.getParameter("key") === "{paste}") {
      e.preventDefault();
      kb.insertText("x");
    }
  });

  tapKey(kb, "{paste}");
  assert.strictEqual(input.getValue(), "x", "insertText wrote the real target");
  assert.strictEqual(liveValue, "x", "insertText fired liveChange with the new value");

  input.destroy();
  kb.destroy();
});

QUnit.test("deleteBackward deletes one grapheme before the caret", async (assert) => {
  const { kb, input } = await setup(layoutOf("a", "{del}"));
  kb.attachKeyPress((e) => {
    if (e.getParameter("key") === "{del}") {
      e.preventDefault();
      const removed = kb.deleteBackward();
      assert.ok(removed, "deleteBackward reports a deletion");
    }
  });

  tapKey(kb, "a");
  tapKey(kb, "a");
  assert.strictEqual(input.getValue(), "aa", "Two characters typed");
  tapKey(kb, "{del}");
  assert.strictEqual(input.getValue(), "a", "deleteBackward removed one grapheme");

  input.destroy();
  kb.destroy();
});

QUnit.test("insertText and deleteBackward are safe no-ops with no active target", async (assert) => {
  // No `controls`, no focus: there is no resolved target.
  const input = new Input({ value: "seed" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ instanceLayouts: { spike: layoutOf("x") }, layout: "spike" });
  await placeAndWait(kb);

  assert.strictEqual(kb.getActiveTargetElement(), null, "No active target resolves to null");
  kb.insertText("z"); // must not throw
  assert.strictEqual(kb.deleteBackward(), false, "deleteBackward returns false with no target");
  assert.strictEqual(input.getValue(), "seed", "Untargeted input is untouched");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Accessibility: KeyDefinition.ariaLabel + icon-only warning
// ───────────────────────────────────────────────────

QUnit.module("custom-keys - accessibility", { afterEach: commonAfterEach });

QUnit.test("KeyDefinition.ariaLabel sets the accessible name for an icon-only key", async (assert) => {
  const { kb, input } = await setup(
    layoutOf({ value: "{paste}", label: "", icon: "sap-icon://paste", ariaLabel: "Paste from clipboard" }),
  );
  const aria = getRequiredKeyElement(kb, "{paste}").getAttribute("aria-label");
  assert.strictEqual(aria, "Paste from clipboard", "aria-label comes from KeyDefinition.ariaLabel");

  input.destroy();
  kb.destroy();
});

QUnit.test("Icon-only key with no ariaLabel/label warns and falls back to value", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf({ value: "{paste}", label: "", icon: "sap-icon://paste" }));

  const aria = getRequiredKeyElement(kb, "{paste}").getAttribute("aria-label");
  assert.strictEqual(aria, "{paste}", "Falls back to the raw value when there is no accessible-name source");
  assert.ok(
    warnSpy.getCalls().some((c) => String(c.args[0]).includes("{paste}") && /accessible name/i.test(String(c.args[0]))),
    "An icon-only key with no accessible name logs a dev warning",
  );

  input.destroy();
  kb.destroy();
});
