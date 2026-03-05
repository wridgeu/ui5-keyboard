import { describe, it, expect } from "vitest";
import { resolveInputOrTextarea } from "../../src/core/dom-utils.js";

describe("resolveInputOrTextarea", () => {
  it("returns native input directly", () => {
    const input = document.createElement("input");
    expect(resolveInputOrTextarea(input)).toBe(input);
  });

  it("returns native textarea directly", () => {
    const textarea = document.createElement("textarea");
    expect(resolveInputOrTextarea(textarea)).toBe(textarea);
  });

  it("returns null for non-element", () => {
    expect(resolveInputOrTextarea(null)).toBeNull();
    expect(resolveInputOrTextarea(undefined)).toBeNull();
    expect(resolveInputOrTextarea("string")).toBeNull();
  });

  it("finds input in light DOM", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);
    expect(resolveInputOrTextarea(wrapper)).toBe(input);
  });

  it("finds textarea in light DOM", () => {
    const wrapper = document.createElement("div");
    const textarea = document.createElement("textarea");
    wrapper.appendChild(textarea);
    expect(resolveInputOrTextarea(wrapper)).toBe(textarea);
  });

  it("finds input in shadow DOM", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadow.appendChild(input);
    expect(resolveInputOrTextarea(host)).toBe(input);
  });

  it("finds input in nested shadow DOM (2 levels)", () => {
    // Simulate: outer-host > shadow > inner-host > shadow > input
    const outer = document.createElement("div");
    const outerShadow = outer.attachShadow({ mode: "open" });
    const inner = document.createElement("div");
    outerShadow.appendChild(inner);
    const innerShadow = inner.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    innerShadow.appendChild(input);

    expect(resolveInputOrTextarea(outer)).toBe(input);
  });

  it("finds input in deeply nested shadow DOM (3 levels)", () => {
    const l1 = document.createElement("div");
    const s1 = l1.attachShadow({ mode: "open" });
    const l2 = document.createElement("div");
    s1.appendChild(l2);
    const s2 = l2.attachShadow({ mode: "open" });
    const l3 = document.createElement("div");
    s2.appendChild(l3);
    const s3 = l3.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    s3.appendChild(input);

    expect(resolveInputOrTextarea(l1)).toBe(input);
  });

  it("respects maxDepth and returns null when exceeded", () => {
    const l1 = document.createElement("div");
    const s1 = l1.attachShadow({ mode: "open" });
    const l2 = document.createElement("div");
    s1.appendChild(l2);
    const s2 = l2.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    s2.appendChild(input);

    // maxDepth=1 means only check l1's shadow, not recurse into l2's shadow
    expect(resolveInputOrTextarea(l1, 1)).toBeNull();
  });

  it("returns null for element without input", () => {
    const div = document.createElement("div");
    div.appendChild(document.createElement("span"));
    expect(resolveInputOrTextarea(div)).toBeNull();
  });

  it("prefers light DOM over shadow DOM", () => {
    const host = document.createElement("div");
    const lightInput = document.createElement("input");
    lightInput.id = "light";
    host.appendChild(lightInput);
    const shadow = host.attachShadow({ mode: "open" });
    const shadowInput = document.createElement("input");
    shadowInput.id = "shadow";
    shadow.appendChild(shadowInput);

    expect(resolveInputOrTextarea(host)).toBe(lightInput);
  });
});
