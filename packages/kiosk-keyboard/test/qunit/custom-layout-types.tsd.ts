import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { LayoutFacet, LayoutRole } from "ui5/kiosk/library";

// Compile-time contract for the `customLayouts` aggregation and the typed properties
// of its children. Nothing here runs: the file is not registered in testsuite.qunit.ts,
// and the assertions are the `@ts-expect-error` directives themselves, each of which
// fails the build if the line it guards stops being an error. `rows`, `variants`,
// `middleware` and `suppress` are declared through `DataType.createType` and
// `layoutRole` through `DataType.registerEnum`, precisely so these are rejected at
// compile time; declared as bare `object` every line below would compile and each
// directive would fail as unused.

const kb = new KioskKeyboard();

// @ts-expect-error rows are a layout definition, never a string
void new CustomLayout({ name: "bad", rows: "nope" });
// @ts-expect-error a key carries its character under `value`
void new CustomLayout({ name: "bad", rows: [[{ label: "a" }]] });
// @ts-expect-error the keycap language is a string
void new CustomLayout({ name: "bad", keycapLang: 42 });
// @ts-expect-error a variant table maps base letters to glyph arrays
void new CustomLayout({ name: "bad", variants: { a: "not-an-array" } });
// @ts-expect-error the role is a closed set, so a typo cannot reach the runtime validator
void new CustomLayout({ name: "bad", layoutRole: "base" });
// @ts-expect-error and so is every suppressible facet
void new CustomLayout({ name: "bad", suppress: ["Varients"] });
// @ts-expect-error locales are BCP-47 prefixes, one per entry
void new CustomLayout({ name: "bad", locales: "pl" });
// @ts-expect-error the aggregation holds CustomLayout elements, not plain records
kb.addCustomLayout({ name: "bad" });

// The accepted shapes, which must keep compiling.
void new KioskKeyboard({
  customLayouts: [
    new CustomLayout({ name: "ok", rows: [[{ value: "a" }]] }),
    new CustomLayout({ name: "ok-overlay", locales: ["de", "de-at"], keycapLang: "he" }),
    new CustomLayout({ name: "numeric", layoutRole: LayoutRole.Base }),
    new CustomLayout({ name: "arabic", suppress: [LayoutFacet.Variants, LayoutFacet.Middleware] }),
    new CustomLayout({
      name: "ko-hangul",
      middleware: () => ({ handleKey: () => false, commit: () => null, reset: () => {} }),
    }),
  ],
  defaultVariants: { a: ["ä"] },
});
kb.addCustomLayout(new CustomLayout({ name: "ok", variants: { a: ["ä"] } }));
kb.setDefaultVariants(null);

// The getters read back as the declared types, with no cast.
const rows = kb.getCustomLayouts()[0]?.getRows();
const role: LayoutRole = kb.getCustomLayouts()[0]!.getLayoutRole();
const facets: LayoutFacet[] = kb.getCustomLayouts()[0]!.getSuppress();
void rows;
void role;
void facets;
