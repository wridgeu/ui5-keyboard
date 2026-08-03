import { fixture, html, expect, oneEvent, waitUntil } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import numericLayout from "../../src/layouts/numeric.js";
import { queryKey } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

/** Wait for UI5Element async render cycle. */
const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKeys(el: KioskKeyboard): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[role="button"]');
}

function rootDiv(el: KioskKeyboard): HTMLElement {
  return el.shadowRoot!.querySelector(DOM.selectors.root)!;
}

function queryRows(el: KioskKeyboard): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll(DOM.selectors.row);
}

/** Whether the host reflects the given responsive tier (`short` / `tiny`). */
function hasCqTier(el: KioskKeyboard, tier: string): boolean {
  return el.getAttribute(DOM.attributes.cqTier) === tier;
}

async function waitForResponsiveSync(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Assign an invalid value to a typed property to test runtime validation/clamping. */
function setInvalidValue(target: any, property: string, value: string): void {
  target[property] = value;
}

describe("kiosk-keyboard", () => {
  // ── Render ──

  describe("rendering", () => {
    it("creates shadow DOM with the layout's keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      // A known qwerty key must be present, not merely "something rendered".
      expect(queryKey(el, "q"), "qwerty layout renders its 'q' key").to.not.be.null;
    });

    it("renders one .kiosk-row per row in the layout definition", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="numeric"></kiosk-keyboard> `);
      await nextRender();
      const rows = queryRows(el);
      // Exact structural match against the definition, not just "> 0".
      expect(rows.length, "one rendered row per numeric layout row").to.equal(numericLayout.length);
    });

    it("renders disabled state with disabled class", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard> `);
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootDisabled)).to.be.true;
    });

    it("exposes a frozen DOM contract", async () => {
      expect(Object.isFrozen(KioskKeyboard.DOM)).to.be.true;
      expect(Object.isFrozen(KioskKeyboard.DOM.classes)).to.be.true;
      expect(Object.isFrozen(KioskKeyboard.DOM.attributes)).to.be.true;
      expect(Object.isFrozen(KioskKeyboard.DOM.selectors)).to.be.true;
    });

    it("renders docked mode with docked class", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootDocked)).to.be.true;
    });

    it("renders hidden state when docked and not opened", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.true;
    });
  });

  // ── Property reflection ──

  describe("property reflection", () => {
    it("reflects layout attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
      expect(el.layout).to.equal("qwertz-de");
    });

    it("reflects keyboard-type attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numpad"></kiosk-keyboard> `);
      expect(el.keyboardType).to.equal("Numpad");
    });

    it("reflects docked boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard docked></kiosk-keyboard> `);
      expect(el.docked).to.be.true;
    });

    it("reflects auto-show boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard auto-show></kiosk-keyboard> `);
      expect(el.autoShow).to.be.true;
    });

    it("reflects auto-type boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard auto-type></kiosk-keyboard> `);
      expect(el.autoType).to.be.true;
    });

    it("reflects disabled attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard disabled></kiosk-keyboard> `);
      expect(el.disabled).to.be.true;
    });

    it("reflects controls attribute", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard controls="my-input"></kiosk-keyboard> `);
      expect(el.controls).to.equal("my-input");
    });

    it("stores controls as string property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard controls="a, b, c"></kiosk-keyboard> `);
      expect(el.controls).to.equal("a, b, c");
    });

    it("re-renders when attribute changes", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      expect(queryKey(el, "q"), "qwerty has q key").to.not.be.null;

      el.setAttribute("keyboard-type", "Numpad");
      await nextRender();

      expect(queryKey(el, "q"), "numpad should not have q key").to.be.null;
      expect(queryKey(el, "7"), "numpad should have 7 key").to.not.be.null;
    });
  });

  // ── Key interaction ──

  describe("key interaction", () => {
    it("dispatches key-press on click", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="numeric"></kiosk-keyboard> `);
      await nextRender();
      const key = queryKey(el, "1")!;
      expect(key).to.not.be.null;

      const keyPressEvent = oneEvent(el, "key-press");
      key.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("1");
      expect(detail.shiftKey).to.be.false;
      expect(detail.char).to.equal("1");
    });

    it("key-press char is undefined for action keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const bksp = queryKey(el, "{backspace}")!;
      expect(bksp).to.not.be.null;
      const keyPressEvent = oneEvent(el, "key-press");
      bksp.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("{backspace}");
      expect(detail.char).to.be.undefined;
    });

    it("key-press char reflects shifted value", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // Activate shift
      queryKey(el, "{shift}")!.click();
      await nextRender();

      const keyA = queryKey(el, "a")!;
      const keyPressEvent = oneEvent(el, "key-press");
      keyA.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("a");
      expect(detail.shiftKey).to.be.true;
      expect(detail.char).to.equal("A");
    });

    it("fires key-press on touch interaction (touchstart + touchend)", async () => {
      const container = await fixture(html`
        <div>
          <input id="touch-target" type="text" />
          <kiosk-keyboard layout="numeric" controls="touch-target"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const key = queryKey(kb, "5")!;
      const rect = key.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const touch = new Touch({
        identifier: 0,
        target: key,
        clientX: cx,
        clientY: cy,
      });

      // Simulate full touch gesture: touchstart (prevents blur) → touchend (fires key press)
      key.dispatchEvent(new TouchEvent("touchstart", { touches: [touch], cancelable: true, bubbles: true }));
      key.dispatchEvent(new TouchEvent("touchend", { changedTouches: [touch], bubbles: true }));

      const input = container.querySelector<HTMLInputElement>("#touch-target")!;
      expect(input.value).to.equal("5");
    });

    it("touch drift: types lift-off key, not touchstart key (regression)", async () => {
      const container = await fixture(html`
        <div>
          <input id="drift-target" type="text" />
          <kiosk-keyboard layout="numeric" controls="drift-target"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const startKey = queryKey(kb, "4")!;
      const endKey = queryKey(kb, "5")!;

      const startRect = startKey.getBoundingClientRect();
      const endRect = endKey.getBoundingClientRect();

      // touchstart on key "4"
      const startTouch = new Touch({
        identifier: 0,
        target: startKey,
        clientX: startRect.left + startRect.width / 2,
        clientY: startRect.top + startRect.height / 2,
      });
      startKey.dispatchEvent(new TouchEvent("touchstart", { touches: [startTouch], cancelable: true, bubbles: true }));

      // touchend with coordinates over key "5" (finger drifted)
      // Per spec, touchend target is still the touchstart element, but
      // changedTouches coordinates reflect where the finger lifted off.
      const endTouch = new Touch({
        identifier: 0,
        target: startKey,
        clientX: endRect.left + endRect.width / 2,
        clientY: endRect.top + endRect.height / 2,
      });
      startKey.dispatchEvent(new TouchEvent("touchend", { changedTouches: [endTouch], bubbles: true }));

      const input = container.querySelector<HTMLInputElement>("#drift-target")!;
      expect(input.value).to.equal("5");
    });

    it("canceling key-press prevents text insertion", async () => {
      const container = await fixture(html`
        <div>
          <input id="cancel-target" type="text" />
          <kiosk-keyboard layout="numeric" controls="cancel-target"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#cancel-target")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      kb.addEventListener("key-press", (e: Event) => e.preventDefault(), { once: true });
      queryKey(kb, "1")!.click();

      expect(input.value).to.equal("");
    });

    it("does not dispatch key-press when disabled", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="numeric" disabled></kiosk-keyboard> `);
      await nextRender();
      let fired = false;
      el.addEventListener("key-press", () => {
        fired = true;
      });

      const key = queryKey(el, "1")!;
      key.click();

      await renderFinished();
      expect(fired).to.be.false;
    });
  });

  // ── Target integration ──

  describe("target integration", () => {
    it("types into target input via controls attribute", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-1" type="text" />
          <kiosk-keyboard layout="qwerty" controls="target-1"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#target-1")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const key = queryKey(kb, "a")!;
      key.click();

      expect(input.value).to.equal("a");
    });

    it("types into target input via setTargetElement", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-2" type="text" />
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#target-2")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      kb.setTargetElement(input);
      await nextRender();

      const key = queryKey(kb, "b")!;
      key.click();

      expect(input.value).to.equal("b");
    });

    it("uses custom target resolver from setTargetResolver", async () => {
      const container = await fixture(html`
        <div>
          <div id="resolver-host"></div>
          <kiosk-keyboard layout="qwerty" controls="resolver-host"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Without resolver, no input is found inside the empty div - typing is a no-op
      queryKey(kb, "a")!.click();

      // Set a custom resolver that provides a detached input
      const customInput = document.createElement("input");
      document.body.appendChild(customInput);

      try {
        kb.setTargetResolver(() => customInput);
        queryKey(kb, "b")!.click();
        expect(customInput.value).to.equal("b");
      } finally {
        kb.setTargetResolver(null);
        customInput.remove();
      }
    });

    it("falls back to built-in resolver when custom resolver throws", async () => {
      // Use a wrapper div as the controls-target so the built-in resolver must
      // actually traverse the DOM to find the <input> inside it.
      const container = await fixture(html`
        <div>
          <div id="throw-host"><input type="text" /></div>
          <kiosk-keyboard layout="qwerty" controls="throw-host"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      const input = container.querySelector<HTMLInputElement>("input")!;
      await nextRender();

      kb.setTargetResolver(() => {
        throw new Error("resolver bug");
      });

      try {
        // Silence the expected console.warn from resolveWithCustomResolver.
        await captureConsole("warn", () => {
          queryKey(kb, "x")!.click();
        });
        expect(input.value, "built-in resolver should find the nested input after resolver threw").to.equal("x");
      } finally {
        kb.setTargetResolver(null);
      }
    });

    it("falls back to built-in resolver when custom resolver returns non-input element", async () => {
      // Use a wrapper div as the controls-target so the built-in resolver must
      // traverse the DOM to find the <input> (not receive it directly).
      const container = await fixture(html`
        <div>
          <div id="fallback-host"><input type="text" /></div>
          <kiosk-keyboard layout="qwerty" controls="fallback-host"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      const input = container.querySelector<HTMLInputElement>("input")!;
      await nextRender();

      // Resolver returns a <div> - should be rejected by the type guard
      // and fall through to the built-in resolver which finds the <input>
      // inside the wrapper.
      const badDiv = document.createElement("div");
      kb.setTargetResolver(() => badDiv as unknown as HTMLInputElement);

      try {
        queryKey(kb, "z")!.click();
        expect(input.value, "built-in resolver should find the nested input despite wrong-type resolver").to.equal("z");
      } finally {
        kb.setTargetResolver(null);
      }
    });

    it("handles backspace on target input", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-3" type="text" value="abc" />
          <kiosk-keyboard layout="qwerty" controls="target-3"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#target-3")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Set cursor at end
      input.focus();
      input.setSelectionRange(3, 3);

      const bksp = queryKey(kb, "{backspace}")!;
      bksp.click();

      expect(input.value).to.equal("ab");
    });
  });

  // ── Backspace press-and-hold auto-repeat ──

  describe("backspace auto-repeat", () => {
    const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    function pressBackspace(bksp: HTMLElement): void {
      bksp.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
    }
    function releasePointer(): void {
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    }

    async function setup(value: string): Promise<{ input: HTMLInputElement; kb: KioskKeyboard; bksp: HTMLElement }> {
      const container = await fixture(html`
        <div>
          <input id="ar-target" type="text" value="${value}" />
          <kiosk-keyboard layout="qwerty" controls="ar-target"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#ar-target")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      const bksp = queryKey(kb, "{backspace}")!;
      return { input, kb, bksp };
    }

    // The repeat curve starts at 450ms then accelerates; a ~900ms hold should
    // delete several characters. Using a generous string keeps the assertion
    // about "more than one" robust against CI timing jitter.
    it("deletes multiple characters while held, and stops on release", async () => {
      const { input, bksp } = await setup("abcdefghijklmnop");

      pressBackspace(bksp);
      await delay(900);
      releasePointer();

      const afterHold = input.value.length;
      expect(afterHold, "a held Backspace deletes more than one character").to.be.lessThan(15);

      // Releasing stops the repeat: the value is stable afterwards.
      await delay(300);
      expect(input.value.length, "no further deletion after release").to.equal(afterHold);
    });

    it("suppresses the trailing release click after a repeat (no over-delete)", async () => {
      const { input, bksp } = await setup("abcdefghij");

      pressBackspace(bksp);
      await delay(700);
      releasePointer();
      const afterHold = input.value.length;

      // The release click (here simulated explicitly) must be swallowed.
      bksp.click();
      expect(input.value.length, "trailing click does not delete an extra character").to.equal(afterHold);

      // A fresh tap deletes normally again (suppression was one-shot).
      bksp.click();
      expect(input.value.length).to.equal(afterHold - 1);
    });

    // Regression: after a repeat, sliding off the key and releasing off-key
    // produces no trailing on-key click to consume the suppression flag. The
    // flag must be cleared on pointer-leave, otherwise the *next* Backspace
    // activation that arrives as a bare click without a preceding pointerdown
    // (keyboard Enter/Space activation, or a programmatic .click()) would be
    // silently swallowed.
    it("does not swallow a keyboard/programmatic Backspace after sliding off and releasing off-key", async () => {
      const { input, bksp } = await setup("abcdefghij");

      pressBackspace(bksp);
      await delay(700); // let it repeat -> click suppression armed
      const afterHold = input.value.length;
      expect(afterHold, "sanity: the hold actually repeated").to.be.lessThan(10);

      // Slide the pointer off the key, then release off-key: no Backspace click
      // is generated by the gesture. (`pointerleave` does not bubble.)
      bksp.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1 }));
      releasePointer();

      // A bare activation click (no preceding pointerdown) must still delete.
      bksp.click();
      expect(input.value.length, "Backspace after slide-off still deletes one").to.equal(afterHold - 1);
    });

    it("is a no-op while held over a read-only input", async () => {
      const { input, bksp } = await setup("abcdef");
      input.readOnly = true;

      pressBackspace(bksp);
      await delay(800);
      releasePointer();

      expect(input.value, "read-only input is untouched").to.equal("abcdef");
    });

    it("is a no-op while held over an empty input", async () => {
      const { input, bksp } = await setup("");

      pressBackspace(bksp);
      await delay(800);
      releasePointer();

      expect(input.value).to.equal("");
    });

    it("does not start auto-repeat when the keyboard is disabled", async () => {
      const container = await fixture(html`
        <div>
          <input id="ar-target-d" type="text" value="abcdef" />
          <kiosk-keyboard layout="qwerty" controls="ar-target-d" disabled></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#ar-target-d")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();
      input.focus();
      input.setSelectionRange(6, 6);

      const bksp = queryKey(kb, "{backspace}")!;
      pressBackspace(bksp);
      await delay(800);
      releasePointer();

      expect(input.value, "disabled keyboard ignores the hold").to.equal("abcdef");
    });
  });

  // ── Shift / Caps ──

  describe("shift and caps lock", () => {
    it("toggles shift state on shift key click", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-pressed")).to.equal("false");

      shift.click();
      await nextRender();
      const shiftAfter = queryKey(el, "{shift}")!;
      expect(shiftAfter.getAttribute("aria-pressed")).to.equal("true");
    });

    it("shows uppercase labels when shifted", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const aKey = queryKey(el, "a")!;
      expect(aKey.textContent!.trim()).to.equal("a");

      queryKey(el, "{shift}")!.click();
      await nextRender();
      const aKeyAfter = queryKey(el, "a")!;
      expect(aKeyAfter.textContent!.trim()).to.equal("A");
    });

    it("auto-releases shift after typing a character", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-shift" type="text" />
          <kiosk-keyboard layout="qwerty" controls="target-shift"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Shift → type "a" → shift should auto-release
      queryKey(kb, "{shift}")!.click();
      await nextRender();
      queryKey(kb, "a")!.click();
      await nextRender();

      const shift = queryKey(kb, "{shift}")!;
      expect(shift.getAttribute("aria-pressed")).to.equal("false");
    });

    it("preserves non-default layout after shift toggle", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
      await nextRender();

      // QWERTZ-DE has ü, ö, ä, ß - QWERTY does not
      expect(queryKey(el, "\u00FC"), "ü key before shift").to.not.be.null;
      expect(queryKey(el, "\u00F6"), "ö key before shift").to.not.be.null;
      expect(queryKey(el, "\u00DF"), "ß key before shift").to.not.be.null;

      queryKey(el, "{shift}")!.click();
      await nextRender();

      // After shift, layout-specific keys must still be present
      expect(queryKey(el, "\u00FC"), "ü key after shift").to.not.be.null;
      expect(queryKey(el, "\u00F6"), "ö key after shift").to.not.be.null;
      expect(queryKey(el, "\u00DF"), "ß key after shift").to.not.be.null;
    });

    it("caps lock stays on after typing", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-caps" type="text" />
          <kiosk-keyboard layout="qwerty" controls="target-caps"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Double-click shift for caps lock
      queryKey(kb, "{shift}")!.click();
      await nextRender();
      queryKey(kb, "{shift}")!.click();
      await nextRender();

      // Type a character
      queryKey(kb, "a")!.click();
      await nextRender();

      const shift = queryKey(kb, "{shift}")!;
      expect(shift.getAttribute("aria-pressed")).to.equal("true");
      expect(shift.classList.contains(DOM.classes.keyCapsLock)).to.be.true;
    });
  });

  // ── Shift feedback latency KPIs ──

  describe("shift feedback latency", () => {
    it("shift-active class appears synchronously after click (before rAF)", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const shift = queryKey(el, "{shift}")!;

      // Click and check IMMEDIATELY - no await
      shift.click();
      const shiftEl = queryKey(el, "{shift}")!;
      expect(
        shiftEl.classList.contains(DOM.classes.keyShiftActive),
        "shift-active class should be present synchronously after click",
      ).to.be.true;

      await nextRender(); // let render cycle complete
    });

    it("shift-active class removed synchronously when turning off from caps lock", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // Click 1: shift on
      queryKey(el, "{shift}")!.click();
      await nextRender();

      // Click 2 (within 400ms): caps lock on
      queryKey(el, "{shift}")!.click();
      await nextRender();

      // Click 3: off - check IMMEDIATELY
      queryKey(el, "{shift}")!.click();
      const shiftEl = queryKey(el, "{shift}")!;
      expect(
        shiftEl.classList.contains(DOM.classes.keyShiftActive),
        "shift-active class should be removed synchronously on off",
      ).to.be.false;
      expect(
        shiftEl.classList.contains(DOM.classes.keyCapsLock),
        "caps-lock class should be removed synchronously on off",
      ).to.be.false;

      await nextRender();
    });

    it("caps-lock class appears synchronously on double-click", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // First click: shift on
      queryKey(el, "{shift}")!.click();
      await nextRender();

      // Second click (within 400ms): caps lock
      queryKey(el, "{shift}")!.click();
      const shiftEl = queryKey(el, "{shift}")!;
      expect(
        shiftEl.classList.contains(DOM.classes.keyCapsLock),
        "caps-lock class should be present synchronously after double-click",
      ).to.be.true;

      await nextRender();
    });

    it("no forced layout reads during shift toggle", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      // Let any pending responsive sync settle
      await waitForResponsiveSync();

      // Instrument getComputedStyle to count calls
      const origGCS = window.getComputedStyle;
      let gcsCount = 0;
      window.getComputedStyle = function (...args: Parameters<typeof origGCS>) {
        gcsCount++;
        return origGCS.apply(window, args);
      } as typeof origGCS;

      try {
        queryKey(el, "{shift}")!.click();
        await nextRender();

        // After the improvement, shift toggle should not trigger
        // getComputedStyle calls (responsive sizing deferred to ResizeObserver)
        expect(gcsCount, "getComputedStyle calls during shift toggle").to.equal(0);
      } finally {
        window.getComputedStyle = origGCS;
      }
    });
  });

  // ── Layout switching ──

  describe("layout switching", () => {
    it("switches layout via layout-change key", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // qwerty has a {layout:numeric} key in the bottom row
      const layoutKey = queryKey(el, "{layout:numeric}");
      expect(layoutKey, "layout switch key should exist in qwerty").to.not.be.null;

      const layoutChangeEvent = oneEvent(el, "layout-change");
      layoutKey!.click();
      const { detail } = await layoutChangeEvent;
      expect(detail.layout).to.equal("numeric");
    });

    it("Full keyboard: the symbols layout keeps the ABC key (letters stay reachable)", async () => {
      // Guard against over-stripping: on a full keyboard the base IS alphabetic,
      // so "ABC" ({layout:base}) correctly returns to letters and must remain.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const toNumeric = oneEvent(el, "layout-change");
      queryKey(el, "{layout:numeric}")!.click();
      await toNumeric;
      await nextRender();

      const toSymbols = oneEvent(el, "layout-change");
      queryKey(el, "{layout:special}")!.click();
      await toSymbols;
      await nextRender();

      expect(queryKey(el, "{layout:base}"), "ABC key present so letters remain reachable").to.not.be.null;
      expect(
        queryKey(el, "{layout:base}")!.textContent?.trim(),
        "Full keeps the 'ABC' text: base is alphabetic, so the key is not relabeled",
      ).to.equal("ABC");
    });

    it("clears caps lock when user switches layout via {layout:X} key", async () => {
      // Regression: caps-lock used to persist across user-initiated layout
      // switches because _handleLayoutSwitch did not reset shift state.
      // Caps-lock that was meaningful in QWERTY has no meaning in numeric.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // Double-click shift to engage caps lock
      queryKey(el, "{shift}")!.click();
      await nextRender();
      queryKey(el, "{shift}")!.click();
      await nextRender();
      expect(
        queryKey(el, "{shift}")!.classList.contains(DOM.classes.keyCapsLock),
        "caps lock should be on before switching layout",
      ).to.be.true;

      // Switch layout via {layout:numeric} key
      const layoutChange = oneEvent(el, "layout-change");
      queryKey(el, "{layout:numeric}")!.click();
      await layoutChange;
      await nextRender();

      // Return to qwerty via {layout:base} and verify shift state is clean
      const layoutChangeBack = oneEvent(el, "layout-change");
      queryKey(el, "{layout:base}")!.click();
      await layoutChangeBack;
      await nextRender();

      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-pressed"), "shift should be released after layout switch").to.equal("false");
      expect(shift.classList.contains(DOM.classes.keyCapsLock), "caps lock class should be cleared").to.be.false;
    });

    it("tracks base layout through primary layout toggle and secondary roundtrip", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="ja-romaji"></kiosk-keyboard> `);
      await nextRender();

      // Step 1: toggle from ja-romaji to ja-kana (primary -> primary)
      const kanaToggle = queryKey(el, "{layout:ja-kana}");
      expect(kanaToggle, "ja-kana toggle key should exist on ja-romaji").to.not.be.null;

      let layoutChange = oneEvent(el, "layout-change");
      kanaToggle!.click();
      let detail = (await layoutChange).detail;
      expect(detail.layout).to.equal("ja-kana");
      await nextRender();

      // Step 2: switch to numeric (secondary layout)
      const numericKey = queryKey(el, "{layout:numeric}");
      expect(numericKey, "numeric key should exist on ja-kana").to.not.be.null;

      layoutChange = oneEvent(el, "layout-change");
      numericKey!.click();
      detail = (await layoutChange).detail;
      expect(detail.layout).to.equal("numeric");
      await nextRender();

      // Step 3: return to base; should be ja-kana, NOT ja-romaji
      const baseKey = queryKey(el, "{layout:base}");
      expect(baseKey, "base key should exist on numeric layout").to.not.be.null;

      layoutChange = oneEvent(el, "layout-change");
      baseKey!.click();
      detail = (await layoutChange).detail;
      expect(detail.layout).to.equal(
        "ja-kana",
        "base layout should track the last primary layout (ja-kana), not the initial layout (ja-romaji)",
      );
    });

    it("fires cancelable key-press for layout-switch keys before the switch", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const layoutKey = queryKey(el, "{layout:numeric}");
      expect(layoutKey, "layout switch key should exist in qwerty").to.not.be.null;

      const seen: string[] = [];
      const onKeyPress = (e: Event) => {
        const detail = (e as CustomEvent<{ key: string }>).detail;
        seen.push(detail.key);
      };
      el.addEventListener("key-press", onKeyPress);
      let layoutChanges = 0;
      el.addEventListener("layout-change", () => {
        layoutChanges++;
      });

      layoutKey!.click();
      await nextRender();

      expect(seen).to.deep.equal(["{layout:numeric}"]);
      expect(layoutChanges, "layout-change should fire when key-press is not prevented").to.equal(1);

      el.removeEventListener("key-press", onKeyPress);
    });

    it("preventDefault on key-press blocks the layout switch", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const layoutKey = queryKey(el, "{layout:numeric}");
      expect(layoutKey).to.not.be.null;

      el.addEventListener(
        "key-press",
        (e: Event) => {
          if ((e as CustomEvent<{ key: string }>).detail.key.startsWith("{layout:")) {
            e.preventDefault();
          }
        },
        { once: true },
      );
      let layoutChanges = 0;
      el.addEventListener("layout-change", () => {
        layoutChanges++;
      });

      layoutKey!.click();
      await nextRender();

      expect(layoutChanges, "layout-change should not fire when key-press is prevented").to.equal(0);
    });

    it("ignores {layout:*} for unregistered layout names", async () => {
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
      await nextRender();

      const initialLayout = el.layout;
      let layoutChanges = 0;
      el.addEventListener("layout-change", () => {
        layoutChanges++;
      });

      // Inject a synthetic key element with an unregistered layout name
      // into the keyboard root so the click handler's closest() finds it.
      const fakeKey = document.createElement("div");
      fakeKey.setAttribute("role", "button");
      fakeKey.dataset.key = "{layout:not-registered}";
      rootDiv(el).appendChild(fakeKey);
      fakeKey.click();
      await nextRender();

      expect(layoutChanges, "no layout-change for unregistered layout").to.equal(0);
      expect(el.layout, "layout property unchanged").to.equal(initialLayout);
      fakeKey.remove();
    });

    it("normalizes mixed-case {layout:*} names without corrupting base tracking", async () => {
      // The registry is case-insensitive, so "{layout:NUMERIC}" must resolve to
      // the lowercase "numeric" (a secondary layout) rather than being recorded
      // as a base layout. A later {layout:base} must still return to qwerty.
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
      await nextRender();

      const fakeKey = document.createElement("div");
      fakeKey.setAttribute("role", "button");
      fakeKey.dataset.key = "{layout:NUMERIC}";
      rootDiv(el).appendChild(fakeKey);

      const layoutChange = oneEvent(el, "layout-change");
      fakeKey.click();
      expect((await layoutChange).detail.layout, "mixed-case name normalized to lowercase").to.equal("numeric");
      fakeKey.remove();
      await nextRender();

      const layoutChangeBack = oneEvent(el, "layout-change");
      queryKey(el, "{layout:base}")!.click();
      expect((await layoutChangeBack).detail.layout, "base returns to qwerty (base not corrupted)").to.equal("qwerty");
    });

    it("filters {layout:base} from the auto-forced layout in Numeric mode", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numeric"></kiosk-keyboard> `);
      await nextRender();

      expect(queryKey(el, "{layout:base}"), "ABC key not rendered on auto-forced numeric layout").to.be.null;
      expect(queryKey(el, "{layout:special}"), "secondary-layout switch keys remain available").to.not.be.null;
    });

    it("strips {layout:base} from the secondary layout in Numeric mode too", async () => {
      // Regression (user feedback): on a Numeric keyboard {layout:base} never
      // reaches letters (it re-forces numeric), so on the user-reached symbols
      // layout it is a dead duplicate of "123" ({layout:numeric}) and is stripped.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numeric"></kiosk-keyboard> `);
      await nextRender();

      const specialKey = queryKey(el, "{layout:special}");
      expect(specialKey, "numeric layout exposes a {layout:special} switch").to.not.be.null;
      specialKey!.click();
      await nextRender();

      expect(queryKey(el, "["), "symbols layout is rendered").to.not.be.null;
      expect(queryKey(el, "{layout:numeric}"), "the '123' key is the real return path to numbers").to.not.be.null;
      expect(queryKey(el, "{layout:base}"), "dead ABC key is not rendered on the numeric symbols layout").to.be.null;
    });

    it("strips a mixed-case {layout:Base} dead key in Numeric mode (case-insensitive)", async () => {
      // parseKeyAction lowercases the layout target, so a consumer-authored
      // mixed-case {layout:Base} dead duplicate is recognized and stripped like
      // the canonical lowercase form; it must not linger as a misleading "ABC" key.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numeric"></kiosk-keyboard> `);
      el.instanceLayouts = {
        special: [
          [{ value: "[" }, { value: "{layout:numeric}", label: "123" }, { value: "{layout:Base}", label: "ABC" }],
        ],
      };
      await nextRender();

      const toSymbols = oneEvent(el, "layout-change");
      queryKey(el, "{layout:special}")!.click();
      await toSymbols;
      await nextRender();

      expect(queryKey(el, "{layout:numeric}"), "the '123' key remains the real way back to numbers").to.not.be.null;
      expect(queryKey(el, "{layout:Base}"), "the mixed-case dead ABC key is stripped").to.be.null;
      expect(queryKey(el, "{layout:base}"), "no lowercase base key either").to.be.null;
    });

    it("Numpad: a user-reached symbols layout keeps the return key (relabeled) to the numpad", async () => {
      // The symbols "123" ({layout:numeric}) reaches numeric, not numpad, so
      // under Numpad {layout:base} is the only way back: kept but relabeled to a
      // back icon, since it returns to numbers, not the letters "ABC" implies.
      // Mirrors the kiosk twin.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numpad"></kiosk-keyboard> `);
      await nextRender();

      // The built-in numpad ships no {layout:*} keys; reach the symbols layout
      // the way a consumer's custom instanceLayouts switch key would.
      const fakeKey = document.createElement("div");
      fakeKey.setAttribute("role", "button");
      fakeKey.dataset.key = "{layout:special}";
      rootDiv(el).appendChild(fakeKey);
      const switched = oneEvent(el, "layout-change");
      fakeKey.click();
      await switched;
      fakeKey.remove();
      await nextRender();

      expect(queryKey(el, "["), "symbols layout is rendered").to.not.be.null;
      const returnKey = queryKey(el, "{layout:base}");
      expect(returnKey, "the return key stays: it is the only way back to the numpad").to.not.be.null;
      expect(
        returnKey!.querySelector(`.${DOM.classes.keyLabel}`),
        "the kept return key drops the misleading 'ABC' text (rendered as a back icon)",
      ).to.be.null;
      expect(returnKey!.getAttribute("aria-label"), "its accessible name says it returns to numbers").to.equal(
        "Return to numbers",
      );
      expect(
        returnKey!.querySelector(`.${DOM.classes.keyIcon}`),
        "the kept return key renders a back icon, not a blank key",
      ).to.not.be.null;

      const back = oneEvent(el, "layout-change");
      returnKey!.click();
      await back;
      await nextRender();

      expect(queryKey(el, "7"), "numpad surface is rendered again").to.not.be.null;
      expect(queryKey(el, "["), "symbols layout left").to.be.null;
      expect(queryKey(el, "q"), "not the alphabetic base layout").to.be.null;
      expect(queryKey(el, "{layout:special}"), "back on the numpad (ships no {layout:*}), not numeric").to.be.null;
    });

    it("Numeric: a layout without a '123' key keeps the return key (relabeled) as its only escape (nav)", async () => {
      // The built-in nav layout's only route out is {layout:base} (its other
      // switch goes deeper, to fkeys). Stripping it there would strand the user,
      // so the strip may only remove it where a {layout:numeric} duplicate
      // exists; here it is kept but relabeled to a back icon ("Return to
      // numbers"), since under the constraint it returns to numbers rather than
      // letters. Mirrors the kiosk twin.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numeric"></kiosk-keyboard> `);
      await nextRender();

      const fakeKey = document.createElement("div");
      fakeKey.setAttribute("role", "button");
      fakeKey.dataset.key = "{layout:nav}";
      rootDiv(el).appendChild(fakeKey);
      const switched = oneEvent(el, "layout-change");
      fakeKey.click();
      await switched;
      fakeKey.remove();
      await nextRender();

      expect(queryKey(el, "{layout:fkeys}"), "nav layout is rendered").to.not.be.null;
      const returnKey = queryKey(el, "{layout:base}");
      expect(returnKey, "the return key stays: it is the nav layout's only way back").to.not.be.null;
      expect(
        returnKey!.querySelector(`.${DOM.classes.keyLabel}`),
        "the kept return key drops the misleading 'ABC' text (rendered as a back icon)",
      ).to.be.null;
      expect(returnKey!.getAttribute("aria-label"), "its accessible name says it returns to numbers").to.equal(
        "Return to numbers",
      );
      expect(
        returnKey!.querySelector(`.${DOM.classes.keyIcon}`),
        "the kept return key renders a back icon, not a blank key",
      ).to.not.be.null;

      const back = oneEvent(el, "layout-change");
      returnKey!.click();
      await back;
      await nextRender();

      expect(queryKey(el, "{layout:special}"), "numeric surface is rendered again").to.not.be.null;
    });

    it("Numpad: a mixed-case {layout:BASE} key re-engages the constraint (twin parity)", async () => {
      // {layout:base} is the base-return token regardless of case; {layout:BASE}
      // must re-engage the keyboardType constraint and return to the numpad,
      // matching the kiosk twin.
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard keyboard-type="Numpad"></kiosk-keyboard> `);
      await nextRender();

      const toSpecial = document.createElement("div");
      toSpecial.setAttribute("role", "button");
      toSpecial.dataset.key = "{layout:special}";
      rootDiv(el).appendChild(toSpecial);
      const switched = oneEvent(el, "layout-change");
      toSpecial.click();
      await switched;
      toSpecial.remove();
      await nextRender();
      expect(queryKey(el, "["), "user switch reached the symbols layout").to.not.be.null;

      const back = document.createElement("div");
      back.setAttribute("role", "button");
      back.dataset.key = "{layout:BASE}";
      rootDiv(el).appendChild(back);
      const returned = oneEvent(el, "layout-change");
      back.click();
      await returned;
      back.remove();
      await nextRender();

      expect(queryKey(el, "7"), "mixed-case {layout:BASE} returned to the numpad").to.not.be.null;
      expect(queryKey(el, "["), "left the symbols layout").to.be.null;
    });

    it("preserves a user {layout:*} override when the same auto-detected input is refocused", async () => {
      // Cross-package parity with kiosk-keyboard (#102 review): re-focusing the
      // already-active auto-detected input is a caret reposition, not a new
      // editing context, so the user's {layout:*} override must survive. webc's
      // focusin guard (`if (detected !== this.keyboardType)`) already prevents the
      // redundant re-detect that would reset `_layoutSource`; this locks it in.
      const container = await fixture(html`
        <div>
          <input id="num-refocus" type="number" />
          <kiosk-keyboard layout="qwerty" docked auto-show auto-type controls="num-refocus"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#num-refocus")!;
      const el = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Auto-detect Numpad for the number input. The auto-forced numpad surface
      // strips the {layout:base} (ABC) key, so its absence marks "on numpad".
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await nextRender();
      expect(el.keyboardType).to.equal("Numpad");
      expect(queryKey(el, "{layout:base}"), "auto-forced numpad strips the ABC key").to.be.null;

      // User taps a {layout:special} key: a user-driven switch that overrides the
      // keyboardType constraint. The special layout's symbol keys (e.g. "[") mark
      // that the override took effect; its ABC ({layout:base}) key is kept because
      // under Numpad it is the only return path to the constrained surface.
      const fakeKey = document.createElement("div");
      fakeKey.setAttribute("role", "button");
      fakeKey.dataset.key = "{layout:special}";
      rootDiv(el).appendChild(fakeKey);
      const switched = oneEvent(el, "layout-change");
      fakeKey.click();
      await switched;
      fakeKey.remove();
      await nextRender();
      expect(queryKey(el, "["), "special layout is shown after the user override").to.not.be.null;
      expect(queryKey(el, "{layout:base}"), "ABC kept as the return path to the numpad").to.not.be.null;

      // Refocus the SAME input: the override must NOT be reverted.
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await nextRender();

      expect(el.keyboardType, "keyboardType unchanged by refocus").to.equal("Numpad");
      expect(queryKey(el, "["), "user {layout:special} override survives refocusing the same input").to.not.be.null;
    });
  });

  // ── Docked mode ──

  describe("docked mode", () => {
    it("opens and closes via show()/close()", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.true;

      el.show();
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.false;

      el.close();
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.true;
    });

    it("dispatches after-open event", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      const afterOpenEvent = oneEvent(el, "after-open");
      el.show();
      await afterOpenEvent;
    });

    it("dispatches after-close event", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      el.show();
      const afterCloseEvent = oneEvent(el, "after-close");
      el.close();
      await afterCloseEvent;
    });

    it("closes on Escape key", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      el.show();
      expect(el.open).to.be.true;

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.open).to.be.false;
    });

    it("fires after-close and resets state when docked is set to false while open", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      el.show();
      expect(el.open).to.be.true;

      let closeFired = false;
      el.addEventListener(
        "after-close",
        () => {
          closeFired = true;
        },
        { once: true },
      );

      el.docked = false;
      await nextRender();

      expect(closeFired, "after-close should fire when docked toggled off while open").to.be.true;
      expect(el.open, "open should be false after docked toggled off").to.be.false;
    });

    it("fires after-close when element is removed from DOM while open", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      el.show();
      expect(el.open).to.be.true;

      let closeFired = false;
      el.addEventListener(
        "after-close",
        () => {
          closeFired = true;
        },
        { once: true },
      );

      el.remove();

      expect(closeFired, "after-close should fire when element removed while open").to.be.true;
    });

    it("properly manages escape listener across docked toggles", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      el.show();
      expect(el.open).to.be.true;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.open).to.be.false;

      // Toggle docked off and back on
      el.docked = false;
      await nextRender();
      el.docked = true;
      await nextRender();

      // Escape should still work after re-enabling docked
      el.show();
      expect(el.open).to.be.true;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.open).to.be.false;
    });

    it("opens via open property (reactive attribute)", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      await nextRender();
      expect(el.open).to.be.false;

      el.open = true;
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.false;

      el.open = false;
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.true;
    });

    it("does not fire spurious after-close when open=true is rejected (non-docked)", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      let closeFired = false;
      el.addEventListener(
        "after-close",
        () => {
          closeFired = true;
        },
        { once: true },
      );

      // open=true on a non-docked keyboard should be rejected silently -
      // it must NOT fire after-close since the keyboard never opened.
      el.open = true;
      await nextRender();

      expect(el.open, "open should remain false when not docked").to.be.false;
      expect(closeFired, "after-close should NOT fire when open was rejected").to.be.false;
    });

    it("does not fire spurious after-close when show() is called on non-docked keyboard", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      let closeFired = false;
      el.addEventListener(
        "after-close",
        () => {
          closeFired = true;
        },
        { once: true },
      );

      el.show();
      await nextRender();

      expect(el.open, "open should remain false when not docked").to.be.false;
      expect(closeFired, "after-close should NOT fire when show() was rejected").to.be.false;
    });

    it("fires after-open when open attribute is set in markup", async () => {
      // Create the element and attach the listener before it connects to the DOM,
      // because after-open fires during onEnterDOM (before fixture() resolves).
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.setAttribute("layout", "qwerty");
      el.setAttribute("docked", "");
      el.setAttribute("open", "");

      let openFired = false;
      el.addEventListener(
        "after-open",
        () => {
          openFired = true;
        },
        { once: true },
      );

      // Connect to DOM - this triggers onEnterDOM → _performOpen → after-open
      const container = await fixture(html` <div></div> `);
      container.appendChild(el);
      await nextRender();

      expect(el.open, "keyboard should be open from attribute").to.be.true;
      expect(openFired, "after-open should have fired during connection").to.be.true;
    });

    it("resets open to false when open attribute is set in markup without docked", async () => {
      // Regression: open=true set before connect on a non-docked keyboard
      // must be normalized to false during onEnterDOM, not left as stale true.
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.setAttribute("layout", "qwerty");
      el.setAttribute("open", ""); // open without docked

      let openFired = false;
      let closeFired = false;
      el.addEventListener("after-open", () => {
        openFired = true;
      });
      el.addEventListener("after-close", () => {
        closeFired = true;
      });

      const container = await fixture(html` <div></div> `);
      container.appendChild(el);
      await nextRender();

      expect(el.open, "open should be false - non-docked keyboard cannot be open").to.be.false;
      expect(openFired, "after-open should NOT fire for non-docked keyboard").to.be.false;
      expect(closeFired, "after-close should NOT fire - keyboard was never open").to.be.false;

      // Removing from DOM should also not fire spurious after-close
      let closeFiredOnRemove = false;
      el.addEventListener("after-close", () => {
        closeFiredOnRemove = true;
      });
      el.remove();
      expect(closeFiredOnRemove, "after-close should NOT fire on remove for keyboard that was never open").to.be.false;
    });

    it("should use 20% docked shadow opacity (consistent with UI5 library)", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard> `);
      await nextRender();
      const shadow = getComputedStyle(el).getPropertyValue("--kiosk-keyboard-docked-shadow").trim();
      expect(shadow, `docked shadow should use 20% opacity, got: ${shadow}`).to.include("20%");
    });
  });

  // ── Auto-show ──

  describe("auto-show", () => {
    it("opens when target input receives focus", async () => {
      const container = await fixture(html`
        <div>
          <input id="auto-input" type="text" />
          <kiosk-keyboard layout="qwerty" docked auto-show controls="auto-input"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#auto-input")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;

      expect(kb.open).to.be.false;

      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

      await waitUntil(() => kb.open, "keyboard should open on focus");
    });
  });

  // ── Focus steal prevention ──

  describe("focus steal prevention", () => {
    it("prevents default on mousedown to keep focus on input", async () => {
      const container = await fixture(html`
        <div>
          <input id="focus-input" type="text" />
          <kiosk-keyboard layout="qwerty" controls="focus-input"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();
      const key = queryKey(kb, "a")!;

      const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      key.dispatchEvent(mousedown);
      expect(mousedown.defaultPrevented).to.be.true;
    });
  });

  // ── i18n ──

  describe("i18n", () => {
    it("renders visible labels for special keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      const labelEl = shift.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
      expect(labelEl).to.not.be.null;
      expect(labelEl!.textContent!.length).to.be.greaterThan(0);
      expect(labelEl!.textContent).to.not.equal("{shift}");
    });

    it("resolver overrides apply", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");
      KK.setI18nResolver((key: string) => {
        if (key === "KEY_SHIFT") return "Custom Shift";
        return undefined;
      });

      try {
        const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
        await nextRender();
        const shift = queryKey(el, "{shift}")!;
        const labelEl = shift.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
        expect(labelEl!.textContent).to.equal("Custom Shift");
      } finally {
        KK.setI18nResolver(null);
      }
    });

    it("resolves the numeric layout space key label through i18n (regression: hardcoded 'Space')", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");
      KK.setI18nResolver((key: string) => (key === "KEY_SPACE" ? "Espace" : undefined));

      try {
        const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="numeric"></kiosk-keyboard> `);
        await nextRender();
        const space = queryKey(el, " ")!;
        expect(space, "numeric layout has a space key").to.not.be.null;
        const labelEl = space.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
        expect(labelEl!.textContent, "space label must resolve through i18n, not a hardcoded literal").to.equal(
          "Espace",
        );
      } finally {
        KK.setI18nResolver(null);
      }
    });

    it("rerenders mounted instances when the resolver changes", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");

      const first = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      const second = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const getLabel = (el: KioskKeyboard) =>
        queryKey(el, "{shift}")!.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!.textContent;

      const initialFirstLabel = getLabel(first);
      const initialSecondLabel = getLabel(second);

      KK.setI18nResolver((key: string) => {
        if (key === "KEY_SHIFT") return "Live Shift";
        return undefined;
      });

      try {
        await nextRender();
        expect(getLabel(first)).to.equal("Live Shift");
        expect(getLabel(second)).to.equal("Live Shift");

        KK.setI18nResolver(null);
        await nextRender();

        expect(getLabel(first)).to.equal(initialFirstLabel);
        expect(getLabel(second)).to.equal(initialSecondLabel);
      } finally {
        KK.setI18nResolver(null);
      }
    });
  });

  // ── F-key / navigation key handling ──

  describe("f-key handling", () => {
    it("fires key-press with extracted key name for F-keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="fkeys"></kiosk-keyboard> `);
      await nextRender();
      const f5Key = queryKey(el, "{fkey:F5}")!;
      expect(f5Key).to.not.be.null;

      const keyPressEvent = oneEvent(el, "key-press");
      f5Key.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("F5");
      expect(detail.shiftKey).to.be.false;
    });

    it("fires key-press with extracted key name for nav keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="nav"></kiosk-keyboard> `);
      await nextRender();
      const arrowUp = queryKey(el, "{fkey:ArrowUp}")!;
      expect(arrowUp).to.not.be.null;

      const keyPressEvent = oneEvent(el, "key-press");
      arrowUp.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("ArrowUp");
    });

    it("prevents default on key-press to suppress F-key action", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="fkeys"></kiosk-keyboard> `);
      await nextRender();
      let prevented = false;
      el.addEventListener(
        "key-press",
        (e: Event) => {
          e.preventDefault();
          prevented = true;
        },
        { once: true },
      );

      const f5Key = queryKey(el, "{fkey:F5}")!;
      f5Key.click();
      expect(prevented).to.be.true;
    });

    it("fKeyMode=None suppresses all action", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-none-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-none-target" f-key-mode="None"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-none-target")!;
      input.setSelectionRange(2, 2);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const arrowRight = queryKey(kb, "{fkey:ArrowRight}")!;
      arrowRight.click();
      // Cursor should not have moved (fKeyMode=None)
      expect(input.selectionStart).to.equal(2);
    });

    it("fKeyMode=Virtual (default) moves cursor for nav keys", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-event-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-event-target"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-event-target")!;
      input.setSelectionRange(2, 2);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const arrowRight = queryKey(kb, "{fkey:ArrowRight}")!;
      arrowRight.click();
      expect(input.selectionStart).to.equal(3);
    });

    it("fKeyMode=Virtual moves cursor to start with Home", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-home-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-home-target"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-home-target")!;
      input.setSelectionRange(3, 3);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const homeKey = queryKey(kb, "{fkey:Home}")!;
      homeKey.click();
      expect(input.selectionStart).to.equal(0);
    });

    it("fKeyMode=Virtual moves cursor to end with End", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-end-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-end-target"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-end-target")!;
      input.setSelectionRange(1, 1);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const endKey = queryKey(kb, "{fkey:End}")!;
      endKey.click();
      expect(input.selectionStart).to.equal(5);
    });

    it("fKeyMode=Native dispatches synthetic keydown on target", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-native-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-native-target" f-key-mode="Native"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-native-target")!;
      input.setSelectionRange(2, 2);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      let nativeKeydown: KeyboardEvent | null = null;
      input.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
          nativeKeydown = e;
        },
        { once: true },
      );

      const arrowRight = queryKey(kb, "{fkey:ArrowRight}")!;
      arrowRight.click();

      expect(nativeKeydown).to.not.be.null;
      expect(nativeKeydown!.key).to.equal("ArrowRight");
    });

    it("fKeyMode=Native: canceled native keydown suppresses built-in action", async () => {
      const container = await fixture(html`
        <div>
          <input id="fkey-cancel-target" type="text" value="hello" />
          <kiosk-keyboard layout="nav" controls="fkey-cancel-target" f-key-mode="Native"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#fkey-cancel-target")!;
      input.setSelectionRange(2, 2);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      input.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
          e.preventDefault();
        },
        { once: true },
      );

      const arrowRight = queryKey(kb, "{fkey:ArrowRight}")!;
      arrowRight.click();
      // Cursor should not have moved because native keydown was canceled
      expect(input.selectionStart).to.equal(2);
    });

    it("reflects f-key-mode attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard f-key-mode="Native"></kiosk-keyboard> `);
      expect(el.fKeyMode).to.equal("Native");
    });

    it("auto-releases shift after F-key press", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // Activate shift
      const shiftKey = queryKey(el, "{shift}")!;
      shiftKey.click();
      await nextRender();
      expect(shiftKey.getAttribute("aria-pressed")).to.equal("true");

      // Switch to fkeys layout
      queryKey(el, "{layout:fkeys}")!.click();
      await nextRender();

      // Press F1
      queryKey(el, "{fkey:F1}")!.click();
      await nextRender();

      // Shift should have auto-released - switch back to check shift key state
      queryKey(el, "{layout:base}")!.click();
      await nextRender();
      const shiftAfter = queryKey(el, "{shift}")!;
      expect(shiftAfter.getAttribute("aria-pressed")).to.not.equal("true");
    });
  });

  // ── Per-instance layout overrides ──

  describe("per-instance layouts", () => {
    it("instanceLayouts makes a custom layout available for rendering", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard></kiosk-keyboard> `);
      el.instanceLayouts = {
        "test-pin": [
          [{ value: "1" }, { value: "2" }, { value: "3" }],
          [{ value: "4" }, { value: "5" }, { value: "6" }],
        ],
      };
      el.layout = "test-pin";
      await nextRender();

      const keys = queryKeys(el);
      const values = Array.from(keys).map((k) => k.dataset.key);
      expect(values).to.include("1");
      expect(values).to.include("6");
      expect(values).to.have.lengthOf(6);
    });

    it("instanceLayouts on one element does not leak into another", async () => {
      const container = await fixture(html`
        <div>
          <kiosk-keyboard id="kb-a"></kiosk-keyboard>
          <kiosk-keyboard id="kb-b"></kiosk-keyboard>
        </div>
      `);
      const kbA = container.querySelector<KioskKeyboard>("#kb-a")!;
      const kbB = container.querySelector<KioskKeyboard>("#kb-b")!;

      kbA.instanceLayouts = { "shared-test": [[{ value: "x" }, { value: "y" }]] };
      kbA.layout = "shared-test";
      kbB.layout = "shared-test";
      await nextRender();

      const valuesA = Array.from(queryKeys(kbA)).map((k) => k.dataset.key);
      expect(valuesA).to.include("x");
      expect(valuesA).to.include("y");

      // kbB has no instance entry for "shared-test" and no built-in registration
      // exists, so it falls back to the default layout (more than 2 keys).
      const keysB = queryKeys(kbB);
      expect(keysB.length).to.be.greaterThan(2);
    });

    it("falls back to default when an unknown layout is requested without instanceLayouts", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard></kiosk-keyboard> `);
      el.layout = "temp-layout";
      await nextRender();

      const keys = queryKeys(el);
      // Default layout has more than 1 key
      expect(keys.length).to.be.greaterThan(1);
    });
  });

  // ── Accessibility ──

  describe("accessibility", () => {
    it("all keys have role=button", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const keys = el.shadowRoot!.querySelectorAll(DOM.selectors.key);
      expect(keys.length, "layout should render at least one key").to.be.greaterThan(0);
      for (const key of keys) {
        expect(key.getAttribute("role")).to.equal("button");
      }
    });

    it("special keys are accessible via visible label or aria-label", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      // Shift and Enter: have visible text labels (icon+label dual rendering)
      const shift = queryKey(el, "{shift}")!;
      const shiftLabel = shift.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
      expect(shiftLabel).to.not.be.null;
      expect(shiftLabel!.textContent!.length).to.be.greaterThan(0);

      const enter = queryKey(el, "{enter}")!;
      expect(enter.querySelector(`.${DOM.classes.keyLabel}`)).to.not.be.null;

      // Backspace: qwerty layout shows icon+label (dual rendering)
      const backspace = queryKey(el, "{backspace}")!;
      expect(backspace.querySelector(`.${DOM.classes.keyLabel}`)).to.not.be.null;
    });

    it("has a live region outside the aria-hidden root so docked-but-hidden announcements aren't suppressed by AT", async () => {
      // The live region must be a sibling of the aria-hidden root group, not a
      // descendant: when the docked keyboard is hidden, `aria-hidden="true"` on
      // the root would otherwise drop a queued caps-lock/shift announcement from
      // the accessibility tree. A JSX fragment keeps it outside the root.
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>`);
      await nextRender();
      const shadow = el.shadowRoot!;
      const region = shadow.querySelector('[role="status"][aria-live="polite"]');
      const rootGroup = shadow.querySelector('[role="group"]');
      expect(region, "live region present").to.not.be.null;
      expect(rootGroup, "root group present").to.not.be.null;
      expect(rootGroup!.contains(region), "live region must NOT be a descendant of the aria-hidden root group").to.be
        .false;
    });

    it("marks the docked-hidden root inert so its tabbable key is not exposed inside an aria-hidden subtree", async () => {
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>`);
      await nextRender();
      const root = el.shadowRoot!.querySelector<HTMLElement>('[role="group"]')!;
      expect(root.getAttribute("aria-hidden")).to.equal("true");
      expect(root.inert).to.be.true;
      el.open = true;
      await nextRender();
      expect(root.inert).to.be.false;
      expect(root.getAttribute("aria-hidden")).to.be.null;
    });

    it("live region content updates announce shift-on", async () => {
      // The structural test above proves the region escapes the aria-hidden
      // root; this proves it actually receives announcement text, catching a
      // broken announcement pipeline (e.g. _liveRegionText never set).
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
      await nextRender();
      queryKey(el, "{shift}")!.click();
      // The component throttles announcements; wait long enough for at least one to land.
      await new Promise((r) => setTimeout(r, 60));
      const region = el.shadowRoot!.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
      expect(region.textContent ?? "", "shift-on announcement appears in live region").to.match(/shift|on/i);
    });

    it("releasing Caps Lock does not announce shift-off", async () => {
      // ShiftState.isShifted is true in CapsLock mode, so a CapsLock -> Off
      // transition also reads as a shift release. The shift-off announcement is
      // reserved for a genuine Shift -> Off; releasing Caps Lock (a key labelled
      // "Caps Lock") must not claim shift was released.
      const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
      await nextRender();
      const shift = () => queryKey(el, "{shift}")!;
      // Two clicks within the double-click window engage Caps Lock...
      shift().click();
      shift().click();
      await nextRender();
      // ...then a single click turns Caps Lock back off.
      shift().click();
      // Let the throttled announcement queue fully drain (120ms per entry).
      await new Promise((r) => setTimeout(r, 400));
      const region = el.shadowRoot!.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
      expect(region.textContent ?? "", "Caps Lock must have engaged").to.match(/caps/i);
      expect(region.textContent ?? "", "Caps Lock release must not announce shift-off").to.not.match(/shift\s*off/i);
    });

    it("exactly one key has tabindex=0 (roving tabindex)", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const focusable = el.shadowRoot!.querySelectorAll(DOM.selectors.focusableKey);
      expect(focusable.length).to.equal(1);
    });

    it("keyboard group has aria-label and aria-roledescription", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const group = rootDiv(el);
      expect(group.getAttribute("role")).to.equal("group");
      expect(group.getAttribute("aria-label")!.length).to.be.greaterThan(0);
      expect(group.getAttribute("aria-roledescription")!.length).to.be.greaterThan(0);
    });

    it("shift key has aria-pressed=false initially (presence + correct default value)", async () => {
      // Assert the value, not just presence: a bare hasAttribute check passes
      // whether shift defaults to "true" or "false".
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-pressed")).to.equal("false");
    });

    it("disabled keys have aria-disabled", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard> `);
      await nextRender();
      const keys = queryKeys(el);
      expect(keys.length, "layout should render at least one key").to.be.greaterThan(0);
      for (const key of keys) {
        expect(key.getAttribute("aria-disabled")).to.equal("true");
      }
    });

    it("a disabled keyboard exposes no tab stop", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard> `);
      await nextRender();
      const keys = queryKeys(el);
      expect(keys.length, "layout should render at least one key").to.be.greaterThan(0);
      for (const key of keys) {
        expect(key.getAttribute("tabindex")).to.equal("-1");
      }
    });

    it("passes axe-core a11y audit", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      await expect(el).to.be.accessible();
    });

    it("ArrowRight focuses the next key in the same row", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const rowKeys = queryRows(el)[1]!.querySelectorAll<HTMLElement>(DOM.selectors.key);
      // Off-diagonal origin and target: navigation parses the key id and rebuilds
      // it to look the target up, so a row/column transposition cannot satisfy this.
      const originKey = rowKeys[2]!;
      const targetKey = rowKeys[3]!;

      originKey.focus();
      originKey.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      expect(el.shadowRoot!.activeElement, "ArrowRight focuses row 1, column 3").to.equal(targetKey);
      expect(targetKey.getAttribute("tabindex"), "roving tabindex follows the move").to.equal("0");
    });

    it("does not activate a key on Enter/Space with a modifier held", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const firstKey = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.focusableKey)!;
      firstKey.focus();

      let fired = 0;
      el.addEventListener("key-press", () => {
        fired++;
      });

      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: " ", altKey: true, bubbles: true }));
      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: " ", metaKey: true, bubbles: true }));
      expect(fired, "modified Enter/Space must not activate the key").to.equal(0);

      // Sanity: an unmodified Enter still activates.
      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(fired, "plain Enter activates the key").to.equal(1);
    });

    it("Ctrl+End jumps focus to the last key of the last row, Ctrl+Home back to the first", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const rows = queryRows(el);
      const firstKey = rows[0]!.querySelector<HTMLElement>(DOM.selectors.key)!;
      const lastRowKeys = rows[rows.length - 1]!.querySelectorAll<HTMLElement>(DOM.selectors.key);
      const lastKey = lastRowKeys[lastRowKeys.length - 1]!;

      firstKey.focus();
      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "End", ctrlKey: true, bubbles: true }));
      expect(el.shadowRoot!.activeElement, "Ctrl+End focuses the last key of the last row").to.equal(lastKey);
      expect(lastKey.getAttribute("tabindex"), "roving tabindex follows the jump").to.equal("0");

      lastKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", ctrlKey: true, bubbles: true }));
      expect(el.shadowRoot!.activeElement, "Ctrl+Home focuses the first key of the first row").to.equal(firstKey);
      expect(firstKey.getAttribute("tabindex")).to.equal("0");
    });
  });

  // ── keyboard-type-change event ──

  describe("keyboard-type-change event", () => {
    it("fires when keyboardType property changes", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const typeChangeEvent = oneEvent(el, "keyboard-type-change");
      el.keyboardType = "Numpad";
      const { detail } = await typeChangeEvent;
      expect(detail.keyboardType).to.equal("Numpad");
      expect(detail.previousKeyboardType).to.equal("Full");
      expect(detail.autoDetected).to.be.false;
    });

    it("fires with autoDetected=true for auto-type detection", async () => {
      const container = await fixture(html`
        <div>
          <input id="numtype-input" type="number" />
          <kiosk-keyboard layout="qwerty" docked auto-show auto-type controls="numtype-input"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#numtype-input")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const typeChangeEvent = oneEvent(kb, "keyboard-type-change");
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      const { detail } = await typeChangeEvent;
      expect(detail.keyboardType).to.equal("Numpad");
      expect(detail.autoDetected).to.be.true;
    });

    it("does not fire when keyboardType is set to same value", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      let fired = false;
      el.addEventListener("keyboard-type-change", () => {
        fired = true;
      });
      el.keyboardType = "Full"; // same as default
      await nextRender();
      expect(fired).to.be.false;
    });

    it("fires with correct previous type on sequential changes", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      const firstEvent = oneEvent(el, "keyboard-type-change");
      el.keyboardType = "Numpad";
      const first = await firstEvent;
      expect(first.detail.previousKeyboardType).to.equal("Full");

      const secondEvent = oneEvent(el, "keyboard-type-change");
      el.keyboardType = "Numeric";
      const second = await secondEvent;
      expect(second.detail.previousKeyboardType).to.equal("Numpad");
      expect(second.detail.keyboardType).to.equal("Numeric");
    });
  });

  // ── Invalid value clamping ──

  describe("invalid value clamping", () => {
    it("clamps invalid enum values back to their defaults", async () => {
      const cases: [property: string, expectedDefault: string][] = [
        ["keyboardType", "Full"],
        ["fKeyMode", "Virtual"],
        ["mobileKeyboard", "Auto"],
      ];
      for (const [property, expectedDefault] of cases) {
        const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
        await nextRender();
        setInvalidValue(el, property, "InvalidValue");
        await nextRender();
        expect((el as unknown as Record<string, unknown>)[property]).to.equal(expectedDefault);
      }
    });
  });

  // ── Additional property reflection ──

  describe("additional property reflection", () => {
    it("reflects accessible-name attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard accessible-name="My Custom Keyboard"></kiosk-keyboard>
      `);
      expect(el.accessibleName).to.equal("My Custom Keyboard");
    });

    it("accessibleName renders as aria-label on the root group", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" accessible-name="Custom Label"></kiosk-keyboard>
      `);
      await nextRender();
      const group = rootDiv(el);
      expect(group.getAttribute("aria-label")).to.equal("Custom Label");
    });

    it("accessibleName change triggers re-render", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" accessible-name="Label A"></kiosk-keyboard>
      `);
      await nextRender();
      expect(rootDiv(el).getAttribute("aria-label")).to.equal("Label A");

      el.accessibleName = "Label B";
      await nextRender();
      expect(rootDiv(el).getAttribute("aria-label")).to.equal("Label B");
    });

    it("falls back to i18n default when accessibleName is empty", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const label = rootDiv(el).getAttribute("aria-label")!;
      expect(label.length).to.be.greaterThan(0);
      // Default English text is "Virtual Keyboard"
      expect(label).to.equal("Virtual Keyboard");
    });

    it("reflects mobile-keyboard attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard mobile-keyboard="Native"></kiosk-keyboard> `);
      expect(el.mobileKeyboard).to.equal("Native");
    });
  });

  // ── mobileKeyboard open/defer behavior ──

  describe("mobileKeyboard open/defer behavior", () => {
    it("mobileKeyboard='Custom' always opens the docked keyboard", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Custom"></kiosk-keyboard>
      `);
      await nextRender();
      el.show();
      await nextRender();
      expect(el.open).to.be.true;
    });

    it("mobileKeyboard='Native' prevents the docked keyboard from opening", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Native"></kiosk-keyboard>
      `);
      await nextRender();
      el.show();
      await nextRender();
      expect(el.open).to.be.false;
    });

    it("mobileKeyboard='Native' does not fire after-open", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Native"></kiosk-keyboard>
      `);
      await nextRender();
      let fired = false;
      el.addEventListener("after-open", () => {
        fired = true;
      });
      el.show();
      await nextRender();
      expect(fired).to.be.false;
    });
  });

  // ── Additional public API ──

  describe("additional public API", () => {
    it("resetKeyboardType() resets to Full and re-enables auto-detection", async () => {
      const container = await fixture(html`
        <div>
          <input id="reset-type-input" type="number" />
          <kiosk-keyboard layout="qwerty" docked auto-show auto-type controls="reset-type-input"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      const input = container.querySelector<HTMLInputElement>("#reset-type-input")!;
      await nextRender();

      // Explicitly set a type
      kb.keyboardType = "Numpad";
      await nextRender();
      expect(kb.keyboardType).to.equal("Numpad");

      // Reset should go back to Full
      kb.resetKeyboardType();
      await nextRender();
      expect(kb.keyboardType).to.equal("Full");

      // Auto-detection should now resume: focusing a number input should auto-detect Numpad
      const typeChangeEvent = oneEvent(kb, "keyboard-type-change");
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      const { detail } = await typeChangeEvent;
      expect(detail.keyboardType).to.equal("Numpad");
      expect(detail.autoDetected).to.be.true;
    });

    it("isSecondaryLayout() identifies secondary layouts", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");
      expect(KK.isSecondaryLayout("numeric")).to.be.true;
      expect(KK.isSecondaryLayout("special")).to.be.true;
      expect(KK.isSecondaryLayout("fkeys")).to.be.true;
      expect(KK.isSecondaryLayout("nav")).to.be.true;
      expect(KK.isSecondaryLayout("numpad")).to.be.false;
      expect(KK.isSecondaryLayout("qwerty")).to.be.false;
      expect(KK.isSecondaryLayout("qwertz-de")).to.be.false;
      expect(KK.isSecondaryLayout("nonexistent")).to.be.false;
    });
  });

  // ── Responsive sizing ──

  describe("responsive sizing", () => {
    it("container query triggers on .kiosk-keyboard width, not :host width", async () => {
      // Place the component in an 800px wide wrapper but cap the keyboard itself to 18rem.
      // After the container-query fix, breakpoints evaluate against the .kiosk-keyboard
      // box (≤ 18rem triggers the @container narrow breakpoint), not the wide :host.
      // NOTE: fixture({ parentNode }) appends the wrapper to body and registers
      // it for cleanup, so do NOT also call document.body.appendChild() or wrapper.remove().
      const wrapper = document.createElement("div");
      wrapper.style.width = "800px";

      const el = await fixture<KioskKeyboard>(
        html` <kiosk-keyboard layout="qwerty" style="--kiosk-keyboard-max-width: 18rem"></kiosk-keyboard> `,
        { parentNode: wrapper },
      );
      await nextRender();

      const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key);
      expect(key).to.not.be.null;

      const fontSize = parseFloat(getComputedStyle(key!).fontSize);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // At ≤ 20rem the cap is 0.875rem; the computed font-size should be at or below that
      expect(fontSize).to.be.at.most(0.875 * remPx + 0.5, "Font size should be capped at ≤ 0.875rem");
    });

    it("caps the key font at 0.75rem when narrow and height-constrained (matches the kiosk twin)", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard
          layout="qwerty"
          style="height: 15rem; overflow: hidden; --kiosk-keyboard-max-width: 18rem"
        ></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();

      expect(hasCqTier(el, DOM.cqTierValues.short), "short tier from the 15rem constraint").to.be.true;

      const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key)!;
      const fontSize = parseFloat(getComputedStyle(key).fontSize);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      // Short tier reduces key-height to 2.25rem, so the font base is 0.84375rem.
      // The narrow width-only cap (0.875rem) leaves that untouched; the combined
      // cap clamps it to 0.75rem, matching the kiosk twin's short tier.
      expect(fontSize).to.be.at.most(0.75 * remPx + 0.5, "narrow + short caps the key font at 0.75rem");
      expect(fontSize).to.be.lessThan(0.84 * remPx, "the combined cap bit below the short-tier base");
    });

    it("preserves consumer font-size below the responsive cap", async () => {
      // Consumer sets a small custom font-size; the responsive breakpoint should
      // NOT override it to a larger value.
      // NOTE: fixture({ parentNode }) appends the wrapper to body and registers
      // it for cleanup, so do NOT also call document.body.appendChild() or wrapper.remove().
      const wrapper = document.createElement("div");
      wrapper.style.width = "320px";

      const el = await fixture<KioskKeyboard>(
        html` <kiosk-keyboard layout="qwerty" style="--kiosk-keyboard-key-font-size: 0.75rem"></kiosk-keyboard> `,
        { parentNode: wrapper },
      );
      await nextRender();

      const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key);
      expect(key).to.not.be.null;

      const fontSize = parseFloat(getComputedStyle(key!).fontSize);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // 0.75rem is below the 1rem / 0.875rem caps, so it should be preserved
      expect(fontSize).to.be.closeTo(0.75 * remPx, 1, "Custom font-size 0.75rem should be preserved");
    });

    it("measures host content height so padded hosts still trigger height breakpoints", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard
          layout="qwerty"
          style="height: 17rem; padding: 1rem; border: 4px solid transparent; box-sizing: border-box; overflow: hidden"
        ></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();

      expect(hasCqTier(el, DOM.cqTierValues.short), "content-box height triggers cq-short despite host padding").to.be
        .true;
      expect(hasCqTier(el, DOM.cqTierValues.tiny), "padding case stays above tiny breakpoint").to.be.false;
    });

    it("adapts responsively in a fixed-height host", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" style="height: 15rem; overflow: hidden"></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();

      const root = rootDiv(el);

      // 15rem host triggers cq-short (threshold: 16rem)
      expect(hasCqTier(el, DOM.cqTierValues.short), "cq-short applied at 15rem").to.be.true;
      expect(hasCqTier(el, DOM.cqTierValues.tiny), "not tiny at 15rem").to.be.false;

      // No minHeight is set on the root
      expect(root.style.minHeight).to.equal("");

      // Switch layout: keyboard remains within the fixed host
      el.layout = "numeric";
      await nextRender();
      await waitForResponsiveSync();

      // No minHeight after layout switch
      expect(root.style.minHeight).to.equal("", "no minHeight after layout switch");
    });

    it("reacts to a style-only intrinsic height change inside a fixed host", async () => {
      // The host box never changes here, so only the shadow root's own
      // observation can notice: the root is auto-height and overflows the host.
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard
          layout="qwerty"
          style="height: 15rem; overflow: hidden; --kiosk-keyboard-key-height: 1.25rem"
        ></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();

      const hostHeightBefore = el.getBoundingClientRect().height;
      expect(hasCqTier(el, DOM.cqTierValues.short), "not constrained with 1.25rem keys").to.be.false;

      el.style.setProperty("--kiosk-keyboard-key-height", "3rem");

      // Observation and the rAF that applies it span an indeterminate number of
      // frames, so wait on the outcome rather than a fixed count.
      await waitUntil(() => hasCqTier(el, DOM.cqTierValues.short), "cq-short applied after content grew", {
        timeout: 2000,
      });

      expect(el.getBoundingClientRect().height, "host box unchanged").to.equal(hostHeightBefore);
    });

    it("measures layout pixels: ancestor transform scale does not shift breakpoints", async () => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "transform: scale(0.5); transform-origin: top left;";

      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard
            layout="qwerty"
            style="height: 15rem; overflow: hidden; --kiosk-keyboard-key-height: 3rem"
          ></kiosk-keyboard>
        `,
        { parentNode: wrapper },
      );
      await nextRender();
      await waitForResponsiveSync();

      // 15rem of layout height renders visually at 7.5rem. CSS sizing responds
      // to layout pixels, so cq-short (<= 16rem) is correct and cq-tiny
      // (<= 12rem, the visual height) would be a misread.
      expect(hasCqTier(el, DOM.cqTierValues.short), "cq-short from the 15rem layout height").to.be.true;
      expect(hasCqTier(el, DOM.cqTierValues.tiny), "no cq-tiny from the 7.5rem visual height").to.be.false;
    });

    it("keeps the responsive tier when the host className is reassigned", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard
          layout="qwerty"
          style="height: 15rem; overflow: hidden; --kiosk-keyboard-key-height: 3rem"
        ></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();
      expect(hasCqTier(el, DOM.cqTierValues.short), "constrained to short before reconciliation").to.be.true;

      // A framework rewriting the host `class` attribute (React/Vue className
      // reconciliation) would have wiped the old cq-* classes. The tier is an
      // attribute the component owns, so it survives.
      el.className = "consumer-added-class";
      expect(hasCqTier(el, DOM.cqTierValues.short), "tier survives a className reassignment").to.be.true;
    });

    it("guards a numpad against a force-set cq-tier (twin parity with :not(--numpad))", async () => {
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const rowGapRem = (el: KioskKeyboard) =>
        parseFloat(getComputedStyle(el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.root)!).rowGap) / remPx;

      // Control: a non-numpad host takes the short tier's compact gap. Measured
      // synchronously right after the attribute is set, before the controller's
      // next sync re-derives the tier (it never lands on a numpad anyway).
      const plain = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
      await nextRender();
      plain.setAttribute(DOM.attributes.cqTier, DOM.cqTierValues.short);
      expect(rowGapRem(plain)).to.be.closeTo(0.25, 0.02, "non-numpad compacts to the short-tier gap");

      // The guard: :not([keyboard-type="Numpad"]) excludes a numpad even when a
      // consumer force-sets cq-tier, so it keeps its base gap. The numpad root
      // re-declares key-height/font but not gap, so gap is the observable leak
      // the guard closes; this mirrors the kiosk twin's :not(--numpad).
      const numpad = await fixture<KioskKeyboard>(html`<kiosk-keyboard keyboard-type="Numpad"></kiosk-keyboard>`);
      await nextRender();
      numpad.setAttribute(DOM.attributes.cqTier, DOM.cqTierValues.short);
      expect(rowGapRem(numpad)).to.be.closeTo(0.375, 0.02, "numpad keeps its base gap; the tier is guarded out");
    });

    it("applies cq-short when clipped by no more than the root's own border", async () => {
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // The natural height adds the root's border, so a clip within the vertical
      // border is still detected. Default 1px border (2px total, 2px clip) and a
      // 4px override (8px total, 6px clip inside it) must both trigger cq-short.
      const cases = [
        { border: "", clip: 2, note: "default 1px border" },
        { border: "; --kiosk-keyboard-border: 4px solid black", clip: 6, note: "4px border override" },
      ];

      for (const { border, clip, note } of cases) {
        const el = await fixture<KioskKeyboard>(
          html`<kiosk-keyboard layout="qwerty" style="--kiosk-keyboard-key-height: 2rem${border}"></kiosk-keyboard>`,
        );
        await nextRender();
        await waitForResponsiveSync();

        // Unconstrained natural border-box height of the root; the host content
        // box must fit this, border included.
        const root = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.root)!;
        const natural = root.getBoundingClientRect().height;
        expect(natural, `precondition: natural height under the short threshold (${note})`).to.be.lessThan(16 * remPx);

        // Clip within the vertical border: the border box no longer fits.
        el.style.height = `${natural - clip}px`;
        el.style.overflow = "hidden";

        await waitUntil(
          () => hasCqTier(el, DOM.cqTierValues.short),
          `cq-short applied for a within-border clip (${note})`,
          {
            timeout: 2000,
          },
        );
      }
    });

    it("auto-detects height constraint from a resolved-height parent (flex and grid)", async () => {
      // The controller reads only host.clientHeight and root.scrollHeight, so it
      // never branches on the parent's layout mode; both a flex column and a grid
      // row with a resolved height must constrain the host identically.
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const parents = [
        { css: "display: flex; flex-direction: column; height: 250px;", note: "flex" },
        { css: "display: grid; grid-template-rows: 1fr; height: 250px;", note: "grid" },
      ];

      for (const { css, note } of parents) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = css;

        const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `, {
          parentNode: wrapper,
        });
        await nextRender();
        await waitForResponsiveSync();

        expect(el.clientHeight, `host respects ${note} parent height`).to.be.at.most(250);
        expect(hasCqTier(el, DOM.cqTierValues.short), `cq-short applied under ${note} parent`).to.be.true;
        const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key);
        const keyHeight = parseFloat(getComputedStyle(key!).height);
        expect(keyHeight, `${note}: key height reduced to cq-short level`).to.be.at.most(2.25 * remPx + 1);
        expect(keyHeight, `${note}: key height smaller than default 3rem`).to.be.lessThan(3 * remPx);
      }
    });

    it("does not trigger height classes when parent is unconstrained", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      await waitForResponsiveSync();

      // Host auto-sizes to content: no constraint detected
      const root = rootDiv(el);
      expect(root.scrollHeight).to.be.at.most(el.clientHeight + 1, "no overflow in unconstrained host");

      expect(hasCqTier(el, DOM.cqTierValues.short), "no cq-short").to.be.false;
      expect(hasCqTier(el, DOM.cqTierValues.tiny), "no cq-tiny").to.be.false;

      // Key height at full default (3rem)
      const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key);
      const keyHeight = parseFloat(getComputedStyle(key!).height);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      expect(keyHeight).to.be.closeTo(3 * remPx, 1, "key height at full 3rem default");
    });

    it("measures natural height with the tier cleared, so the tier cannot oscillate", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      await waitForResponsiveSync();

      const root = rootDiv(el);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      // root.scrollHeight here depends on the host's cq-tier, which a constant
      // stub cannot express: 20rem with no tier (constrained at the 15rem host)
      // but 10rem once tiered (unconstrained). The measurement must clear the
      // tier first, or a stale tier flips the constrained verdict.
      Object.defineProperty(el, "clientHeight", { value: 15 * remPx, configurable: true });
      Object.defineProperty(root, "scrollHeight", {
        get() {
          return (el.hasAttribute(DOM.attributes.cqTier) ? 10 : 20) * remPx;
        },
        configurable: true,
      });

      try {
        // Seed a stale wrong tier: clearing before measuring re-derives short at
        // 15rem; measuring first reads 10rem and bails, leaving the stale tier.
        el.setAttribute(DOM.attributes.cqTier, DOM.cqTierValues.tiny);

        el.refreshResponsiveState();
        await waitForResponsiveSync();

        expect(hasCqTier(el, DOM.cqTierValues.short), "corrected to cq-short: measured with the tier cleared").to.be
          .true;
        expect(hasCqTier(el, DOM.cqTierValues.tiny), "stale cq-tiny not read into the measurement").to.be.false;
      } finally {
        Reflect.deleteProperty(el, "clientHeight");
        Reflect.deleteProperty(root, "scrollHeight");
      }
    });
  });

  // ── Shadow-DOM inputmode suppression ──

  describe("shadow-DOM inputmode suppression", () => {
    it("restores inputmode on shadow-DOM targets after close", async () => {
      // Define a custom element with a shadow-root input
      const tagName = "shadow-input-host";
      if (!customElements.get(tagName)) {
        customElements.define(
          tagName,
          class extends HTMLElement {
            constructor() {
              super();
              const shadow = this.attachShadow({ mode: "open" });
              const input = document.createElement("input");
              input.type = "text";
              shadow.appendChild(input);
            }
          },
        );
      }

      const container = await fixture(html`
        <div>
          <shadow-input-host id="shadow-host"></shadow-input-host>
          <kiosk-keyboard layout="qwerty" docked controls="shadow-host"></kiosk-keyboard>
        </div>
      `);
      const host = container.querySelector<HTMLElement>("#shadow-host")!;
      const shadowInput = host.shadowRoot!.querySelector("input")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      const originalInputMode = shadowInput.getAttribute("inputmode");

      kb.show();
      await nextRender();
      expect(shadowInput.getAttribute("inputmode")).to.equal("none", "inputmode should be suppressed while open");

      kb.close();
      await nextRender();
      expect(shadowInput.getAttribute("inputmode")).to.equal(
        originalInputMode,
        "inputmode should be restored after close",
      );
    });
  });

  // ── setTargetElement reconciliation ──

  describe("setTargetElement reconciliation", () => {
    it("restores old target inputmode and suppresses new target when retargeting while open", async () => {
      const container = await fixture(html`
        <div>
          <input id="retarget-a" type="text" />
          <input id="retarget-b" type="text" />
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        </div>
      `);
      const inputA = container.querySelector<HTMLInputElement>("#retarget-a")!;
      const inputB = container.querySelector<HTMLInputElement>("#retarget-b")!;
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      await nextRender();

      // Open keyboard targeting input A
      kb.setTargetElement(inputA);
      kb.show();
      await nextRender();
      expect(inputA.getAttribute("inputmode")).to.equal("none", "input A should be suppressed while targeted");

      // Retarget to input B while open
      kb.setTargetElement(inputB);
      await nextRender();
      expect(inputA.getAttribute("inputmode")).to.not.equal(
        "none",
        "input A inputmode should be restored after retarget",
      );
      expect(inputB.getAttribute("inputmode")).to.equal("none", "input B should be suppressed after retarget");
    });
  });

  // ── Multi-keyboard inactive-participation filter ──

  describe("multi-keyboard inactive-participation filter", () => {
    it("disabled keyboard does not block another keyboard from auto-showing on same input", async () => {
      const container = await fixture(html`
        <div>
          <input id="multi-kb-input" type="text" />
          <kiosk-keyboard id="kb-disabled" layout="qwerty" docked disabled controls="multi-kb-input"></kiosk-keyboard>
          <kiosk-keyboard id="kb-active" layout="qwerty" docked auto-show controls="multi-kb-input"></kiosk-keyboard>
        </div>
      `);
      const input = container.querySelector<HTMLInputElement>("#multi-kb-input")!;
      const kbActive = container.querySelector<KioskKeyboard>("#kb-active")!;
      await nextRender();

      // Focus the input to trigger auto-show on the active keyboard
      const afterOpenEvent = oneEvent(kbActive, "after-open");
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await afterOpenEvent;

      expect(kbActive.open).to.be.true;
    });
  });

  // ── CSS Parts ──

  describe("CSS parts", () => {
    it("exposes a frozen parts list and exportParts string on DOM contract", () => {
      expect(DOM.parts).to.deep.equal([
        "keyboard",
        "row",
        "key",
        "modifier",
        "action",
        "fkey",
        "key-label",
        "key-icon",
        "variant-popup",
        "variant-option",
      ]);
      expect(Object.isFrozen(DOM.parts)).to.be.true;
      expect(DOM.exportParts).to.equal(
        "keyboard, row, key, modifier, action, fkey, key-label, key-icon, variant-popup, variant-option",
      );
    });

    it("all declared parts appear in rendered shadow DOM", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="fkeys"></kiosk-keyboard> `);
      await nextRender();

      const allPartElements = el.shadowRoot!.querySelectorAll("[part]");
      const renderedParts = new Set<string>();
      for (const node of allPartElements) {
        for (const token of node.getAttribute("part")!.split(" ")) {
          renderedParts.add(token);
        }
      }

      // The variant-popup / variant-option parts only render while the accent
      // popup is open; they are covered in variant-popup.test.ts.
      const alwaysRendered = DOM.parts.filter((p) => p !== "variant-popup" && p !== "variant-option");
      for (const declared of alwaysRendered) {
        expect(renderedParts.has(declared), `part "${declared}" found in rendered DOM`).to.be.true;
      }
    });

    it("exposes 'keyboard' part on root container", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const root = rootDiv(el);
      expect(root.getAttribute("part")).to.equal("keyboard");
    });

    it("exposes 'row' part on each row", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const rows = queryRows(el);
      expect(rows.length).to.be.greaterThan(0);
      for (const row of rows) {
        expect(row.getAttribute("part")).to.equal("row");
      }
    });

    it("exposes 'key' part on regular keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const key = queryKey(el, "a")!;
      expect(key).to.not.be.null;
      expect(key.getAttribute("part")).to.equal("key");
    });

    it("exposes 'key modifier' part on modifier keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift).to.not.be.null;
      expect(shift.getAttribute("part")).to.equal("key modifier");
    });

    it("exposes 'key action' part on action keys", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const enter = queryKey(el, "{enter}")!;
      expect(enter).to.not.be.null;
      expect(enter.getAttribute("part")).to.equal("key action");
    });

    it("exposes 'key-label' part on text labels", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const label = el.shadowRoot!.querySelector(`.${DOM.classes.keyLabel}`)!;
      expect(label).to.not.be.null;
      expect(label.getAttribute("part")).to.equal("key-label");
    });

    it("exposes 'key-icon' part on icon elements", async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const icon = el.shadowRoot!.querySelector(`.${DOM.classes.keyIcon}`)!;
      expect(icon).to.not.be.null;
      expect(icon.getAttribute("part")).to.equal("key-icon");
    });
  });

  // ── Responsive threshold CSS variables ──

  describe("responsive threshold CSS variables", () => {
    it("uses custom height thresholds for class toggling", async () => {
      const el = await fixture<KioskKeyboard>(html`
        <kiosk-keyboard layout="qwerty" style="height: 260px; overflow: hidden"></kiosk-keyboard>
      `);
      await nextRender();
      await waitForResponsiveSync();

      // At 260px with default 16rem threshold (256px), no cq-short expected.
      // Override short threshold to 18rem (288px) so 260px triggers cq-short.
      el.style.setProperty("--kiosk-keyboard-cq-short-threshold", "18rem");
      el.refreshResponsiveState();
      await waitForResponsiveSync();

      expect(hasCqTier(el, DOM.cqTierValues.short)).to.be.true;
    });
  });
});
