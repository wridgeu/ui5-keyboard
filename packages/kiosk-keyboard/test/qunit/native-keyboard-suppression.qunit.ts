import NativeKeyboardSuppression from "ui5/kiosk/internal/native-keyboard-suppression";
import Element from "sap/ui/core/Element";
import { MobileKeyboard } from "ui5/kiosk/library";

const fixture = document.getElementById("qunit-fixture")!;

/**
 * Creates a mock host that satisfies NativeKeyboardSuppressionHost.
 * `mobileKeyboard` defaults to Custom (suppression active).
 */
function makeHost(activeTargetId: string, mobileKeyboard = MobileKeyboard.Custom) {
  return {
    getMobileKeyboard: () => mobileKeyboard,
    _getActiveTargetId: () => activeTargetId,
    _getEffectiveResolver: () => null,
  };
}

/**
 * Places a real <input> in the fixture and returns the inputId
 * and native element.
 */
function registerInputElement(id: string) {
  const input = document.createElement("input");
  input.id = `${id}-inner`;
  input.type = "text";
  fixture.appendChild(input);
  return { inputId: id, input };
}

// ═══════════════════════════════════════════════════
// Basic suppress / restore
// ═══════════════════════════════════════════════════

QUnit.module("NativeKeyboardSuppression - basic");

