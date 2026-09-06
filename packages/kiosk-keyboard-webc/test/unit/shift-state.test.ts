import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { ShiftState } from "../../src/core/shift-state.js";

// Exercises the `onChange` contract: every mutator (toggle / autoRelease /
// syncFromPhysical / reset) must invoke the constructor callback exactly on a
// real mode transition, and never on a no-op. The owner (KioskKeyboard) uses
// it to drive ARIA announcements and mirror-field updates.

describe("ShiftState", () => {
  let onChange: Mock<() => void>;
  let state: ShiftState;

  beforeEach(() => {
    onChange = vi.fn();
    state = new ShiftState(onChange);
  });

  it("starts in off state and does not fire onChange on construction", () => {
    expect(state.isShifted).toBe(false);
    expect(state.isCapsLock).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("toggle()", () => {
    it("activates shift on first toggle and fires onChange", () => {
      state.toggle();
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("double-click → caps lock", () => {
    it("rapid double-click activates caps lock and fires onChange per transition", () => {
      state.toggle(); // shift on (1st)
      state.toggle(); // double-click → caps lock (2nd)
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("click while caps-locked turns everything off (3 transitions, 3 callbacks)", () => {
      state.toggle();
      state.toggle(); // caps lock
      state.toggle(); // off
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it("rapid double-click from Off activates caps lock (shift expired then quick re-click)", () => {
      const spy = vi.spyOn(performance, "now");
      spy.mockReturnValue(1000);
      state.toggle(); // shift on at t=1000
      expect(state.isShifted).toBe(true);

      spy.mockReturnValue(1000 + ShiftState.DOUBLE_CLICK_MS + 100);
      state.toggle(); // shift expired → off
      expect(state.isShifted).toBe(false);

      spy.mockReturnValue(1000 + ShiftState.DOUBLE_CLICK_MS + 200);
      state.toggle(); // quick re-click → caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });

  describe("peekToggle()", () => {
    it("predicts each arm of toggle()", () => {
      const spy = vi.spyOn(performance, "now");
      spy.mockReturnValue(1000);
      expect(state.peekToggle(), "Off -> Shift").toBe(true);
      state.toggle();

      spy.mockReturnValue(1100);
      expect(state.peekToggle(), "Shift -> CapsLock, within the window").toBe(true);
      state.toggle();

      spy.mockReturnValue(1200);
      expect(state.peekToggle(), "CapsLock -> Off").toBe(false);
      state.toggle();

      spy.mockReturnValue(1300);
      expect(state.peekToggle(), "Off -> CapsLock, within the window").toBe(true);
      state.toggle();
      expect(state.isCapsLock).toBe(true);
      spy.mockRestore();
    });

    it("reports the Shift -> Off arm the mirrored caps-lock flag cannot see", () => {
      const spy = vi.spyOn(performance, "now");
      spy.mockReturnValue(1000);
      state.toggle(); // Off -> Shift

      spy.mockReturnValue(1000 + ShiftState.DOUBLE_CLICK_MS + 100);
      expect(state.peekToggle(), "outside the window: Shift -> Off").toBe(false);
      spy.mockRestore();
    });

    it("neither transitions nor moves the double-click window", () => {
      const spy = vi.spyOn(performance, "now");
      spy.mockReturnValue(1000);
      state.toggle(); // Off -> Shift
      onChange.mockClear();

      spy.mockReturnValue(1100);
      state.peekToggle();
      state.peekToggle();
      expect(state.isShifted).toBe(true);
      expect(onChange).not.toHaveBeenCalled();

      state.toggle(); // still measured from t=1000, so still within the window
      expect(state.isCapsLock).toBe(true);
      spy.mockRestore();
    });
  });

  describe("autoRelease()", () => {
    it("releases shift and fires onChange", () => {
      state.toggle(); // shift on (1st onChange)
      onChange.mockClear();

      state.autoRelease();
      expect(state.isShifted).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("is a no-op (no onChange) when caps-locked", () => {
      state.toggle();
      state.toggle(); // caps
      onChange.mockClear();

      state.autoRelease();
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("is a no-op (no onChange) when already off", () => {
      state.autoRelease();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("toggle after autoRelease activates shift, not caps lock", () => {
      state.toggle(); // shift on
      state.autoRelease(); // off (typed a character)
      state.toggle(); // should be shift, not caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });
  });

  describe("reset()", () => {
    it("clears shift and fires onChange", () => {
      state.toggle();
      onChange.mockClear();

      state.reset();
      expect(state.isShifted).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("clears caps lock and fires onChange", () => {
      state.toggle();
      state.toggle(); // caps
      onChange.mockClear();

      state.reset();
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("is a no-op (no onChange) when already off", () => {
      state.reset();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("syncFromPhysical()", () => {
    it("(false, false) from Off does not fire onChange", () => {
      state.syncFromPhysical(false, false);
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("(true, false) from Off sets Shift and fires onChange", () => {
      state.syncFromPhysical(true, false);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("(false, true) from Off sets CapsLock and fires onChange", () => {
      state.syncFromPhysical(false, true);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("(false, false) from Shift returns to Off (transition fires onChange)", () => {
      state.syncFromPhysical(true, false); // 1st
      state.syncFromPhysical(false, false); // 2nd
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("(false, false) from CapsLock returns to Off (transition fires onChange)", () => {
      state.syncFromPhysical(false, true); // 1st
      state.syncFromPhysical(false, false); // 2nd
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("CapsLock wins over Shift when both flags set", () => {
      state.syncFromPhysical(true, true);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("does not fire onChange when called repeatedly with the same state", () => {
      state.syncFromPhysical(true, false);
      onChange.mockClear();

      state.syncFromPhysical(true, false);
      expect(state.isShifted).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("resets double-click window so next toggle starts fresh Shift", () => {
      state.toggle(); // shift on
      expect(state.isShifted).toBe(true);

      state.syncFromPhysical(false, false); // external sync → off, resets window

      state.toggle(); // should start fresh shift, not caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });
  });
});
