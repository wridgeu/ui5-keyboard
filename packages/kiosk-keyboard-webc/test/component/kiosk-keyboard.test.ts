import { fixture, html, expect, oneEvent, waitUntil } from "@open-wc/testing";
import "../../src/KioskKeyboard.js";
import type KioskKeyboard from "../../src/KioskKeyboard.js";

/** Wait for UI5Element async render cycle (microtask-based). */
async function nextRender(): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

function queryKeys(el: KioskKeyboard): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[role="button"]');
}

function queryKey(el: KioskKeyboard, dataKey: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-key="${CSS.escape(dataKey)}"]`);
}

function rootDiv(el: KioskKeyboard): HTMLElement {
  return el.shadowRoot!.querySelector(".kiosk-keyboard")!;
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
      const rows = el.shadowRoot!.querySelectorAll(".kiosk-row");
      expect(rows.length).to.be.greaterThan(0);
    });

    it("renders disabled state with disabled class", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" disabled></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).classList.contains("kiosk-keyboard--disabled")).to.be.true;
    });

    it("renders docked mode with docked class", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).classList.contains("kiosk-keyboard--docked")).to.be.true;
    });

    it("renders hidden state when docked and not opened", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      await nextRender();
      expect(rootDiv(el).classList.contains("kiosk-keyboard--hidden")).to.be.true;
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

      setTimeout(() => key.click());
      const { detail } = await oneEvent(el, "key-press");
      expect(detail.key).to.equal("1");
      expect(detail.shiftKey).to.be.false;
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

      await new Promise((r) => setTimeout(r, 100));
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

      // Without resolver, no input is found inside the empty div — typing is a no-op
      queryKey(kb, "a")!.click();

      // Set a custom resolver that provides a detached input
      const customInput = document.createElement("input");
      document.body.appendChild(customInput);

      kb.setTargetResolver(() => customInput);
      queryKey(kb, "b")!.click();
      expect(customInput.value).to.equal("b");

      // Cleanup
      kb.setTargetResolver(null);
      customInput.remove();
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
      expect(shift.classList.contains("kiosk-key--caps-lock")).to.be.true;
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

      setTimeout(() => layoutKey!.click());
      const { detail } = await oneEvent(el, "layout-change");
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
      expect(rootDiv(el).classList.contains("kiosk-keyboard--hidden")).to.be.true;

      el.show();
      await nextRender();
      expect(rootDiv(el).classList.contains("kiosk-keyboard--hidden")).to.be.false;

      el.close();
      await nextRender();
      expect(rootDiv(el).classList.contains("kiosk-keyboard--hidden")).to.be.true;
    });

    it("dispatches after-open event", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      setTimeout(() => el.show());
      await oneEvent(el, "after-open");
    });

    it("dispatches after-close event", async () => {
      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty" docked></kiosk-keyboard>
        `,
      );
      el.show();
      setTimeout(() => el.close());
      await oneEvent(el, "after-close");
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

      const el = await fixture<KioskKeyboard>(
        html`
          <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
        `,
      );
      await nextRender();
      const shift = queryKey(el, "{shift}")!;
      expect(shift.getAttribute("aria-label")).to.equal("Custom Shift");

      // Clean up resolver
      KK.setI18nResolver(null);
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

      setTimeout(() => f5Key.click());
      const { detail } = await oneEvent(el, "key-press");
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

      setTimeout(() => arrowUp.click());
      const { detail } = await oneEvent(el, "key-press");
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

      // Shift should have auto-released — switch back to check shift key state
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
      const keys = el.shadowRoot!.querySelectorAll(".kiosk-key");
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
      const focusable = el.shadowRoot!.querySelectorAll('.kiosk-key[tabindex="0"]');
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
      const firstKey = el.shadowRoot!.querySelector<HTMLElement>('.kiosk-key[tabindex="0"]')!;
      firstKey.focus();

      firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      const nextFocused = el.shadowRoot!.querySelector<HTMLElement>('.kiosk-key[tabindex="0"]')!;
      expect(nextFocused).to.not.equal(firstKey);
    });
  });
});
