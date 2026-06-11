import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import Log from "sap/base/Log";
import type { LayoutDefinition, ActionContext, ActionDefinition } from "ui5/kiosk/types";
import { defineActions } from "ui5/kiosk/types";
import { placeAndWait, tapKey, getRequiredKeyElement, waitForRender } from "./test-helpers";

// ── Helpers ──

const sandbox = sinon.createSandbox();

function commonAfterEach(): void {
  sandbox.restore();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

/** Build a one-row layout from the given key values. */
function layoutOf(...values: string[]): LayoutDefinition {
  return [values.map((value) => ({ value, label: value }))];
}

/**
 * Wire up an Input + focused KioskKeyboard rendering the supplied layout
 * under the name "spike". Returns both so the test can tap keys and read the
 * input value. The keyboard targets the input via `controls` + focus.
 */
async function setup(
  layout: LayoutDefinition,
  instanceActions?: Record<string, ActionDefinition>,
): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { spike: layout },
    instanceActions,
    layout: "spike",
  });
  await placeAndWait(kb);
  input.focus();
  return { kb, input };
}

// ───────────────────────────────────────────────────
// Registered actions: dispatch, context, params
// ───────────────────────────────────────────────────

QUnit.module("instance-actions - dispatch", { afterEach: commonAfterEach });

QUnit.test("Registered action runs on tap and inserts via the context", async (assert) => {
  const { kb, input } = await setup(layoutOf("{action:paste}"), {
    paste: { handler: (ctx) => ctx.insertText("hello") },
  });

  tapKey(kb, "{action:paste}");
  assert.strictEqual(input.getValue(), "hello", "Action handler inserted text through ActionContext");

  input.destroy();
  kb.destroy();
});

QUnit.test("Action handler receives the param after the second colon", async (assert) => {
  let seen: string | undefined = "untouched";
  const { kb, input } = await setup(layoutOf("{action:ins:euro:sign}"), {
    ins: {
      handler: (ctx, param) => {
        seen = param;
        ctx.insertText(param ?? "");
      },
    },
  });

  tapKey(kb, "{action:ins:euro:sign}");
  assert.strictEqual(seen, "euro:sign", "Everything after the first name colon is the param (colons preserved)");
  assert.strictEqual(input.getValue(), "euro:sign", "Param inserted");

  input.destroy();
  kb.destroy();
});

QUnit.test("ActionContext exposes shift state and the resolved target element", async (assert) => {
  const seen: { shifted?: boolean; caps?: boolean; hasTarget?: boolean } = {};
  const { kb, input } = await setup(layoutOf("{shift}", "{action:probe}"), {
    probe: {
      handler: (ctx: ActionContext) => {
        seen.shifted = ctx.isShifted;
        seen.caps = ctx.isCapsLock;
        seen.hasTarget = ctx.targetElement instanceof HTMLInputElement;
        ctx.insertText(ctx.isShifted ? "U" : "l");
      },
    },
  });

  tapKey(kb, "{shift}");
  tapKey(kb, "{action:probe}");
  assert.ok(seen.shifted, "isShifted reflects the active one-shot shift");
  assert.notOk(seen.caps, "isCapsLock false for a single shift tap");
  assert.ok(seen.hasTarget, "targetElement resolves to the native input");
  assert.strictEqual(input.getValue(), "U", "Handler branched on shift state");

  input.destroy();
  kb.destroy();
});

