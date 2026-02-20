# Feature: Function Key Row (F1-F12)

## Overview

Add an optional row of function keys (F1 through F12) to the kiosk keyboard. Function keys are common in industrial/kiosk terminals where SAP transactions rely on F-key shortcuts (e.g. F8 = Execute, F3 = Back).

## Motivation

- SAP GUI transactions map heavily to F-keys (F1 Help, F3 Back, F4 Value Help, F5 Refresh, F8 Execute, etc.)
- Kiosk/terminal setups often lack physical keyboards — the virtual keyboard must provide F-key access
- Touch devices in warehouse/shop-floor scenarios need F-keys for SAP transaction navigation

## Design

### New built-in layout: `fkeys`

A standalone layout containing F1-F12 in two rows, accessible via `{layout:fkeys}` from other layouts.

```
┌────┬────┬────┬────┬────┬────┐
│ F1 │ F2 │ F3 │ F4 │ F5 │ F6 │
├────┼────┼────┼────┼────┼────┤
│ F7 │ F8 │ F9 │F10 │F11 │F12 │
├─────────┴────┴────┴─────────┤
│  ABC              {enter}   │
└─────────────────────────────┘
```

### Layout definition

```ts
// src/layouts/fkeys.ts
import type { LayoutDefinition } from "../types";

const fkeys: LayoutDefinition = [
  [{ value: "F1" }, { value: "F2" }, { value: "F3" }, { value: "F4" }, { value: "F5" }, { value: "F6" }],
  [{ value: "F7" }, { value: "F8" }, { value: "F9" }, { value: "F10" }, { value: "F11" }, { value: "F12" }],
  [
    { value: "{layout:base}", label: "ABC", width: "2", type: "modifier" },
    { value: "{enter}", label: "OK", width: "2", type: "action" },
  ],
];

export default fkeys;
```

### Key behavior

F-keys are **not** text-insertion keys. They fire the `keyPress` event with `key: "F1"` through `key: "F12"` but do **not** insert text into the target input. This matches how physical F-keys behave — the consuming application decides what action to take.

This requires a change in the key-press handler. Currently all non-special keys call `_insertText()`. F-keys need to:

1. Fire the `keyPress` event (so the app can react)
2. Skip `_insertText()` (no character to insert)

### Approach: `{fkey:N}` action syntax

Extend the special-value system with a new action pattern:

```ts
// New SpecialKeyValue addition:
export type SpecialKeyValue = "{backspace}" | "{enter}" | "{shift}" | `{layout:${string}}` | `{fkey:${string}}`; // ← new
```

Layout definition then becomes:

```ts
{ value: "{fkey:F1}", label: "F1" }
{ value: "{fkey:F2}", label: "F2" }
// ...
```

The handler matches `{fkey:*}`, fires `keyPress` with the extracted key name, and does not insert text.

**Alternative**: Use plain `value: "F1"` and detect multi-char values that start with `F` followed by digits. This is simpler but fragile — it conflates key identity with text content. The `{fkey:*}` pattern is explicit and consistent with existing `{layout:*}` convention.

### Integration with existing layouts

Add a layout-switch key to the bottom row of `qwerty` and `qwertz-de`:

```ts
// qwerty row 5 becomes:
[
  { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
  { value: ",", shiftLabel: "<", shiftValue: "<" },
  { value: " ", label: "Space", width: "space", type: "space" },
  { value: ".", shiftLabel: ">", shiftValue: ">" },
  { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" }, // replaces #+=
];
```

> **Open question**: Does `Fn` replace the `#+=` (special) key, or should we add a fourth button? Replacing keeps the row balanced. If both are needed, the bottom row gets 5 buttons and the space bar shrinks.

### Registration

Register as a built-in layout (not overwritable):

```ts
// src/layouts/index.ts
import fkeys from "./fkeys";

const layouts: Record<string, LayoutDefinition> = {
  qwerty,
  "qwertz-de": qwertzDe,
  numeric,
  special,
  numpad,
  fkeys, // ← new
};
```

Add `"fkeys"` to `_BUILTIN_LAYOUTS` in `KioskKeyboard.ts` and to `SECONDARY_LAYOUTS` in `types.ts` (it's a secondary view, not a base alphabetic layout).

## Scope

### In scope

- New `fkeys` built-in layout with F1-F12
- `{fkey:*}` special action syntax
- Handler logic: fire `keyPress`, skip text insertion
- Layout-switch button added to qwerty / qwertz-de bottom rows
- QUnit tests for the new layout and key handling
- Demo page update showing F-key usage

### Out of scope (future)

- Modifier combos (Ctrl+F4, Alt+F5) — would need a Ctrl/Alt modifier key first
- Configurable F-key labels (e.g. "Help" on F1, "Back" on F3) — apps can use `registerLayout` with custom labels today
- Escape / Tab / arrow keys — separate feature

## Files to change

| File                            | Change                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| `src/types.ts`                  | Add `{fkey:${string}}` to `SpecialKeyValue`                     |
| `src/layouts/fkeys.ts`          | New file — layout definition                                    |
| `src/layouts/index.ts`          | Export `fkeys` layout                                           |
| `src/KioskKeyboard.ts`          | Handle `{fkey:*}` in key-press logic; add to `_BUILTIN_LAYOUTS` |
| `src/layouts/qwerty.ts`         | Add `Fn` button to bottom row                                   |
| `src/layouts/qwertz-de.ts`      | Add `Fn` button to bottom row                                   |
| `test/qunit/FKeys.qunit.ts`     | Tests for F-key press events, no text insertion                 |
| `test/qunit/testsuite.qunit.ts` | Register new test                                               |
| Demo app view/controller        | Showcase F-key event handling                                   |

## Open questions

1. **Bottom row layout**: Replace `#+=` with `Fn`, or add a fourth button alongside it?
2. **F-key visual style**: Use `type: "default"` (standard key look) or `type: "modifier"` (subdued)? Modifier makes sense since F-keys are function triggers, not text.
3. **Shift behavior**: Should Shift have any effect on F-keys? (Probably not — F-keys are typically shift-agnostic on physical keyboards.)
