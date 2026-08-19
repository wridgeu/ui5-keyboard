import { describe, it, expect } from "vitest";

// Taken from the element module rather than from core/latin-variants, because the
// re-export at KioskKeyboard.ts is the route consumers use and nothing else in the
// suite exercises it: without this import, deleting that line still typechecks.
import type { VariantTable } from "../../src/KioskKeyboard.js";

// The bundle entry boots the UI5 WC style engine, which reads
// `document.adoptedStyleSheets`. jsdom ships no constructable stylesheets, so
// the array is supplied here before the entry loads.
Object.defineProperty(document, "adoptedStyleSheets", { value: [], writable: true, configurable: true });

// Module-scope import: runs after the property is defined, and keeps the
// entry's transform cost out of the per-test timeout.
const bundle = await import("../../src/bundle.esm.js");

// Regression guard: the bundle entry is the documented consumption surface
// ("kiosk-keyboard-webc/bundle"), so the public value exports must be
// reachable from it, not only from the main KioskKeyboard entry.
describe("bundle.esm public surface", () => {
  it("re-exports both custom-element classes and the public enums", () => {
    expect(bundle.KioskKeyboard).toBeInstanceOf(Function);
    expect(bundle.CustomLayout).toBeInstanceOf(Function);
    expect(bundle.FKeyMode.Virtual).toBe("Virtual");
    expect(bundle.KeyboardType.Full).toBe("Full");
    expect(bundle.MobileKeyboard.Auto).toBe("Auto");
    expect(bundle.LayoutFacet.Variants).toBe("Variants");
    expect(bundle.LayoutRole.Inherit).toBe("Inherit");
  });

  it("re-exports the VariantTable type from the element module", () => {
    const table: VariantTable = { a: ["à", "á"] };
    expect(table.a).toEqual(["à", "á"]);
  });
});
