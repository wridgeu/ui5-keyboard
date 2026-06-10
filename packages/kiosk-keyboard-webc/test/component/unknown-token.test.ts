import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function queryKey(el: KioskKeyboard, value: string): HTMLElement {
  const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue(value));
  if (!key) throw new Error(`Key "${value}" not found`);
  return key;
}

async function setup(layout: LayoutDefinition): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
  const container = await fixture(html`
    <div>
      <input id="ut-target" type="text" />
      <kiosk-keyboard layout="spike"></kiosk-keyboard>
    </div>
  `);
  const input = container.querySelector<HTMLInputElement>("#ut-target")!;
  const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
  kb.instanceLayouts = { spike: layout };
  kb.setTargetElement(input);
  await nextRender();
  return { kb, input };
}

describe("kiosk-keyboard - unrecognized {token} keys", () => {
  it("does not type the literal braces for an unknown token", async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (msg?: unknown) => warnings.push(String(msg));
    try {
      // `{bcksp}` is a typo for `{backspace}`: previously typed "{bcksp}".
      const { kb, input } = await setup([[{ value: "{bcksp}", label: "x" }]]);
      queryKey(kb, "{bcksp}").click();
      expect(input.value).to.equal("");
      expect(warnings.some((w) => w.includes("{bcksp}"))).to.equal(true);
    } finally {
      console.warn = orig;
    }
  });

  it("inserts nothing and does not warn when a consumer prevents key-press", async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (msg?: unknown) => warnings.push(String(msg));
    try {
      // A consumer that handles a custom token via key-press + preventDefault
      // owns the behavior, so the keyboard must stay silent (no warning).
      const { kb, input } = await setup([[{ value: "{paste}", label: "p" }]]);
      kb.addEventListener("key-press", (e: Event) => e.preventDefault(), { once: true });
      queryKey(kb, "{paste}").click();
      expect(input.value).to.equal("");
      expect(warnings.some((w) => w.includes("{paste}"))).to.equal(false);
    } finally {
      console.warn = orig;
    }
  });

  it("still inserts a lone brace character", async () => {
    const { kb, input } = await setup([[{ value: "{" }, { value: "}" }]]);
    queryKey(kb, "{").click();
    queryKey(kb, "}").click();
    expect(input.value).to.equal("{}");
  });

  it("leaves regular character keys unaffected", async () => {
    const { kb, input } = await setup([[{ value: "a" }, { value: "b" }]]);
    queryKey(kb, "a").click();
    queryKey(kb, "b").click();
    expect(input.value).to.equal("ab");
  });
});
