import { ShiftState } from "ui5/kiosk/internal/shift-state";

// Exercises the `onChange` contract: every mutator (toggle / autoRelease /
// syncFromPhysical / reset) invokes the constructor callback exactly on a real
// mode transition, and never on a no-op. The owner (KioskKeyboard) wires it to
// `invalidate()` so it never has to pair a mutation with a manual repaint.

let onChange: sinon.SinonSpy;
let state: ShiftState;

QUnit.module("ShiftState", {
  beforeEach() {
    onChange = sinon.spy();
    state = new ShiftState(onChange);
  },
});

QUnit.test("starts in off state and does not fire onChange on construction", (assert) => {
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
  assert.ok(onChange.notCalled, "onChange not fired on construction");
});

QUnit.test("first toggle activates temporary shift and fires onChange", (assert) => {
  state.toggle();
  assert.ok(state.isShifted, "shifted after single click");
  assert.strictEqual(state.isCapsLock, false, "not caps lock after single click");
  assert.strictEqual(onChange.callCount, 1, "onChange fired once");
});

QUnit.test("rapid double-click activates caps lock and fires onChange per transition", (assert) => {
  state.toggle();
  state.toggle(); // immediate second click
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock active");
  assert.strictEqual(onChange.callCount, 2, "onChange fired per transition");
});

QUnit.test("click while caps-locked turns everything off (3 transitions)", (assert) => {
  state.toggle();
  state.toggle(); // caps lock
  state.toggle(); // off
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
  assert.strictEqual(onChange.callCount, 3, "onChange fired per transition");
});

QUnit.test("second click after timeout turns shift off, not caps lock", (assert) => {
  const stub = sinon.stub(performance, "now");
  try {
    stub.returns(1000);
    state.toggle(); // shift on at t=1000
    assert.ok(state.isShifted, "shifted after first click");

    stub.returns(1000 + ShiftState.DOUBLE_CLICK_MS + 100);
    state.toggle(); // outside double-click window -> off

    assert.strictEqual(state.isShifted, false, "not shifted: second slow click turns off");
    assert.strictEqual(state.isCapsLock, false, "not caps lock: outside double-click window");
    assert.strictEqual(onChange.callCount, 2, "onChange fired for both transitions");
  } finally {
    stub.restore();
  }
});

QUnit.test("rapid double-click from Off activates caps lock (shift expired then quick re-click)", (assert) => {
  const stub = sinon.stub(performance, "now");
  try {
    stub.returns(1000);
    state.toggle(); // shift on at t=1000
    assert.ok(state.isShifted, "shifted after first click");

    stub.returns(1000 + ShiftState.DOUBLE_CLICK_MS + 100);
    state.toggle(); // shift expired -> off
    assert.strictEqual(state.isShifted, false, "shift turned off after timeout");

    // Quick re-click within 400ms of the off-toggle
    stub.returns(1000 + ShiftState.DOUBLE_CLICK_MS + 200);
    state.toggle(); // should be caps lock, not shift
    assert.ok(state.isShifted, "shifted after rapid re-click");
    assert.ok(state.isCapsLock, "caps lock activated from Off via rapid double-click");
  } finally {
    stub.restore();
  }
});

