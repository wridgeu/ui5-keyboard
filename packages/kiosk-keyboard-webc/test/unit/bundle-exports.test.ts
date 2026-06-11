import { describe, it, expect, vi } from "vitest";

// The bundle entry's side-effect imports (Assets boots the UI5 WC style
// engine, KioskKeyboard defines the custom element) cannot run under jsdom.
// They are irrelevant here: this test guards the entry's own re-export
// statements, so both are mocked away and `defineActions` resolves from the
// real types module.
vi.mock("../../src/Assets.js", () => ({}));
vi.mock("../../src/KioskKeyboard.js", () => ({ default: function KioskKeyboard() {} }));

// Regression guard: the bundle entry is the documented consumption surface
// ("kiosk-keyboard-webc/bundle"), so the per-instance action API must be
// reachable from it, not only from the main KioskKeyboard entry.
describe("bundle.esm public surface", () => {
  it("re-exports defineActions as a function", async () => {
    const bundle = await import("../../src/bundle.esm.js");
    expect(typeof bundle.defineActions).toBe("function");
  });
});
