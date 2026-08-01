import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// Compile-time contract for the four per-instance override properties. Nothing
// here runs: the file is not registered in testsuite.qunit.ts, and the assertions
// are the `@ts-expect-error` directives themselves, each of which fails the build
// if the line it guards stops being an error. The properties are declared through
// `DataType.createType` precisely so these are rejected at compile time; declared
// as bare `object` (the shape before #214) every line below would compile and each
// directive would fail as unused.

const kb = new KioskKeyboard();

// @ts-expect-error a layout entry is rows or a descriptor, never a string
kb.setInstanceLayouts({ bad: "nope" });
// @ts-expect-error a descriptor's lang is a string
kb.setInstanceLayouts({ bad: { rows: [[{ value: "a" }]], lang: 42 } });
// @ts-expect-error a descriptor carries its rows under `rows`
kb.setInstanceLayouts({ bad: { layout: [[{ value: "a" }]] } });
// @ts-expect-error the locale map takes layout names, not layouts
kb.setInstanceLocaleLayouts({ de: [[{ value: "a" }]] });
// @ts-expect-error a variant table maps base letters to glyph arrays
kb.setInstanceVariants({ qwerty: { a: "not-an-array" } });
// @ts-expect-error middleware entries are factory functions
kb.setInstanceMiddleware({ x: {} });

// The accepted shapes, which must keep compiling.
kb.setInstanceLayouts({ ok: [[{ value: "a" }]] });
kb.setInstanceLayouts({ ok: { rows: [[{ value: "a" }]], lang: "he", secondary: true } });
kb.setInstanceLayouts(null);
kb.setInstanceVariants({ qwerty: { a: ["ä"] }, arabic: null });
kb.setInstanceLocaleLayouts({ de: "qwertz-de" });

// The getter reads back as the record it accepts, with no cast.
const layouts = kb.getInstanceLayouts();
const first = layouts?.["ok"];
void first;
