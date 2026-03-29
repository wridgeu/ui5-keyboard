import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startComposition,
  updateComposition,
  endComposition,
  _resetComposition,
} from "../../src/core/composition-utils.js";

describe("composition-utils", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    _resetComposition();
    input = document.createElement("input");
    input.value = "hello";
    input.setSelectionRange(5, 5);
  });

  describe("startComposition", () => {
    it("dispatches compositionstart event", () => {
      const spy = vi.fn();
      input.addEventListener("compositionstart", spy);
      startComposition(input);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("updateComposition", () => {
    it("replaces preedit text and dispatches compositionupdate", () => {
      const spy = vi.fn();
      input.addEventListener("compositionupdate", spy);
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      expect(input.value).toBe("hello\u304B");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("replaces previous preedit on subsequent calls", () => {
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      updateComposition(input, "\u304C"); // が
      expect(input.value).toBe("hello\u304C");
    });
  });

  describe("endComposition", () => {
    it("dispatches compositionend and commits preedit", () => {
      const spy = vi.fn();
      input.addEventListener("compositionend", spy);
      startComposition(input);
      updateComposition(input, "\u304C"); // が
      endComposition(input);
      expect(input.value).toBe("hello\u304C");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("clears preedit tracking so next startComposition is fresh", () => {
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      endComposition(input);
      startComposition(input);
      updateComposition(input, "\u305F"); // た
      expect(input.value).toBe("hello\u304B\u305F");
    });
  });
});
