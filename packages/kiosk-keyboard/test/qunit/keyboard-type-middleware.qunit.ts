import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { KeyboardType } from "ui5/kiosk/library";
import type { CompositionMiddleware } from "ui5/kiosk/types";
import { placeAndWait, waitForRender, tapKey } from "./test-helpers";

function commonAfterEach(): void {
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

/**
 * Spy middleware factory wired through the public `instanceMiddleware` setting.
 * `created` proves whether the keyboard instantiated the middleware at all;
 * `handled` records the keys routed through it; `commits` counts forced
 * commits of an in-progress composition. Twin of the webc
 * `keyboard-type-middleware.test.ts` spy.
 */
function spyMiddleware(): {
  calls: { created: number; handled: string[]; commits: number };
  factory: () => CompositionMiddleware;
} {
  const calls = { created: 0, handled: [] as string[], commits: 0 };
  const factory = (): CompositionMiddleware => {
    calls.created++;
    return {
      handleKey: (key: string) => {
        calls.handled.push(key);
        return true; // consume: an in-progress composition holds the key
      },
      commit: () => {
        calls.commits++;
        return null;
      },
      reset: () => {},
    };
  };
  return { calls, factory };
}

/** Input + focused KioskKeyboard configured with the ko-hangul layout. */
async function setupHangul(keyboardType?: KeyboardType): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], layout: "ko-hangul" });
  if (keyboardType) kb.setKeyboardType(keyboardType);
  await placeAndWait(kb);
  input.focus();
  return { kb, input };
}

QUnit.module("keyboard-type-middleware - keyboardType vs composition middleware", { afterEach: commonAfterEach });

QUnit.test("does not instantiate the layout middleware when keyboardType forces the numpad surface", async (assert) => {
  const { kb, input } = await setupHangul(KeyboardType.Numpad);
  const { calls, factory } = spyMiddleware();
  kb.setInstanceMiddleware({ "ko-hangul": factory });
  await waitForRender();

  // The rendered surface is the numpad; pressing a digit must resolve the
  // middleware for the EFFECTIVE layout (numpad: none), not for the configured
  // layout property (ko-hangul). Without a single resolved-layout source the
  // renderer shows numpad while the middleware lookup uses getLayout().
  tapKey(kb, "7");
  assert.strictEqual(calls.created, 0, "no ko-hangul middleware on the auto-forced numpad surface");
  assert.strictEqual(input.getValue(), "7", "the digit is inserted directly");

  input.destroy();
  kb.destroy();
});

QUnit.test("commits an in-progress composition when a keyboardType change swaps the surface", async (assert) => {
  const { kb, input } = await setupHangul();
  const { calls, factory } = spyMiddleware();
  kb.setInstanceMiddleware({ "ko-hangul": factory });
  await waitForRender();

  // Start a composition on the full hangul surface.
  tapKey(kb, "ㄱ");
  assert.strictEqual(calls.created, 1, "ko-hangul middleware instantiated on the hangul surface");
  assert.deepEqual(calls.handled, ["ㄱ"], "the jamo was routed through the middleware");

  // Swapping the surface must end the composition (commit + drop), exactly like
  // a layout switch does.
  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();
  assert.strictEqual(calls.commits, 1, "keyboardType change commits the in-progress preedit");

  // The dropped middleware must not see keys typed on the new surface.
  tapKey(kb, "7");
  assert.deepEqual(calls.handled, ["ㄱ"], "old middleware does not receive keys after the swap");
  assert.strictEqual(input.getValue(), "7", "numpad digit inserts directly after the swap");

  input.destroy();
  kb.destroy();
});
