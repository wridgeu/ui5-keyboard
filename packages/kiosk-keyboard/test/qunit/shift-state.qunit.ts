import { ShiftState } from "ui5/kiosk/internal/shift-state";

QUnit.module("ShiftState");

QUnit.test("starts in off state", (assert) => {
  const state = new ShiftState();
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});

QUnit.test("first toggle activates temporary shift", (assert) => {
  const state = new ShiftState();
  state.toggle();
  assert.ok(state.isShifted, "shifted after single click");
  assert.strictEqual(state.isCapsLock, false, "not caps lock after single click");
});

QUnit.test("rapid double-click activates caps lock", (assert) => {
  const state = new ShiftState();
  state.toggle();
  state.toggle(); // immediate second click
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock active");
});

QUnit.test("click while caps-locked turns everything off", (assert) => {
  const state = new ShiftState();
  state.toggle();
  state.toggle(); // caps lock
  state.toggle(); // off
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});

QUnit.test("second click after timeout turns shift off, not caps lock", (assert) => {
  const state = new ShiftState();
  const stub = sinon.stub(performance, "now");
  try {
    stub.returns(1000);
    state.toggle(); // shift on at t=1000
    assert.ok(state.isShifted, "shifted after first click");

    stub.returns(1000 + ShiftState.DOUBLE_CLICK_MS + 100);
    state.toggle(); // outside double-click window -> off

    assert.strictEqual(state.isShifted, false, "not shifted -- second slow click turns off");
    assert.strictEqual(state.isCapsLock, false, "not caps lock -- outside double-click window");
  } finally {
    stub.restore();
  }
});

QUnit.test("autoRelease releases shift and returns true", (assert) => {
  const state = new ShiftState();
  state.toggle();
  assert.ok(state.autoRelease(), "released");
  assert.strictEqual(state.isShifted, false, "no longer shifted");
});

QUnit.test("autoRelease does not release caps lock", (assert) => {
  const state = new ShiftState();
  state.toggle();
  state.toggle(); // caps lock
  assert.strictEqual(state.autoRelease(), false, "not released");
  assert.ok(state.isShifted, "still shifted");
  assert.ok(state.isCapsLock, "still caps lock");
});

QUnit.test("autoRelease returns false when already off", (assert) => {
  const state = new ShiftState();
  assert.strictEqual(state.autoRelease(), false, "nothing to release");
});

QUnit.test("reset clears shift", (assert) => {
  const state = new ShiftState();
  state.toggle();
  state.reset();
  assert.strictEqual(state.isShifted, false, "cleared");
});

QUnit.test("reset clears caps lock", (assert) => {
  const state = new ShiftState();
  state.toggle();
  state.toggle(); // caps lock
  state.reset();
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});
