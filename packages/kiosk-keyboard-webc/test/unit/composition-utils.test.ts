import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompositionState } from "../../src/core/composition-utils.js";
import {
  createCompositionState,
  startComposition,
  updateComposition,
  endComposition,
  isComposing,
} from "../../src/core/composition-utils.js";

describe("composition-utils", () => {
  let input: HTMLInputElement;
  let state: CompositionState;

  beforeEach(() => {
    state = createCompositionState();
    input = document.createElement("input");
    input.value = "hello";
    input.setSelectionRange(5, 5);
  });

  describe("startComposition", () => {
    it("dispatches compositionstart event", () => {
      const spy = vi.fn();
      input.addEventListener("compositionstart", spy);
      startComposition(state, input);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("updateComposition", () => {
    it("replaces preedit text and dispatches compositionupdate", () => {
      const spy = vi.fn();
      input.addEventListener("compositionupdate", spy);
      startComposition(state, input);
      updateComposition(state, input, "\u304B"); // か
      expect(input.value).toBe("hello\u304B");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("replaces previous preedit on subsequent calls", () => {
      startComposition(state, input);
      updateComposition(state, input, "\u304B"); // か
      updateComposition(state, input, "\u304C"); // が
      expect(input.value).toBe("hello\u304C");
    });
  });

  describe("endComposition", () => {
    it("dispatches compositionend and commits preedit", () => {
      const spy = vi.fn();
      let committed: string | null = null;
      input.addEventListener("compositionend", spy);
      input.addEventListener("compositionend", (e) => {
        committed = (e as CompositionEvent).data;
      });
      startComposition(state, input);
      updateComposition(state, input, "が"); // が
      endComposition(state, input);
      expect(input.value).toBe("helloが");
      expect(committed).toBe("が");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("clears preedit tracking so next startComposition is fresh", () => {
      startComposition(state, input);
      updateComposition(state, input, "\u304B"); // か
      endComposition(state, input);
      startComposition(state, input);
      updateComposition(state, input, "\u305F"); // た
      expect(input.value).toBe("hello\u304B\u305F");
    });
  });

  describe("isComposing", () => {
    it("returns false for a freshly created state", () => {
      expect(isComposing(state)).toBe(false);
    });

    it("returns true after startComposition", () => {
      startComposition(state, input);
      expect(isComposing(state)).toBe(true);
    });

    it("returns false after endComposition", () => {
      startComposition(state, input);
      endComposition(state, input);
      expect(isComposing(state)).toBe(false);
    });

    it("tracks independently for separate state objects", () => {
      const otherState = createCompositionState();
      startComposition(state, input);
      expect(isComposing(state)).toBe(true);
      expect(isComposing(otherState)).toBe(false);
    });
  });
});