QUnit.test("ActionContext.switchLayout switches layout and fires layoutChange", async (assert) => {
  const { kb, input } = await setup(layoutOf("{action:goNumeric}"), {
    gonumeric: { handler: (ctx) => ctx.switchLayout("numeric") },
  });
  const layoutChange = sandbox.spy();
  kb.attachLayoutChange(layoutChange);

  tapKey(kb, "{action:goNumeric}");
  assert.strictEqual(kb.getLayout(), "numeric", "Action switched the active layout");
  assert.ok(layoutChange.calledOnce, "layoutChange fired exactly once");
  assert.strictEqual(layoutChange.firstCall.args[0].getParameter("layout"), "numeric", "Event carries the new layout");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// keyPress integration + robustness
// ───────────────────────────────────────────────────

QUnit.module("instance-actions - keyPress & robustness", { afterEach: commonAfterEach });

QUnit.test("keyPress fires for an action key and preventDefault skips the handler", async (assert) => {
  let handlerRan = false;
  const { kb, input } = await setup(layoutOf("{action:paste}"), {
    paste: { handler: () => (handlerRan = true) },
  });

  let pressedKey = "";
  kb.attachKeyPress((e) => {
    pressedKey = e.getParameter("key") ?? "";
    e.preventDefault();
  });

  tapKey(kb, "{action:paste}");
  assert.strictEqual(pressedKey, "{action:paste}", "keyPress fired with the full action token as key");
  assert.notOk(handlerRan, "preventDefault skipped the action handler");
  assert.strictEqual(input.getValue(), "", "Nothing inserted when vetoed");

  input.destroy();
  kb.destroy();
});

QUnit.test("Unregistered {action:*} fires a cancelable keyPress; veto suppresses the warning", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf("{action:missing}"));

  let pressedKey: string | null = null;
  kb.attachKeyPress((e) => {
    pressedKey = e.getParameter("key") ?? "";
    e.preventDefault();
  });

  // Mirrors {fkey:*} and the unrecognized-token path: the cancelable keyPress
  // fires BEFORE validation, so a consumer can observe or veto any {action:*}
  // press; a veto suppresses the unregistered-action warning.
  tapKey(kb, "{action:missing}");
  assert.strictEqual(pressedKey, "{action:missing}", "keyPress fired for the unregistered action token");
  assert.notOk(warnSpy.called, "veto suppresses the unregistered-action warning");
  assert.strictEqual(input.getValue(), "", "Nothing inserted for an unregistered action");

  input.destroy();
  kb.destroy();
});

QUnit.test("Empty action name ({action:}) is warned and ignored", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf("{action:}"));

  tapKey(kb, "{action:}");
  assert.ok(
    warnSpy.getCalls().some((c) => String(c.args[0]).includes("{action:}")),
    "Empty action name logs a warning",
  );
  assert.strictEqual(input.getValue(), "", "Empty action name inserts nothing");

  input.destroy();
  kb.destroy();
});

QUnit.test("A throwing handler is contained and logged; the keyboard keeps working", async (assert) => {
  const errorSpy = sandbox.spy(Log, "error");
  const { kb, input } = await setup(layoutOf("{action:boom}", "x"), {
    boom: {
      handler: () => {
        throw new Error("kaboom");
      },
    },
  });

  tapKey(kb, "{action:boom}");
  assert.ok(errorSpy.called, "Handler exception was logged");
  assert.strictEqual(input.getValue(), "", "Throwing handler left the input untouched");

  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "x", "Subsequent normal key still types after a thrown handler");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Unregistered / unknown tokens: no literal insertion (tier-1 hardening)
// ───────────────────────────────────────────────────

QUnit.module("instance-actions - unknown tokens", { afterEach: commonAfterEach });

QUnit.test("Unregistered {action:*} is a no-op and warns (no literal text)", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf("{action:missing}"));

  tapKey(kb, "{action:missing}");
  assert.strictEqual(input.getValue(), "", "Unregistered action inserts nothing");
  assert.ok(warnSpy.called, "Unregistered action logged a warning");

  input.destroy();
  kb.destroy();
});

// (Generic unrecognized-`{token}` no-op behavior is covered by the dedicated
// unknown-token.qunit.ts; here we only assert the action-specific case above.)

// ───────────────────────────────────────────────────
// Per-instance scoping
// ───────────────────────────────────────────────────

QUnit.module("instance-actions - scoping", { afterEach: commonAfterEach });

QUnit.test("Actions are scoped per instance and never leak to a sibling", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");

  const withAction = await setup(layoutOf("{action:paste}"), {
    paste: { handler: (ctx) => ctx.insertText("A") },
  });
  const without = await setup(layoutOf("{action:paste}"));

  tapKey(withAction.kb, "{action:paste}");
  assert.strictEqual(withAction.input.getValue(), "A", "Instance with the action runs it");

  tapKey(without.kb, "{action:paste}");
  assert.strictEqual(without.input.getValue(), "", "Sibling without the action does nothing");
  assert.ok(warnSpy.called, "Sibling logs an unregistered-action warning");

  withAction.input.destroy();
  withAction.kb.destroy();
  without.input.destroy();
  without.kb.destroy();
});

