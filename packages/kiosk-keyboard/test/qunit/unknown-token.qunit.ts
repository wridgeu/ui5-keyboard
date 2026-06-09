import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import Log from "sap/base/Log";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { placeAndWait, tapKey } from "./test-helpers";

const sandbox = sinon.createSandbox();

function commonAfterEach(): void {
  sandbox.restore();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

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

QUnit.module("unknown-token - no literal brace insertion", { afterEach: commonAfterEach });

QUnit.test("Unrecognized {token} is a no-op and warns, never typed as literal text", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  // `{bcksp}` is a typo for `{backspace}`. Before this guard the keyboard
  // typed the literal text "{bcksp}" into the field.
  const { kb, input } = await setup([[{ value: "{bcksp}", label: "x" }]]);

  tapKey(kb, "{bcksp}");
  assert.strictEqual(input.getValue(), "", "Unknown brace token inserts nothing");
  assert.ok(warnSpy.called, "Unknown brace token logged a warning");

  input.destroy();
  kb.destroy();
});

QUnit.test("keyPress still fires for an unrecognized token (consumers can handle it)", async (assert) => {
  const { kb, input } = await setup([[{ value: "{custom}", label: "c" }]]);
  let pressed = "";
  kb.attachKeyPress((e) => {
    pressed = e.getParameter("key") ?? "";
  });

  tapKey(kb, "{custom}");
  assert.strictEqual(pressed, "{custom}", "keyPress fired with the full token as key");
  assert.strictEqual(input.getValue(), "", "Still nothing inserted");

  input.destroy();
  kb.destroy();
});

QUnit.test("A lone brace character is still inserted as a literal", async (assert) => {
  // Length-2 guard: "{" and "}" are real characters a user may want to type.
  const { kb, input } = await setup([[{ value: "{" }, { value: "}" }]]);

  tapKey(kb, "{");
  tapKey(kb, "}");
  assert.strictEqual(input.getValue(), "{}", "Single-brace characters insert normally");

  input.destroy();
  kb.destroy();
});

QUnit.test("Regular character keys are unaffected by the guard", async (assert) => {
  const { kb, input } = await setup([[{ value: "a" }, { value: "b" }]]);

  tapKey(kb, "a");
  tapKey(kb, "b");
  assert.strictEqual(input.getValue(), "ab", "Normal keys still type");

  input.destroy();
  kb.destroy();
});