QUnit.test("suppress sets inputmode=none, restore removes it", (assert) => {
  const { inputId, input } = registerInputElement("input1");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const host = makeHost(inputId);
    const suppression = new NativeKeyboardSuppression(host);

    suppression.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "inputmode set to none");

    suppression.restore();
    assert.strictEqual(input.getAttribute("inputmode"), null, "inputmode removed after restore");

    suppression.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("suppress preserves original inputmode and restores it", (assert) => {
  const { inputId, input } = registerInputElement("input2");
  input.setAttribute("inputmode", "numeric");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const host = makeHost(inputId);
    const suppression = new NativeKeyboardSuppression(host);

    suppression.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "inputmode overridden to none");

    suppression.restore();
    assert.strictEqual(input.getAttribute("inputmode"), "numeric", "original inputmode restored");

    suppression.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("destroy calls restore", (assert) => {
  const { inputId, input } = registerInputElement("input3");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const host = makeHost(inputId);
    const suppression = new NativeKeyboardSuppression(host);

    suppression.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "suppressed");

    suppression.destroy();
    assert.strictEqual(input.getAttribute("inputmode"), null, "restored by destroy");
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

// ═══════════════════════════════════════════════════
// Multi-instance ref-counting
// ═══════════════════════════════════════════════════

QUnit.module("NativeKeyboardSuppression - multi-instance ref-count");

QUnit.test("two instances suppress the same input, single restore keeps it suppressed", (assert) => {
  const { inputId, input } = registerInputElement("shared1");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const a = new NativeKeyboardSuppression(makeHost(inputId));
    const b = new NativeKeyboardSuppression(makeHost(inputId));

    a.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "suppressed by A");

    b.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "still suppressed after B joins");

    a.restore();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "still suppressed: B holds the ref");

    b.restore();
    assert.strictEqual(input.getAttribute("inputmode"), null, "restored after both release");

    a.destroy();
    b.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("two instances suppress the same input, destroy one keeps it suppressed", (assert) => {
  const { inputId, input } = registerInputElement("shared2");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const a = new NativeKeyboardSuppression(makeHost(inputId));
    const b = new NativeKeyboardSuppression(makeHost(inputId));

    a.suppress();
    b.suppress();

    a.destroy();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "still suppressed after A destroyed");

    b.destroy();
    assert.strictEqual(input.getAttribute("inputmode"), null, "restored after both destroyed");
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("original inputmode is correctly restored after multi-instance release", (assert) => {
  const { inputId, input } = registerInputElement("shared3");
  input.setAttribute("inputmode", "tel");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const a = new NativeKeyboardSuppression(makeHost(inputId));
    const b = new NativeKeyboardSuppression(makeHost(inputId));

    a.suppress();
    b.suppress();
    a.restore();
    b.restore();

    assert.strictEqual(input.getAttribute("inputmode"), "tel", "original inputmode=tel restored");

    a.destroy();
    b.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("re-suppress after restore does not corrupt ref count", (assert) => {
  const { inputId, input } = registerInputElement("shared4");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const a = new NativeKeyboardSuppression(makeHost(inputId));
    const b = new NativeKeyboardSuppression(makeHost(inputId));

    a.suppress();
    b.suppress();
    a.restore();
    // A released, B still holds

    a.suppress();
    // A re-acquires: refCount should be 2 again
    assert.strictEqual(input.getAttribute("inputmode"), "none", "still suppressed");

    a.restore();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "B still holds");

    b.restore();
    assert.strictEqual(input.getAttribute("inputmode"), null, "fully restored");

    a.destroy();
    b.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("switching targets restores the previous input before suppressing the new one", (assert) => {
  const { inputId: id1, input: input1 } = registerInputElement("switch1");
  const { inputId: id2, input: input2 } = registerInputElement("switch2");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(id1).returns({ getFocusDomRef: () => input1 } as never);
    stub.withArgs(id2).returns({ getFocusDomRef: () => input2 } as never);

    let activeId = id1;
    const host = {
      getMobileKeyboard: () => MobileKeyboard.Custom,
      _getActiveTargetId: () => activeId,
      _getEffectiveResolver: () => null,
    };
    const suppression = new NativeKeyboardSuppression(host);

    suppression.suppress();
    assert.strictEqual(input1.getAttribute("inputmode"), "none", "input1 suppressed");

    activeId = id2;
    suppression.suppress();
    assert.strictEqual(input1.getAttribute("inputmode"), null, "input1 restored after target switch");
    assert.strictEqual(input2.getAttribute("inputmode"), "none", "input2 suppressed");

    suppression.destroy();
    assert.strictEqual(input2.getAttribute("inputmode"), null, "input2 restored after destroy");
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

// ═══════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════

QUnit.module("NativeKeyboardSuppression - edge cases");

QUnit.test("restore is safe when DOM element has been removed", (assert) => {
  const { inputId, input } = registerInputElement("removed1");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const suppression = new NativeKeyboardSuppression(makeHost(inputId));

    suppression.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), "none", "suppressed");

    // Simulate DOM removal: make getElementById return null
    stub.withArgs(inputId).returns(null as never);

    suppression.restore();
    // Should not throw, and should clean up internal state
    assert.ok(true, "restore did not throw when DOM was removed");

    suppression.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("suppress is a no-op when shouldDeferToNative returns true", (assert) => {
  const { inputId, input } = registerInputElement("native1");
  const stub = sinon.stub(Element, "getElementById");
  try {
    stub.withArgs(inputId).returns({ getFocusDomRef: () => input } as never);

    const suppression = new NativeKeyboardSuppression(makeHost(inputId, MobileKeyboard.Native));

    suppression.suppress();
    assert.strictEqual(input.getAttribute("inputmode"), null, "inputmode not changed: deferred to native");

    suppression.destroy();
  } finally {
    stub.restore();
    fixture.innerHTML = "";
  }
});

QUnit.test("suppress is a no-op when active target is empty", (assert) => {
  // The static suppressions map is shared across all tests, so assert on the
  // before/after delta rather than an absolute size: the empty-target guard
  // must not perform any ref-count bookkeeping.
  const suppressions = NativeKeyboardSuppression["_suppressions"];
  const sizeBefore = suppressions.size;

  const suppression = new NativeKeyboardSuppression(makeHost(""));

  suppression.suppress();
  assert.strictEqual(suppressions.size, sizeBefore, "suppress did no bookkeeping for empty target");

  suppression.destroy();
});
