import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShiftState } from "../../src/core/shift-state.js";

describe("ShiftState", () => {
  let state: ShiftState;

  beforeEach(() => {
    state = new ShiftState();
  });

  it("starts in off state", () => {
    expect(state.isShifted).toBe(false);
    expect(state.isCapsLock).toBe(false);
  });

  describe("single click → shift", () => {
    it("first toggle activates shift", () => {
      state.toggle();
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });

    it("single click after timeout turns shift off", () => {
      state.toggle(); // shift on
      expect(state.isShifted).toBe(true);
      // Simulate time passing beyond double-click threshold
      vi.spyOn(performance, "now").mockReturnValue(performance.now() + ShiftState.DOUBLE_CLICK_MS + 100);
      state.toggle(); // outside double-click window → off
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
    });
  });

  describe("double-click → caps lock", () => {
    it("rapid double-click activates caps lock", () => {
      state.toggle(); // shift on
      state.toggle(); // double-click → caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
    });

    it("click while caps-locked turns everything off", () => {
      state.toggle();
      state.toggle(); // caps lock
      state.toggle(); // off
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
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
      spy.mockRestore();
    });
  });

  describe("autoRelease", () => {
    it("releases shift and returns true", () => {
      state.toggle(); // shift on
      expect(state.autoRelease()).toBe(true);
      expect(state.isShifted).toBe(false);
    });

    it("does not release caps lock", () => {
      state.toggle(); // shift
      state.toggle(); // caps
      expect(state.autoRelease()).toBe(false);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
    });

    it("returns false when already off", () => {
      expect(state.autoRelease()).toBe(false);
    });

    it("toggle after autoRelease activates shift, not caps lock", () => {
      state.toggle(); // shift on
      state.autoRelease(); // off (typed a character)
      state.toggle(); // should be shift, not caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears shift", () => {
      state.toggle();
      state.reset();
      expect(state.isShifted).toBe(false);
    });

    it("clears caps lock", () => {
      state.toggle();
      state.toggle();
      state.reset();
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
    });
  });

  describe("syncFromPhysical", () => {
    it("from Off with (false, false) returns false (no change)", () => {
      expect(state.syncFromPhysical(false, false)).toBe(false);
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
    });

    it("from Off with (true, false) sets Shift", () => {
      expect(state.syncFromPhysical(true, false)).toBe(true);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });

    it("from Off with (false, true) sets CapsLock", () => {
      expect(state.syncFromPhysical(false, true)).toBe(true);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
    });

    it("from Shift with (false, false) returns to Off", () => {
      state.syncFromPhysical(true, false); // move to Shift
      expect(state.syncFromPhysical(false, false)).toBe(true);
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
    });

    it("from CapsLock with (false, false) returns to Off", () => {
      state.syncFromPhysical(false, true); // move to CapsLock
      expect(state.syncFromPhysical(false, false)).toBe(true);
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
    });

    it("CapsLock wins over Shift when both flags set", () => {
      expect(state.syncFromPhysical(true, true)).toBe(true);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
    });

    it("no-op when state unchanged returns false on second call", () => {
      expect(state.syncFromPhysical(true, false)).toBe(true);
      expect(state.syncFromPhysical(true, false)).toBe(false);
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });

    it("resets double-click window so next toggle starts fresh Shift", () => {
      state.toggle(); // shift on
      expect(state.isShifted).toBe(true);

      state.syncFromPhysical(false, false); // external sync -> off, resets window

      state.toggle(); // should start fresh shift, not caps lock
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });
  });
});
