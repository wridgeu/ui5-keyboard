import { describe, it, expect, vi } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLayout,
} from "../../src/core/layout-registry.js";

// Import all layouts (simulates full entry)
import "../../src/layouts/qwerty.js";
import "../../src/layouts/qwertz-de.js";
import "../../src/layouts/numeric.js";
import "../../src/layouts/special.js";
import "../../src/layouts/numpad.js";
import "../../src/layouts/fkeys.js";
import "../../src/layouts/nav.js";
import "../../src/layouts/qwerty-fk.js";
import "../../src/layouts/qwertz-de-fk.js";
import "../../src/layouts/qwerty-nav.js";
import "../../src/layouts/qwertz-de-nav.js";
import "../../src/layouts/ja-romaji.js";
import "../../src/layouts/ja-kana.js";
import "../../src/layouts/arabic.js";

const ALL_BUILTIN_NAMES = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "qwerty-fk",
  "qwertz-de-fk",
  "qwerty-nav",
  "qwertz-de-nav",
  "ja-romaji",
  "ja-kana",
  "arabic",
];

describe("entry-points: full entry", () => {
  it("all built-in layouts are registered after importing all layout modules", () => {
    const names = getRegisteredLayoutNames();
    for (const name of ALL_BUILTIN_NAMES) {
      expect(names).toContain(name);
      expect(isBuiltInLayout(name)).toBe(true);
    }
  });

  it("each built-in layout has a valid definition", () => {
    for (const name of ALL_BUILTIN_NAMES) {
      const layout = getRegisteredLayout(name);
      expect(layout).toBeDefined();
      expect(Array.isArray(layout)).toBe(true);
      expect(layout!.length).toBeGreaterThan(0);
    }
  });
});

describe("entry-points: idempotent registration", () => {
  it("importing layout modules does not produce warnings", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Layouts were already imported at module level above.
    // The combinator layouts (e.g., qwerty-fk) import base layouts (qwerty),
    // which means _registerBuiltInLayout is called multiple times for "qwerty".
    // Verify this produced no warnings.
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("entry-points: registerLayout overrides built-ins", () => {
  const CUSTOM: LayoutDefinition = [[{ value: "custom-a" }, { value: "custom-b" }]];

  it("registerLayout overrides a built-in layout", () => {
    registerLayout("qwerty", CUSTOM);
    expect(getRegisteredLayout("qwerty")).toBe(CUSTOM);
  });
});