QUnit.test("autoRelease releases shift and fires onChange", (assert) => {
  state.toggle();
  onChange.resetHistory();
  state.autoRelease();
  assert.strictEqual(state.isShifted, false, "no longer shifted");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("autoRelease is a no-op (no onChange) when caps-locked", (assert) => {
  state.toggle();
  state.toggle(); // caps lock
  onChange.resetHistory();
  state.autoRelease();
  assert.ok(state.isShifted, "still shifted");
  assert.ok(state.isCapsLock, "still caps lock");
  assert.ok(onChange.notCalled, "onChange not fired");
});

QUnit.test("toggle after autoRelease activates shift, not caps lock", (assert) => {
  state.toggle(); // shift on
  state.autoRelease(); // off (typed a character)
  state.toggle(); // should be shift, not caps lock
  assert.ok(state.isShifted, "shifted after toggle following autoRelease");
  assert.strictEqual(state.isCapsLock, false, "not caps lock: autoRelease closed the double-click window");
});

QUnit.test("autoRelease is a no-op (no onChange) when already off", (assert) => {
  state.autoRelease();
  assert.ok(onChange.notCalled, "nothing to release");
});

QUnit.test("reset clears shift and fires onChange", (assert) => {
  state.toggle();
  onChange.resetHistory();
  state.reset();
  assert.strictEqual(state.isShifted, false, "cleared");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("reset clears caps lock and fires onChange", (assert) => {
  state.toggle();
  state.toggle(); // caps lock
  onChange.resetHistory();
  state.reset();
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("reset is a no-op (no onChange) when already off", (assert) => {
  state.reset();
  assert.ok(onChange.notCalled, "onChange not fired");
});

// ── syncFromPhysical ─────────────────────────────────────────────

QUnit.test("syncFromPhysical: no onChange when the physical state matches the current mode", (assert) => {
  state.syncFromPhysical(false, false);
  assert.strictEqual(state.isShifted, false, "still not shifted");
  assert.strictEqual(state.isCapsLock, false, "still not caps lock");
  assert.ok(onChange.notCalled, "onChange not fired from Off");

  state.syncFromPhysical(true, false);
  onChange.resetHistory();
  state.syncFromPhysical(true, false);
  assert.ok(state.isShifted, "still shifted");
  assert.ok(onChange.notCalled, "second call with the same state is a no-op");
});

QUnit.test("syncFromPhysical: (true, false) from Off sets Shift and fires onChange", (assert) => {
  state.syncFromPhysical(true, false);
  assert.ok(state.isShifted, "shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("syncFromPhysical: (false, true) from Off sets CapsLock and fires onChange", (assert) => {
  state.syncFromPhysical(false, true);
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("syncFromPhysical: (false, false) from Shift or CapsLock returns to Off (fires onChange)", (assert) => {
  state.syncFromPhysical(true, false);
  state.syncFromPhysical(false, false);
  assert.strictEqual(state.isShifted, false, "not shifted after Shift");
  assert.strictEqual(onChange.callCount, 2, "onChange fired per transition");

  state.syncFromPhysical(false, true);
  state.syncFromPhysical(false, false);
  assert.strictEqual(state.isShifted, false, "not shifted after CapsLock");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
  assert.strictEqual(onChange.callCount, 4, "onChange fired per transition");
});

QUnit.test("syncFromPhysical: CapsLock wins over Shift when both flags set", (assert) => {
  state.syncFromPhysical(true, true);
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock: capsLock wins over shift");
  assert.strictEqual(onChange.callCount, 1, "onChange fired");
});

QUnit.test("syncFromPhysical: resets double-click window so next toggle starts fresh Shift", (assert) => {
  state.toggle(); // shift on
  assert.ok(state.isShifted, "shifted after toggle");

  state.syncFromPhysical(false, false); // external sync -> off, resets window

  state.toggle(); // should start fresh shift, not jump to caps lock
  assert.ok(state.isShifted, "shifted after toggle following sync");
  assert.strictEqual(state.isCapsLock, false, "not caps lock: double-click window was reset");
});

QUnit.test("peekToggle: predicts each arm of toggle()", (assert) => {
  const stub = sinon.stub(performance, "now");
  try {
    stub.returns(1000);
    assert.strictEqual(state.peekToggle(), true, "Off -> Shift");
    state.toggle();

    stub.returns(1100);
    assert.strictEqual(state.peekToggle(), true, "Shift -> CapsLock, within the window");
    state.toggle();

    stub.returns(1200);
    assert.strictEqual(state.peekToggle(), false, "CapsLock -> Off");
    state.toggle();

    stub.returns(1300);
    assert.strictEqual(state.peekToggle(), true, "Off -> CapsLock, within the window");
    state.toggle();
    assert.ok(state.isCapsLock, "caps lock reached");
  } finally {
    stub.restore();
  }
});
