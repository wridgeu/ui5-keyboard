import { describe, it, expect } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLayout,
  unregisterLayout,
} from "../../src/core/layout-registry.js";

// Import the core entry -- NO built-in layouts, just the component class.
// This simulates: import KioskKeyboard from "kiosk-keyboard-webc/core";
import KioskKeyboard from "../../src/KioskKeyboardCore.js";

const CUSTOM_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [
    { value: "{backspace}", type: "action", width: "1.5" },
    { value: "0" },
    { value: "{enter}", type: "action", width: "1.5" },
  ],
];

describe("core entry: lean consumption", () => {
  it("exports the component class with full static registration API", () => {
    // The core entry (KioskKeyboardCore) provides the component class
    // without importing any built-in layout files. Layout isolation
    // cannot be tested here because vitest shares module state across
    // test files in the same process -- it is an architectural guarantee
    // of the source file, not a runtime-testable property.
    expect(KioskKeyboard).toBeDefined();
    expect(typeof KioskKeyboard.registerLayout).toBe("function");
    expect(typeof KioskKeyboard.unregisterLayout).toBe("function");
    expect(typeof KioskKeyboard.getRegisteredLayout).toBe("function");
    expect(typeof KioskKeyboard.getRegisteredLayoutNames).toBe("function");
    expect(typeof KioskKeyboard.isBuiltInLayout).toBe("function");
    expect(typeof KioskKeyboard.registerMiddleware).toBe("function");
  });

  it("allows registering a custom layout without any built-ins", () => {
    registerLayout("custom-pin", CUSTOM_LAYOUT);

    expect(getRegisteredLayout("custom-pin")).toBe(CUSTOM_LAYOUT);
    expect(isBuiltInLayout("custom-pin")).toBe(false);

    // Clean up
    unregisterLayout("custom-pin");
    expect(getRegisteredLayout("custom-pin")).toBeUndefined();
  });

  it("allows cherry-picking a single built-in layout", async () => {
    // Dynamically import just one layout (simulates selective import)
    await import("../../src/layouts/numeric.js");

    expect(getRegisteredLayout("numeric")).toBeDefined();
    expect(isBuiltInLayout("numeric")).toBe(true);
  });

  it("custom layout works alongside cherry-picked built-in", () => {
    registerLayout("custom-pin", CUSTOM_LAYOUT);

    const names = getRegisteredLayoutNames();
    expect(names).toContain("numeric");
    expect(names).toContain("custom-pin");

    // Clean up
    unregisterLayout("custom-pin");
  });
});
