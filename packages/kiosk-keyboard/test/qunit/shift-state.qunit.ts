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

QUnit.test("rapid double-click from Off activates caps lock (shift expired then quick re-click)", (assert) => {
  const state = new ShiftState();
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

QUnit.test("toggle after autoRelease activates shift, not caps lock", (assert) => {
  const state = new ShiftState();
  state.toggle(); // shift on
  state.autoRelease(); // off (typed a character)
  state.toggle(); // should be shift, not caps lock
  assert.ok(state.isShifted, "shifted after toggle following autoRelease");
  assert.strictEqual(state.isCapsLock, false, "not caps lock -- autoRelease closed the double-click window");
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

// ── syncFromPhysical ─────────────────────────────────────────────

QUnit.test("syncFromPhysical: from Off with (false, false) returns false (no change)", (assert) => {
  const state = new ShiftState();
  assert.strictEqual(state.syncFromPhysical(false, false), false, "no change");
  assert.strictEqual(state.isShifted, false, "still not shifted");
  assert.strictEqual(state.isCapsLock, false, "still not caps lock");
});

QUnit.test("syncFromPhysical: from Off with (true, false) sets Shift", (assert) => {
  const state = new ShiftState();
  assert.ok(state.syncFromPhysical(true, false), "state changed");
  assert.ok(state.isShifted, "shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});

QUnit.test("syncFromPhysical: from Off with (false, true) sets CapsLock", (assert) => {
  const state = new ShiftState();
  assert.ok(state.syncFromPhysical(false, true), "state changed");
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock");
});

QUnit.test("syncFromPhysical: from Shift with (false, false) returns to Off", (assert) => {
  const state = new ShiftState();
  state.syncFromPhysical(true, false); // move to Shift
  assert.ok(state.syncFromPhysical(false, false), "state changed");
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});

QUnit.test("syncFromPhysical: from CapsLock with (false, false) returns to Off", (assert) => {
  const state = new ShiftState();
  state.syncFromPhysical(false, true); // move to CapsLock
  assert.ok(state.syncFromPhysical(false, false), "state changed");
  assert.strictEqual(state.isShifted, false, "not shifted");
  assert.strictEqual(state.isCapsLock, false, "not caps lock");
});

QUnit.test("syncFromPhysical: CapsLock wins over Shift when both flags set", (assert) => {
  const state = new ShiftState();
  assert.ok(state.syncFromPhysical(true, true), "state changed");
  assert.ok(state.isShifted, "shifted");
  assert.ok(state.isCapsLock, "caps lock -- capsLock wins over shift");
});

QUnit.test("syncFromPhysical: no-op when state unchanged returns false on second call", (assert) => {
  const state = new ShiftState();
  assert.ok(state.syncFromPhysical(true, false), "first call changed state");
  assert.strictEqual(state.syncFromPhysical(true, false), false, "second call is a no-op");
  assert.ok(state.isShifted, "still shifted");
  assert.strictEqual(state.isCapsLock, false, "still not caps lock");
});

QUnit.test("syncFromPhysical: resets double-click window so next toggle starts fresh Shift", (assert) => {
  const state = new ShiftState();
  state.toggle(); // shift on
  assert.ok(state.isShifted, "shifted after toggle");

  state.syncFromPhysical(false, false); // external sync -> off, resets window

  state.toggle(); // should start fresh shift, not jump to caps lock
  assert.ok(state.isShifted, "shifted after toggle following sync");
  assert.strictEqual(state.isCapsLock, false, "not caps lock -- double-click window was reset");
});