QUnit.test("setInstanceActions after construction registers the action for the next tap", async (assert) => {
  const { kb, input } = await setup(layoutOf("{action:paste}"));

  tapKey(kb, "{action:paste}");
  assert.strictEqual(input.getValue(), "", "No action before it is set");

  // NOTE (spike finding): the generated setter param is `object | null`
  // (UI5 `type: "object"` erases the rich type), so an inline handler does
  // not get contextual typing here - `ctx` must be annotated. Same limitation
  // as the existing `setInstanceMiddleware`.
  kb.setInstanceActions({ paste: { handler: (ctx: ActionContext) => ctx.insertText("Z") } });
  tapKey(kb, "{action:paste}");
  assert.strictEqual(input.getValue(), "Z", "Action runs after setInstanceActions");

  kb.setInstanceActions(null);
  tapKey(kb, "{action:paste}");
  assert.strictEqual(input.getValue(), "Z", "Cleared action no longer runs (value unchanged)");

  input.destroy();
  kb.destroy();
});

QUnit.test("Invalid instanceActions entries are filtered out with a warning", async (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  const { kb, input } = await setup(layoutOf("{action:bad}"), {
    // handler missing - must be dropped, leaving the action unregistered
    bad: {} as unknown as ActionDefinition,
  });

  tapKey(kb, "{action:bad}");
  assert.strictEqual(input.getValue(), "", "Entry without a handler is not invoked");
  assert.ok(warnSpy.called, "Invalid entry logged a warning");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Accessibility: icon-only action keys get a sane accessible name
// ───────────────────────────────────────────────────

QUnit.module("instance-actions - accessibility", { afterEach: commonAfterEach });

/** Render an icon-only `{action:*}` key (label suppressed) and return its aria-label. */
async function ariaLabelOf(value: string, actions?: Record<string, ActionDefinition>): Promise<string | null> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { spike: [[{ value, label: "", icon: "sap-icon://paste" }]] },
    instanceActions: actions,
    layout: "spike",
  });
  await placeAndWait(kb);
  const aria = getRequiredKeyElement(kb, value).getAttribute("aria-label");
  input.destroy();
  kb.destroy();
  return aria;
}

QUnit.test("Icon-only action key uses the action's ariaLabel as accessible name", async (assert) => {
  const aria = await ariaLabelOf(
    "{action:paste}",
    defineActions({ paste: { handler: () => {}, ariaLabel: "Paste from clipboard" } }),
  );
  assert.strictEqual(aria, "Paste from clipboard", "aria-label comes from ActionDefinition.ariaLabel");
});

QUnit.test(
  "Icon-only action key without ariaLabel falls back to the bare name, never the raw token",
  async (assert) => {
    const aria = await ariaLabelOf("{action:paste}", defineActions({ paste: { handler: () => {} } }));
    assert.strictEqual(aria, "paste", "Falls back to the action name");
    assert.notStrictEqual(aria, "{action:paste}", "Accessible name is never the raw {action:*} token");
  },
);

QUnit.test("setInstanceActions re-renders so an updated ariaLabel reaches the DOM", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { spike: [[{ value: "{action:paste}", label: "", icon: "sap-icon://paste" }]] },
    instanceActions: defineActions({ paste: { handler: () => {}, ariaLabel: "Old label" } }),
    layout: "spike",
  });
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "{action:paste}").getAttribute("aria-label"),
    "Old label",
    "Initial ariaLabel rendered",
  );

  kb.setInstanceActions({ paste: { handler: () => {}, ariaLabel: "New label" } });
  await waitForRender();

  assert.strictEqual(
    getRequiredKeyElement(kb, "{action:paste}").getAttribute("aria-label"),
    "New label",
    "Updated ariaLabel reaches the rendered DOM after setInstanceActions",
  );

  input.destroy();
  kb.destroy();
});
