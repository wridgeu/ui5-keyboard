import FocusClaimService from "ui5/kiosk/internal/focus-claim-service";
import Control from "sap/ui/core/Control";
import type { $ControlSettings } from "sap/ui/core/Control";
import Input from "sap/m/Input";
import type RenderManager from "sap/ui/core/RenderManager";
import TextArea from "sap/m/TextArea";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

const fixture = document.getElementById("qunit-fixture")!;

// ─── Helpers ─────────────────────────────────────

// @ts-expect-error Control is abstract in @openui5/types but instantiable at runtime
const createControl = (id: string): Control => new Control(id);

/** Runtime interface for the dynamically generated property getters on TypedInput. */
interface TypedInputControl extends Control {
  getInputType(): string;
  getInputDisabled(): boolean;
  getInputReadOnly(): boolean;
}

/** What the generated constructor accepts: the base control's settings plus TypedInput's own properties. */
interface TypedInputSettings extends $ControlSettings {
  inputType?: string;
  inputDisabled?: boolean;
  inputReadOnly?: boolean;
}

/** Minimal UI5 Control wrapping a single <input> with configurable type/disabled/readOnly. */
const TypedInput = Control.extend("test.FcsTypedInput", {
  metadata: {
    properties: {
      inputType: { type: "string", defaultValue: "text" },
      inputDisabled: { type: "boolean", defaultValue: false },
      inputReadOnly: { type: "boolean", defaultValue: false },
    },
  },
  renderer: {
    apiVersion: 2,
    render(rm: RenderManager, ctrl: TypedInputControl) {
      rm.openStart("div", ctrl).openEnd();
      rm.voidStart("input")
        .attr("id", ctrl.getId() + "-inner")
        .attr("type", ctrl.getInputType());
      if (ctrl.getInputDisabled()) rm.attr("disabled", "disabled");
      if (ctrl.getInputReadOnly()) rm.attr("readonly", "readonly");
      rm.voidEnd();
      rm.close("div");
    },
  },
  getFocusDomRef(this: Control) {
    return document.getElementById(this.getId() + "-inner");
  },
}) as new (settings?: TypedInputSettings) => TypedInputControl;

function createService(
  overrides: {
    getControls?: () => string[];
    getResolvedControlIds?: () => ReadonlySet<string>;
    shouldDeferToNative?: () => boolean;
    isTargetOfOther?: (inputId: string) => boolean;
  } = {},
): FocusClaimService {
  return new FocusClaimService(
    overrides.getControls ?? (() => []),
    overrides.getResolvedControlIds ?? (() => new Set()),
    overrides.shouldDeferToNative ?? (() => false),
    overrides.isTargetOfOther ?? (() => false),
  );
}

// ──────────────────────────────────────────────────
// isTextualInput filtering (via resolveClaimableControl)
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service - isTextualInput filtering", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Rejects null target", (assert) => {
  const svc = createService();
  assert.strictEqual(svc.resolveClaimableControl(null), null, "null target rejected");
});

QUnit.test("Rejects non-input element", (assert) => {
  const div = document.createElement("div");
  fixture.appendChild(div);

  const svc = createService();
  assert.strictEqual(svc.resolveClaimableControl(div), null, "div element rejected");
});

QUnit.test("Rejects disabled input", async (assert) => {
  const ctrl = new TypedInput({ inputDisabled: true });
  ctrl.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService();
  assert.strictEqual(svc.resolveClaimableControl(ctrl.getFocusDomRef()), null, "Disabled input rejected");

  ctrl.destroy();
});

QUnit.test("Rejects readOnly input", async (assert) => {
  const ctrl = new TypedInput({ inputReadOnly: true });
  ctrl.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService();
  assert.strictEqual(svc.resolveClaimableControl(ctrl.getFocusDomRef()), null, "ReadOnly input rejected");

  ctrl.destroy();
});

QUnit.test("Rejects non-textual input types", async (assert) => {
  const nonTextualTypes = ["checkbox", "radio", "date", "range", "color", "file", "hidden"];
  const svc = createService();

  for (const type of nonTextualTypes) {
    const ctrl = new TypedInput({ inputType: type });
    ctrl.placeAt("qunit-fixture");
    await nextUIUpdate();

    assert.strictEqual(svc.resolveClaimableControl(ctrl.getFocusDomRef()), null, `type="${type}" rejected`);

    ctrl.destroy();
    await nextUIUpdate();
  }
});

QUnit.test("Accepts all textual input types", async (assert) => {
  const textualTypes = ["text", "search", "url", "tel", "email", "password", "number"];
  const svc = createService();

  for (const type of textualTypes) {
    const ctrl = new TypedInput({ inputType: type });
    ctrl.placeAt("qunit-fixture");
    await nextUIUpdate();

    const result = svc.resolveClaimableControl(ctrl.getFocusDomRef());
    assert.ok(result !== null, `type="${type}" accepted`);

    ctrl.destroy();
    await nextUIUpdate();
  }
});

QUnit.test("Accepts textarea", async (assert) => {
  const ta = new TextArea();
  ta.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService();
  assert.ok(svc.wouldClaimInput(ta.getFocusDomRef()), "Textarea accepted");

  ta.destroy();
});

// ──────────────────────────────────────────────────
// resolveClaimableControl
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service - resolveClaimableControl", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Returns null when shouldDeferToNative is true", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({ shouldDeferToNative: () => true });
  assert.strictEqual(svc.resolveClaimableControl(input.getFocusDomRef()), null, "Defers to native keyboard");

  input.destroy();
});

