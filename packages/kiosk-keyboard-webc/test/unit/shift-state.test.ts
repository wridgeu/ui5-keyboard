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
      state.toggle(); // shift on
      // Simulate time passing beyond double-click threshold
      vi.spyOn(performance, "now").mockReturnValue(performance.now() + ShiftState.DOUBLE_CLICK_MS + 100);
      state.toggle(); // shift expired → off
      expect(state.isShifted).toBe(false);

      // Now quickly double-click (restore real timing)
      vi.restoreAllMocks();
      state.toggle(); // off → should be caps lock (rapid click after off)
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
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
});
