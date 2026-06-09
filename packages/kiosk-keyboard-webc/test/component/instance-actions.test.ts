import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { defineActions } from "../../src/types.js";
import type { ActionContext, ActionDefinition, LayoutDefinition } from "../../src/types.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function queryKey(el: KioskKeyboard, value: string): HTMLElement {
  const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue(value));
  if (!key) throw new Error(`Key "${value}" not found`);
  return key;
}

async function setup(
  layout: LayoutDefinition,
  actions?: Record<string, ActionDefinition>,
): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
  const container = await fixture(html`
    <div>
      <input id="ia-target" type="text" />
      <kiosk-keyboard layout="spike"></kiosk-keyboard>
    </div>
  `);
  const input = container.querySelector<HTMLInputElement>("#ia-target")!;
  const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
  kb.instanceLayouts = { spike: layout };
  kb.instanceActions = actions ?? null;
  kb.setTargetElement(input);
  await nextRender();
  return { kb, input };
}

describe("kiosk-keyboard - registered actions", () => {
  it("runs a registered action on click and inserts via the context", async () => {
    const { kb, input } = await setup([[{ value: "{action:paste}", label: "P" }]], {
      paste: { handler: (ctx) => ctx.insertText("hello") },
    });
    queryKey(kb, "{action:paste}").click();
    expect(input.value).to.equal("hello");
  });

  it("passes the param after the second colon (colons preserved)", async () => {
    let seen: string | undefined;
    const { kb, input } = await setup([[{ value: "{action:ins:a:b}", label: "I" }]], {
      ins: {
        handler: (ctx, param) => {
          seen = param;
          ctx.insertText(param ?? "");
        },
      },
    });
    queryKey(kb, "{action:ins:a:b}").click();
    expect(seen).to.equal("a:b");
    expect(input.value).to.equal("a:b");
  });

  it("fires key-press and preventDefault skips the handler", async () => {
    let ran = false;
    const { kb, input } = await setup([[{ value: "{action:paste}", label: "P" }]], {
      paste: { handler: () => (ran = true) },
    });
    let pressedKey = "";
    kb.addEventListener("key-press", (e) => {
      pressedKey = (e as CustomEvent<{ key: string }>).detail.key;
      e.preventDefault();
    });
    queryKey(kb, "{action:paste}").click();
    expect(pressedKey).to.equal("{action:paste}");
    expect(ran).to.equal(false);
    expect(input.value).to.equal("");
  });

  it("contains a throwing handler and keeps working", async () => {
    const orig = console.error;
    let logged = false;
    console.error = () => (logged = true);
    try {
      const { kb, input } = await setup([[{ value: "{action:boom}", label: "B" }, { value: "x" }]], {
        boom: {
          handler: () => {
            throw new Error("kaboom");
          },
        },
      });
      queryKey(kb, "{action:boom}").click();
      expect(logged).to.equal(true);
      expect(input.value).to.equal("");
      queryKey(kb, "x").click();
      expect(input.value).to.equal("x");
    } finally {
      console.error = orig;
    }
  });

  it("ignores an unregistered action (no-op + warning), never typing literal text", async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (msg?: unknown) => warnings.push(String(msg));
    try {
      const { kb, input } = await setup([[{ value: "{action:missing}", label: "M" }]]);
      queryKey(kb, "{action:missing}").click();
      expect(input.value).to.equal("");
      expect(warnings.some((w) => w.includes("missing"))).to.equal(true);
    } finally {
      console.warn = orig;
    }
  });

  it("switchLayout from the context switches layout and fires layout-change", async () => {
    const { kb } = await setup([[{ value: "{action:go}", label: "G" }]], {
      go: { handler: (ctx: ActionContext) => ctx.switchLayout("numeric") },
    });
    let changedTo = "";
    kb.addEventListener("layout-change", (e) => {
      changedTo = (e as CustomEvent<{ layout: string }>).detail.layout;
    });
    queryKey(kb, "{action:go}").click();
    await nextRender();
    expect(changedTo).to.equal("numeric");
  });

  it("gives an icon-only action key an accessible name (ariaLabel, else bare name)", async () => {
    const withAria = await setup([[{ value: "{action:paste}", label: "", icon: "sap-icon://paste" }]], {
      paste: { handler: () => {}, ariaLabel: "Paste from clipboard" },
    });
    expect(queryKey(withAria.kb, "{action:paste}").getAttribute("aria-label")).to.equal("Paste from clipboard");

    const noAria = await setup([[{ value: "{action:copy}", label: "", icon: "sap-icon://copy" }]], {
      copy: { handler: () => {} },
    });
    const aria = queryKey(noAria.kb, "{action:copy}").getAttribute("aria-label");
    expect(aria).to.equal("copy");
    expect(aria).to.not.equal("{action:copy}");
  });

  it("scopes actions per element via defineActions, never leaking to a sibling", async () => {
    const withAction = await setup([[{ value: "{action:paste}", label: "P" }]], {
      paste: { handler: (ctx) => ctx.insertText("A") },
    });
    const orig = console.warn;
    console.warn = () => {};
    try {
      const without = await setup([[{ value: "{action:paste}", label: "P" }]]);
      queryKey(withAction.kb, "{action:paste}").click();
      expect(withAction.input.value).to.equal("A");
      queryKey(without.kb, "{action:paste}").click();
      expect(without.input.value).to.equal("");
    } finally {
      console.warn = orig;
    }

    // defineActions is an identity helper that only constrains the type.
    const typed = defineActions({ x: { handler: () => {} } });
    expect(typeof typed.x.handler).to.equal("function");
  });
});