QUnit.test("Returns null for raw DOM input without UI5 control", (assert) => {
  const rawInput = document.createElement("input");
  rawInput.type = "text";
  fixture.appendChild(rawInput);

  const svc = createService();
  assert.strictEqual(svc.resolveClaimableControl(rawInput), null, "Raw DOM input rejected");
});

QUnit.test("Returns null when target is claimed by another keyboard", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({ isTargetOfOther: () => true });
  assert.strictEqual(svc.resolveClaimableControl(input.getFocusDomRef()), null, "Already-claimed input rejected");

  input.destroy();
});

QUnit.test("Passes control ID to isTargetOfOther callback", async (assert) => {
  const input = new Input("fcs-id-check");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  let receivedId = "";
  const svc = createService({
    isTargetOfOther: (id) => {
      receivedId = id;
      return false;
    },
  });

  svc.resolveClaimableControl(input.getFocusDomRef());
  assert.strictEqual(receivedId, "fcs-id-check", "Callback receives the UI5 control ID");

  input.destroy();
});

QUnit.test("Claims any textual input when controls is empty", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({ getControls: () => [] });
  const result = svc.resolveClaimableControl(input.getFocusDomRef());
  assert.ok(result instanceof Control, "Returns UI5 control in claim-all mode");

  input.destroy();
});

QUnit.test("Claims input whose ID is in controls", async (assert) => {
  const input = new Input("fcs-allowed");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({
    getControls: () => ["fcs-allowed"],
    getResolvedControlIds: () => new Set(["fcs-allowed"]),
  });

  const result = svc.resolveClaimableControl(input.getFocusDomRef());
  assert.ok(result instanceof Control, "Input in controls is claimed");

  input.destroy();
});

QUnit.test("Rejects input whose ID is not in controls", async (assert) => {
  const input = new Input("fcs-excluded");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({
    getControls: () => ["some-other-id"],
    getResolvedControlIds: () => new Set(["some-other-id"]),
  });

  assert.strictEqual(svc.resolveClaimableControl(input.getFocusDomRef()), null, "Input not in controls rejected");

  input.destroy();
});

// ──────────────────────────────────────────────────
// resolveControlsAncestor
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service - resolveControlsAncestor");

QUnit.test("Returns control when its own ID matches", (assert) => {
  const ctrl = createControl("fcs-self");

  const svc = createService({
    getResolvedControlIds: () => new Set(["fcs-self"]),
  });

  assert.strictEqual(svc.resolveControlsAncestor(ctrl), ctrl, "Direct ID match");

  ctrl.destroy();
});

QUnit.test("Traverses to parent when parent ID matches", (assert) => {
  const parent = createControl("fcs-parent");
  const child = createControl("fcs-child");
  parent.addDependent(child);

  const svc = createService({
    getResolvedControlIds: () => new Set(["fcs-parent"]),
  });

  assert.strictEqual(svc.resolveControlsAncestor(child), parent, "Parent match via traversal");

  parent.destroy();
});

QUnit.test("Traverses multiple ancestor levels", (assert) => {
  const grandparent = createControl("fcs-gp");
  const mid = createControl("fcs-mid");
  const child = createControl("fcs-leaf");
  grandparent.addDependent(mid);
  mid.addDependent(child);

  const svc = createService({
    getResolvedControlIds: () => new Set(["fcs-gp"]),
  });

  assert.strictEqual(svc.resolveControlsAncestor(child), grandparent, "Grandparent match");

  grandparent.destroy();
});

QUnit.test("Returns closest matching ancestor when multiple ancestors match", (assert) => {
  const grandparent = createControl("fcs-outer");
  const parent = createControl("fcs-inner");
  const child = createControl("fcs-deep");
  grandparent.addDependent(parent);
  parent.addDependent(child);

  const svc = createService({
    getResolvedControlIds: () => new Set(["fcs-outer", "fcs-inner"]),
  });

  assert.strictEqual(svc.resolveControlsAncestor(child), parent, "Returns nearest matching ancestor");

  grandparent.destroy();
});

QUnit.test("Returns null when no ancestor matches", (assert) => {
  const parent = createControl("fcs-nomatch-p");
  const child = createControl("fcs-nomatch-c");
  parent.addDependent(child);

  const svc = createService({
    getResolvedControlIds: () => new Set(["unrelated-id"]),
  });

  assert.strictEqual(svc.resolveControlsAncestor(child), null, "No matching ancestor");

  parent.destroy();
});

QUnit.test("Returns null when resolved set is empty", (assert) => {
  const ctrl = createControl("fcs-empty-set");

  const svc = createService({
    getResolvedControlIds: () => new Set(),
  });

  assert.strictEqual(svc.resolveControlsAncestor(ctrl), null, "Empty resolved set returns null");

  ctrl.destroy();
});

// ──────────────────────────────────────────────────
// isInControls
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service - isInControls");

QUnit.test("Returns true when ancestor is in resolved set", (assert) => {
  const ctrl = createControl("fcs-in");

  const svc = createService({
    getResolvedControlIds: () => new Set(["fcs-in"]),
  });

  assert.ok(svc.isInControls(ctrl), "Control found in controls");

  ctrl.destroy();
});

QUnit.test("Returns false when no ancestor matches", (assert) => {
  const ctrl = createControl("fcs-out");

  const svc = createService({
    getResolvedControlIds: () => new Set(["other"]),
  });

  assert.notOk(svc.isInControls(ctrl), "Control not in controls");

  ctrl.destroy();
});
