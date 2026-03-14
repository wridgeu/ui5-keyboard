# ui5-lib-kiosk-keyboard

> Part of the [ui5-lib-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md) and [kiosk-keyboard-webc](../kiosk-keyboard-webc/README.md).

On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications.

> [!IMPORTANT]
> **Minimum UI5 version: 1.120**: requires `Lib.init()` (1.118), `DataType.registerEnum()` and `Localization.getLanguageTag()` (both 1.120).

A UI5 TypeScript library (`ui5.kiosk`) providing a fully themed, accessible virtual keyboard that types into any UI5 input control. Supports multiple layouts, Shift/Caps Lock, docked mode with auto-show, and integrates with SAP Horizon theming.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Quick Start](#quick-start)
- [API Stability](#api-stability)
- [KioskKeyboard Control](#kioskkeyboard-control)
  - [Properties](#properties)
  - [Associations](#associations)
  - [Events](#events)
  - [Public Methods (Common)](#public-methods-common)
  - [Public Methods (Complete)](#public-methods-complete)
  - [Static Methods (Complete)](#static-methods-complete)
- [Layouts](#layouts)
  - [Stable Height](#stable-height)
  - [Custom Layouts](#custom-layouts)
- [Function Keys (F1-F12)](#function-keys-f1-f12)
- [Locale-Based Default Layout](#locale-based-default-layout)
- [Docked Mode](#docked-mode)
- [Auto-Show](#auto-show)
  - [Input Detection](#input-detection)
- [Interop Cookbook](#interop-cookbook)
- [Auto-Type](#auto-type)
- [inputIds](#inputids)
- [Custom Target Resolver](#custom-target-resolver)
- [Mobile Keyboard Detection](#mobile-keyboard-detection)
- [Shift & Caps Lock](#shift--caps-lock)
- [Accessibility](#accessibility)
- [Theming](#theming)
- [Internationalization (i18n)](#internationalization-i18n)
  - [i18n Extension API](#i18n-extension-api)
- [Library Enums & Constants](#library-enums--constants)
- [Further Reading](#further-reading)
- [Troubleshooting](#troubleshooting)
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

- Built-in layouts: QWERTY, QWERTZ-DE, numeric, special characters, numpad, function keys, navigation keys
- Variant layouts: QWERTY-FK/QWERTZ-DE-FK and QWERTY-NAV/QWERTZ-DE-NAV
- Locale-based default layout (auto-detects from UI5 language setting)
- Runtime layout switching via `{layout:name}` keys
- `keyboardType` property for quick switching between Full, Numeric, and Numpad modes
- Extensible layout definition format (`LayoutDefinition` type)
- Custom layout registration via `registerLayout()`
- Reusable `fkey-row` and `nav-row` modules for composing custom variant layouts

**Docked Mode**

- Bottom-of-viewport positioning with slide-in/out animation
- `show()` / `close()` API for programmatic control
- Auto-show: opens when any `<input>` or `<textarea>` receives focus, closes when focus leaves

**Smart Context Detection**

- Auto-type: automatically switches to numpad for Number/Tel inputs and StepInput
- Mobile keyboard detection: suppress native keyboard or defer to it on phones/tablets
- Native keyboard suppression via `inputmode="none"` with ref-counted restore across keyboard instances

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

> This package is currently workspace-only (`private: true`) and not published to npm.

In this monorepo, dependencies are managed via npm workspaces:

```bash
npm install
```

If/when this package is published, you can install it directly from npm (`ui5-lib-kiosk-keyboard`).

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

## API Stability

Recommended stable consumer imports:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardLayout, KeyboardType, KeyName, MobileKeyboard, FKeyMode } from "ui5/kiosk/library";
import type { KeyDefinition, LayoutDefinition } from "ui5/kiosk/types";
```

Advanced/internal modules are available but should not be treated as a semver-stable API surface. In particular, anything under `ui5/kiosk/internal/*` is internal-only. This includes renderer internals and helper modules such as input operations and low-level DOM utilities. Under `ui5/kiosk/layouts/*`, only `ui5/kiosk/layouts/fkey-row` and `ui5/kiosk/layouts/nav-row` are supported as stable consumer imports for composing custom variant layouts. These rows omit `type` (defaulting to regular keys with visible borders); set `type: "modifier"` on individual keys to get the transparent Lite button style instead.

## FLP Lifecycle (Module Cache)

In SAP Fiori launchpad (single-page shell), modules are cached and reused between app launches. Keep these rules in mind:

- Controls inside the normal view/control tree are destroyed by UI5 and clean up automatically.
- Programmatically created keyboards outside the view tree (for example `placeAt("sap-ui-static")`) must be destroyed explicitly in `Component.destroy()`.
- App-specific layout registrations are module-level state and survive app reopen in FLP.
- Technical note: cleanup of layout/locale registrations is optional. Re-registering the same custom layout names is blocked, and reapplying locale mappings is typically harmless.
- For deterministic per-app state (and especially dynamic registration names), cleanup is still recommended in `Component.destroy()` with:
  - `KioskKeyboard.unregisterLayout(name)` / `KioskKeyboard.unregisterLocaleLayout(locale)` for targeted cleanup, or
  - `KioskKeyboard.resetCustomLayouts()` / `KioskKeyboard.resetLocaleLayouts()` to reset to built-in defaults.

## KioskKeyboard Control

### Properties

| Property         | Type                       | Default     | Description                                                                                            |
| ---------------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `layout`         | `string`                   | `"qwerty"`  | Active layout name. Auto-detected from locale when omitted. Only for `keyboardType="Full"`.            |
| `keyboardType`   | `ui5.kiosk.KeyboardType`   | `"Full"`    | Display type: `Full`, `Numeric`, or `Numpad`.                                                          |
| `enabled`        | `boolean`                  | `true`      | Whether the keyboard is interactive.                                                                   |
| `ariaLabel`      | `string`                   | `""`        | Accessible label for the keyboard group. Defaults to "Virtual Keyboard" from i18n when empty.          |
| `docked`         | `boolean`                  | `false`     | Anchor to the bottom of the viewport with slide animation.                                             |
| `autoShow`       | `boolean`                  | `false`     | Auto-open on input focus, auto-close when focus leaves. Requires `docked`.                             |
| `autoType`       | `boolean`                  | `false`     | Auto-switch between Full/Numpad based on focused input type. Requires `autoShow`.                      |
| `mobileKeyboard` | `ui5.kiosk.MobileKeyboard` | `"Custom"`  | Native keyboard behavior: `Custom` (suppress), `Native` (defer), `Auto` (device-aware).                |
| `fKeyMode`       | `ui5.kiosk.FKeyMode`       | `"Virtual"` | F-key handling: `Virtual` (emit `keyPress`) or `Native` (dispatch synthetic keydown + native actions). |
| `inputIds`       | `string[]`                 | `[]`        | Input control IDs for multi-input targeting. See [inputIds](#inputids).                                |
| `stableHeight`   | `boolean`                  | `false`     | Maintain consistent minimum height across layout switches. See [Stable Height](#stable-height).        |

### Associations

| Association       | Type                  | Cardinality | Description                                                  |
| ----------------- | --------------------- | ----------- | ------------------------------------------------------------ |
| `targetInput`     | `sap.ui.core.Control` | 0..1        | The input control to type into (e.g. `sap.m.Input`).         |
| `ariaLabelledBy`  | `sap.ui.core.Control` | 0..n        | Additional labels announced by assistive technologies.       |
| `ariaDescribedBy` | `sap.ui.core.Control` | 0..n        | Additional descriptions announced by assistive technologies. |

### Events

| Event                | Parameters                                                                      | Description                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `keyPress`           | `key: string`, `shiftKey: boolean`                                              | Fired when a virtual key is pressed. Call `preventDefault()` to skip default input action. Use `KeyName` constants for non-character keys. |
| `layoutChange`       | `layout: string`                                                                | Fired when the active layout changes.                                                                                                      |
| `keyboardTypeChange` | `keyboardType: string`, `previousKeyboardType: string`, `autoDetected: boolean` | Fired when the keyboard type changes.                                                                                                      |
| `afterOpen`          | -                                                                               | Fired when `show()` opens the docked keyboard (state/event hook, not CSS transition end).                                                  |
| `afterClose`         | -                                                                               | Fired when `close()` closes the docked keyboard (state/event hook, not CSS transition end).                                                |

### Public Methods (Common)

| Method                     | Returns           | Description                                                                 |
| -------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `setLayout(layout)`        | `this`            | Set active layout (effective when `keyboardType="Full"`).                   |
| `getBaseLayout()`          | `string`          | Get the tracked base (alphabetic) layout used by `{layout:base}`.           |
| `resetLayout()`            | `this`            | Switch back to the tracked base layout.                                     |
| `setKeyboardType(type)`    | `this`            | Set keyboard display type (`Full`, `Numeric`, `Numpad`) and lock auto-type. |
| `isKeyboardTypeExplicit()` | `boolean`         | Whether keyboardType is explicitly locked (auto-type disabled).             |
| `setAutoShow(autoShow)`    | `this`            | Enable/disable focus-driven open/close behavior (docked mode).              |
| `setDocked(docked)`        | `this`            | Enable/disable docked positioning and related open state handling.          |
| `setTargetInput(target)`   | `this`            | Set the target input (no re-render).                                        |
| `show()`                   | `this`            | Open the docked keyboard. Idempotent.                                       |
| `close()`                  | `this`            | Close the docked keyboard. Idempotent.                                      |
| `isOpen()`                 | `boolean`         | Whether the docked keyboard is currently open.                              |
| `getTargetControl()`       | `Control \| null` | Resolve the associated target input to a control instance (typed helper).   |
| `resetKeyboardType()`      | `this`            | Clear explicit lock, re-enable auto-type.                                   |

### Public Methods (Complete)

Complete list of KioskKeyboard-specific public instance methods (excluding inherited UI5 base class methods):

| Method                     | Returns           | Description                                                                             |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `setLayout(layout)`        | `this`            | Set active layout (effective when `keyboardType="Full"`).                               |
| `getBaseLayout()`          | `string`          | Get the tracked base (alphabetic) layout used by `{layout:base}`.                       |
| `resetLayout()`            | `this`            | Switch back to the tracked base layout.                                                 |
| `setKeyboardType(type)`    | `this`            | Set keyboard display type (`Full`, `Numeric`, `Numpad`) and lock auto-type.             |
| `isKeyboardTypeExplicit()` | `boolean`         | Whether keyboardType is explicitly locked (auto-type disabled).                         |
| `resetKeyboardType()`      | `this`            | Clear explicit lock, re-enable auto-type.                                               |
| `setAutoShow(autoShow)`    | `this`            | Enable/disable focus-driven open/close behavior (docked mode).                          |
| `setDocked(docked)`        | `this`            | Enable/disable docked positioning and related open state handling.                      |
| `setTargetInput(target)`   | `this`            | Set the target input (no re-render).                                                    |
| `show()`                   | `this`            | Open the docked keyboard. Idempotent.                                                   |
| `close()`                  | `this`            | Close the docked keyboard. Idempotent.                                                  |
| `isOpen()`                 | `boolean`         | Whether the docked keyboard is currently open.                                          |
| `getTargetControl()`       | `Control \| null` | Resolve the associated target input to a control instance (typed helper).               |
| `getFocusDomRef()`         | `Element \| null` | Returns the keyboard root DOM reference used for focus handling.                        |
| `getFocusInfo()`           | `object`          | Returns focus state snapshot for UI5 focus restoration.                                 |
| `applyFocusInfo(info)`     | `this`            | Restores focus state snapshot previously returned by `getFocusInfo()`.                  |
| `getAccessibilityInfo()`   | `object`          | Returns UI5 accessibility metadata for assistive technologies.                          |
| `setTargetResolver(fn)`    | `this`            | Set an instance-level custom resolver for locating native inputs. Pass `null` to clear. |
| `getTargetResolver()`      | `Function\|null`  | Returns the instance-level target resolver, or `null`.                                  |

For full generated typings (including property/event accessors from UI5 metadata), see [`src/KioskKeyboard.gen.d.ts`](src/KioskKeyboard.gen.d.ts) (regenerated by `npm run generate`).

### Static Methods (Complete)

| Method                                 | Returns                             | Description                                                                    |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `registerLayout(name, definition)`     | `void`                              | Register a custom layout. Built-in layouts cannot be overwritten.              |
| `unregisterLayout(name)`               | `void`                              | Remove a previously registered custom layout. Built-in layouts are protected.  |
| `resetCustomLayouts()`                 | `void`                              | Remove all custom layouts and keep built-in layouts.                           |
| `getRegisteredLayout(name)`            | `LayoutDefinition?`                 | Get the definition for a layout name, or `undefined`.                          |
| `getRegisteredLayoutNames()`           | `string[]`                          | List all registered layout names (built-in + custom).                          |
| `isBuiltInLayout(name)`                | `boolean`                           | Whether the given name is a built-in layout.                                   |
| `isSecondaryLayout(name)`              | `boolean`                           | Whether the layout is secondary (non-alphabetic, e.g. `numeric`, `fkeys`).     |
| `getLocaleLayout()`                    | `string`                            | Detect the best layout for the current UI5 locale. Falls back to `"qwerty"`.   |
| `registerLocaleLayout(locale, layout)` | `void`                              | Map a BCP-47 tag or prefix (e.g. `"fr"`, `"pt-br"`) to a layout name.          |
| `unregisterLocaleLayout(locale)`       | `void`                              | Remove one locale-to-layout mapping.                                           |
| `resetLocaleLayouts()`                 | `void`                              | Reset locale mappings to built-in defaults.                                    |
| `getKeyIcon(keyValue)`                 | `string?`                           | Default icon URI for a special key value, or `undefined` if none.              |
| `configureI18n(config)`                | `Promise<void>`                     | Set enhancement bundles and locale metadata for i18n extensibility.            |
| `resetI18nConfiguration()`             | `void`                              | Clear enhancement config and cancel in-flight loads (not the hook).            |
| `setI18nOverrideHook(fn)`              | `boolean`                           | Register a per-key text override hook (replaces any previous hook).            |
| `clearI18nOverrideHook()`              | `void`                              | Remove the active i18n override hook.                                          |
| `getI18nConfiguration()`               | `Readonly<KioskI18nConfig> \| null` | Frozen snapshot of the active i18n config (for debugging).                     |
| `setGlobalTargetResolver(fn)`          | `void`                              | Set a global custom resolver for locating native inputs. Pass `null` to clear. |
| `getGlobalTargetResolver()`            | `Function \| null`                  | Returns the global target resolver, or `null`.                                 |

---

## Layouts

The library ships with eleven built-in layouts:

| Layout          | Description                              | Rows |
| --------------- | ---------------------------------------- | ---- |
| `qwerty`        | Standard QWERTY with number row          | 5    |
| `qwertz-de`     | German QWERTZ with Umlaute (ä, ö, ü, ß)  | 5    |
| `numeric`       | Numbers with basic operators             | 4    |
| `special`       | Special characters and symbols           | 4    |
| `numpad`        | Compact numeric keypad (calculator)      | 5    |
| `fkeys`         | Function keys F1-F12 (standalone)        | 3    |
| `nav`           | Navigation keys (arrows, Home/End, Pg)   | 4    |
| `qwerty-fk`     | QWERTY with F1-F12 row on top            | 6    |
| `qwertz-de-fk`  | German QWERTZ with F1-F12 row on top     | 6    |
| `qwerty-nav`    | QWERTY with navigation row on top        | 6    |
| `qwertz-de-nav` | German QWERTZ with navigation row on top | 6    |

Layout switching is driven by special key values in the layout definition:

```ts
// A key that switches to the numeric layout when tapped
{ value: "{layout:numeric}", label: "123", type: "modifier" }
```

The `keyboardType` property provides a shortcut for common configurations:

- **`Full`**: renders the active `layout` property (default: QWERTY)
- **`Numeric`**: renders the numeric layout regardless of the `layout` property
- **`Numpad`**: renders the numpad layout regardless of the `layout` property

Programmatic base-layout helpers make layout round-trips explicit:

```ts
const kb = this.byId("keyboard") as KioskKeyboard;

kb.setLayout("qwertz-de");
kb.setLayout("numeric");

kb.getBaseLayout(); // "qwertz-de"
kb.resetLayout(); // back to qwertz-de
```

### Stable Height

The `stableHeight` property enables consistent minimum height across layout switches. When enabled, switching from QWERTY (5 rows) to numeric (4 rows) does not shrink the keyboard: the rows expand to fill the available space, providing larger touch targets and preventing layout shifts.

This is **opt-in** (`false` by default) and only effective for non-docked Full keyboards. Docked keyboards always minimize their footprint.

> **When to use `stableHeight`:**
>
> Enable `stableHeight="true"` when the keyboard is rendered inside a **`sap.m.Popover`** or any container that reacts to content height changes. `sap.m.Popover` in particular will close automatically when its content height changes during a resize event on scrolled pages (due to a coordinate-system mismatch in `_applyPosition`). The stable height prevents this by ensuring layout switches never change the keyboard's outer dimensions.
>
> For keyboards embedded **inline on a page** (not in a Popover), `stableHeight` is typically not needed; the surrounding layout can accommodate height changes naturally.
>
> **Latch behavior:** `stableHeight` records the maximum observed height and never shrinks automatically, even after a container resize or orientation change. This is by design: the keyboard cannot distinguish a container resize from a layout switch. If you need to reset after an orientation change, toggle the property off and on (`setStableHeight(false); setStableHeight(true);`).

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

The `qwerty` and `qwertz-de` layouts include an **Fn** button on the bottom row. Tapping it switches to the standalone `fkeys` layout (F1-F12 + ABC to return). This is the default, no configuration needed.

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

### Navigation keys

Use the `nav` layout for directional/navigation keys (Arrow keys, Home/End, PageUp/PageDown):

```xml
<kiosk:KioskKeyboard layout="nav" targetInput="myInput" />
```

Or use `qwerty-nav` / `qwertz-de-nav` for integrated top-row navigation.

Navigation keys fire `keyPress` and also perform default caret navigation on the target input/textarea:

- `ArrowLeft` / `ArrowRight`: move caret by one character
- `ArrowUp` / `ArrowDown`: move caret vertically for multiline text
- `Home` / `End`: jump to start/end
- `PageUp` / `PageDown`: jump to start/end

For single-line inputs, `ArrowUp` and `ArrowDown` do not change the caret.

If your app handles these keys itself, call `preventDefault()` on `keyPress` to suppress the built-in navigation behavior.

### Handling F-key presses

F-keys fire the `keyPress` event but do **not** insert text into the target input. The consuming application decides what each F-key does:

```ts
import { KeyName } from "ui5/kiosk/library";

keyboard.attachKeyPress((event) => {
  switch (event.getParameter("key")) {
    case KeyName.F1:
      showHelp();
      break;
    case KeyName.F3:
      navigateBack();
      break;
    case KeyName.F5:
      refreshData();
      break;
    case KeyName.F8:
      executeTransaction();
      break;
  }
});
```

### Opt-in native F-key behavior

Set `fKeyMode="Native"` to opt into browser-style F-key handling.

- The keyboard dispatches a synthetic `keydown` for the F-key.
- If that event is not `preventDefault()`'d, built-in native actions run for:
  - `F5`: `location.reload()`
  - `F11`: fullscreen toggle
- `keyPress` still fires afterward for compatibility.

```xml
<kiosk:KioskKeyboard layout="qwerty" fKeyMode="Native" targetInput="myInput" />
```

This mirrors how SAP GUI intercepts physical F-keys and maps them to transaction commands. The virtual keyboard fires the event; your application provides the meaning.

### Custom F-key variant layouts

Import the shared `fkey-row` module to compose custom layouts with an F-key row on top, the same row used by the built-in `qwerty-fk` and `qwertz-de-fk` layouts:

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

Import the shared `nav-row` module to compose navigation variants, or combine both rows in a single custom variant:

```ts
import navRow from "ui5/kiosk/layouts/nav-row";

const azertyFrNav: LayoutDefinition = [navRow, ...azertyFr];
KioskKeyboard.registerLayout("azerty-fr-nav", azertyFrNav);

const azertyFrFkNav: LayoutDefinition = [fkeyRow, navRow, ...azertyFr];
KioskKeyboard.registerLayout("azerty-fr-fk-nav", azertyFrFkNav);
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

Both `show()` and `close()` are idempotent; calling them multiple times has no effect. They fire `afterOpen` and `afterClose` immediately as state-change hooks (not after CSS transition completion).

The docked keyboard uses `position: fixed` with `z-index: var(--ui5KioskKeyboard-dockedZIndex)` (default `100`) and a `box-shadow` for visual separation.

With `mobileKeyboard="Auto"`, coarse-pointer devices intentionally defer to the native on-screen keyboard. In that mode, calling `show()` keeps the custom docked keyboard closed. The default is `mobileKeyboard="Custom"`, which always opens the UI5 control.

---

## Auto-Show

When `autoShow="true"` (requires `docked="true"`), the keyboard automatically:

1. **Opens** when any `<input>` or `<textarea>` on the page receives focus, setting it as the target. When `inputIds` is set, only the listed inputs trigger open.
2. **Closes** when focus leaves all inputs (uses `FocusEvent.relatedTarget` for synchronous close decisions, with a one-tick deferred fallback when `relatedTarget` is `null` during browser/shadow-DOM transitions).
3. **Stays open** when focus moves between the keyboard and an input, or between two inputs.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" />
```

The auto-show listeners use document-level `focusin`/`focusout` in the capture phase. They are automatically cleaned up on `destroy()`.

When multiple `KioskKeyboard` instances exist, auto-show claim arbitration only considers instances that are currently active in the UI (visible, enabled, rendered, and attached to the document). Hidden/inactive instances do not block another active keyboard from claiming the focused input.

For routed applications with cached views, still prefer one of these patterns for predictable behavior:

- Scope each keyboard with `inputIds` to its own form fields.
- Disable `autoShow` when a route/view becomes inactive (`setAutoShow(false)`) and re-enable on route enter.

### Input Detection

The keyboard recognizes input elements through a two-layer check: **DOM-level detection** (what triggers open/close) and **UI5-level resolution** (what the keyboard types into).

**1. DOM layer: what triggers auto-show:**

The `focusin` handler checks whether the focused DOM element is a **text-entry** `HTMLInputElement` or `HTMLTextAreaElement`. Non-textual input types (checkbox, radio, file, range, color, button, submit, reset, image) and `readonly` inputs are filtered out. Additionally, the element must be owned by a UI5 control (`Element.closestTo()` must resolve); raw DOM inputs without a UI5 control wrapper are ignored.

| DOM element                                                      | Detected? | Notes                                                 |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| `<input type="text\|search\|url\|tel\|email\|password\|number">` | Yes       | Free-form text-entry types                            |
| `<input type="date\|datetime-local\|month\|week\|time">`         | No        | Require specific formats, no `selectionStart` support |
| `<textarea>`                                                     | Yes       | Multi-line text inputs                                |
| `<input type="checkbox\|radio\|file\|range\|color\|...">`        | No        | Non-textual input types are filtered out              |
| `<input readonly>` / `<textarea readonly>`                       | No        | Read-only inputs cannot be typed into                 |
| `<div contenteditable>`                                          | No        | Not an `HTMLInputElement` or `HTMLTextAreaElement`    |
| `<select>`                                                       | No        | Not a text input element                              |
| Custom element / Shadow DOM inner `<input>`                      | Depends   | See Web Components notes below                        |

> For host controls/wrappers, typing and auto-type now resolve inner native `<input>/<textarea>` from either light DOM or Shadow DOM when available via `getFocusDomRef()`. Auto-show claiming still depends on the focused event target and UI5 control resolution.

In docked mode, pressing physical Escape closes the keyboard regardless of
where focus currently is. Inner-input resolution from `getFocusDomRef()` is
still used for focus return behavior when Escape is pressed on a virtual key.

**2. UI5 layer: what the keyboard types into:**

Once an `<input>` or `<textarea>` receives focus, the keyboard uses `Element.closestTo(domElement)` to resolve the owning UI5 control. This resolved control becomes the `targetInput`. For typing to work, the control must:

| Requirement     | Method/Property                                                                                                   | Used for                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Required**    | `getFocusDomRef()` returning an element that exposes an inner `input/textarea` (direct, light DOM, or Shadow DOM) | Reading/writing `.value`, cursor position via `selectionStart`/`selectionEnd` |
| **Recommended** | `setValue(string)` method                                                                                         | Syncs value to both ManagedObject property and DOM                            |
| **Recommended** | `liveChange` event                                                                                                | Fires after each keystroke for data binding integration                       |
| **Optional**    | `change` event                                                                                                    | Fired on Enter key (simulates form submit)                                    |
| **Optional**    | `getType()` returning `"Number"` or `"Tel"`                                                                       | Auto-type numpad detection                                                    |

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

## Interop Cookbook

### 1. Integration Style

- Declarative (XML properties like `targetInput`, `inputIds`, `autoShow`, `autoType`) is recommended for standard UI5 forms.
- Imperative (`setTargetInput()`, `show()`, `close()`) is recommended for dynamic targets, custom controls, and web component bridges.
- Mixing both is valid: use declarative defaults, then override imperatively for edge flows.

### 2. Standard UI5 Controls

Use `sap.m.Input`, `sap.m.TextArea`, or `sap.m.StepInput` with `targetInput` (single field) or `inputIds` (form fields):

```xml
<m:Input id="firstName" />
<m:Input id="lastName" />
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" inputIds="firstName,lastName" />
```

### 3. Custom UI5 Controls

For auto-show + typing to work, the control should:

- resolve from DOM to UI5 control via `Element.closestTo()`
- expose `getFocusDomRef()` that returns `HTMLInputElement` or `HTMLTextAreaElement`
- ideally support `setValue(string)` plus `liveChange` (and optionally `change`)

Minimal programmatic fallback:

```ts
keyboard.setTargetInput(myCustomControl);
keyboard.show();
```

### 4. Web Components and Shadow DOM

There are two paths:

- Native/custom web components are best integrated with a small UI5 bridge control because focus retargeting can hide the inner input from auto-show claim logic.
- UI5 wrapper controls from `sap.ui.webc.main` are deprecated in modern UI5; prefer `sap.m`/`sap.f` controls or a bridge pattern for custom elements.

If you build your own UI5 wrapper around a native custom element (for example via `sap/ui/core/webc/WebComponent.extend`), define a custom `setValue` that updates both the UI5 property bag and the rendered host element immediately:

```ts
setValue(value: string) {
  this.setProperty("value", value, true); // no invalidation

  const host = this.getDomRef();
  if (host instanceof HTMLElement) {
    (host as HTMLElement & { value?: string }).value = value;
  }

  return this;
}
```

Kiosk typing writes on every keypress. Relying only on metadata mapping can cause invalidation/re-render timing, which may introduce focus/caret jitter. The custom setter keeps typing smooth by avoiding re-render and syncing the DOM value immediately. Apply the same pattern to other frequently updated properties (for example `placeholder`) when you want immediate host sync without re-render.

This is not mandatory for every wrapper. If default metadata mapping already keeps your UI and bindings stable in your scenario, you may not need custom setters. Validate with your own integration (especially sustained typing) and add explicit DOM sync only when you observe lag, re-render side effects, or caret/focus issues.

Programmatic bridge pattern:

```ts
myHost.attachBrowserEvent("focusin", () => {
  keyboard.setTargetInput(myUi5WrapperControl);
  keyboard.show();
});

myHost.attachBrowserEvent("focusout", () => {
  keyboard.close();
});
```

### 5. Do and Don't

- Do use `inputIds` for multi-field forms
- Do set `targetInput` explicitly for custom/non-standard integrations
- Don't rely on implicit auto-detection for arbitrary shadow-hosted inputs
- Don't assume `afterOpen`/`afterClose` are CSS transition-end events

### 6. Troubleshooting

- Keyboard does not open: ensure `docked="true"` and `autoShow="true"`, and target resolves to a UI5 control
- Typing does not update bindings: ensure control supports `setValue` and `liveChange`
- Change timing differs from expected: `change` is commit-oriented (Enter/close/target switch) for single-line inputs

## Auto-Type

When `autoType="true"` (requires `autoShow="true"`), the keyboard inspects the focused input's metadata and automatically switches between Full and Numpad keyboard types.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" />
```

**Detection order** (first match wins):

1. UI5 control `getType()`: `"Number"` or `"Tel"` → Numpad
2. UI5 control name: `sap.m.StepInput` → Numpad
3. DOM `inputmode` attribute: `"numeric"`, `"decimal"`, or `"tel"` → Numpad
4. HTML `type` attribute: `"number"` or `"tel"` → Numpad
5. Fallback → Full

When the user tabs from a numeric input to a text input, the keyboard switches back to Full automatically.

**Explicit override:** Setting `keyboardType` explicitly (via XML, constructor, or `setKeyboardType()`) disables auto-type detection. The keyboard respects the explicit type and never overrides it.

You can query this lock state directly:

```ts
kb.setKeyboardType("Full");
kb.isKeyboardTypeExplicit(); // true

kb.resetKeyboardType();
kb.isKeyboardTypeExplicit(); // false
```

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
2. When any of them receives focus, the keyboard sets it as the `targetInput`. In docked + `autoShow` mode, the keyboard also opens automatically.
3. When `autoShow` is active, `inputIds` acts as a filter: only the listed inputs trigger auto-show. Focusing an input **not** in the list will not open the keyboard.
4. IDs are resolved against the parent View first (view-local IDs), then globally, safe for XML views where IDs are prefixed.
5. **Composite controls** (e.g. `sap.m.StepInput`) are supported: when focus lands on the inner input, the keyboard walks the UI5 parent chain to find the registered ancestor.

**`inputIds` vs `targetInput`:**

| Use case                              | Approach                                |
| ------------------------------------- | --------------------------------------- |
| Single input                          | `targetInput="myInput"`                 |
| Multiple inputs in a form             | `inputIds="field1,field2,field3"`       |
| Dynamic input (determined at runtime) | `setTargetInput(control)` in controller |

When `inputIds` is set, there is no need to also set `targetInput`; the keyboard updates the target association automatically based on focus.

**TypeScript:**

```ts
new KioskKeyboard({
  inputIds: ["firstName", "lastName", "email"],
});
```

---

## Custom Target Resolver

By default, the keyboard calls `getFocusDomRef()` on the target control and checks whether the returned element is a native `<input>` or `<textarea>`. For standard UI5 controls (`sap.m.Input`, `sap.m.StepInput`, `sap.m.TextArea`), this already returns the native input directly, so no further traversal is needed.

For custom controls with non-standard DOM structures, you can set a **target resolver** callback, either per instance or globally for all instances.

### Instance Resolver

An instance-level resolver applies only to a single KioskKeyboard:

```ts
const kb = this.byId("myKeyboard") as KioskKeyboard;

kb.setTargetResolver((el: HTMLElement) => {
  // Custom control: find the deeply nested input
  return el.querySelector(".my-wrapper .inner-editor input") as HTMLInputElement;
});
```

Pass `null` to clear:

```ts
kb.setTargetResolver(null);
```

### Global Resolver

A global resolver applies to **all** KioskKeyboard instances that don't have their own instance resolver:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

KioskKeyboard.setGlobalTargetResolver((el: HTMLElement) => {
  // App-wide custom resolution logic
  const inner = el.querySelector<HTMLInputElement>(".custom-input-wrapper input");
  return inner ?? null; // return null to fall back to built-in resolution
});
```

Pass `null` to clear:

```ts
KioskKeyboard.setGlobalTargetResolver(null);
```

### Resolver Precedence

1. **Instance resolver**: checked first (`setTargetResolver`)
2. **Global resolver**: checked if no instance resolver is set (`setGlobalTargetResolver`)
3. **Built-in resolver**: default DOM traversal (light DOM → shadow DOM, up to 3 levels)

At each level, if the resolver returns `null`, the next level is tried.

The callback receives the focused `HTMLElement` (the host element / DOM ref of the control) and must return:

- The native `<input>` or `<textarea>` to type into, **or**
- `null` to fall back to the next resolver in the chain

---

## Mobile Keyboard Detection

The `mobileKeyboard` property controls whether the KioskKeyboard or the native on-screen keyboard is used.

| Value      | Behavior                                                                                | Use when                                         |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `"Custom"` | Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. **Default.** | Dedicated kiosk terminal (no physical keyboard)  |
| `"Native"` | Always defer to the native keyboard; KioskKeyboard does not open on focus.              | Desktop/mobile app where desktops have keyboards |
| `"Auto"`   | Desktop browsers → use KioskKeyboard. Phone/tablet → defer to native.                   | Kiosk terminal that also serves mobile visitors  |

> **Note:** `"Auto"` relies on `sap/ui/Device` for device detection. Browsers cannot detect whether a physical keyboard is attached, so on any desktop browser, including a regular laptop, the virtual keyboard **will** appear. Use `"Native"` if that is not desired.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Auto" />
```

When the KioskKeyboard is active, it sets `inputmode="none"` on the focused input to suppress the native keyboard, and restores the original value when the last keyboard instance targeting that input closes or is destroyed.

### `inputmode` Lifecycle Details

- Suppression is applied when the keyboard opens, and also when the target input is switched while the keyboard remains open.
- Restoration runs on `close()` / `destroy()`, and also when an already open docked keyboard becomes non-participating (for example `visible="false"` or `enabled="false"`) and focus leaves the input.
- For shared targets, restoration is ref-counted: the original `inputmode` is restored only after the last keyboard instance releases that input.

---

## Shift & Caps Lock

The Shift key follows a three-state cycle:

1. **Off**: default state
2. **Shift** (single tap): next character is uppercase, then auto-releases
3. **Caps Lock** (double tap): all characters uppercase until toggled off

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
- ARIA live region announces keyboard open/close and shift state changes to screen readers
- Closing the keyboard or switching targets fires a `change` event on modified single-line inputs (mirrors physical keyboard commit behavior)
- Compact mode key sizes meet WCAG 2.5.8 minimum touch target size (24x24 CSS px)

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

### Public CSS Custom Properties

The documented `--ui5KioskKeyboard-*` variables are the supported styling API. Internal `--_ui5KioskKeyboard-*` aliases and renderer classes remain private implementation details and may change without notice.

Override these on `.ui5KioskKeyboard` to fine-tune layout without `!important`:

| Property                                 | Default                                           | Description                               |
| ---------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `--ui5KioskKeyboard-padding`             | `0.75rem`                                         | Container padding                         |
| `--ui5KioskKeyboard-keyGap`              | `0.375rem`                                        | Gap between keys and rows                 |
| `--ui5KioskKeyboard-keyHeight`           | `3rem`                                            | Key height / touch target                 |
| `--ui5KioskKeyboard-keyPaddingInline`    | `0.25rem`                                         | Horizontal key padding                    |
| `--ui5KioskKeyboard-keyFontSize`         | `calc(var(--ui5KioskKeyboard-keyHeight) * 0.375)` | Key label font size                       |
| `--ui5KioskKeyboard-keyShadow`           | _(theme)_                                         | Key resting shadow                        |
| `--ui5KioskKeyboard-keyShadowHover`      | _(theme)_                                         | Key hover shadow                          |
| `--ui5KioskKeyboard-maxWidth`            | `100%`                                            | Max width for the default inline keyboard |
| `--ui5KioskKeyboard-dockedMaxWidth`      | `1024px`                                          | Max width when docked                     |
| `--ui5KioskKeyboard-dockedShadow`        | _(theme)_                                         | Shadow when docked                        |
| `--ui5KioskKeyboard-dockedZIndex`        | `100`                                             | Z-index for the docked keyboard           |
| `--ui5KioskKeyboard-modifierFontSize`    | `@sapUiFontSize`                                  | Modifier / action key font size           |
| `--ui5KioskKeyboard-modifierShadow`      | _(theme)_                                         | Modifier key resting shadow               |
| `--ui5KioskKeyboard-modifierShadowHover` | _(theme)_                                         | Modifier key hover shadow                 |
| `--ui5KioskKeyboard-numpadMaxWidth`      | `20rem`                                           | Numpad container max-width                |
| `--ui5KioskKeyboard-numpadKeyMinWidth`   | `4rem`                                            | Numpad key min-width                      |

Override `--ui5KioskKeyboard-dockedZIndex` to adjust the docked keyboard's stacking layer.

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
.ui5KioskKeyboard {
  --ui5KioskKeyboard-maxWidth: 64rem;
}
```

Docked keyboards default to `1024px` max-width and center automatically via `margin-inline: auto`.

Responsive font scaling follows the keyboard's rendered width, so embedded keyboards react to the width of their actual host container instead of only the viewport. At narrow widths (≤ 30 rem / ≤ 20 rem), `--ui5KioskKeyboard-keyFontSize` is capped to `1rem` / `0.875rem`, but a consumer-provided value that is already smaller than the cap is preserved.

#### Label Sizing

Key labels use three scaling tiers:

| Tier                  | Applies to                                     | Scaling                                                                                                                                            |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glyph**             | Single-grapheme labels (`a`, `@`, `€`)         | No scaling, rendered at the key's font-size with `overflow: visible` so wide glyphs are not clipped.                                               |
| **Multi**             | Multi-character labels (`F10`, `Home`, `PgUp`) | Scales proportionally to the key's inline width via `clamp(0.5rem, 100cqi × 0.35, 1em)`.                                                           |
| **Modifier / Action** | Shift, Enter, Backspace, layout switches       | Defaults to the theme's base font-size (`@sapUiFontSize`). Scaled down in height-constrained containers via `--ui5KioskKeyboard-modifierFontSize`. |

```css
/* Example: larger keys for kiosk terminals */
.ui5KioskKeyboard {
  --ui5KioskKeyboard-keyHeight: 4rem;
  --ui5KioskKeyboard-keyFontSize: 1.5rem;
}
```

#### Key Types

Keys support different visual styles via the `type` property in `KeyDefinition`:

| Default                                                       | Default (hovered)                                                           | Modifier (`type: "modifier"`)                                   | Modifier (hovered)                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ![Default key](../../docs/shared/images/key-type-default.png) | ![Default key hovered](../../docs/shared/images/key-type-default-hover.png) | ![Modifier key](../../docs/shared/images/key-type-modifier.png) | ![Modifier key hovered](../../docs/shared/images/key-type-modifier-hover.png) |

- **Default**: visible border, SAP button background. Used for character keys.
- **Modifier**: transparent background, no border (Lite button style). Used for Shift, Caps Lock, layout switchers, and similar non-character keys.
- **Action**: emphasized style (blue). Used for Enter, Backspace.

Theme preview (QWERTY layout):

Full-size inline keyboard:

| `sap_horizon`                                                                                           | `sap_horizon_dark`                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon](../../docs/kiosk/images/kiosk-inline-wide-sap_horizon.png) | ![Inline wide kiosk keyboard in sap_horizon_dark](../../docs/kiosk/images/kiosk-inline-wide-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                                               | `sap_horizon_hcw`                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon_hcb](../../docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcb.png) | ![Inline wide kiosk keyboard in sap_horizon_hcw](../../docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcw.png) |

Both `compact` and `cozy` content densities are supported with adjusted key heights and spacing.

---

## Internationalization (i18n)

The library ships with an English resource bundle for all accessibility labels and key names. German (`messagebundle_de.properties`) is also included.

**Resource bundle keys:**

| Key                              | Default (English)       | Used for                                                |
| -------------------------------- | ----------------------- | ------------------------------------------------------- |
| `KIOSK_KEYBOARD_LABEL`           | Virtual Keyboard        | Default `aria-label` when `ariaLabel` property is empty |
| `KIOSK_KEYBOARD_ROLEDESCRIPTION` | keyboard                | `aria-roledescription` on the root element              |
| `KEY_SHIFT`                      | Shift                   | Visual label and `aria-label` for the Shift key         |
| `KEY_ENTER`                      | Enter                   | Visual label and `aria-label` for the Enter key         |
| `KEY_BACKSPACE`                  | Backspace               | `aria-label` for the Backspace key (icon-only)          |
| `KEY_SPACE`                      | Space                   | `aria-label` for the Space key                          |
| `ARIA_CAPS_LOCK`                 | Caps Lock               | `aria-label` for the Shift key when Caps Lock is active |
| `ARIA_CAPS_LOCK_ON`              | Caps Lock on            | ARIA live region announcement                           |
| `ARIA_SHIFT_ON`                  | Shift on                | ARIA live region announcement                           |
| `ARIA_KEYBOARD_OPENED`           | Virtual keyboard opened | ARIA live region announcement on `show()`               |
| `ARIA_KEYBOARD_CLOSED`           | Virtual keyboard closed | ARIA live region announcement on `close()`              |

**Adding translations (library contributors):**

To add a new locale to the library itself, create a properties file following the standard UI5 i18n naming convention in the library's `i18n/` folder. For example, to add French:

```
packages/kiosk-keyboard/src/i18n/messagebundle_fr.properties
```

```properties
KIOSK_KEYBOARD_LABEL=Clavier virtuel
KIOSK_KEYBOARD_ROLEDESCRIPTION=clavier
KEY_SHIFT=Maj
KEY_ENTER=Entrée
KEY_BACKSPACE=Retour arrière
KEY_SPACE=Espace
ARIA_CAPS_LOCK=Verrouillage majuscules
ARIA_CAPS_LOCK_ON=Verrouillage majuscules activé
ARIA_SHIFT_ON=Majuscules activées
ARIA_KEYBOARD_OPENED=Clavier virtuel ouvert
ARIA_KEYBOARD_CLOSED=Clavier virtuel fermé
```

The UI5 resource bundle mechanism (`Lib.getResourceBundleFor("ui5.kiosk")`) automatically resolves the correct bundle based on the active UI5 locale.

### i18n Extension API

Consumers can extend or override the keyboard's translatable texts without modifying the library package. Two mechanisms are available:

**Enhancement bundles**: provide additional locales or override built-in texts via standard `.properties` files:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// Add French and Spanish translations via a consumer bundle.
// supportedLocales / fallbackLocale are set per entry.
// Use "" as the fallback locale when your base file is
// messagebundle.properties (no locale suffix).
await KioskKeyboard.configureI18n({
  enhanceWith: [
    {
      bundleName: "my.app.i18n.kiosk",
      supportedLocales: ["", "de", "fr", "es"],
      fallbackLocale: "",
    },
  ],
});

// Or use a URL instead of a module name
await KioskKeyboard.configureI18n({
  enhanceWith: [
    {
      bundleUrl: "/i18n/kiosk/messagebundle.properties",
      supportedLocales: [""],
      fallbackLocale: "",
    },
  ],
});
```

**Override hook**: programmatically replace resolved texts for tenant-specific wording:

```ts
KioskKeyboard.setI18nOverrideHook(({ key, resolvedText }) => {
  if (key === "KIOSK_KEYBOARD_LABEL") {
    return "Terminal Keyboard";
  }
  return undefined; // keep resolvedText for all other keys
});
```

**Resolution order:** base library bundle (with built-in fallback) → enhancement bundles (last wins) → override hook.

**Locale reactivity:** when the UI5 locale changes at runtime (e.g. via `Localization.setLanguage()`), all live `KioskKeyboard` instances automatically reload their enhancement bundles and re-render with the updated texts.

**Validation behavior:** invalid top-level configuration (for example `null`, non-array `enhanceWith`, non-string `fallbackLocale`) logs a warning and rejects the returned Promise.

**FLP cleanup**: call both reset methods in `Component.destroy()` to prevent cross-app leakage:

```ts
export default class Component extends UIComponent {
  async init(): Promise<void> {
    super.init();
    // Fire-and-forget - the keyboard re-renders automatically once bundles load.
    // Await the returned Promise only if you need guaranteed bundle availability.
    KioskKeyboard.configureI18n({
      enhanceWith: [{ bundleName: "my.app.i18n.kiosk" }],
    });
  }

  destroy(): void {
    KioskKeyboard.clearI18nOverrideHook();
    KioskKeyboard.resetI18nConfiguration();
    super.destroy();
  }
}
```

> **Note:** The library automatically resets the i18n configuration and clears the override hook when the last `KioskKeyboard` instance is destroyed. Explicit cleanup in `Component.destroy()` is still recommended for apps that manage keyboard instances outside the normal view tree.

**Inspecting active config**: `getI18nConfiguration()` returns a frozen deep copy of the active configuration, or `null` when none has been applied. Useful for debugging and test assertions:

```ts
const config = KioskKeyboard.getI18nConfiguration();
console.log(config?.enhanceWith); // read-only - mutations throw
```

**TypeScript types**: import the config and context types for type-safe usage:

```ts
import type {
  KioskI18nConfig,
  KioskI18nEnhancement,
  KioskI18nOverrideHook,
  KioskI18nOverrideContext,
} from "ui5/kiosk/types";
```

| Method                                                    | Description                                          |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `configureI18n(config): Promise<void>`                    | Set enhancement bundles and locale metadata          |
| `resetI18nConfiguration(): void`                          | Clear enhancement config (not the hook)              |
| `setI18nOverrideHook(fn): boolean`                        | Register a per-key text override hook                |
| `clearI18nOverrideHook(): void`                           | Remove the override hook                             |
| `getI18nConfiguration(): Readonly<KioskI18nConfig>\|null` | Frozen snapshot of the active config (for debugging) |

---

## Library Enums & Constants

The library exports frozen `const` objects for type-safe comparisons. The UI5 property enums (`KeyboardLayout`, `KeyboardType`, `MobileKeyboard`, `FKeyMode`) are additionally registered via `DataType.registerEnum()` for XML view binding.

```ts
import { KeyboardLayout, KeyboardType, KeyName, MobileKeyboard, FKeyMode } from "ui5/kiosk/library";

// KeyboardLayout - built-in layout identifiers
KeyboardLayout.Qwerty; // "qwerty"
KeyboardLayout.QwertzDe; // "qwertz-de"
KeyboardLayout.Numeric; // "numeric"
KeyboardLayout.Special; // "special"
KeyboardLayout.Numpad; // "numpad"
KeyboardLayout.Fkeys; // "fkeys"
KeyboardLayout.Nav; // "nav"
KeyboardLayout.QwertyFk; // "qwerty-fk"
KeyboardLayout.QwertzDeFk; // "qwertz-de-fk"
KeyboardLayout.QwertyNav; // "qwerty-nav"
KeyboardLayout.QwertzDeNav; // "qwertz-de-nav"

// KeyboardType - keyboard display type
KeyboardType.Full; // "Full"
KeyboardType.Numeric; // "Numeric"
KeyboardType.Numpad; // "Numpad"

// MobileKeyboard - native keyboard behavior
MobileKeyboard.Custom; // "Custom"
MobileKeyboard.Native; // "Native"
MobileKeyboard.Auto; // "Auto"

// FKeyMode - F-key dispatch mode
FKeyMode.Virtual; // "Virtual"
FKeyMode.Native; // "Native"

// KeyName - key names for the keyPress event's `key` parameter
// Action keys
KeyName.Enter; // "Enter"
KeyName.Backspace; // "Backspace"
// Function keys
KeyName.F1; // "F1"  …  KeyName.F12  // "F12"
// Navigation keys
KeyName.ArrowLeft; // "ArrowLeft"
KeyName.ArrowRight; // "ArrowRight"
KeyName.ArrowUp; // "ArrowUp"
KeyName.ArrowDown; // "ArrowDown"
KeyName.Home; // "Home"
KeyName.End; // "End"
KeyName.PageUp; // "PageUp"
KeyName.PageDown; // "PageDown"
```

> **Note:** `KeyName` is not a UI5 DataType enum; it is a consumer convenience for type-safe comparisons in `keyPress` event handlers. Regular character keys fire their literal value (e.g. `"a"`, `"A"`, `"1"`) and are not covered by `KeyName`. Custom `{fkey:CustomAction}` keys fire their action name directly; use a string literal for those.

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# QUnit tests (WebdriverIO + qunit-service)
npm run test:qunit

# E2E tests (WebdriverIO), desktop
npm run test:e2e

# E2E tests, phone (360x800) / tablet (768x1024) device emulation
npm run test:e2e:phone
npm run test:e2e:tablet

# Run all device profiles in parallel
npm run test:e2e:all-devices

# Update visual baselines (desktop / phone / tablet)
npm run test:e2e:update
npm run test:e2e:phone:update
npm run test:e2e:tablet:update

# NOTE: Visual baselines are tied to the pinned Chrome-for-Testing version
# in tools/wdio-device-profiles.ts (CHROME_VERSION). Changing that version
# requires regenerating ALL visual baselines across all packages.

# Type check
npm run typecheck
```

---

## Further Reading

- [Architecture & Internals](../../docs/kiosk/ARCHITECTURE.md): control design, rendering, theming approach

---

## Troubleshooting

**Keyboard does not open on input focus:**

- Ensure both `docked="true"` and `autoShow="true"` are set
- The focused element must be a text-entry `<input>` or `<textarea>` owned by a UI5 control (`Element.closestTo()` must resolve)
- If `inputIds` is set, only the listed inputs trigger auto-show
- Check the browser console for `Log.warning` messages from `ui5.kiosk.KioskKeyboard`

**Typing does not update the model/binding:**

- The target control must support `setValue(string)` and fire `liveChange`. All standard `sap.m` input controls support this out of the box
- For custom controls, ensure `getFocusDomRef()` returns the actual `<input>` or `<textarea>` element

**Native keyboard appears alongside the virtual keyboard:**

- Set `mobileKeyboard="Custom"` (the default) to suppress native keyboard via `inputmode="none"`
- If the target control re-renders while the keyboard is open, the suppression may be lost; see [Mobile Keyboard Detection](#mobile-keyboard-detection)

**Layout switches cause the keyboard to change size:**

- Enable `stableHeight="true"` to maintain consistent height. This is especially important inside `sap.m.Popover`, which may close on content height changes

**Physical keyboard highlighting doesn't work for custom layout keys:**

- Ensure custom key `value` strings don't conflict with built-in action keys (`{backspace}`, `{enter}`, `{shift}`, etc.)

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
