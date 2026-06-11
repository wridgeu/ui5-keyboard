import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { CompositionMiddleware } from "../../src/types.js";
import { requireKey } from "../helpers/fixtures.js";

const nextRender = renderFinished;

/**
 * Spy middleware factory wired through the public `instanceMiddleware`
 * property. `created` proves whether the keyboard instantiated the middleware
 * at all; `handled` records the keys routed through it; `commits` counts
 * forced commits of an in-progress composition.
 */
function spyMiddleware(): {
  calls: { created: number; handled: string[]; commits: number };
  factory: () => CompositionMiddleware;
} {
  const calls = { created: 0, handled: [] as string[], commits: 0 };
  const factory = (): CompositionMiddleware => {
    calls.created++;
    return {
      handleKey: (key) => {
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

async function setupHangul(keyboardType?: string): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
  const container = await fixture(html`
    <div>
      <input id="ktm-target" type="text" />
      <kiosk-keyboard layout="ko-hangul"></kiosk-keyboard>
    </div>
  `);
  const input = container.querySelector<HTMLInputElement>("#ktm-target")!;
  const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
  if (keyboardType) kb.setAttribute("keyboard-type", keyboardType);
  kb.setTargetElement(input);
  await nextRender();
  return { kb, input };
}

describe("kiosk-keyboard - keyboardType vs composition middleware", () => {
  it("does not instantiate the layout middleware when keyboardType forces the numpad surface", async () => {
    const { kb, input } = await setupHangul("Numpad");
    const { calls, factory } = spyMiddleware();
    kb.instanceMiddleware = { "ko-hangul": factory };
    await nextRender();

    // The rendered surface is the numpad; pressing a digit must resolve the
    // middleware for the EFFECTIVE layout (numpad: none), not for the
    // configured layout property (ko-hangul).
    requireKey(kb, "7").click();
    expect(calls.created, "no ko-hangul middleware on the auto-forced numpad surface").to.equal(0);
    expect(input.value, "the digit is inserted directly").to.equal("7");
  });

  it("commits an in-progress composition when a keyboardType change swaps the surface", async () => {
    const { kb, input } = await setupHangul();
    const { calls, factory } = spyMiddleware();
    kb.instanceMiddleware = { "ko-hangul": factory };
    await nextRender();

    // Start a composition on the full hangul surface.
    requireKey(kb, "ㄱ").click();
    expect(calls.created).to.equal(1);
    expect(calls.handled).to.deep.equal(["ㄱ"]);

    // Swapping the surface must end the composition (commit + drop), exactly
    // like a layout switch does.
    kb.keyboardType = "Numpad";
    await nextRender();
    expect(calls.commits, "keyboardType change commits the in-progress preedit").to.equal(1);

    // The dropped middleware must not see keys typed on the new surface.
    requireKey(kb, "7").click();
    expect(calls.handled, "old middleware does not receive keys after the swap").to.deep.equal(["ㄱ"]);
    expect(input.value, "numpad digit inserts directly after the swap").to.equal("7");
  });
});
