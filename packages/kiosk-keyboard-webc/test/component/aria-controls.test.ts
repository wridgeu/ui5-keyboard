import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";

const nextRender = renderFinished;

/**
 * The host carries `aria-controls` pointing at the element it types into,
 * matching the UI5 twin, which names the target control's id. The attribute
 * lives on the host rather than on the shadow root's `.kiosk-keyboard` div
 * because IDREFs do not resolve across a shadow boundary.
 */
describe("kiosk-keyboard - aria-controls on the host", () => {
  async function setup(): Promise<{
    kb: KioskKeyboard;
    a: HTMLInputElement;
    b: HTMLInputElement;
    noId: HTMLInputElement;
  }> {
    const container = await fixture(html`
      <div>
        <input id="ac-a" type="text" />
        <input id="ac-b" type="text" />
        <input type="text" class="ac-noid" />
        <kiosk-keyboard layout="qwerty" controls="ac-a"></kiosk-keyboard>
      </div>
    `);
    await nextRender();
    return {
      kb: container.querySelector<KioskKeyboard>("kiosk-keyboard")!,
      a: container.querySelector<HTMLInputElement>("#ac-a")!,
      b: container.querySelector<HTMLInputElement>("#ac-b")!,
      noId: container.querySelector<HTMLInputElement>(".ac-noid")!,
    };
  }

  it("names the focused target on the auto-show path", async () => {
    const container = await fixture(html`
      <div>
        <input id="ac-auto" type="text" />
        <kiosk-keyboard layout="qwerty" docked auto-show></kiosk-keyboard>
      </div>
    `);
    const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const input = container.querySelector<HTMLInputElement>("#ac-auto")!;
    await nextRender();

    input.focus();
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await nextRender();

    expect(kb.getAttribute("aria-controls")).to.equal("ac-auto");
  });

  it("follows a programmatic target switch", async () => {
    const { kb, a, b } = await setup();
    kb.setTargetElement(a);
    await nextRender();
    expect(kb.getAttribute("aria-controls")).to.equal("ac-a");

    kb.setTargetElement(b);
    await nextRender();
    expect(kb.getAttribute("aria-controls")).to.equal("ac-b");
  });

  it("drops the attribute when the target is cleared", async () => {
    const { kb, a } = await setup();
    kb.setTargetElement(a);
    await nextRender();

    kb.setTargetElement(null);
    await nextRender();
    expect(kb.hasAttribute("aria-controls"), "absent, not an empty string").to.be.false;
  });

  it("emits no attribute for a target carrying no id", async () => {
    const { kb, noId } = await setup();
    kb.setTargetElement(noId);
    await nextRender();

    expect(kb.hasAttribute("aria-controls")).to.be.false;
  });

  it("names the light-DOM component when the target is inside its shadow root", async () => {
    const container = await fixture(html`
      <div>
        <ac-wrapper id="ac-wrapped"></ac-wrapper>
        <kiosk-keyboard layout="qwerty" controls="ac-wrapped"></kiosk-keyboard>
      </div>
    `);
    await nextRender();
    const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const wrapper = container.querySelector("#ac-wrapped")!;
    const inner = wrapper.shadowRoot!.querySelector("input")!;

    kb.setTargetElement(inner);
    await nextRender();

    // The inner input's own id ("inner") is unreachable from the host's tree.
    expect(kb.getAttribute("aria-controls")).to.equal("ac-wrapped");
  });
});

/** A minimal component whose native input lives in its shadow root. */
class AcWrapper extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = '<input id="inner" type="text" />';
  }
}
customElements.define("ac-wrapper", AcWrapper);
