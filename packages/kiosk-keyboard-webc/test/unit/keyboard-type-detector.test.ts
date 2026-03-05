import { describe, it, expect } from "vitest";
import { detectKeyboardType } from "../../src/core/keyboard-type-detector.js";

describe("detectKeyboardType", () => {
  it("returns Full for plain text input", () => {
    const el = document.createElement("input");
    el.type = "text";
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("returns Numpad for type=number", () => {
    const el = document.createElement("input");
    el.type = "number";
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Numpad for type=tel", () => {
    const el = document.createElement("input");
    el.type = "tel";
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Numpad for inputmode=numeric", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "numeric");
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Numpad for inputmode=decimal", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "decimal");
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Numpad for inputmode=tel", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "tel");
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Full for textarea", () => {
    const el = document.createElement("textarea");
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("returns Full for non-input element", () => {
    const el = document.createElement("div");
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("inputmode takes priority over type", () => {
    const el = document.createElement("input");
    el.type = "text";
    el.setAttribute("inputmode", "numeric");
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Numpad for type=number even with inputmode=text (non-numpad inputmode does not override type)", () => {
    const el = document.createElement("input");
    el.type = "number";
    el.setAttribute("inputmode", "text");
    // inputmode="text" is not a numpad mode, so it falls through to type check
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Full for inputmode=email", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "email");
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("returns Full for inputmode=url", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "url");
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("returns Full for input with no type or inputmode", () => {
    const el = document.createElement("input");
    expect(detectKeyboardType(el)).toBe("Full");
  });
});
