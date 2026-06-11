import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import { defineActions } from "../../src/types.js";
import { parseActionToken } from "../../src/core/action-registry.js";
import type { ActionContext } from "../../src/types.js";
import { requireKey as queryKey, setupWithLayout as setup } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

const nextRender = renderFinished;

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
    const { kb, input } = await setup([[{ value: "{action:boom}", label: "B" }, { value: "x" }]], {
      boom: {
        handler: () => {
          throw new Error("kaboom");
        },
      },
    });
    const errors = await captureConsole("error", () => {
      queryKey(kb, "{action:boom}").click();
    });
    expect(errors.length > 0).to.equal(true);
    expect(input.value).to.equal("");
    queryKey(kb, "x").click();
    expect(input.value).to.equal("x");
  });

  it("ignores an unregistered action (no-op + warning), never typing literal text", async () => {
    const { kb, input } = await setup([[{ value: "{action:missing}", label: "M" }]]);
    const warnings = await captureConsole("warn", () => {
      queryKey(kb, "{action:missing}").click();
    });
    expect(input.value).to.equal("");
    expect(warnings.some((w) => w.includes("missing"))).to.equal(true);
  });

  it("fires a cancelable key-press for an unregistered action; veto suppresses the warning", async () => {
    const { kb, input } = await setup([[{ value: "{action:missing}", label: "M" }]]);
    let pressedKey = "";
    kb.addEventListener(
      "key-press",
      (e) => {
        pressedKey = (e as CustomEvent<{ key: string }>).detail.key;
        e.preventDefault();
      },
      { once: true },
    );
    // Mirrors {layout:*}: the cancelable key-press fires BEFORE validation,
    // and a veto means the consumer owns the key - no warning, no handler.
    const vetoed = await captureConsole("warn", () => {
      queryKey(kb, "{action:missing}").click();
    });
    expect(pressedKey).to.equal("{action:missing}");
    expect(
      vetoed.some((w) => w.includes("missing")),
      "veto suppresses the unregistered warning",
    ).to.equal(false);
    expect(input.value).to.equal("");

    // Without a veto, the same key warns and no-ops.
    const unvetoed = await captureConsole("warn", () => {
      queryKey(kb, "{action:missing}").click();
    });
    expect(unvetoed.some((w) => w.includes("missing"))).to.equal(true);
    expect(input.value).to.equal("");
  });

  it("warns on an empty action name ({action:})", async () => {
    const { kb, input } = await setup([[{ value: "{action:}", label: "E" }]]);
    const warnings = await captureConsole("warn", () => {
      queryKey(kb, "{action:}").click();
    });
    expect(
      warnings.some((w) => w.includes("{action:}")),
      "empty action name logs a warning",
    ).to.equal(true);
    expect(input.value).to.equal("");
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
    const without = await setup([[{ value: "{action:paste}", label: "P" }]]);
    queryKey(withAction.kb, "{action:paste}").click();
    expect(withAction.input.value).to.equal("A");
    // The sibling has no registration: expected unregistered warning is silenced.
    await captureConsole("warn", () => {
      queryKey(without.kb, "{action:paste}").click();
    });
    expect(without.input.value).to.equal("");

    // defineActions is an identity helper that only constrains the type.
    const typed = defineActions({ x: { handler: () => {} } });
    expect(typeof typed.x.handler).to.equal("function");
  });
});

describe("parseActionToken", () => {
  it("splits name and param at the first colon after the name", () => {
    expect(parseActionToken("{action:paste}")).to.deep.equal({ name: "paste", param: undefined });
    expect(parseActionToken("{action:ins:x}")).to.deep.equal({ name: "ins", param: "x" });
  });

  it("preserves colons inside the param", () => {
    expect(parseActionToken("{action:ins:a:b:c}")).to.deep.equal({ name: "ins", param: "a:b:c" });
  });

  it("trims the name and yields an empty param for a trailing colon", () => {
    expect(parseActionToken("{action: paste }")).to.deep.equal({ name: "paste", param: undefined });
    expect(parseActionToken("{action:ins:}")).to.deep.equal({ name: "ins", param: "" });
  });

  it("yields an empty name for {action:} and for a param-only token", () => {
    expect(parseActionToken("{action:}")).to.deep.equal({ name: "", param: undefined });
    expect(parseActionToken("{action::x}")).to.deep.equal({ name: "", param: "x" });
  });

  it("returns null when the value is not a complete action token", () => {
    // A complete token needs both the "{action:" prefix and a closing brace;
    // anything else (missing brace, wrong prefix) is rejected rather than
    // silently truncating the final character.
    expect(parseActionToken("{action:go")).to.equal(null);
    expect(parseActionToken("{action:x")).to.equal(null);
    expect(parseActionToken("paste")).to.equal(null);
  });
});
