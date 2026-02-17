# ui5-lib-kiosk-keyboard

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md).

On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications.

A UI5 TypeScript library (`ui5.kiosk`) providing a fully themed, accessible virtual keyboard that types into any UI5 input control. Supports multiple layouts, Shift/Caps Lock, docked mode with auto-show, and integrates with SAP Horizon theming.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [KioskKeyboard Control](#kioskkeyboard-control)
  - [Properties](#properties)
  - [Associations](#associations)
  - [Events](#events)
  - [Public Methods](#public-methods)
  - [Static Methods](#static-methods)
- [Layouts](#layouts)
- [Locale-Based Default Layout](#locale-based-default-layout)
- [Docked Mode](#docked-mode)
- [Auto-Show](#auto-show)
- [Auto-Type](#auto-type)
- [Mobile Keyboard Detection](#mobile-keyboard-detection)
- [Shift & Caps Lock](#shift--caps-lock)
- [Accessibility](#accessibility)
- [Theming](#theming)
- [When NOT to Use This Library](#when-not-to-use-this-library)

---

## Features

**Core**

- Pure UI5 Control with flat DOM and event delegation (no child controls)
- Types into any UI5 input control (`sap.m.Input`, `sap.m.TextArea`, etc.) via association
- Cursor-aware text insertion, backspace, and selection replacement
- Fires `liveChange` on the target for proper data binding integration
- Shift toggle (single tap) and Caps Lock (double tap) with auto-release

**Layouts**

- Built-in layouts: QWERTY, QWERTZ-DE, numeric, special characters, numpad
- Locale-based default layout (auto-detects from UI5 language setting)
- Runtime layout switching via `{layout:name}` keys
- `keyboardType` property for quick switching between Full, Numeric, and Numpad modes
- Extensible layout definition format (`LayoutDefinition` type)
- Custom layout registration via `registerLayout()`

**Docked Mode**

- Bottom-of-viewport positioning with slide-in/out animation
- `show()` / `close()` API for programmatic control
- Auto-show: opens when any `<input>` or `<textarea>` receives focus, closes when focus leaves

**Smart Context Detection**

- Auto-type: automatically switches to numpad for Number/Tel inputs and StepInput
- Mobile keyboard detection: suppress native keyboard or defer to it on phones/tablets
- Native keyboard suppression via `inputmode="none"` with proper save/restore

**Integration**

- SAP Horizon theming via LESS variables (all key states use `@sapUiButton*` parameters)
- Compact and cozy content density support
- F6 fast navigation group (`data-sap-ui-fastnavgroup`)
- RTL support
- Reduced motion support (`prefers-reduced-motion`)

**Accessibility**

- Roving tabindex for keyboard (arrow key) navigation between virtual keys
- `role="button"` on each key with `aria-label`
- `aria-pressed` toggle state on Shift key
- `aria-disabled` on disabled state
- Configurable `ariaLabel` for the keyboard group

---

## Installation

```bash
npm install ui5-lib-kiosk-keyboard
```

Add the library to your application's `manifest.json`:

```json
{
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "ui5.kiosk": {}
      }
    }
  }
}
```

---

## Quick Start

**XML View:**

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="myInput" value="{/text}" />
  <kiosk:KioskKeyboard targetInput="myInput" />
</mvc:View>
```

**TypeScript:**

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";

const input = new Input({ value: "" });
const keyboard = new KioskKeyboard({
  targetInput: input,
});
```

**Docked with auto-show:**

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" />
```

The keyboard anchors to the bottom of the viewport and automatically opens when any input receives focus.

---

## KioskKeyboard Control

### Properties

| Property         | Type                       | Default              | Description                                                                                 |
| ---------------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `layout`         | `string`                   | `"qwerty"`           | Active layout name. Auto-detected from locale when omitted. Only for `keyboardType="Full"`. |
| `keyboardType`   | `ui5.kiosk.KeyboardType`   | `"Full"`             | Display type: `Full`, `Numeric`, or `Numpad`.                                               |
| `enabled`        | `boolean`                  | `true`               | Whether the keyboard is interactive.                                                        |
| `ariaLabel`      | `string`                   | `"Virtual Keyboard"` | Accessible label for the keyboard group.                                                    |
| `docked`         | `boolean`                  | `false`              | Anchor to the bottom of the viewport with slide animation.                                  |
| `autoShow`       | `boolean`                  | `false`              | Auto-open on input focus, auto-close when focus leaves. Requires `docked`.                  |
| `autoType`       | `boolean`                  | `false`              | Auto-switch between Full/Numpad based on focused input type. Requires `autoShow`.           |
| `mobileKeyboard` | `ui5.kiosk.MobileKeyboard` | `"Custom"`           | Native keyboard behavior: `Custom` (suppress), `Native` (defer), `Auto` (device-aware).     |
| `inputIds`       | `string[]`                 | `[]`                 | Input control IDs for focus delegation targeting.                                           |

### Associations

| Association   | Type                  | Cardinality | Description                                          |
| ------------- | --------------------- | ----------- | ---------------------------------------------------- |
| `targetInput` | `sap.ui.core.Control` | 0..1        | The input control to type into (e.g. `sap.m.Input`). |

### Events

| Event          | Parameters                         | Description                                                                                |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `keyPress`     | `key: string`, `shiftKey: boolean` | Fired when a virtual key is pressed. Call `preventDefault()` to skip default input action. |
| `layoutChange` | `layout: string`                   | Fired when the active layout changes.                                                      |
| `afterOpen`    | —                                  | Fired after the docked keyboard has opened.                                                |
| `afterClose`   | —                                  | Fired after the docked keyboard has closed.                                                |

### Public Methods

| Method                   | Returns            | Description                                    |
| ------------------------ | ------------------ | ---------------------------------------------- |
| `setTargetInput(target)` | `this`             | Set the target input (no re-render).           |
| `show()`                 | `this`             | Open the docked keyboard. Idempotent.          |
| `close()`                | `this`             | Close the docked keyboard. Idempotent.         |
| `isOpen()`               | `boolean`          | Whether the docked keyboard is currently open. |
| `isShiftActive()`        | `boolean`          | Whether Shift or Caps Lock is active.          |
| `isCapsLock()`           | `boolean`          | Whether Caps Lock is active.                   |
| `getResolvedLayout()`    | `LayoutDefinition` | The layout currently being rendered.           |

### Static Methods

| Method                                 | Returns             | Description                                                                  |
| -------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `registerLayout(name, definition)`     | `void`              | Register a custom layout. Built-in layouts cannot be overwritten.            |
| `getRegisteredLayout(name)`            | `LayoutDefinition?` | Get the definition for a layout name, or `undefined`.                        |
| `getRegisteredLayoutNames()`           | `string[]`          | List all registered layout names (built-in + custom).                        |
| `isBuiltInLayout(name)`                | `boolean`           | Whether the given name is a built-in layout.                                 |
| `getLocaleLayout()`                    | `string`            | Detect the best layout for the current UI5 locale. Falls back to `"qwerty"`. |
| `registerLocaleLayout(locale, layout)` | `void`              | Map a BCP-47 tag or prefix (e.g. `"fr"`, `"pt-br"`) to a layout name.        |

---

## Layouts

The library ships with five built-in layouts:

| Layout      | Description                             | Rows |
| ----------- | --------------------------------------- | ---- |
| `qwerty`    | Standard QWERTY with number row         | 5    |
| `qwertz-de` | German QWERTZ with Umlaute (ä, ö, ü, ß) | 5    |
| `numeric`   | Numbers with basic operators            | 4    |
| `special`   | Special characters and symbols          | 4    |
| `numpad`    | Compact numeric keypad (calculator)     | 4    |

Layout switching is driven by special key values in the layout definition:

```ts
// A key that switches to the numeric layout when tapped
{ value: "{layout:numeric}", label: "123", type: "modifier" }
```

The `keyboardType` property provides a shortcut for common configurations:

- **`Full`** — renders the active `layout` property (default: QWERTY)
- **`Numeric`** — renders the numeric layout regardless of the `layout` property
- **`Numpad`** — renders the numpad layout regardless of the `layout` property

### Consistent Height Across Layouts

When using a `Full` keyboard type in **embedded/inline** or **Popover** scenarios, the keyboard maintains a consistent height across all layout switches. Switching from QWERTY (5 rows) to numeric (4 rows) does not shrink the keyboard — the rows expand to fill the available space, providing larger touch targets and preventing layout shifts.

In **docked mode**, consistent height is deliberately disabled so the keyboard shrinks to fit the current layout, minimising the screen area it occupies.

> **Popover note**: `sap.m.Popover` closes automatically when its content height changes during a resize event on scrollable pages (due to a coordinate-system mismatch in `_applyPosition`). The consistent-height behavior prevents this by ensuring layout switches never change the keyboard's outer dimensions. See [`docs/KNOWN-ISSUES.md`](../../docs/KNOWN-ISSUES.md) for details.

### Custom Layouts

Layouts are arrays of rows, where each row is an array of `KeyDefinition` objects:

```ts
import type { LayoutDefinition, KeyDefinition } from "ui5/kiosk/types";

const myLayout: LayoutDefinition = [
  [
    { value: "1" },
    { value: "2" },
    { value: "3" },
    { value: "{backspace}", label: "", icon: "sap-icon://arrow-left", width: "2", type: "action" },
  ],
  [{ value: "{enter}", label: "Enter", width: "2", type: "action" }],
];
```

**KeyDefinition fields:**

| Field        | Type     | Description                                                                      |
| ------------ | -------- | -------------------------------------------------------------------------------- |
| `value`      | `string` | Character or action (`{backspace}`, `{enter}`, `{shift}`, `{layout:name}`)       |
| `label`      | `string` | Display label (defaults to `value`). Set to `""` for icon-only.                  |
| `shiftLabel` | `string` | Label when Shift is active.                                                      |
| `shiftValue` | `string` | Value when Shift is active (defaults to uppercase of `value`).                   |
| `width`      | `string` | CSS width class: `"1.5"`, `"2"`, `"2.25"`, `"space"`, etc.                       |
| `type`       | `string` | Styling: `"default"`, `"modifier"` (subdued), `"action"` (prominent), `"space"`. |
| `icon`       | `string` | UI5 icon URI for icon-only keys (e.g. `"sap-icon://arrow-left"`).                |

---

## Locale-Based Default Layout

When no explicit `layout` is provided, the keyboard auto-detects the appropriate layout from the UI5 locale. This uses `Localization.getLanguageTag()` from `sap/base/i18n/Localization`, which resolves from all UI5 language sources (URL `sap-ui-language` param, bootstrap config, browser settings).

**Resolution order:**

1. Exact BCP-47 match (e.g. `"de-at"`)
2. Language prefix (e.g. `"de"`)
3. Fallback to `"qwerty"`

**Built-in mappings:**

| Language | Layout      |
| -------- | ----------- |
| `de`     | `qwertz-de` |

Additional mappings can be registered at runtime:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// Register before creating any keyboard instances
KioskKeyboard.registerLocaleLayout("fr", "azerty-fr");
KioskKeyboard.registerLocaleLayout("pt-br", "custom-pt-br");
```

An explicit `layout` property always takes priority over locale detection:

```xml
<!-- Uses QWERTY regardless of locale -->
<kiosk:KioskKeyboard layout="qwerty" />

<!-- Uses locale-detected layout (e.g. QWERTZ-DE for German) -->
<kiosk:KioskKeyboard />
```

---

## Docked Mode

When `docked="true"`, the keyboard anchors to the bottom of the viewport with a slide-in/out transition:

```ts
const keyboard = new KioskKeyboard({ docked: true });
keyboard.placeAt("content");

// Programmatic control
keyboard.show(); // slides in
keyboard.close(); // slides out
```

Both `show()` and `close()` are idempotent — calling them multiple times has no effect. They fire `afterOpen` and `afterClose` events respectively.

The docked keyboard uses `position: fixed` with `z-index: 100` and a `box-shadow` for visual separation.

---

## Auto-Show

When `autoShow="true"` (requires `docked="true"`), the keyboard automatically:

1. **Opens** when any `<input>` or `<textarea>` on the page receives focus, setting it as the target.
2. **Closes** when focus leaves all inputs (with a 200ms debounce to handle focus transitions).
3. **Stays open** when focus moves between the keyboard and an input.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" />
```

The auto-show listeners use document-level `focusin`/`focusout` in the capture phase. They are automatically cleaned up on `destroy()`.

---

## Auto-Type

When `autoType="true"` (requires `autoShow="true"`), the keyboard inspects the focused input's metadata and automatically switches between Full and Numpad keyboard types.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" />
```

**Detection order** (first match wins):

1. UI5 control `getType()` — `"Number"` or `"Tel"` → Numpad
2. UI5 control name — `sap.m.StepInput` → Numpad
3. DOM `inputmode` attribute — `"numeric"`, `"decimal"`, or `"tel"` → Numpad
4. HTML `type` attribute — `"number"` or `"tel"` → Numpad
5. Fallback → Full

When the user tabs from a numeric input to a text input, the keyboard switches back to Full automatically.

**Explicit override:** Setting `keyboardType` explicitly (via XML, constructor, or `setKeyboardType()`) disables auto-type detection. The keyboard respects the explicit type and never overrides it.

---

## Mobile Keyboard Detection

The `mobileKeyboard` property controls how the keyboard interacts with native virtual keyboards on mobile/touch devices.

| Value      | Behavior                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- |
| `"Custom"` | Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. **Default.**     |
| `"Native"` | On phones and tablets, defer to the native keyboard entirely (KioskKeyboard does not show). |
| `"Auto"`   | Desktop/kiosk → use KioskKeyboard. Phone/tablet → defer to native.                          |

```xml
<!-- Suppress native keyboard on all devices (kiosk use case) -->
<kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Custom" />

<!-- Let mobile devices use their native keyboard -->
<kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Auto" />
```

When `mobileKeyboard` is `"Custom"`, the keyboard sets `inputmode="none"` on the focused input's DOM element when it opens, and restores the original `inputmode` when it closes. This suppression is transparent and does not affect the input's value or behavior.

---

## Shift & Caps Lock

The Shift key follows a three-state cycle:

1. **Off** — default state
2. **Shift** (single tap) — next character is uppercase, then auto-releases
3. **Caps Lock** (double tap) — all characters uppercase until toggled off

```
Tap Shift  →  Shift active (single character)
Tap Shift  →  Caps Lock on (sticky)
Tap Shift  →  Off
```

When Shift is active, the renderer shows uppercase labels and the Shift key gets the `ui5KioskKey--active` CSS class.

---

## Accessibility

- The keyboard root has `role="group"` with a configurable `aria-label`
- Each key has `role="button"` with an `aria-label` (resolves to human-readable names for icon-only keys like Backspace and Enter)
- The Shift key has `aria-pressed` reflecting its toggle state
- Arrow keys navigate between virtual keys via roving tabindex
- The keyboard is an F6 navigation group (`data-sap-ui-fastnavgroup="true"`)
- Disabled state applies `aria-disabled="true"` to both the root and individual keys

---

## Theming

The control uses SAP LESS theme parameters for all visual states:

| Element       | Parameters Used                                            |
| ------------- | ---------------------------------------------------------- |
| Default keys  | `@sapUiButton{Background,TextColor,BorderColor}`           |
| Modifier keys | `@sapUiButtonLite{Background,TextColor,BorderColor}`       |
| Action keys   | `@sapUiButtonEmphasized{Background,TextColor,BorderColor}` |
| Active Shift  | `@sapUiButtonEmphasized{Background,TextColor,BorderColor}` |
| Focus ring    | `@sapUiContentFocusColor`                                  |

Supported themes: `sap_horizon`, `sap_horizon_dark`, `sap_horizon_hcb`, `sap_horizon_hcw`.

Both `compact` and `cozy` content densities are supported with adjusted key heights and spacing.

---

## Library Enums

The library registers proper UI5 enums via `DataType.registerEnum()`:

```ts
import { KeyboardLayout, KeyboardType, MobileKeyboard } from "ui5/kiosk/library";

// KeyboardLayout — built-in layout identifiers
KeyboardLayout.Qwerty; // "qwerty"
KeyboardLayout.QwertzDe; // "qwertz-de"
KeyboardLayout.Numeric; // "numeric"
KeyboardLayout.Special; // "special"

// KeyboardType — keyboard display type
KeyboardType.Full; // "Full"
KeyboardType.Numeric; // "Numeric"
KeyboardType.Numpad; // "Numpad"

// MobileKeyboard — native keyboard behavior
MobileKeyboard.Custom; // "Custom"
MobileKeyboard.Native; // "Native"
MobileKeyboard.Auto; // "Auto"
```

---

## Further Reading

- [Architecture & Internals](../../docs/KIOSK-ARCHITECTURE.md) — control design, rendering, theming approach

---

## When NOT to Use This Library

| Scenario                            | Use Instead                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| Desktop-only application            | Physical keyboard (no virtual keyboard needed)                        |
| Mobile browser with native keyboard | Set `mobileKeyboard="Auto"` to defer to the native keyboard on mobile |
| Complex IME input (CJK)             | Native OS input methods                                               |
| Rich text editing                   | Dedicated rich text editor controls                                   |

This library is designed for **kiosk terminals**, **industrial touchscreens**, and **point-of-sale** applications where the OS does not provide a virtual keyboard or where a controlled input experience is required. For mixed desktop/mobile use, set `mobileKeyboard="Auto"` to let mobile devices use their native keyboard.

---

## License

[MIT](../../LICENSE)
