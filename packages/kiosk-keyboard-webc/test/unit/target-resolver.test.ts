import { describe, it, expect } from "vitest";
import { resolveInputOrTextarea } from "../../src/core/dom-utils.js";

/**
 * Tests for the target resolver pattern used by KioskKeyboard.
 *
 * The component's `_resolveInputFrom` method calls the custom resolver first,
 * then falls back to the built-in `resolveInputOrTextarea`. These tests verify
 * the resolver callback contract independently of the full component lifecycle.
 */

/** Mimics `KioskKeyboard._resolveInputFrom` logic. */
function resolveInputFrom(
  el: HTMLElement,
  customResolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (customResolver) {
    const custom = customResolver(el);
    if (custom) return custom;
  }
  return resolveInputOrTextarea(el);
}

describe("target resolver callback", () => {
  it("custom resolver takes precedence over built-in", () => {
    const wrapper = document.createElement("div");
    const builtInInput = document.createElement("input");
    builtInInput.id = "builtin";
    wrapper.appendChild(builtInInput);

    const customInput = document.createElement("input");
    customInput.id = "custom";

    const resolver = () => customInput;
    expect(resolveInputFrom(wrapper, resolver)).toBe(customInput);
  });

  it("falls back to built-in when custom resolver returns null", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    const resolver = () => null;
    expect(resolveInputFrom(wrapper, resolver)).toBe(input);
  });

  it("falls back to built-in when no custom resolver is set", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    expect(resolveInputFrom(wrapper, null)).toBe(input);
  });

  it("custom resolver receives the host element", () => {
    const host = document.createElement("div");
    host.id = "my-host";
    let receivedEl: HTMLElement | null = null;

    const resolver = (el: HTMLElement) => {
      receivedEl = el;
      return null;
    };

    resolveInputFrom(host, resolver);
    expect(receivedEl).toBe(host);
  });

  it("custom resolver can traverse deeply nested structures", () => {
    // Simulate a complex custom control
    const host = document.createElement("div");
    const level1 = document.createElement("div");
    level1.className = "custom-wrapper";
    const level2 = document.createElement("div");
    level2.className = "inner";
    const input = document.createElement("input");
    level2.appendChild(input);
    level1.appendChild(level2);
    host.appendChild(level1);

    const resolver = (el: HTMLElement) => {
      return el.querySelector<HTMLInputElement>(".custom-wrapper .inner input");
    };

    expect(resolveInputFrom(host, resolver)).toBe(input);
  });
});
