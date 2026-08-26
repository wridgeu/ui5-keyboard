import { fixture, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { CompositionMiddleware } from "../../src/types.js";
import { customLayout, requireKey } from "../helpers/fixtures.js";

const nextRender = renderFinished;

/**
 * What a spy middleware observed. `created` proves whether the keyboard
 * instantiated the middleware at all; `handled` records the keys routed through
 * it; `commits` counts forced commits of an in-progress composition.
 */
interface MiddlewareCalls {
  created: number;
  handled: string[];
  commits: number;
}

/** A spy middleware factory and the record it writes into. */
interface SpyMiddleware {
  calls: MiddlewareCalls;
  factory: () => CompositionMiddleware;
}

/** Spy middleware factory wired through a slotted `<kiosk-keyboard-custom-layout>`. */
function spyMiddleware(): SpyMiddleware {
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

async function setupHangul(
  factory: () => CompositionMiddleware,
  keyboardType?: string,
): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
  const container = document.createElement("div");
  const input = document.createElement("input");
  input.id = "ktm-target";
  input.type = "text";
  const kb = document.createElement("kiosk-keyboard") as KioskKeyboard;
  kb.setAttribute("layout", "ko-hangul");
  if (keyboardType) kb.setAttribute("keyboard-type", keyboardType);
  kb.appendChild(customLayout({ name: "ko-hangul", middleware: factory }));
  container.append(input, kb);

  await fixture(container);
  kb.setTargetElement(input);
  await nextRender();
  return { kb, input };
}

describe("kiosk-keyboard - keyboardType vs composition middleware", () => {
  it("does not instantiate the layout middleware when keyboardType forces the numpad surface", async () => {
    const { calls, factory } = spyMiddleware();
    const { kb, input } = await setupHangul(factory, "Numpad");

    // The rendered surface is the numpad; pressing a digit must resolve the
    // middleware for the EFFECTIVE layout (numpad: none), not for the
    // configured layout property (ko-hangul).
    requireKey(kb, "7").click();
    expect(calls.created, "no ko-hangul middleware on the auto-forced numpad surface").to.equal(0);
    expect(input.value, "the digit is inserted directly").to.equal("7");
  });

  it("commits an in-progress composition when a keyboardType change swaps the surface", async () => {
    const { calls, factory } = spyMiddleware();
    const { kb, input } = await setupHangul(factory);

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

  it("spends the one-shot Shift latch on a middleware-consumed key", async () => {
    const { calls, factory } = spyMiddleware();
    const { kb, input } = await setupHangul(factory);

    requireKey(kb, "{shift}").click();
    await nextRender();
    expect(requireKey(kb, "{shift}").getAttribute("aria-pressed"), "precondition: shift latched").to.equal("true");

    requireKey(kb, "ㄱ").click();
    // The consumption is asserted too: a key the middleware declined would
    // reach the same spend gate down the default branch, so the latch
    // assertion alone would stay green with the early return moved above it.
    // The middleware is handed the key's base value, not its shifted glyph.
    expect(calls.handled, "the middleware consumed the key").to.deep.equal(["ㄱ"]);
    expect(input.value, "the consumed key wrote nothing directly").to.equal("");

    await nextRender();
    expect(
      requireKey(kb, "{shift}").getAttribute("aria-pressed"),
      "the consumed key still spent the one-shot Shift latch",
    ).to.equal("false");
  });
});
