import { describe, it, expect, vi } from "vitest";

// The bundle entry's side-effect imports (Assets boots the UI5 WC style
// engine, KioskKeyboard defines the custom element) cannot run under jsdom.
// They are irrelevant here: this test guards the entry's own re-export
// statements, so both are mocked away and the enum re-exports resolve from
// the real types module.
vi.mock("../../src/Assets.js", () => ({}));
vi.mock("../../src/KioskKeyboard.js", () => ({ default: function KioskKeyboard() {} }));

// Module-scope import: runs after the hoisted vi.mock calls, and keeps the
// entry's transform cost out of the per-test timeout.
const bundle = await import("../../src/bundle.esm.js");

// Regression guard: the bundle entry is the documented consumption surface
// ("kiosk-keyboard-webc/bundle"), so the public value exports must be
// reachable from it, not only from the main KioskKeyboard entry.
describe("bundle.esm public surface", () => {
  it("re-exports the component class and the public enums", () => {
    expect(typeof bundle.KioskKeyboard).toBe("function");
    expect(bundle.FKeyMode.Virtual).toBe("Virtual");
    expect(bundle.KeyboardType.Full).toBe("Full");
    expect(bundle.MobileKeyboard.Auto).toBe("Auto");
  });
});
