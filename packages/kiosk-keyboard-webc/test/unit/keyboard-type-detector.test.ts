import { describe, it, expect } from "vitest";
import { detectKeyboardType } from "../../src/core/keyboard-type-detector.js";

describe("detectKeyboardType", () => {
  it("returns Full for plain text input", () => {
    const el = document.createElement("input");
    el.type = "text";
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it.each(["number", "tel"])("returns Numpad for type=%s", (type) => {
    const el = document.createElement("input");
    el.type = type;
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it.each(["numeric", "decimal", "tel"])("returns Numpad for inputmode=%s", (mode) => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", mode);
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("matches inputmode case-insensitively (inputmode=Numeric)", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", "Numeric");
    expect(detectKeyboardType(el)).toBe("Numpad");
  });

  it("returns Full for textarea", () => {
    const el = document.createElement("textarea");
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

  it.each(["email", "url"])("returns Full for inputmode=%s", (mode) => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", mode);
    expect(detectKeyboardType(el)).toBe("Full");
  });

  it("returns Full for input with no type or inputmode", () => {
    const el = document.createElement("input");
    expect(detectKeyboardType(el)).toBe("Full");
  });

  // ── data-keyboard-type override ──

  describe("data-keyboard-type override", () => {
    it("returns Numpad when data-keyboard-type=Numpad is on the input", () => {
      const el = document.createElement("input");
      el.setAttribute("data-keyboard-type", "Numpad");
      expect(detectKeyboardType(el)).toBe("Numpad");
    });

    it("returns Full when data-keyboard-type=Full is on the input", () => {
      const el = document.createElement("input");
      el.type = "number"; // would normally be Numpad
      el.setAttribute("data-keyboard-type", "Full");
      expect(detectKeyboardType(el)).toBe("Full");
    });

    it("detects data-keyboard-type on a parent element", () => {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-keyboard-type", "Numpad");
      const el = document.createElement("input");
      wrapper.appendChild(el);
      document.body.appendChild(wrapper);
      try {
        expect(detectKeyboardType(el)).toBe("Numpad");
      } finally {
        wrapper.remove();
      }
    });

    it("data-keyboard-type takes priority over inputmode", () => {
      const el = document.createElement("input");
      el.setAttribute("inputmode", "numeric"); // would be Numpad
      el.setAttribute("data-keyboard-type", "Full");
      expect(detectKeyboardType(el)).toBe("Full");
    });

    it("ignores invalid data-keyboard-type values", () => {
      const el = document.createElement("input");
      el.type = "number";
      el.setAttribute("data-keyboard-type", "Numeric"); // not a valid override
      // Falls through to type check
      expect(detectKeyboardType(el)).toBe("Numpad");
    });

    it("ignores empty data-keyboard-type", () => {
      const el = document.createElement("input");
      el.setAttribute("data-keyboard-type", "");
      expect(detectKeyboardType(el)).toBe("Full");
    });

    it("detects data-keyboard-type across shadow DOM boundaries", () => {
      // Simulate: <div data-keyboard-type="Numpad"> #shadow <input>
      const host = document.createElement("div");
      host.setAttribute("data-keyboard-type", "Numpad");
      const shadow = host.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      shadow.appendChild(input);
      document.body.appendChild(host);
      try {
        expect(detectKeyboardType(input)).toBe("Numpad");
      } finally {
        host.remove();
      }
    });

    it("detects data-keyboard-type across nested shadow DOM boundaries", () => {
      // Simulate: <div data-keyboard-type="Full"> #shadow <inner-host> #shadow <input type="number">
      const outer = document.createElement("div");
      outer.setAttribute("data-keyboard-type", "Full");
      const outerShadow = outer.attachShadow({ mode: "open" });
      const inner = document.createElement("div");
      outerShadow.appendChild(inner);
      const innerShadow = inner.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      input.type = "number"; // would be Numpad without the override
      innerShadow.appendChild(input);
      document.body.appendChild(outer);
      try {
        expect(detectKeyboardType(input)).toBe("Full");
      } finally {
        outer.remove();
      }
    });

    it("falls through to inputmode when no data-keyboard-type ancestor exists in shadow DOM", () => {
      const host = document.createElement("div");
      const shadow = host.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      input.setAttribute("inputmode", "numeric");
      shadow.appendChild(input);
      document.body.appendChild(host);
      try {
        expect(detectKeyboardType(input)).toBe("Numpad");
      } finally {
        host.remove();
      }
    });
  });
});
