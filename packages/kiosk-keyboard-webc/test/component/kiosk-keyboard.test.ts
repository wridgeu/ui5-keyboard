import { fixture, html, expect, oneEvent, waitUntil } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";

/** Wait for UI5Element async render cycle. */
const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKeys(el: KioskKeyboard): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[role="button"]');
}

function queryKey(el: KioskKeyboard, dataKey: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(DOM.selectors.keyByValue(dataKey));
}

function rootDiv(el: KioskKeyboard): HTMLElement {
  return el.shadowRoot!.querySelector(DOM.selectors.root)!;
}

function queryRows(el: KioskKeyboard): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll(DOM.selectors.row);
}

async function waitForResponsiveSync(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Assign an invalid value to a typed property to test runtime validation/clamping. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setInvalidValue(target: any, property: string, value: string): void {
  target[property] = value;
}

describe("kiosk-keyboard", () => {
  // ── Render ──

  describe("rendering", () => {
    it("creates shadow DOM with keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const keys = queryKeys(el);
      expect(keys.length).to.be.greaterThan(0);
    });

    it("renders rows matching layout definition", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="numeric"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const rows = queryRows(el);
      expect(rows.length).to.be.greaterThan(0);
    });

    it("renders disabled state with disabled class", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootDocked)).to.be.true;
    });

    it("renders hidden state when docked and not opened", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).classList.contains(DOM.classes.rootHidden)).to.be.true;
    });
  });

  // ── Property reflection ──

  describe("property reflection", () => {
    it("reflects layout attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard>
        `,
      );
      expect(el.layout).to.equal("qwertz-de");
    });

    it("reflects keyboard-type attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard keyboard-type="Numpad"></kiosk-keyboard>
        `,
      );
      expect(el.keyboardType).to.equal("Numpad");
    });

    it("reflects docked boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard docked></kiosk-keyboard>
        `,
      );
      expect(el.docked).to.be.true;
    });

    it("reflects auto-show boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard auto-show></kiosk-keyboard>
        `,
      );
      expect(el.autoShow).to.be.true;
    });

    it("reflects auto-type boolean attribute", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard auto-type></kiosk-keyboard>
        `,
      );
      expect(el.autoType).to.be.true;
    });

    it("reflects disabled attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard disabled></kiosk-keyboard>
        `,
      );
      expect(el.disabled).to.be.true;
    });

    it("reflects for attribute", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard for="my-input"></kiosk-keyboard>
        `,
      );
      expect(el.for).to.equal("my-input");
    });

    it("stores input-ids as string property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard input-ids="a, b, c"></kiosk-keyboard>
        `,
      );
      expect(el.inputIds).to.equal("a, b, c");
    });

    it("re-renders when attribute changes", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="numeric"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="numeric" for="touch-target"></kiosk-keyboard>
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
          <kiosk-keyboard layout="numeric" for="drift-target"></kiosk-keyboard>
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
          <kiosk-keyboard layout="numeric" for="cancel-target"></kiosk-keyboard>
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="numeric" disabled></kiosk-keyboard>
        `,
      );
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
    it("types into target input via for attribute", async () => {
      const container = await fixture(html`
        <div>
          <input id="target-1" type="text" />
          <kiosk-keyboard layout="qwerty" for="target-1"></kiosk-keyboard>
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
          <kiosk-keyboard layout="qwerty" for="resolver-host"></kiosk-keyboard>
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
      // Use a wrapper div as the for-target so the built-in resolver must
      // actually traverse the DOM to find the <input> inside it.
      const container = await fixture(html`
        <div>
          <div id="throw-host"><input type="text" /></div>
          <kiosk-keyboard layout="qwerty" for="throw-host"></kiosk-keyboard>
        </div>
      `);
      const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
      const input = container.querySelector<HTMLInputElement>("input")!;
      await nextRender();

      // Suppress the expected console.warn from resolveWithCustomResolver.
      const originalWarn = console.warn;
      console.warn = () => {};
      kb.setTargetResolver(() => {
        throw new Error("resolver bug");
      });

      try {
        queryKey(kb, "x")!.click();
        expect(input.value, "built-in resolver should find the nested input after resolver threw").to.equal("x");
      } finally {
        console.warn = originalWarn;
        kb.setTargetResolver(null);
      }
    });

    it("falls back to built-in resolver when custom resolver returns non-input element", async () => {
      // Use a wrapper div as the for-target so the built-in resolver must
      // traverse the DOM to find the <input> (not receive it directly).
      const container = await fixture(html`
        <div>
          <div id="fallback-host"><input type="text" /></div>
          <kiosk-keyboard layout="qwerty" for="fallback-host"></kiosk-keyboard>
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
          <kiosk-keyboard layout="qwerty" for="target-3"></kiosk-keyboard>
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

  // ── Shift / Caps ──

  describe("shift and caps lock", () => {
    it("toggles shift state on shift key click", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-pressed")).to.equal("false");

      shift.click();
      await nextRender();
      const shiftAfter = queryKey(el, "{shift}")!;
      expect(shiftAfter.getAttribute("aria-pressed")).to.equal("true");
    });

    it("shows uppercase labels when shifted", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="qwerty" for="target-shift"></kiosk-keyboard>
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="qwerty" for="target-caps"></kiosk-keyboard>
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

  // ── Layout switching ──

  describe("layout switching", () => {
    it("switches layout via layout-change key", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();

      // qwerty has a {layout:numeric} key in the bottom row
      const layoutKey = queryKey(el, "{layout:numeric}");
      expect(layoutKey, "layout switch key should exist in qwerty").to.not.be.null;

      const layoutChangeEvent = oneEvent(el, "layout-change");
      layoutKey!.click();
      const { detail } = await layoutChangeEvent;
      expect(detail.layout).to.equal("numeric");
    });
  });

  // ── Docked mode ──

  describe("docked mode", () => {
    it("opens and closes via show()/close()", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      const afterOpenEvent = oneEvent(el, "after-open");
      el.show();
      await afterOpenEvent;
    });

    it("dispatches after-close event", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      el.show();
      const afterCloseEvent = oneEvent(el, "after-close");
      el.close();
      await afterCloseEvent;
    });

    it("closes on Escape key", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      el.show();
      expect(el.open).to.be.true;

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.open).to.be.false;
    });

    it("fires after-close and resets state when docked is set to false while open", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
      const container = await fixture(
        html`
          <div></div>
        `,
      );
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

      const container = await fixture(
        html`
          <div></div>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shadow = getComputedStyle(el).getPropertyValue("--kiosk-keyboard-docked-shadow").trim();
      // color-mix browsers: "... 20% ..." | fallback: "... 0.2)"
      expect(shadow).to.satisfy(
        (v: string) => v.includes("20%") || v.includes("0.2)"),
        `docked shadow should use 20% opacity, got: ${shadow}`,
      );
    });
  });

  // ── Auto-show ──

  describe("auto-show", () => {
    it("opens when target input receives focus", async () => {
      const container = await fixture(html`
        <div>
          <input id="auto-input" type="text" />
          <kiosk-keyboard layout="qwerty" docked auto-show input-ids="auto-input"></kiosk-keyboard>
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
          <kiosk-keyboard layout="qwerty" for="focus-input"></kiosk-keyboard>
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
    it("renders ARIA labels for special keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      const ariaLabel = shift.getAttribute("aria-label")!;
      expect(ariaLabel.length).to.be.greaterThan(0);
      expect(ariaLabel).to.not.equal("{shift}");
    });

    it("resolver overrides apply", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");
      KK.setI18nResolver((key: string) => {
        if (key === "KEY_SHIFT") return "Custom Shift";
        return undefined;
      });

      try {
        const el = await fixture<KioskKeyboard>(
          html`
            <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
          `,
        );
        await nextRender();
        const shift = queryKey(el, "{shift}")!;
        expect(shift.getAttribute("aria-label")).to.equal("Custom Shift");
      } finally {
        KK.setI18nResolver(null);
      }
    });

    it("rerenders mounted instances when the resolver changes", async () => {
      const { default: KK } = await import("../../src/KioskKeyboard.js");

      const first = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      const second = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();

      const initialFirstLabel = queryKey(first, "{shift}")!.getAttribute("aria-label");
      const initialSecondLabel = queryKey(second, "{shift}")!.getAttribute("aria-label");

      KK.setI18nResolver((key: string) => {
        if (key === "KEY_SHIFT") return "Live Shift";
        return undefined;
      });

      try {
        await nextRender();
        expect(queryKey(first, "{shift}")!.getAttribute("aria-label")).to.equal("Live Shift");
        expect(queryKey(second, "{shift}")!.getAttribute("aria-label")).to.equal("Live Shift");

        KK.setI18nResolver(null);
        await nextRender();

        expect(queryKey(first, "{shift}")!.getAttribute("aria-label")).to.equal(initialFirstLabel);
        expect(queryKey(second, "{shift}")!.getAttribute("aria-label")).to.equal(initialSecondLabel);
      } finally {
        KK.setI18nResolver(null);
      }
    });
  });

  // ── F-key / navigation key handling ──

  describe("f-key handling", () => {
    it("fires key-press with extracted key name for F-keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="fkeys"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="nav"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const arrowUp = queryKey(el, "{fkey:ArrowUp}")!;
      expect(arrowUp).to.not.be.null;

      const keyPressEvent = oneEvent(el, "key-press");
      arrowUp.click();
      const { detail } = await keyPressEvent;
      expect(detail.key).to.equal("ArrowUp");
    });

    it("prevents default on key-press to suppress F-key action", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="fkeys"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="nav" for="fkey-none-target" f-key-mode="None"></kiosk-keyboard>
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
          <kiosk-keyboard layout="nav" for="fkey-event-target"></kiosk-keyboard>
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
          <kiosk-keyboard layout="nav" for="fkey-home-target"></kiosk-keyboard>
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
          <kiosk-keyboard layout="nav" for="fkey-end-target"></kiosk-keyboard>
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
          <kiosk-keyboard layout="nav" for="fkey-native-target" f-key-mode="Native"></kiosk-keyboard>
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
          <kiosk-keyboard layout="nav" for="fkey-cancel-target" f-key-mode="Native"></kiosk-keyboard>
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard f-key-mode="Native"></kiosk-keyboard>
        `,
      );
      expect(el.fKeyMode).to.equal("Native");
    });

    it("auto-releases shift after F-key press", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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

  // ── Instance layout registration ──

  describe("instance layout registration", () => {
    it("registerLayout on instance makes layout available for rendering", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard></kiosk-keyboard>
        `,
      );
      el.registerLayout("test-pin", [
        [{ value: "1" }, { value: "2" }, { value: "3" }],
        [{ value: "4" }, { value: "5" }, { value: "6" }],
      ]);
      el.layout = "test-pin";
      await nextRender();

      const keys = queryKeys(el);
      const values = Array.from(keys).map((k) => k.dataset.key);
      expect(values).to.include("1");
      expect(values).to.include("6");
      expect(values).to.have.lengthOf(6);

      // Clean up
      el.unregisterLayout("test-pin");
    });

    it("layout registered on one instance is visible to another", async () => {
      const container = await fixture(html`
        <div>
          <kiosk-keyboard id="kb-a"></kiosk-keyboard>
          <kiosk-keyboard id="kb-b"></kiosk-keyboard>
        </div>
      `);
      const kbA = container.querySelector<KioskKeyboard>("#kb-a")!;
      const kbB = container.querySelector<KioskKeyboard>("#kb-b")!;

      kbA.registerLayout("shared-test", [[{ value: "x" }, { value: "y" }]]);
      kbB.layout = "shared-test";
      await nextRender();

      const keys = queryKeys(kbB);
      const values = Array.from(keys).map((k) => k.dataset.key);
      expect(values).to.include("x");
      expect(values).to.include("y");

      // Clean up
      kbA.unregisterLayout("shared-test");
    });

    it("unregisterLayout on instance removes layout", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard></kiosk-keyboard>
        `,
      );
      el.registerLayout("temp-layout", [[{ value: "a" }]]);
      el.unregisterLayout("temp-layout");

      // Should fall back to default since temp-layout is gone
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const keys = el.shadowRoot!.querySelectorAll(DOM.selectors.key);
      expect(keys.length, "layout should render at least one key").to.be.greaterThan(0);
      for (const key of keys) {
        expect(key.getAttribute("role")).to.equal("button");
      }
    });

    it("special keys have aria-label", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-label")).to.not.be.null;
      expect(shift.getAttribute("aria-label")!.length).to.be.greaterThan(0);

      const enter = queryKey(el, "{enter}")!;
      expect(enter.getAttribute("aria-label")).to.not.be.null;

      const backspace = queryKey(el, "{backspace}")!;
      expect(backspace.getAttribute("aria-label")).to.not.be.null;
    });

    it("has a live region for announcements", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const region = el.shadowRoot!.querySelector('[role="status"][aria-live="polite"]');
      expect(region).to.not.be.null;
    });

    it("exactly one key has tabindex=0 (roving tabindex)", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const focusable = el.shadowRoot!.querySelectorAll(DOM.selectors.focusableKey);
      expect(focusable.length).to.equal(1);
    });

    it("keyboard group has aria-label and aria-roledescription", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const group = rootDiv(el);
      expect(group.getAttribute("role")).to.equal("group");
      expect(group.getAttribute("aria-label")!.length).to.be.greaterThan(0);
      expect(group.getAttribute("aria-roledescription")!.length).to.be.greaterThan(0);
    });

    it("shift key has aria-pressed attribute", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.hasAttribute("aria-pressed")).to.be.true;
    });

    it("disabled keys have aria-disabled", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard>
        `,
      );
      await nextRender();
      const keys = queryKeys(el);
      expect(keys.length, "layout should render at least one key").to.be.greaterThan(0);
      for (const key of keys) {
        expect(key.getAttribute("aria-disabled")).to.equal("true");
      }
    });

    it("passes axe-core a11y audit", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      await expect(el).to.be.accessible();
    });

    it("keyboard navigation moves focus between keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const firstKey = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.focusableKey)!;
      firstKey.focus();

      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      const nextFocused = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.focusableKey)!;
      expect(nextFocused).to.not.equal(firstKey);
    });
  });

  // ── keyboard-type-change event ──

  describe("keyboard-type-change event", () => {
    it("fires when keyboardType property changes", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="qwerty" docked auto-show auto-type input-ids="numtype-input"></kiosk-keyboard>
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
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
    it("clamps invalid keyboardType to 'Full'", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      setInvalidValue(el, "keyboardType", "InvalidType");
      await nextRender();
      expect(el.keyboardType).to.equal("Full");
    });

    it("clamps invalid fKeyMode to 'Virtual'", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      setInvalidValue(el, "fKeyMode", "InvalidMode");
      await nextRender();
      expect(el.fKeyMode).to.equal("Virtual");
    });

    it("clamps invalid mobileKeyboard to 'Auto'", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      setInvalidValue(el, "mobileKeyboard", "InvalidValue");
      await nextRender();
      expect(el.mobileKeyboard).to.equal("Auto");
    });
  });

  // ── Additional property reflection ──

  describe("additional property reflection", () => {
    it("reflects accessible-name attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard accessible-name="My Custom Keyboard"></kiosk-keyboard>
        `,
      );
      expect(el.accessibleName).to.equal("My Custom Keyboard");
    });

    it("accessibleName renders as aria-label on the root group", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" accessible-name="Custom Label"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const group = rootDiv(el);
      expect(group.getAttribute("aria-label")).to.equal("Custom Label");
    });

    it("accessibleName change triggers re-render", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" accessible-name="Label A"></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).getAttribute("aria-label")).to.equal("Label A");

      el.accessibleName = "Label B";
      await nextRender();
      expect(rootDiv(el).getAttribute("aria-label")).to.equal("Label B");
    });

    it("falls back to i18n default when accessibleName is empty", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const label = rootDiv(el).getAttribute("aria-label")!;
      expect(label.length).to.be.greaterThan(0);
      // Default English text is "Virtual Keyboard"
      expect(label).to.equal("Virtual Keyboard");
    });

    it("reflects mobile-keyboard attribute to property", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard mobile-keyboard="Native"></kiosk-keyboard>
        `,
      );
      expect(el.mobileKeyboard).to.equal("Native");
    });
  });

  // ── mobileKeyboard open/defer behavior ──

  describe("mobileKeyboard open/defer behavior", () => {
    it("mobileKeyboard='Custom' always opens the docked keyboard", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Custom"></kiosk-keyboard>
        `,
      );
      await nextRender();
      el.show();
      await nextRender();
      expect(el.open).to.be.true;
    });

    it("mobileKeyboard='Native' prevents the docked keyboard from opening", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Native"></kiosk-keyboard>
        `,
      );
      await nextRender();
      el.show();
      await nextRender();
      expect(el.open).to.be.false;
    });

    it("mobileKeyboard='Native' does not fire after-open", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked mobile-keyboard="Native"></kiosk-keyboard>
        `,
      );
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
          <kiosk-keyboard layout="qwerty" docked auto-show auto-type input-ids="reset-type-input"></kiosk-keyboard>
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

    it("isOpen() returns current open state", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(el.isOpen()).to.be.false;

      el.show();
      expect(el.isOpen()).to.be.true;

      el.close();
      expect(el.isOpen()).to.be.false;
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
      // box (≤ 18rem → cq-xs), not the wide :host.
      // NOTE: fixture({ parentNode }) appends the wrapper to body and registers
      // it for cleanup, so do NOT also call document.body.appendChild() or wrapper.remove().
      const wrapper = document.createElement("div");
      wrapper.style.width = "800px";

      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="--kiosk-keyboard-max-width: 18rem"></kiosk-keyboard>
        `,
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

    it("JS fallback applies width classes for non-CQ browsers", async () => {
      // _applyResponsiveClasses adds cq-sm / cq-xs classes to .kiosk-keyboard
      // based on measured width. In CQ browsers the @supports not(...) CSS
      // hides these; in non-CQ browsers they drive the font-size caps.
      // This test verifies the JS class-toggle logic works correctly.
      const wrapper = document.createElement("div");
      wrapper.style.width = "18rem"; // ≤ 20rem → should get cq-xs

      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
        { parentNode: wrapper },
      );
      await nextRender();

      const root = rootDiv(el);
      expect(root.classList.contains(DOM.classes.rootCqXs), "cq-xs applied at ≤ 20rem").to.be.true;
      expect(root.classList.contains(DOM.classes.rootCqSm), "cq-sm absent when cq-xs applies").to.be.false;

      // Widen to 25rem → should switch to cq-sm
      wrapper.style.width = "25rem";
      // Trigger ResizeObserver cycle
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await nextRender();

      expect(root.classList.contains(DOM.classes.rootCqSm), "cq-sm applied at ≤ 30rem").to.be.true;
      expect(root.classList.contains(DOM.classes.rootCqXs), "cq-xs removed above 20rem").to.be.false;

      // Widen beyond 30rem → both removed
      wrapper.style.width = "40rem";
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await nextRender();

      expect(root.classList.contains(DOM.classes.rootCqSm), "cq-sm removed above 30rem").to.be.false;
      expect(root.classList.contains(DOM.classes.rootCqXs), "cq-xs removed above 30rem").to.be.false;
    });

    it("preserves consumer font-size below the responsive cap", async () => {
      // Consumer sets a small custom font-size; the responsive breakpoint should
      // NOT override it to a larger value.
      // NOTE: fixture({ parentNode }) appends the wrapper to body and registers
      // it for cleanup, so do NOT also call document.body.appendChild() or wrapper.remove().
      const wrapper = document.createElement("div");
      wrapper.style.width = "320px";

      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="--kiosk-keyboard-key-font-size: 0.75rem"></kiosk-keyboard>
        `,
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
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard
            layout="qwerty"
            style="height: 17rem; padding: 1rem; border: 4px solid transparent; box-sizing: border-box; overflow: hidden"
          ></kiosk-keyboard>
        `,
      );
      await nextRender();
      await waitForResponsiveSync();

      expect(
        el.classList.contains(DOM.classes.hostCqShort),
        "content-box height triggers cq-short despite host padding",
      ).to.be.true;
      expect(el.classList.contains(DOM.classes.hostCqTiny), "padding case stays above tiny breakpoint").to.be.false;
    });

    it("adapts responsively in a fixed-height host", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="height: 15rem; overflow: hidden"></kiosk-keyboard>
        `,
      );
      await nextRender();
      await waitForResponsiveSync();

      const root = rootDiv(el);

      // 15rem host triggers cq-short (threshold: 16rem)
      expect(el.classList.contains(DOM.classes.hostCqShort), "cq-short applied at 15rem").to.be.true;
      expect(el.classList.contains(DOM.classes.hostCqTiny), "not tiny at 15rem").to.be.false;

      // No minHeight is set on the root
      expect(root.style.minHeight).to.equal("");

      // Switch layout -- keyboard remains within the fixed host
      el.layout = "numeric";
      await nextRender();
      await waitForResponsiveSync();

      // No minHeight after layout switch
      expect(root.style.minHeight).to.equal("", "no minHeight after layout switch");
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
          <kiosk-keyboard layout="qwerty" docked for="shadow-host"></kiosk-keyboard>
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
          <kiosk-keyboard id="kb-disabled" layout="qwerty" docked disabled for="multi-kb-input"></kiosk-keyboard>
          <kiosk-keyboard id="kb-active" layout="qwerty" docked auto-show input-ids="multi-kb-input"></kiosk-keyboard>
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

      expect(kbActive.isOpen()).to.be.true;
    });
  });

  // ── CSS Parts ──

  describe("CSS parts", () => {
    it("exposes a frozen parts list and exportParts string on DOM contract", () => {
      expect(DOM.parts).to.deep.equal(["keyboard", "row", "key", "modifier", "action", "key-label", "key-icon"]);
      expect(Object.isFrozen(DOM.parts)).to.be.true;
      expect(DOM.exportParts).to.equal("keyboard, row, key, modifier, action, key-label, key-icon");
    });

    it("exportParts string matches the parts array", () => {
      const fromString = DOM.exportParts.split(", ");
      expect(fromString).to.deep.equal([...DOM.parts]);
    });

    it("all declared parts appear in rendered shadow DOM", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();

      const allPartElements = el.shadowRoot!.querySelectorAll("[part]");
      const renderedParts = new Set<string>();
      for (const node of allPartElements) {
        for (const token of node.getAttribute("part")!.split(" ")) {
          renderedParts.add(token);
        }
      }

      for (const declared of DOM.parts) {
        expect(renderedParts.has(declared), `part "${declared}" found in rendered DOM`).to.be.true;
      }
    });

    it("exposes 'keyboard' part on root container", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const root = rootDiv(el);
      expect(root.getAttribute("part")).to.equal("keyboard");
    });

    it("exposes 'row' part on each row", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const rows = queryRows(el);
      expect(rows.length).to.be.greaterThan(0);
      for (const row of rows) {
        expect(row.getAttribute("part")).to.equal("row");
      }
    });

    it("exposes 'key' part on regular keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const key = queryKey(el, "a")!;
      expect(key).to.not.be.null;
      expect(key.getAttribute("part")).to.equal("key");
    });

    it("exposes 'key modifier' part on modifier keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift).to.not.be.null;
      expect(shift.getAttribute("part")).to.equal("key modifier");
    });

    it("exposes 'key action' part on action keys", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const enter = queryKey(el, "{enter}")!;
      expect(enter).to.not.be.null;
      expect(enter.getAttribute("part")).to.equal("key action");
    });

    it("exposes 'key-label' part on text labels", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const label = el.shadowRoot!.querySelector(`.${DOM.classes.keyLabel}`)!;
      expect(label).to.not.be.null;
      expect(label.getAttribute("part")).to.equal("key-label");
    });

    it("exposes 'key-icon' part on icon elements", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const icon = el.shadowRoot!.querySelector(`.${DOM.classes.keyIcon}`)!;
      expect(icon).to.not.be.null;
      expect(icon.getAttribute("part")).to.equal("key-icon");
    });
  });

  // ── Responsive threshold CSS variables ──

  describe("responsive threshold CSS variables", () => {
    it("uses custom width thresholds for visible narrow-mode styling", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="width: 600px"></kiosk-keyboard>
        `,
      );
      await nextRender();
      await waitForResponsiveSync();

      const key = queryKey(el, "1");
      expect(key).to.not.be.null;

      const defaultFontSize = parseFloat(getComputedStyle(key!).fontSize);
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      // At 600px with default 30rem threshold (480px), no cq-sm class expected.
      // Override narrow threshold to 40rem (640px) so 600px triggers cq-sm.
      el.style.setProperty("--kiosk-keyboard-cq-narrow-threshold", "40rem");
      el.refreshResponsiveState();
      await waitForResponsiveSync();

      const root = rootDiv(el);
      expect(root.classList.contains(DOM.classes.rootCqWidthCustom)).to.be.true;
      expect(root.classList.contains(DOM.classes.rootCqSm)).to.be.true;

      const customFontSize = parseFloat(getComputedStyle(key!).fontSize);
      expect(customFontSize).to.be.at.most(1 * remPx + 0.5, "Font size should respect the 1rem narrow cap");
      expect(customFontSize).to.be.below(
        defaultFontSize - 0.5,
        "Custom width threshold should visibly narrow the keys",
      );
    });

    it("uses custom compact threshold for visible compact-mode padding", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="width: 28rem"></kiosk-keyboard>
        `,
      );
      await nextRender();
      await waitForResponsiveSync();

      const key = queryKey(el, "1");
      expect(key).to.not.be.null;

      const defaultPaddingLeft = parseFloat(getComputedStyle(key!).paddingLeft);

      // At 28rem the default 20rem compact threshold does not apply.
      // Override compact threshold to 30rem so 28rem triggers cq-xs.
      el.style.setProperty("--kiosk-keyboard-cq-compact-threshold", "30rem");
      el.refreshResponsiveState();
      await waitForResponsiveSync();

      const root = rootDiv(el);
      expect(root.classList.contains(DOM.classes.rootCqWidthCustom)).to.be.true;
      expect(root.classList.contains(DOM.classes.rootCqXs)).to.be.true;

      const compactPaddingLeft = parseFloat(getComputedStyle(key!).paddingLeft);
      expect(compactPaddingLeft).to.be.below(
        defaultPaddingLeft - 0.5,
        "Custom compact threshold should reduce key padding",
      );
    });

    it("uses custom height thresholds for class toggling", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" style="height: 260px; overflow: hidden"></kiosk-keyboard>
        `,
      );
      await nextRender();
      await waitForResponsiveSync();

      // At 260px with default 16rem threshold (256px), no cq-short expected.
      // Override short threshold to 18rem (288px) so 260px triggers cq-short.
      el.style.setProperty("--kiosk-keyboard-cq-short-threshold", "18rem");
      el.refreshResponsiveState();
      await waitForResponsiveSync();

      expect(el.classList.contains(DOM.classes.hostCqShort)).to.be.true;
    });
  });
});
