import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await renderFinished();
  }
}

function physicalKey(input: HTMLElement, key: string, shiftKey = false): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
}

function isHighlighted(kb: KioskKeyboard, value: string): boolean {
  return requireKey(kb, value).classList.contains(DOM.classes.keyHighlight);
}

describe("kiosk-keyboard - target switch", () => {
  it("setTargetElement commits a live preedit to the old input before switching", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="ts-a" />
        <input id="ts-b" value="xyz" />
        <kiosk-keyboard layout="ko-hangul"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const a = box.querySelector<HTMLInputElement>("#ts-a")!;
    const b = box.querySelector<HTMLInputElement>("#ts-b")!;
    await renderFinished();
    kb.setTargetElement(a);
    let ends = 0;
    a.addEventListener("compositionend", () => ends++);

    requireKey(kb, "ㄱ").click();
    kb.setTargetElement(b);
    b.setSelectionRange(3, 3);
    requireKey(kb, "ㅏ").click();

    expect(b.value, "the new input is typed at its own caret").to.equal("xyzㅏ");
    expect(ends, "the old input's composition ended").to.equal(1);
  });

  it("binds the physical-key highlight to a target that arrives through controls and show()", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div><kiosk-keyboard docked mobile-keyboard="Custom" layout="qwerty"></kiosk-keyboard></div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    await renderFinished();
    const input = document.createElement("input");
    input.id = "ts-controls";
    box.prepend(input);
    kb.controls = "ts-controls";
    kb.show();
    await settle();

    physicalKey(input, "a");
    expect(isHighlighted(kb, "a")).to.equal(true);
    kb.close();
  });

  it("stops mirroring physical Shift once auto-show clears its target", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="ts-clear" />
        <button id="ts-away">away</button>
        <kiosk-keyboard docked auto-show mobile-keyboard="Custom" layout="qwerty"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const input = box.querySelector<HTMLInputElement>("#ts-clear")!;
    await renderFinished();
    input.focus();
    await settle();
    expect(kb.open, "precondition: auto-show opened").to.equal(true);
    box.querySelector<HTMLButtonElement>("#ts-away")!.focus();
    await settle();
    expect(kb.getActiveTargetElement(), "precondition: target cleared").to.equal(null);

    physicalKey(input, "Shift", true);
    await settle();
    expect(requireKey(kb, "{shift}").classList.contains(DOM.classes.keyShiftActive)).to.equal(false);
  });

  it("re-arms the physical-key listeners when a cleared target is set again", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="ts-rearm" />
        <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const input = box.querySelector<HTMLInputElement>("#ts-rearm")!;
    await renderFinished();
    kb.setTargetElement(input);
    kb.setTargetElement(null);
    kb.setTargetElement(input);
    await settle();

    physicalKey(input, "a");
    expect(isHighlighted(kb, "a")).to.equal(true);
  });

  it("a removed target ends its composition and announces the cleared target", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="ts-gone" />
        <input id="ts-fallback" value="xyz" />
        <kiosk-keyboard layout="ko-hangul" controls="ts-fallback"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const gone = box.querySelector<HTMLInputElement>("#ts-gone")!;
    const fallback = box.querySelector<HTMLInputElement>("#ts-fallback")!;
    await renderFinished();
    kb.setTargetElement(gone);
    requireKey(kb, "ㄱ").click();
    const changes: (HTMLElement | null)[] = [];
    kb.addEventListener("active-control-change", (e) =>
      changes.push((e as CustomEvent<{ activeElement: HTMLElement | null }>).detail.activeElement),
    );

    gone.remove();
    fallback.setSelectionRange(3, 3);
    requireKey(kb, "ㅏ").click();

    expect(fallback.value, "the fallback is typed at its own caret").to.equal("xyzㅏ");
    expect(changes).to.deep.equal([null]);
  });
});

describe("kiosk-keyboard - Native F-key dispatch and the physical-key mirror", () => {
  const FKEY_LAYOUT: LayoutDefinition = [[{ value: "{shift}" }, { value: "{fkey:ArrowLeft}" }]];

  async function nativeFKeys(): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
    const setup = await setupWithLayout(FKEY_LAYOUT);
    setup.kb.fKeyMode = "Native";
    await settle();
    return setup;
  }

  function hasClass(kb: KioskKeyboard, value: string, cls: string): boolean {
    return requireKey(kb, value).classList.contains(cls);
  }

  it("an on-screen F-key tap keeps Caps Lock and lights no key", async () => {
    const { kb } = await nativeFKeys();
    requireKey(kb, "{shift}").click();
    requireKey(kb, "{shift}").click();
    await settle();
    expect(hasClass(kb, "{shift}", DOM.classes.keyCapsLock), "precondition: caps lock on").to.equal(true);

    requireKey(kb, "{fkey:ArrowLeft}").click();
    await settle();
    expect(hasClass(kb, "{shift}", DOM.classes.keyCapsLock), "caps lock survives the tap").to.equal(true);
    expect(hasClass(kb, "{fkey:ArrowLeft}", DOM.classes.keyHighlight), "our own dispatch lights nothing").to.equal(
      false,
    );
  });

  it("a keydown the page dispatches on the target still mirrors Shift", async () => {
    const { kb, input } = await nativeFKeys();
    physicalKey(input, "Shift", true);
    await settle();
    expect(hasClass(kb, "{shift}", DOM.classes.keyShiftActive)).to.equal(true);
  });
});

describe("kiosk-keyboard - auto-type on refocus", () => {
  it("re-detects from the authored inputmode after resetKeyboardType while open", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="b4-num" inputmode="numeric" />
        <kiosk-keyboard docked auto-show auto-type mobile-keyboard="Custom" layout="qwerty"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const input = box.querySelector<HTMLInputElement>("#b4-num")!;
    await renderFinished();
    input.focus();
    await settle();
    expect(kb.keyboardType, "precondition: detected on first focus").to.equal("Numpad");

    kb.resetKeyboardType();
    await settle();
    expect(kb.keyboardType, "precondition: reset to Full").to.equal("Full");
    kb.shadowRoot!.querySelector<HTMLElement>('[role="button"][tabindex="0"]')!.focus();
    input.focus();
    await settle();

    expect(kb.open, "precondition: still open").to.equal(true);
    expect(kb.keyboardType).to.equal("Numpad");
  });
});
