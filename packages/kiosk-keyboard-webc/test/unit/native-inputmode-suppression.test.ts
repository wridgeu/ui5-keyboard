import { describe, it, expect } from "vitest";
import { NativeInputModeSuppression } from "../../src/core/native-inputmode-suppression.js";

/** A fresh input in the document, so each test gets its own WeakMap entry. */
function makeInput(inputMode?: string): HTMLInputElement {
  const input = document.createElement("input");
  if (inputMode !== undefined) input.setAttribute("inputmode", inputMode);
  document.body.appendChild(input);
  return input;
}

describe("NativeInputModeSuppression", () => {
  it("a repeat suppress() on the held element does not raise the refcount", () => {
    const input = makeInput();
    const suppression = new NativeInputModeSuppression(() => input);

    suppression.suppress();
    suppression.suppress();
    suppression.restore();

    expect(input.getAttribute("inputmode")).toBe(null);
  });

  it("suppressing a new target releases the previous one", () => {
    const a = makeInput();
    const b = makeInput();
    let target: HTMLInputElement = a;
    const suppression = new NativeInputModeSuppression(() => target);

    suppression.suppress();
    target = b;
    suppression.suppress();

    expect(a.getAttribute("inputmode")).toBe(null);
    expect(b.getAttribute("inputmode")).toBe("none");

    suppression.restore();
    expect(b.getAttribute("inputmode")).toBe(null);
  });

  it("two instances on one element keep the refcount", () => {
    const input = makeInput();
    const a = new NativeInputModeSuppression(() => input);
    const b = new NativeInputModeSuppression(() => input);

    a.suppress();
    b.suppress();
    a.restore();
    expect(input.getAttribute("inputmode")).toBe("none");

    b.restore();
    expect(input.getAttribute("inputmode")).toBe(null);
  });

  it("an authored inputmode is restored, not removed", () => {
    const input = makeInput("decimal");
    const suppression = new NativeInputModeSuppression(() => input);

    suppression.suppress();
    expect(input.getAttribute("inputmode")).toBe("none");

    suppression.restore();
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });
});
