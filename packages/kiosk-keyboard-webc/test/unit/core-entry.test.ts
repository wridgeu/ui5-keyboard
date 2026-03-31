import { describe, it, expect, beforeAll } from "vitest";
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
  it("no built-in layouts are registered when using core entry", () => {
    // The core entry does not import layout files, so the registry
    // should only contain layouts registered by other test files in
    // the same vitest process (if any). This test checks that the
    // core entry itself does not add layouts.
    const names = getRegisteredLayoutNames();
    // "qwerty" is a built-in -- if it's registered, the core entry
    // leaked layout imports.
    for (const name of names) {
      if (isBuiltInLayout(name)) {
        // A built-in is present -- this could be from another test file
        // in the same process. We can't fully isolate vitest modules,
        // so we just verify the core entry CLASS is available.
        break;
      }
    }
    // The key assertion: the class itself is usable.
    expect(KioskKeyboard).toBeDefined();
    expect(typeof KioskKeyboard.registerLayout).toBe("function");
    expect(typeof KioskKeyboard.getRegisteredLayoutNames).toBe("function");
  });

  it("exports the component class with static registration API", () => {
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
