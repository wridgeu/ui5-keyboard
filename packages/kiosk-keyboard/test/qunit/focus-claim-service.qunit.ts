import FocusClaimService from "ui5/kiosk/internal/focus-claim-service";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

const fixture = document.getElementById("qunit-fixture")!;

// ─── Helpers ─────────────────────────────────────

/** Minimal UI5 Control wrapping a single <input> with configurable type/disabled/readOnly. */
const TypedInput = (Control as any).extend("test.FcsTypedInput", {
  metadata: {
    properties: {
      inputType: { type: "string", defaultValue: "text" },
      inputDisabled: { type: "boolean", defaultValue: false },
      inputReadOnly: { type: "boolean", defaultValue: false },
    },
  },
  renderer: {
    apiVersion: 2,
    render(rm: any, ctrl: any) {
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
  getFocusDomRef() {
    return document.getElementById((this as any).getId() + "-inner");
  },
}) as any;

function createService(
  overrides: {
    getInputIds?: () => string[];
    getResolvedInputControlIds?: () => ReadonlySet<string>;
    shouldDeferToNative?: () => boolean;
    isTargetOfOther?: (inputId: string) => boolean;
  } = {},
): FocusClaimService {
  return new FocusClaimService(
    overrides.getInputIds ?? (() => []),
    overrides.getResolvedInputControlIds ?? (() => new Set()),
    overrides.shouldDeferToNative ?? (() => false),
    overrides.isTargetOfOther ?? (() => false),
  );
}

// ──────────────────────────────────────────────────
// isTextualInput filtering (via resolveClaimableControl)
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service — isTextualInput filtering", {
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

QUnit.module("focus-claim-service — resolveClaimableControl", {
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

QUnit.test("Claims any textual input when inputIds is empty", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({ getInputIds: () => [] });
  const result = svc.resolveClaimableControl(input.getFocusDomRef());
  assert.ok(result instanceof Control, "Returns UI5 control in claim-all mode");

  input.destroy();
});

QUnit.test("Claims input whose ID is in inputIds", async (assert) => {
  const input = new Input("fcs-allowed");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({
    getInputIds: () => ["fcs-allowed"],
    getResolvedInputControlIds: () => new Set(["fcs-allowed"]),
  });

  const result = svc.resolveClaimableControl(input.getFocusDomRef());
  assert.ok(result instanceof Control, "Input in inputIds is claimed");

  input.destroy();
});

QUnit.test("Rejects input whose ID is not in inputIds", async (assert) => {
  const input = new Input("fcs-excluded");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const svc = createService({
    getInputIds: () => ["some-other-id"],
    getResolvedInputControlIds: () => new Set(["some-other-id"]),
  });

  assert.strictEqual(svc.resolveClaimableControl(input.getFocusDomRef()), null, "Input not in inputIds rejected");

  input.destroy();
});

// ──────────────────────────────────────────────────
// resolveInputIdsAncestor
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service — resolveInputIdsAncestor");

QUnit.test("Returns control when its own ID matches", (assert) => {
  const ctrl = new Control("fcs-self");

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["fcs-self"]),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(ctrl), ctrl, "Direct ID match");

  ctrl.destroy();
});

QUnit.test("Traverses to parent when parent ID matches", (assert) => {
  const parent = new Control("fcs-parent");
  const child = new Control("fcs-child");
  parent.addDependent(child);

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["fcs-parent"]),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(child), parent, "Parent match via traversal");

  parent.destroy();
});

QUnit.test("Traverses multiple ancestor levels", (assert) => {
  const grandparent = new Control("fcs-gp");
  const mid = new Control("fcs-mid");
  const child = new Control("fcs-leaf");
  grandparent.addDependent(mid);
  mid.addDependent(child);

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["fcs-gp"]),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(child), grandparent, "Grandparent match");

  grandparent.destroy();
});

QUnit.test("Returns closest matching ancestor when multiple ancestors match", (assert) => {
  const grandparent = new Control("fcs-outer");
  const parent = new Control("fcs-inner");
  const child = new Control("fcs-deep");
  grandparent.addDependent(parent);
  parent.addDependent(child);

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["fcs-outer", "fcs-inner"]),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(child), parent, "Returns nearest matching ancestor");

  grandparent.destroy();
});

QUnit.test("Returns null when no ancestor matches", (assert) => {
  const parent = new Control("fcs-nomatch-p");
  const child = new Control("fcs-nomatch-c");
  parent.addDependent(child);

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["unrelated-id"]),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(child), null, "No matching ancestor");

  parent.destroy();
});

QUnit.test("Returns null when resolved set is empty", (assert) => {
  const ctrl = new Control("fcs-empty-set");

  const svc = createService({
    getResolvedInputControlIds: () => new Set(),
  });

  assert.strictEqual(svc.resolveInputIdsAncestor(ctrl), null, "Empty resolved set returns null");

  ctrl.destroy();
});

// ──────────────────────────────────────────────────
// isInInputIds
// ──────────────────────────────────────────────────

QUnit.module("focus-claim-service — isInInputIds");

QUnit.test("Returns true when ancestor is in resolved set", (assert) => {
  const ctrl = new Control("fcs-in");

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["fcs-in"]),
  });

  assert.ok(svc.isInInputIds(ctrl), "Control found in inputIds");

  ctrl.destroy();
});

QUnit.test("Returns false when no ancestor matches", (assert) => {
  const ctrl = new Control("fcs-out");

  const svc = createService({
    getResolvedInputControlIds: () => new Set(["other"]),
  });

  assert.notOk(svc.isInInputIds(ctrl), "Control not in inputIds");

  ctrl.destroy();
});
