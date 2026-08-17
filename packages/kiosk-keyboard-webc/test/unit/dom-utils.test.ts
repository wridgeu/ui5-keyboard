import { describe, it, expect, vi } from "vitest";
import {
  classifyRow,
  keyPart,
  keyPositionOf,
  resolveInputOrTextarea,
  resolveWithCustomResolver,
} from "../../src/core/dom-utils.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";
import { parseKeyAction } from "../../src/core/key-token.js";
import { getRegisteredLayoutNames } from "../../src/core/layout-registry.js";

/**
 * A resolver return of the wrong element type, which the resolver signature
 * forbids but a plain-JS consumer can hand back. The runtime type guard exists
 * for exactly this, so the tests have to be able to produce one.
 */
function asResolvedInput(el: HTMLDivElement | HTMLInputElement): HTMLInputElement {
  return el as HTMLInputElement;
}

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
    // @ts-expect-error a value only plain JS can supply, which is what the guard covers
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

describe("resolveWithCustomResolver", () => {
  it("uses custom resolver result when it returns an input", () => {
    const wrapper = document.createElement("div");
    const builtInInput = document.createElement("input");
    wrapper.appendChild(builtInInput);

    const customInput = document.createElement("input");
    expect(resolveWithCustomResolver(wrapper, () => customInput)).toBe(customInput);
  });

  it("falls back to built-in when custom resolver returns null", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    expect(resolveWithCustomResolver(wrapper, () => null)).toBe(input);
  });

  it("falls back to built-in when no custom resolver is set", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    expect(resolveWithCustomResolver(wrapper, null)).toBe(input);
  });

  it("rejects non-input return from custom resolver via type guard", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    const div = document.createElement("div");
    expect(resolveWithCustomResolver(wrapper, () => asResolvedInput(div))).toBe(input);
  });

  it("catches throwing resolver and falls back to built-in", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveWithCustomResolver(wrapper, () => {
      throw new Error("resolver bug");
    });

    expect(result).toBe(input);
    expect(warnSpy).toHaveBeenCalledWith("[kiosk-keyboard] Custom target resolver threw:", expect.any(Error));
  });
});

describe("classifyRow", () => {
  it("returns 'fkey' for an all-function-key row", () => {
    expect(classifyRow([{ value: "{fkey:F1}" }, { value: "{fkey:F2}" }, { value: "{fkey:F12}" }])).toBe("fkey");
  });

  it("returns 'nav' for an all-navigation-key row", () => {
    expect(classifyRow([{ value: "{fkey:Home}" }, { value: "{fkey:End}" }, { value: "{fkey:ArrowLeft}" }])).toBe("nav");
  });

  it("returns undefined for an empty row", () => {
    expect(classifyRow([])).toBeUndefined();
  });

  it("returns undefined for a mixed/character row", () => {
    expect(classifyRow([{ value: "{fkey:F1}" }, { value: "a" }])).toBeUndefined();
  });
});

describe("keyPositionOf", () => {
  function keyEl(row?: string, col?: string): HTMLElement {
    const el = document.createElement("div");
    if (row !== undefined) el.setAttribute(DOM.attributes.rowIndex, row);
    if (col !== undefined) el.setAttribute(DOM.attributes.keyIndex, col);
    return el;
  }

  it("reads the pair the template publishes", () => {
    expect(keyPositionOf(keyEl("2", "7"))).toEqual({ row: 2, col: 7 });
  });

  it("reads a zero coordinate", () => {
    expect(keyPositionOf(keyEl("0", "0"))).toEqual({ row: 0, col: 0 });
  });

  it("returns null when the row index is missing", () => {
    expect(keyPositionOf(keyEl(undefined, "3"))).toBeNull();
  });

  it("returns null when the key index is missing", () => {
    expect(keyPositionOf(keyEl("3"))).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(keyPositionOf(keyEl())).toBeNull();
  });

  it("returns null for an empty attribute value", () => {
    expect(keyPositionOf(keyEl("", "0"))).toBeNull();
    expect(keyPositionOf(keyEl("0", ""))).toBeNull();
  });

  it("returns null for a non-integer coordinate", () => {
    expect(keyPositionOf(keyEl("1.5", "0"))).toBeNull();
    expect(keyPositionOf(keyEl("0", "x"))).toBeNull();
  });
});

describe("keyPart", () => {
  const partOf = (value: string, type?: Parameters<typeof keyPart>[1]) => keyPart(parseKeyAction(value), type);

  it("names a character key by category alone", () => {
    expect(partOf("a")).toBe("key");
    expect(partOf("a", "default")).toBe("key");
    expect(partOf("A", "default")).toBe("key");
  });

  it("names the space key", () => {
    expect(partOf(" ", "space")).toBe("key key-space");
  });

  it("names the fixed action keys alongside their category", () => {
    expect(partOf("{shift}", "modifier")).toBe("key modifier key-shift");
    expect(partOf("{backspace}", "action")).toBe("key action key-backspace");
    expect(partOf("{enter}", "action")).toBe("key action key-enter");
  });

  it("keeps the fkey part for function keys", () => {
    expect(partOf("{fkey:F1}", "modifier")).toBe("key modifier fkey");
    expect(partOf("{fkey:ArrowLeft}", "modifier")).toBe("key modifier fkey");
  });

  it("names a switch to a built-in layout by its target", () => {
    expect(partOf("{layout:numeric}", "modifier")).toBe("key modifier key-layout key-layout-numeric");
    expect(partOf("{layout:ja-kana}", "modifier")).toBe("key modifier key-layout key-layout-ja-kana");
  });

  it("names the base sentinel like any other target", () => {
    expect(partOf("{layout:base}", "modifier")).toBe("key modifier key-layout key-layout-base");
  });

  it("matches the target case-insensitively, as the registry does", () => {
    expect(partOf("{layout:NUMERIC}", "modifier")).toBe("key modifier key-layout key-layout-numeric");
  });

  it("gives a switch to a custom layout the generic part only", () => {
    expect(partOf("{layout:my-tenant-layout}", "modifier")).toBe("key modifier key-layout");
  });

  it("gives an unknown token no per-key part", () => {
    expect(partOf("{nope}")).toBe("key");
    expect(partOf("{layout:}")).toBe("key");
  });

  it("emits only part names the contract declares", () => {
    const declared = new Set(DOM.parts);
    const values = [
      "a",
      " ",
      "{shift}",
      "{backspace}",
      "{enter}",
      "{fkey:F1}",
      "{layout:base}",
      "{layout:numeric}",
      "{layout:my-tenant-layout}",
      "{nope}",
    ];
    for (const value of values) {
      for (const token of partOf(value, "modifier").split(" ")) {
        expect(declared.has(token), `part "${token}" from "${value}" is declared`).toBe(true);
      }
    }
  });
});

describe("declared CSS parts", () => {
  it("carries one key-layout part per built-in layout, plus the base sentinel", () => {
    const declared = DOM.parts.filter((p) => p.startsWith("key-layout-")).map((p) => p.slice("key-layout-".length));
    expect(declared.toSorted()).toEqual([...getRegisteredLayoutNames(), "base"].toSorted());
  });

  it("names every part with a selectable CSS identifier", () => {
    // `::part()` takes an ident, so a name carrying the braces or colons of a
    // key token would be declarable but never selectable.
    for (const part of DOM.parts) {
      expect(part, `part "${part}" is a valid ident`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
