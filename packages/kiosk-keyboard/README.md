# ui5-lib-kiosk-keyboard

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md).

On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications.

A UI5 TypeScript library (`ui5.kiosk`) providing a fully themed, accessible virtual keyboard that types into any UI5 input control. Supports multiple layouts, Shift/Caps Lock, docked mode with auto-show, and integrates with SAP Horizon theming.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Quick Start](#quick-start)
- [KioskKeyboard Control](#kioskkeyboard-control)
  - [Properties](#properties)
  - [Associations](#associations)
  - [Events](#events)
  - [Public Methods](#public-methods)
  - [Static Methods](#static-methods)
- [Layouts](#layouts)
  - [Stable Height](#stable-height)
- [Function Keys (F1-F12)](#function-keys-f1-f12)
- [Locale-Based Default Layout](#locale-based-default-layout)
- [Docked Mode](#docked-mode)
- [Auto-Show](#auto-show)
  - [Input Detection](#input-detection)
- [Auto-Type](#auto-type)
- [inputIds](#inputids)
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

- Built-in layouts: QWERTY, QWERTZ-DE, numeric, special characters, numpad, function keys
- F-key variant layouts: QWERTY-FK and QWERTZ-DE-FK with F1-F12 row on top
- Locale-based default layout (auto-detects from UI5 language setting)
- Runtime layout switching via `{layout:name}` keys
- `keyboardType` property for quick switching between Full, Numeric, and Numpad modes
- Extensible layout definition format (`LayoutDefinition` type)
- Custom layout registration via `registerLayout()`
- Reusable `fkey-row` module for composing custom F-key variant layouts

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

## Getting Started

**1. Add the library dependency to `ui5.yaml`:**

```yaml
framework:
  libraries:
    - name: ui5.kiosk
```

If the library is consumed from npm (not a workspace sibling), also configure `ui5-tooling-transpile` to transpile it:

```yaml
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        transpileDependencies: true
```

**2. Declare the library dependency in `manifest.json`:**

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

**3. Use the control in your view or controller.** See [Quick Start](#quick-start) below.

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

| Property         | Type                       | Default    | Description                                                                                     |
| ---------------- | -------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `layout`         | `string`                   | `"qwerty"` | Active layout name. Auto-detected from locale when omitted. Only for `keyboardType="Full"`.     |
| `keyboardType`   | `ui5.kiosk.KeyboardType`   | `"Full"`   | Display type: `Full`, `Numeric`, or `Numpad`.                                                   |
| `enabled`        | `boolean`                  | `true`     | Whether the keyboard is interactive.                                                            |
| `ariaLabel`      | `string`                   | `""`       | Accessible label for the keyboard group. Defaults to "Virtual Keyboard" from i18n when empty.   |
| `docked`         | `boolean`                  | `false`    | Anchor to the bottom of the viewport with slide animation.                                      |
| `autoShow`       | `boolean`                  | `false`    | Auto-open on input focus, auto-close when focus leaves. Requires `docked`.                      |
| `autoType`       | `boolean`                  | `false`    | Auto-switch between Full/Numpad based on focused input type. Requires `autoShow`.               |
| `mobileKeyboard` | `ui5.kiosk.MobileKeyboard` | `"Custom"` | Native keyboard behavior: `Custom` (suppress), `Native` (defer), `Auto` (device-aware).         |
| `inputIds`       | `string[]`                 | `[]`       | Input control IDs for multi-input targeting. See [inputIds](#inputids).                         |
| `stableHeight`   | `boolean`                  | `false`    | Maintain consistent minimum height across layout switches. See [Stable Height](#stable-height). |

### Associations

| Association   | Type                  | Cardinality | Description                                          |
| ------------- | --------------------- | ----------- | ---------------------------------------------------- |
| `targetInput` | `sap.ui.core.Control` | 0..1        | The input control to type into (e.g. `sap.m.Input`). |

### Events

| Event                | Parameters                                                                      | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `keyPress`           | `key: string`, `shiftKey: boolean`                                              | Fired when a virtual key is pressed. Call `preventDefault()` to skip default input action. |
| `layoutChange`       | `layout: string`                                                                | Fired when the active layout changes.                                                      |
| `keyboardTypeChange` | `keyboardType: string`, `previousKeyboardType: string`, `autoDetected: boolean` | Fired when the keyboard type changes.                                                      |
| `afterOpen`          | —                                                                               | Fired after the docked keyboard has opened.                                                |
| `afterClose`         | —                                                                               | Fired after the docked keyboard has closed.                                                |

### Public Methods

| Method                   | Returns            | Description                                    |
| ------------------------ | ------------------ | ---------------------------------------------- |
| `setTargetInput(target)` | `this`             | Set the target input (no re-render).           |
| `show()`                 | `this`             | Open the docked keyboard. Idempotent.          |
| `close()`                | `this`             | Close the docked keyboard. Idempotent.         |
| `isOpen()`               | `boolean`          | Whether the docked keyboard is currently open. |
| `isShiftActive()`        | `boolean`          | Whether Shift or Caps Lock is active.          |
| `isCapsLock()`           | `boolean`          | Whether Caps Lock is active.                   |
| `resetKeyboardType()`    | `this`             | Clear explicit lock, re-enable auto-type.      |
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
| `getKeyIcon(keyValue)`                 | `string?`           | Default icon URI for a special key value, or `undefined` if none.            |

---

## Layouts

The library ships with eight built-in layouts:

| Layout         | Description                             | Rows |
| -------------- | --------------------------------------- | ---- |
| `qwerty`       | Standard QWERTY with number row         | 5    |
| `qwertz-de`    | German QWERTZ with Umlaute (ä, ö, ü, ß) | 5    |
| `numeric`      | Numbers with basic operators            | 4    |
| `special`      | Special characters and symbols          | 4    |
| `numpad`       | Compact numeric keypad (calculator)     | 5    |
| `fkeys`        | Function keys F1-F12 (standalone)       | 3    |
| `qwerty-fk`    | QWERTY with F1-F12 row on top           | 6    |
| `qwertz-de-fk` | German QWERTZ with F1-F12 row on top    | 6    |

Layout switching is driven by special key values in the layout definition:

```ts
// A key that switches to the numeric layout when tapped
{ value: "{layout:numeric}", label: "123", type: "modifier" }
```

The `keyboardType` property provides a shortcut for common configurations:

- **`Full`** — renders the active `layout` property (default: QWERTY)
- **`Numeric`** — renders the numeric layout regardless of the `layout` property
- **`Numpad`** — renders the numpad layout regardless of the `layout` property

### Stable Height

The `stableHeight` property enables consistent minimum height across layout switches. When enabled, switching from QWERTY (5 rows) to numeric (4 rows) does not shrink the keyboard — the rows expand to fill the available space, providing larger touch targets and preventing layout shifts.

This is **opt-in** (`false` by default) and only effective for non-docked Full keyboards. Docked keyboards always minimize their footprint.

> **When to use `stableHeight`:**
>
> Enable `stableHeight="true"` when the keyboard is rendered inside a **`sap.m.Popover`** or any container that reacts to content height changes. `sap.m.Popover` in particular will close automatically when its content height changes during a resize event on scrolled pages (due to a coordinate-system mismatch in `_applyPosition`). The stable height prevents this by ensuring layout switches never change the keyboard's outer dimensions.
>
> For keyboards embedded **inline on a page** (not in a Popover), `stableHeight` is typically not needed — the surrounding layout can accommodate height changes naturally.

```xml
<!-- Recommended: keyboard inside a Popover -->
<Popover>
  <kiosk:KioskKeyboard stableHeight="true" targetInput="myInput" />
</Popover>

<!-- Default: inline keyboard, no stable height needed -->
<kiosk:KioskKeyboard targetInput="myInput" />
```

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

| Field        | Type     | Description                                                                               |
| ------------ | -------- | ----------------------------------------------------------------------------------------- |
| `value`      | `string` | Character or action (`{backspace}`, `{enter}`, `{shift}`, `{layout:name}`, `{fkey:name}`) |
| `label`      | `string` | Display label (defaults to `value`). Set to `""` for icon-only.                           |
| `shiftLabel` | `string` | Label when Shift is active.                                                               |
| `shiftValue` | `string` | Value when Shift is active (defaults to uppercase of `value`).                            |
| `width`      | `string` | CSS width class: `"1.5"`, `"2"`, `"2.25"`, `"space"`, etc.                                |
| `type`       | `string` | Styling: `"default"`, `"modifier"` (subdued), `"action"` (prominent), `"space"`.          |
| `icon`       | `string` | UI5 icon URI for icon-only keys (e.g. `"sap-icon://arrow-left"`).                         |

---

## Function Keys (F1-F12)

SAP GUI transactions rely heavily on function keys (F1 Help, F3 Back, F4 Value Help, F5 Refresh, F8 Execute). Kiosk and terminal setups that lack physical keyboards need virtual F-key access. The library provides three approaches:

### Approach 1: Fn button on base layouts

The `qwerty` and `qwertz-de` layouts include an **Fn** button on the bottom row. Tapping it switches to the standalone `fkeys` layout (F1-F12 + ABC to return). This is the default — no configuration needed.

### Approach 2: Variant layouts with F-key row

Use `qwerty-fk` or `qwertz-de-fk` to render a full keyboard with an F1-F12 row permanently visible on top (6 rows total):

```xml
<kiosk:KioskKeyboard layout="qwerty-fk" targetInput="myInput" />
```

### Approach 3: Standalone fkeys layout

Use the `fkeys` layout directly for an F-key-only keyboard (F1-F12 + Enter):

```xml
<kiosk:KioskKeyboard layout="fkeys" targetInput="myInput" />
```

### Handling F-key presses

F-keys fire the `keyPress` event but do **not** insert text into the target input. The consuming application decides what each F-key does:

```ts
keyboard.attachKeyPress((event) => {
  switch (event.getParameter("key")) {
    case "F1":
      showHelp();
      break;
    case "F3":
      navigateBack();
      break;
    case "F5":
      refreshData();
      break;
    case "F8":
      executeTransaction();
      break;
  }
});
```

This mirrors how SAP GUI intercepts physical F-keys and maps them to transaction commands. The virtual keyboard fires the event; your application provides the meaning.

### Custom F-key variant layouts

Import the shared `fkey-row` module to compose custom layouts with an F-key row on top — the same row used by the built-in `qwerty-fk` and `qwertz-de-fk` layouts:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import type { LayoutDefinition } from "ui5/kiosk/types";

// Define your custom base layout
const azertyFr: LayoutDefinition = [
  /* ... */
];
KioskKeyboard.registerLayout("azerty-fr", azertyFr);

// Compose a variant with F-keys on top
const azertyFrFk: LayoutDefinition = [fkeyRow, ...azertyFr];
KioskKeyboard.registerLayout("azerty-fr-fk", azertyFrFk);
```

### Custom F-key actions

The `{fkey:*}` syntax is not limited to F1-F12. You can define custom function keys with any name:

```ts
const sapLayout: LayoutDefinition = [
  [
    { value: "{fkey:F1}", label: "Help", type: "modifier" },
    { value: "{fkey:F3}", label: "Back", type: "modifier" },
    { value: "{fkey:F5}", label: "Refresh", type: "modifier" },
    { value: "{fkey:F8}", label: "Execute", type: "action" },
  ],
  // ... rest of the layout
];
```

F-key taps do not auto-release Shift, and the `shiftKey` parameter is passed along so applications can distinguish shifted F-key presses if needed.

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
2. **Closes** when focus leaves all inputs (uses `FocusEvent.relatedTarget` for synchronous close decisions — no timers or debounce).
3. **Stays open** when focus moves between the keyboard and an input, or between two inputs.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" />
```

The auto-show listeners use document-level `focusin`/`focusout` in the capture phase. They are automatically cleaned up on `destroy()`.

### Input Detection

The keyboard recognizes input elements through a two-layer check: **DOM-level detection** (what triggers open/close) and **UI5-level resolution** (what the keyboard types into).

**1. DOM layer — what triggers auto-show:**

The `focusin` handler checks whether the focused DOM element is a **text-entry** `HTMLInputElement` or `HTMLTextAreaElement`. Non-textual input types (checkbox, radio, file, range, color, button, submit, reset, image) and `readonly` inputs are filtered out. Additionally, the element must be owned by a UI5 control (`Element.closestTo()` must resolve) — raw DOM inputs without a UI5 control wrapper are ignored.

| DOM element                                                           | Detected? | Notes                                              |
| --------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| `<input type="text\|search\|url\|tel\|email\|password\|number\|...">` | Yes       | All text-entry types                               |
| `<textarea>`                                                          | Yes       | Multi-line text inputs                             |
| `<input type="checkbox\|radio\|file\|range\|color\|...">`             | No        | Non-textual input types are filtered out           |
| `<input readonly>` / `<textarea readonly>`                            | No        | Read-only inputs cannot be typed into              |
| `<div contenteditable>`                                               | No        | Not an `HTMLInputElement` or `HTMLTextAreaElement` |
| `<select>`                                                            | No        | Not a text input element                           |
| Custom element / Shadow DOM inner `<input>`                           | No\*      | See below                                          |

> \* If a Web Component or custom element renders a native `<input>` in its Shadow DOM, the `focusin` event's `event.target` will be the **host element**, not the inner `<input>`. Since the host element is not an `HTMLInputElement`, the keyboard will not detect it. To work with such components, set `targetInput` explicitly and use `show()`/`close()` programmatically.

**2. UI5 layer — what the keyboard types into:**

Once an `<input>` or `<textarea>` receives focus, the keyboard uses `Element.closestTo(domElement)` to resolve the owning UI5 control. This resolved control becomes the `targetInput`. For typing to work, the control must:

| Requirement     | Method/Property                                                        | Used for                                                                      |
| --------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Required**    | `getFocusDomRef()` returning `HTMLInputElement \| HTMLTextAreaElement` | Reading/writing `.value`, cursor position via `selectionStart`/`selectionEnd` |
| **Recommended** | `setValue(string)` method                                              | Syncs value to both ManagedObject property and DOM                            |
| **Recommended** | `liveChange` event                                                     | Fires after each keystroke for data binding integration                       |
| **Optional**    | `change` event                                                         | Fired on Enter key (simulates form submit)                                    |
| **Optional**    | `getType()` returning `"Number"` or `"Tel"`                            | Auto-type numpad detection                                                    |

All standard `sap.m` input controls (`Input`, `TextArea`, `SearchField`, `StepInput`) satisfy these requirements out of the box.

**Working with custom controls or Web Components:**

If your custom control renders a native `<input>` as its focus DOM ref and is registered in the UI5 Element registry (extends `sap.ui.core.Element`), auto-show works automatically. For anything else, use programmatic control:

```ts
// Custom element that doesn't auto-detect
myCustomInput.attachBrowserEvent("focusin", () => {
  keyboard.setTargetInput(myCustomInput);
  keyboard.show();
});
myCustomInput.attachBrowserEvent("focusout", () => {
  keyboard.close();
});
```

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

## inputIds

The `inputIds` property provides declarative multi-input targeting. Instead of manually calling `setTargetInput()` when focus changes, list all relevant input IDs and the keyboard will automatically target whichever one last received focus.

```xml
<m:Input id="firstName" />
<m:Input id="lastName" />
<m:Input id="email" />

<kiosk:KioskKeyboard inputIds="firstName,lastName,email" />
```

**How it works:**

1. The keyboard attaches a focus delegation to each resolved control.
2. When any of them receives focus, the keyboard sets it as the `targetInput`.
3. IDs are resolved against the parent View first (view-local IDs), then globally — safe for XML views where IDs are prefixed.

**`inputIds` vs `targetInput`:**

| Use case                              | Approach                                |
| ------------------------------------- | --------------------------------------- |
| Single input                          | `targetInput="myInput"`                 |
| Multiple inputs in a form             | `inputIds="field1,field2,field3"`       |
| Dynamic input (determined at runtime) | `setTargetInput(control)` in controller |

When `inputIds` is set, there is no need to also set `targetInput` — the keyboard updates the target association automatically based on focus.

**TypeScript:**

```ts
new KioskKeyboard({
  inputIds: ["firstName", "lastName", "email"],
});
```

---

## Mobile Keyboard Detection

The `mobileKeyboard` property controls whether the KioskKeyboard or the native on-screen keyboard is used.

| Value      | Behavior                                                                                | Use when                                         |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `"Custom"` | Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. **Default.** | Dedicated kiosk terminal (no physical keyboard)  |
| `"Native"` | Always defer to the native keyboard — KioskKeyboard does not open on focus.             | Desktop/mobile app where desktops have keyboards |
| `"Auto"`   | Desktop browsers → use KioskKeyboard. Phone/tablet → defer to native.                   | Kiosk terminal that also serves mobile visitors  |

> **Note:** `"Auto"` relies on `sap/ui/Device` for device detection. Browsers cannot detect whether a physical keyboard is attached, so on any desktop browser — including a regular laptop — the virtual keyboard **will** appear. Use `"Native"` if that is not desired.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Auto" />
```

When the KioskKeyboard is active, it sets `inputmode="none"` on the focused input to suppress the native keyboard, and restores the original value on close.

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

- The keyboard root has `role="group"` with a configurable `aria-label` and `aria-roledescription="keyboard"`
- Each key has `role="button"` with an `aria-label` (resolves to human-readable names for icon-only keys like Backspace and Enter)
- The Shift key has `aria-pressed` reflecting its toggle state
- Arrow keys navigate between virtual keys via roving tabindex; Home/End jump to the first/last key in the current row
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
KeyboardLayout.Numpad; // "numpad"
KeyboardLayout.Fkeys; // "fkeys"
KeyboardLayout.QwertyFk; // "qwerty-fk"
KeyboardLayout.QwertzDeFk; // "qwertz-de-fk"

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
