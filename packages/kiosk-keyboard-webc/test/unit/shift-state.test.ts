import { describe, it, expect, beforeEach } from "vitest";
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

  describe("toggle cycle: off → shift → caps → off", () => {
    it("first toggle activates shift", () => {
      state.toggle();
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(false);
    });

    it("second toggle activates caps lock", () => {
      state.toggle();
      state.toggle();
      expect(state.isShifted).toBe(true);
      expect(state.isCapsLock).toBe(true);
    });

    it("third toggle returns to off", () => {
      state.toggle();
      state.toggle();
      state.toggle();
      expect(state.isShifted).toBe(false);
      expect(state.isCapsLock).toBe(false);
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
