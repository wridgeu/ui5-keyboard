<p align="center">
  <a href="https://www.npmjs.com/package/ui5-lib-kiosk-keyboard"><img src="https://img.shields.io/npm/v/ui5-lib-kiosk-keyboard.svg" alt="npm"></a>
  <a href="https://npmx.dev/package/ui5-lib-kiosk-keyboard"><img src="https://img.shields.io/npm/v/ui5-lib-kiosk-keyboard?label=npmx.dev&color=0a0a0a" alt="npmx"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://openui5.org/"><img src="https://img.shields.io/badge/OpenUI5-1.144.0-green.svg" alt="UI5"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript"></a>
</p>

<h1 align="center">ui5-lib-kiosk-keyboard</h1>

> Part of the [ui5-lib-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md) and [kiosk-keyboard-webc](../kiosk-keyboard-webc/README.md).

On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications.

> [!IMPORTANT]
> **UI5 compatibility**
> Supported package baseline: UI5 1.144.0.
> Lowest implementation floor: UI5 1.120, because the library uses `DataType.registerEnum()` and `Localization.getLanguageTag()` from 1.120.
> `Lib.init()` is available from 1.118, so it does not raise the floor.

A UI5 TypeScript library (`ui5.kiosk`) providing a fully themed, accessible virtual keyboard that types into any UI5 input control. Supports multiple layouts, Shift/Caps Lock, docked mode with auto-show, and integrates with SAP Horizon theming.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Browser Compatibility](#browser-compatibility)
- [Getting Started](#getting-started)
- [Quick Start](#quick-start)
- [API Stability](#api-stability)
- [KioskKeyboard Control](#kioskkeyboard-control)
  - [Properties](#properties)
  - [Associations](#associations)
  - [Events](#events)
  - [Public Methods](#public-methods)
  - [Static Methods (Complete)](#static-methods-complete)
- [Layouts](#layouts)
  - [Constrained Containers and Popovers](#constrained-containers-and-popovers)
  - [Custom Layouts](#custom-layouts)
- [Function Keys (F1-F12)](#function-keys-f1-f12)
- [Locale-Based Default Layout](#locale-based-default-layout)
- [Docked Mode](#docked-mode)
- [Auto-Show](#auto-show)
  - [Input Detection](#input-detection)
- [Interop Cookbook](#interop-cookbook)
- [Auto-Type](#auto-type)
- [controls](#controls)
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

- Built-in layouts: QWERTY, QWERTZ-DE, Japanese Romaji, Japanese Kana, Arabic, numeric, special characters, numpad, function keys, navigation keys
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

Install from npm:

```bash
npm install ui5-lib-kiosk-keyboard
```

In this monorepo, dependencies are managed via npm workspaces (`npm install` at the root).

## Browser Compatibility

The keyboard requires modern browser features for full functionality:

| Feature               | Used for                 | Baseline                                |
| --------------------- | ------------------------ | --------------------------------------- |
| CSS Container Queries | Width-responsive sizing  | Chrome 105+, Firefox 110+, Safari 16+   |
| ResizeObserver        | Height-responsive sizing | Chrome 64+, Firefox 69+, Safari 13.1+   |
| CSS `min()` / `max()` | Font-size capping        | Chrome 79+, Firefox 75+, Safari 13.1+   |
| CSS Custom Properties | Consumer overrides       | Chrome 49+, Firefox 31+, Safari 9.1+    |
| CSS `color-mix()`     | Theme-adaptive shadows   | Chrome 111+, Firefox 113+, Safari 16.2+ |

All features are supported in browsers released since mid-2023. In older
browsers, the keyboard renders at full size without width-responsive font
scaling. Shadow colors fall back to static `rgba()` values.

## Getting Started

The package ships:

- the UI5 source project (`src/`, `ui5.yaml`) for source-first development
- the prebuilt distributable under `dist/resources/ui5/kiosk/`
- build metadata under `dist/.ui5/build-manifest.json`

That gives you 3 supported consumption modes. No project shim is required.

Before choosing a mode, declare the library dependency in your app `manifest.json`:

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

### 1. Installed package + UI5 Tooling (default)

Recommended for published/runtime usage.

Install the package, keep the library in `manifest.json`, and let UI5 Tooling resolve it from `node_modules`.

```bash
npm install ui5-lib-kiosk-keyboard
```

If your app build should copy the library resources into the app `dist/`, add the UI5 project name to `builder.settings.includeDependency`:

```yaml
builder:
  settings:
    includeDependency:
      - ui5.kiosk
```

Notes:

- Use the UI5 project name `ui5.kiosk` here, not the npm package name `ui5-lib-kiosk-keyboard`.
- `includeDependency` is a build concern. `ui5 serve` can resolve the installed UI5 dependency without it.
- The packaged build manifest exists so the distributable can be reused as a build result in dist-based setups instead of always rebuilding from source.

If you deploy the built app to a plain static server while bootstrapping UI5 from CDN, also map the library namespace to the copied `resources/` folder:

```html
<script
  id="sap-ui-bootstrap"
  src="https://sdk.openui5.org/resources/sap-ui-core.js"
  data-sap-ui-resource-roots='{
    "my.app": "./",
    "ui5.kiosk": "./resources/ui5/kiosk/"
  }'
  data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
  data-sap-ui-async="true"
></script>
```

### 2. Source package + UI5 Tooling transpilation

Recommended for monorepos and local development when you want to work against the library source instead of the prebuilt distributable.

Enable dependency transpilation in both the build task and dev server middleware:

```yaml
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
```

Notes:

- Do not add `ui5.kiosk` under `framework.libraries`; this is a custom UI5 dependency, not a framework library.
- Keep using the `manifest.json` dependency shown above.
- If your app build should include the library resources in its own `dist/`, keep `builder.settings.includeDependency: [ui5.kiosk]` in addition to the transpile setup.

### 3. Static middleware escape hatch

Use this when you want explicit runtime serving from the dependency's distributable and do not want the dependency to participate in your app's UI5 dependency resolution.

```bash
npm install -D ui5-middleware-servestatic
```

```yaml
server:
  customMiddleware:
    - name: ui5-middleware-servestatic
      afterMiddleware: compression
      mountPath: /resources/ui5/kiosk/
      configuration:
        npmPackagePath: ui5-lib-kiosk-keyboard/dist/resources/ui5/kiosk
```

Notes:

- This is mainly a dev-server/runtime option.
- If you need the library resources inside the app build output as well, prefer mode 1 with `includeDependency`, or copy the resources explicitly as part of your deployment process.

Lazy loading via `"lazy": true` is supported and worth considering if the keyboard is only used on specific views or routes. The library includes CSS, theming, and i18n bundles, so deferring the load avoids pulling those resources at app startup:

```json
"ui5.kiosk": { "lazy": true }
```

When the library is used declaratively in an XML view (e.g. `<kiosk:KioskKeyboard .../>`), the framework loads it automatically on first view instantiation. For programmatic usage, load it explicitly before creating controls:

```ts
import Lib from "sap/ui/core/Lib";
await Lib.load({ name: "ui5.kiosk" });
```

For kiosk terminals where the keyboard is always needed, eager loading (the default, no `"lazy"` flag) is simpler.

Use the control in your view or controller as shown in [Quick Start](#quick-start) below.

---

## Quick Start

**XML View:**

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="myInput" value="{/text}" />
  <kiosk:KioskKeyboard controls="myInput" />
</mvc:View>
```

**TypeScript:**

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";

const input = new Input({ value: "" });
const keyboard = new KioskKeyboard({
  controls: [input.getId()],
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
import type { KioskKeyboardDomContract } from "ui5/kiosk/KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "ui5/kiosk/types";

const DOM: KioskKeyboardDomContract = KioskKeyboard.DOM;
```

Advanced/internal modules are available but should not be treated as a semver-stable API surface. In particular, anything under `ui5/kiosk/internal/*` is internal-only. This includes renderer internals and helper modules such as input operations and low-level DOM utilities. Under `ui5/kiosk/layouts/*`, only `ui5/kiosk/layouts/fkey-row` and `ui5/kiosk/layouts/nav-row` are supported as stable consumer imports for composing custom variant layouts. These rows omit `type` (defaulting to regular keys with visible borders); set `type: "modifier"` on individual keys to get the transparent Lite button style instead.

`KioskKeyboard.DOM` is also a supported read-only DOM hook contract for tests and DOM assertions. Prefer it over hard-coded class names or selectors. Styling customizations should still use the public `--ui5KioskKeyboard-*` CSS variables rather than DOM classes.

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

| Property         | Type                       | Default     | Description                                                                                                                                 |
| ---------------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`         | `string`                   | `"qwerty"`  | Active layout name. Auto-detected from locale when omitted. Only for `keyboardType="Full"`.                                                 |
| `keyboardType`   | `ui5.kiosk.KeyboardType`   | `"Full"`    | Display type: `Full`, `Numeric`, or `Numpad`.                                                                                               |
| `enabled`        | `boolean`                  | `true`      | Whether the keyboard is interactive.                                                                                                        |
| `ariaLabel`      | `string`                   | `""`        | Accessible label for the keyboard group. Defaults to "Virtual Keyboard" from i18n when empty.                                               |
| `docked`         | `boolean`                  | `false`     | Anchor to the bottom of the viewport with slide animation.                                                                                  |
| `autoShow`       | `boolean`                  | `false`     | Auto-open on input focus, auto-close when focus leaves. Requires `docked`.                                                                  |
| `autoType`       | `boolean`                  | `false`     | Auto-switch between Full/Numpad based on focused input type. Requires `autoShow`.                                                           |
| `mobileKeyboard` | `ui5.kiosk.MobileKeyboard` | `"Auto"`    | Native keyboard behavior: `Auto` (device-aware), `Custom` (suppress), `Native` (defer).                                                     |
| `fKeyMode`       | `ui5.kiosk.FKeyMode`       | `"Virtual"` | F-key handling: `Virtual` (emit `keyPress`), `Native` (dispatch synthetic keydown + native actions), `None` (event only, no native action). |
| `controls`       | `string[]`                 | `[]`        | Input control IDs for targeting. Supports single or multiple inputs. See [controls](#controls).                                             |

### Associations

| Association       | Type                  | Cardinality | Description                                                  |
| ----------------- | --------------------- | ----------- | ------------------------------------------------------------ |
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

### Public Methods

KioskKeyboard-specific public instance methods (excluding inherited UI5 base class methods):

| Method                     | Returns           | Description                                                                                                                                                           |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setLayout(layout)`        | `this`            | Set active layout (effective when `keyboardType="Full"`).                                                                                                             |
| `getBaseLayout()`          | `string`          | Get the tracked base (alphabetic) layout used by `{layout:base}`.                                                                                                     |
| `resetLayout()`            | `this`            | Switch back to the tracked base layout.                                                                                                                               |
| `setKeyboardType(type)`    | `this`            | Set keyboard display type (`Full`, `Numeric`, `Numpad`) and lock auto-type.                                                                                           |
| `isKeyboardTypeExplicit()` | `boolean`         | Whether keyboardType is explicitly locked (auto-type disabled).                                                                                                       |
| `resetKeyboardType()`      | `this`            | Clear explicit lock, re-enable auto-type.                                                                                                                             |
| `setAutoShow(autoShow)`    | `this`            | Enable/disable focus-driven open/close behavior (docked mode).                                                                                                        |
| `setDocked(docked)`        | `this`            | Enable/disable docked positioning and related open state handling.                                                                                                    |
| `setControls(ids)`         | `this`            | Set the list of control IDs to target (no re-render).                                                                                                                 |
| `getControls()`            | `string[]`        | Get the current list of control IDs.                                                                                                                                  |
| `getActiveControl()`       | `Control \| null` | Resolve the currently active (last focused) target control instance.                                                                                                  |
| `show()`                   | `this`            | Open the docked keyboard. Idempotent.                                                                                                                                 |
| `close()`                  | `this`            | Close the docked keyboard. Idempotent.                                                                                                                                |
| `isOpen()`                 | `boolean`         | Whether the docked keyboard is currently open.                                                                                                                        |
| `refreshResponsiveState()` | `this`            | Recompute responsive width/height classes after runtime CSS changes that do not trigger a reliable resize callback. Usually not needed for normal container resizing. |
| `setTargetResolver(fn)`    | `this`            | Set an instance-level custom resolver for locating native inputs. Pass `null` to clear.                                                                               |
| `getTargetResolver()`      | `Function\|null`  | Returns the instance-level target resolver, or `null`.                                                                                                                |
| `getFocusDomRef()`         | `Element \| null` | Returns the keyboard root DOM reference used for focus handling.                                                                                                      |
| `getFocusInfo()`           | `object`          | Returns focus state snapshot for UI5 focus restoration.                                                                                                               |
| `applyFocusInfo(info)`     | `this`            | Restores focus state snapshot previously returned by `getFocusInfo()`.                                                                                                |
| `getAccessibilityInfo()`   | `object`          | Returns UI5 accessibility metadata for assistive technologies.                                                                                                        |

For full generated typings (including property/event accessors from UI5 metadata), see [`src/KioskKeyboard.gen.d.ts`](src/KioskKeyboard.gen.d.ts) (regenerated by `npm run generate`).

The generated file above covers UI5 metadata accessors. The convenience/runtime methods listed here (for example `show()`, `close()`, `refreshResponsiveState()`) and the read-only `KioskKeyboard.DOM` hook contract live in [`src/KioskKeyboard.ts`](src/KioskKeyboard.ts).

### Static Methods (Complete)

| Method                                 | Returns             | Description                                                                    |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `registerLayout(name, definition)`     | `void`              | Register a custom layout. Can override built-in layouts.                       |
| `unregisterLayout(name)`               | `void`              | Remove a previously registered custom layout. Built-in layouts are protected.  |
| `resetCustomLayouts()`                 | `void`              | Remove all custom layouts and keep built-in layouts.                           |
| `getRegisteredLayout(name)`            | `LayoutDefinition?` | Get the definition for a layout name, or `undefined`.                          |
| `getRegisteredLayoutNames()`           | `string[]`          | List all registered layout names (built-in + custom).                          |
| `isBuiltInLayout(name)`                | `boolean`           | Whether the given name is a built-in layout.                                   |
| `isSecondaryLayout(name)`              | `boolean`           | Whether the layout is secondary (non-alphabetic, e.g. `numeric`, `fkeys`).     |
| `getLocaleLayout()`                    | `string`            | Detect the best layout for the current UI5 locale. Falls back to `"qwerty"`.   |
| `registerLocaleLayout(locale, layout)` | `void`              | Map a BCP-47 tag or prefix (e.g. `"fr"`, `"pt-br"`) to a layout name.          |
| `unregisterLocaleLayout(locale)`       | `void`              | Remove one locale-to-layout mapping.                                           |
| `resetLocaleLayouts()`                 | `void`              | Reset locale mappings to built-in defaults.                                    |
| `getKeyIcon(keyValue)`                 | `string?`           | Default icon URI for a special key value, or `undefined` if none.              |
| `setI18nResolver(fn)`                  | `void`              | Set a resolver callback for i18n text overrides, or `null` to clear.           |
| `setGlobalTargetResolver(fn)`          | `void`              | Set a global custom resolver for locating native inputs. Pass `null` to clear. |
| `getGlobalTargetResolver()`            | `Function \| null`  | Returns the global target resolver, or `null`.                                 |
| `registerMiddleware(layouts, factory)` | `void`              | Register composition middleware for one or more layout names.                  |

### DOM Contract

Use `KioskKeyboard.DOM` for test selectors and DOM assertions instead of repeating raw renderer class names:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

const DOM = KioskKeyboard.DOM;
const firstKey = keyboard.getDomRef()?.querySelector(DOM.selectors.key);
```

This contract is read-only and stable for DOM hooks. It is not the styling API; continue to customize appearance through the documented `--ui5KioskKeyboard-*` CSS custom properties.

---

## Layouts

The library ships with twelve built-in layouts:

| Layout      | Description                                        | Rows |
| ----------- | -------------------------------------------------- | ---- |
| `qwerty`    | Standard QWERTY with number row                    | 5    |
| `qwertz-de` | German QWERTZ with Umlaute (ä, ö, ü, ß)            | 5    |
| `numeric`   | Numbers with basic operators                       | 4    |
| `special`   | Special characters and symbols                     | 4    |
| `numpad`    | Compact numeric keypad (calculator)                | 5    |
| `fkeys`     | Function keys F1-F12 (standalone)                  | 3    |
| `nav`       | Navigation keys (arrows, Home/End, Pg)             | 4    |
| `ja-romaji` | Japanese Romaji (QWERTY base with JIS punctuation) | 5    |
| `ja-kana`   | Japanese Kana direct-input (JIS X 6002)            | 5    |
| `arabic`    | Arabic (standard Arabic 101 layout)                | 5    |
| `ko-hangul` | Korean Hangul Dubeolsik (KS X 5002)                | 5    |
| `qwerty-es` | Spanish QWERTY with accented vowels and ñ          | 5    |

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

### Responsive Behavior Overview

| Scenario                                                       | Detection                                                                  | Adapts automatically?      | Consumer CSS needed?                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| **Width** (any container width)                                | CSS `@container` queries at 30rem / 20rem                                  | Yes                        | No                                            |
| **Height** -- flex/grid parent with fixed height               | Root element inherits constraint via `max-height: 100%; min-height: 0`     | Yes                        | No                                            |
| **Height** -- explicit constraint on root                      | `max-height` or `height` on the keyboard root                              | Yes                        | No                                            |
| **Height** -- `height: auto` parent (unconstrained)            | `max-height: 100%` resolves to no constraint                               | Correctly stays full size  | No                                            |
| **Height** -- deeply nested ancestor constraint (no flex/grid) | Intermediate `height: auto` ancestors break `max-height: 100%` propagation | No                         | `max-height` or `height` on the keyboard root |
| **Docked mode**                                                | Viewport-driven, fixed positioning                                         | Skipped (always full size) | No                                            |
| **Compact density**                                            | `sapUiSizeCompact` CSS class                                               | Yes                        | No                                            |

### Constrained Containers and Popovers

The keyboard root element sets `max-height: 100%; min-height: 0; overflow: hidden` by default, so placing it inside a flex or grid parent with a fixed height automatically triggers responsive scaling without any additional CSS.

| Container height | Behavior                                               |
| ---------------- | ------------------------------------------------------ |
| Above 16 rem     | Full layout (default key sizes)                        |
| 12-16 rem        | Compact layout (`cq-short`, reduced key height)        |
| Below 12 rem     | Minimal layout (`cq-tiny`, further reduced key height) |

The thresholds are configurable via CSS custom properties (`--ui5KioskKeyboard-cqShortThreshold`, `--ui5KioskKeyboard-cqTinyThreshold`).

```xml
<!-- Automatic: flex parent constrains the keyboard -->
<VBox height="250px">
  <kiosk:KioskKeyboard controls="myInput" />
</VBox>

<!-- Manual CSS needed: Popover wraps content in height: auto divs that break propagation -->
<Popover contentWidth="24rem" contentHeight="18rem">
  <kiosk:KioskKeyboard controls="myInput" class="myConstrainedKeyboard" />
</Popover>
<!-- .myConstrainedKeyboard { height: 15rem; } -->
```

> **Tip:** You can also fine-tune key sizes via `--ui5KioskKeyboard-keyHeight` and other [CSS custom properties](#public-css-custom-properties) to fit more content into a smaller container without relying solely on the automatic breakpoints.

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

| Field           | Type     | Description                                                                                                                                                                             |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | `string` | Character or action (`{backspace}`, `{enter}`, `{shift}`, `{layout:name}`, `{fkey:name}`)                                                                                               |
| `label`         | `string` | Display label. Omit to resolve automatically (i18n for special keys, `value` for regular keys). Set to `""` to suppress (icon-only). When `icon` is also present, both render together. |
| `shiftLabel`    | `string` | Label when Shift is active.                                                                                                                                                             |
| `shiftValue`    | `string` | Value when Shift is active (defaults to uppercase of `value`).                                                                                                                          |
| `capsLockLabel` | `string` | Label for `{shift}` key when Caps Lock is active. Omit for i18n "Caps Lock". Set to `""` to suppress. Only meaningful on `{shift}` keys.                                                |
| `capsLockIcon`  | `string` | Icon for `{shift}` key when Caps Lock is active. Independent of `icon`. Defaults to `sap-icon://locked`. Only meaningful on `{shift}` keys.                                             |
| `width`         | `string` | CSS width class: `"1.5"`, `"2"`, `"2.25"`, `"space"`, etc.                                                                                                                              |
| `type`          | `string` | Styling: `"default"`, `"modifier"` (subdued), `"action"` (prominent), `"space"`.                                                                                                        |
| `icon`          | `string` | SAP icon URI or Unicode character. Renders inline with label when both are present (customizable via `--ui5KioskKeyboard-dualDirection`). Set `label=""` for icon-only.                 |

---

## Composition Middleware

Some scripts require processing between key press and text insertion. For example, Japanese Kana needs dakuten/handakuten composition (ka + dakuten = ga), and Korean Hangul needs jamo-to-syllable composition (individual consonants and vowels combine into syllable blocks).

The UI5 library includes composition middleware that activates automatically when the associated layout is active. No configuration needed -- the middleware is always available in the library preload.

### Built-in Middleware

| Middleware       | Layout      | Behavior                                                 |
| ---------------- | ----------- | -------------------------------------------------------- |
| `kana-dakuten`   | `ja-kana`   | Composes base kana + dakuten/handakuten into voiced kana |
| `hangul-compose` | `ko-hangul` | Composes jamo into Hangul syllable blocks with preedit   |

### Custom Middleware

Implement the `CompositionMiddleware` interface and register it via the static API:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { CompositionMiddleware } from "ui5/kiosk/types";

function createMyMiddleware(): CompositionMiddleware {
  return {
    handleKey(key, target) {
      // Return true if consumed (keyboard skips default handling).
      // Return false to pass through to default behavior.
      return false;
    },
    commit() {
      // Force-commit any in-progress composition. Return committed text or null.
      return null;
    },
    reset() {
      // Clear state without committing.
    },
  };
}

KioskKeyboard.registerMiddleware(["my-layout"], createMyMiddleware);
```

The `handleKey` method receives:

- `key`: the raw key value from the layout definition (e.g., `"a"`, `"{backspace}"`, `"{enter}"`)
- `target`: the DOM input element the keyboard is typing into

When `handleKey` returns `true`, the keyboard skips default handling. The middleware is responsible for modifying the target's value (use `insertText` from `ui5/kiosk/internal/input-operations` to properly update the UI5 control's model binding).

Middleware lifecycle:

- **Layout switch**: `commit()` is called, instance discarded. A fresh instance is created when the layout activates again.
- **Component destroyed**: `reset()` is called. In-progress composition is discarded, not flushed.

---

## Function Keys (F1-F12)

SAP GUI transactions rely heavily on function keys (F1 Help, F3 Back, F4 Value Help, F5 Refresh, F8 Execute). Kiosk and terminal setups that lack physical keyboards need virtual F-key access. The library provides three approaches:

### Approach 1: Fn button on base layouts

The `qwerty` and `qwertz-de` layouts include an **Fn** button on the bottom row. Tapping it switches to the standalone `fkeys` layout (F1-F12 + ABC to return). This is the default, no configuration needed.

### Approach 2: Composed layout with permanent F-key row

Compose a custom layout with the shared `fkey-row` module to render a full keyboard with an F1-F12 row permanently visible on top (6 rows total):

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";

const qwertyBase = KioskKeyboard.getRegisteredLayout("qwerty")!;
KioskKeyboard.registerLayout("qwerty-fk", [fkeyRow, ...qwertyBase]);
```

```xml
<kiosk:KioskKeyboard layout="qwerty-fk" controls="myInput" />
```

See [Custom F-key variant layouts](#custom-f-key-variant-layouts) for more details.

### Approach 3: Standalone fkeys layout

Use the `fkeys` layout directly for an F-key-only keyboard (F1-F12 + Enter):

```xml
<kiosk:KioskKeyboard layout="fkeys" controls="myInput" />
```

### Navigation keys

Use the `nav` layout for directional/navigation keys (Arrow keys, Home/End, PageUp/PageDown):

```xml
<kiosk:KioskKeyboard layout="nav" controls="myInput" />
```

Compose a variant with the shared `nav-row` module for integrated top-row navigation (same pattern as the F-key composition above).

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

The component dispatches a synthetic `KeyboardEvent("keydown")` to the target input for all F-keys (F1-F12) and navigation keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown). `keyPress` still fires afterward for compatibility.

**Important:** browsers treat synthetic `KeyboardEvent` instances as untrusted (`isTrusted: false`) and block them from triggering security-sensitive browser actions such as page reload, fullscreen, or developer tools. A synthetic F5 keydown does **not** reload the page.

To work around this limitation, the component has built-in action handlers for exactly two keys:

- **F5**: calls `location.reload()` (unless `keyPress` is cancelled with `preventDefault()`)
- **F11**: toggles fullscreen via `document.requestFullscreen()` / `document.exitFullscreen()` (unless cancelled)

All other F-keys (F1-F4, F6-F10, F12) dispatch the synthetic `keydown` to the target input but have no built-in browser action. The `keyPress` event is where the consuming app handles those keys.

```xml
<kiosk:KioskKeyboard layout="qwerty" fKeyMode="Native" controls="myInput" />
```

Handle other F-keys via the `keyPress` event:

```typescript
onKeyPress(event: Event<{ key: string }>): void {
  if (event.getParameter("key") === "{fkey:F1}") {
    event.preventDefault(); // optional: suppress default key-press behavior
    this.showHelpDialog();
  }
}
```

Or in XML view:

```xml
<kiosk:KioskKeyboard fKeyMode="Native" keyPress=".onKeyPress" />
```

When `fKeyMode="Native"`, the synthetic `keydown` is dispatched to the target input **before** `keyPress` fires. Any global keyboard shortcut system listening on the document (for example, ui5-lib-hotkeys) will also see the F-key event, independent of whether the `keyPress` handler calls `preventDefault()`.

This mirrors how SAP GUI intercepts physical F-keys and maps them to transaction commands. The virtual keyboard fires the event; your application provides the meaning.

### Custom F-key variant layouts

Import the shared `fkey-row` module to compose custom layouts with an F-key row on top:

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
| `ja`     | `ja-romaji` |
| `ar`     | `arabic`    |
| `ko`     | `ko-hangul` |
| `es`     | `qwerty-es` |

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

With `mobileKeyboard="Auto"` (the default), coarse-pointer devices intentionally defer to the native on-screen keyboard. In that mode, calling `show()` keeps the custom docked keyboard closed. Set `mobileKeyboard="Custom"` to always open the UI5 control regardless of device.

---

## Auto-Show

When `autoShow="true"` (requires `docked="true"`), the keyboard automatically:

1. **Opens** when any `<input>` or `<textarea>` on the page receives focus, setting it as the target. When `controls` is set, only the listed inputs trigger open.
2. **Closes** when focus leaves all inputs (uses `FocusEvent.relatedTarget` for synchronous close decisions, with a one-tick deferred fallback when `relatedTarget` is `null` during browser/shadow-DOM transitions).
3. **Stays open** when focus moves between the keyboard and an input, or between two inputs.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" />
```

The auto-show listeners use document-level `focusin`/`focusout` in the capture phase. They are automatically cleaned up on `destroy()`.

When multiple `KioskKeyboard` instances exist, auto-show claim arbitration only considers instances that are currently active in the UI (visible, enabled, rendered, and attached to the document). Hidden/inactive instances do not block another active keyboard from claiming the focused input.

For routed applications with cached views, still prefer one of these patterns for predictable behavior:

- Scope each keyboard with `controls` to its own form fields.
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

Once an `<input>` or `<textarea>` receives focus, the keyboard uses `Element.closestTo(domElement)` to resolve the owning UI5 control. This resolved control becomes the active target. For typing to work, the control must:

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
  keyboard.setControls([myCustomInput.getId()]);
  keyboard.show();
});
myCustomInput.attachBrowserEvent("focusout", () => {
  keyboard.close();
});
```

## Interop Cookbook

### 1. Integration Style

- Declarative (XML properties like `controls`, `autoShow`, `autoType`) is recommended for standard UI5 forms.
- Imperative (`setControls()`, `show()`, `close()`) is recommended for dynamic targets, custom controls, and web component bridges.
- Mixing both is valid: use declarative defaults, then override imperatively for edge flows.

### 2. Standard UI5 Controls

Use `sap.m.Input`, `sap.m.TextArea`, or `sap.m.StepInput` with the `controls` property (single or multiple field IDs):

```xml
<m:Input id="firstName" />
<m:Input id="lastName" />
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" controls="firstName,lastName" />
```

### 3. Custom UI5 Controls

For auto-show + typing to work, the control should:

- resolve from DOM to UI5 control via `Element.closestTo()`
- expose `getFocusDomRef()` that returns `HTMLInputElement` or `HTMLTextAreaElement`
- ideally support `setValue(string)` plus `liveChange` (and optionally `change`)

Minimal programmatic fallback:

```ts
keyboard.setControls([myCustomControl.getId()]);
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
  keyboard.setControls([myUi5WrapperControl.getId()]);
  keyboard.show();
});

myHost.attachBrowserEvent("focusout", () => {
  keyboard.close();
});
```

### 5. Do and Don't

- Do use `controls` for single or multi-field forms
- Do call `setControls()` explicitly for custom/non-standard integrations
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

## controls

The `controls` property provides declarative input targeting. List one or more input control IDs and the keyboard will automatically target whichever one last received focus. This replaces the older separate `targetInput` association and `inputIds` property with a single unified approach.

**Single input:**

```xml
<m:Input id="myInput" />
<kiosk:KioskKeyboard controls="myInput" />
```

**Multiple inputs in a form:**

```xml
<m:Input id="firstName" />
<m:Input id="lastName" />
<m:Input id="email" />

<kiosk:KioskKeyboard controls="firstName,lastName,email" />
```

**How it works:**

1. The keyboard attaches a focus delegation to each resolved control.
2. When any of them receives focus, the keyboard sets it as the active target. In docked + `autoShow` mode, the keyboard also opens automatically.
3. When `autoShow` is active, `controls` acts as a filter: only the listed inputs trigger auto-show. Focusing an input **not** in the list will not open the keyboard.
4. IDs are resolved against the parent View first (view-local IDs), then globally, safe for XML views where IDs are prefixed.
5. **Composite controls** (e.g. `sap.m.StepInput`) are supported: when focus lands on the inner input, the keyboard walks the UI5 parent chain to find the registered ancestor.

**TypeScript:**

```ts
new KioskKeyboard({
  controls: ["firstName", "lastName", "email"],
});
```

To retrieve the currently active (last focused) control:

```ts
const active: Control | null = keyboard.getActiveControl();
```

For fully dynamic targeting at runtime, call `setControls()` imperatively:

```ts
keyboard.setControls([myDynamicControl.getId()]);
keyboard.show();
```

---

## Icon + Label Rendering

Keys can display an icon, a label, or both. The combination of `icon` and `label` properties determines what renders:

| `icon`  | `label`    | Rendered output                                         |
| ------- | ---------- | ------------------------------------------------------- |
| omitted | omitted    | Label auto-resolved from i18n (special keys) or `value` |
| omitted | `"Custom"` | Custom label text only                                  |
| omitted | `""`       | Blank key (no content)                                  |
| set     | omitted    | Icon + auto-resolved label (dual rendering)             |
| set     | `"Custom"` | Icon + custom label (dual rendering)                    |
| set     | `""`       | Icon only                                               |
| `""`    | omitted    | Label only (built-in icon suppressed)                   |
| `""`    | `""`       | Blank key (no content)                                  |

### Icon types

The `icon` property accepts two value types:

- **SAP icon URI** (e.g. `"sap-icon://accept"`) -- rendered via `rm.icon()` with `aria-hidden="true"`
- **Unicode character or emoji** (e.g. `"\u2191"`, `"\u23CE"`, `"\uD83D\uDD0D"`) -- rendered as a text span styled at icon size

Invalid SAP icon URIs are validated via `IconPool.getIconInfo()`. If an icon is not found, a warning is logged and the icon is skipped (the key degrades gracefully to label-only).

```ts
// SAP icon with label
{ value: "{enter}", icon: "sap-icon://accept", label: "Enter", type: "action" }

// Unicode arrow icon, label suppressed (icon-only)
{ value: "{fkey:ArrowUp}", icon: "\u2191", label: "", type: "modifier" }

// Unicode icon with label (dual rendering)
{ value: "{fkey:Home}", icon: "\u21F1", label: "Home", type: "modifier" }
```

### Dual rendering (icon + label)

When both `icon` and a non-empty `label` resolve, the key renders in **dual mode**: icon and label side by side. The layout direction defaults to `row` (inline) and is customizable via CSS custom properties:

```css
/* Stack icon above label instead of side by side */
.ui5KioskKeyboard {
  --ui5KioskKeyboard-dualDirection: column;
  --ui5KioskKeyboard-dualGap: 0.1em;
  --ui5KioskKeyboard-dualIconSize: 0.85em;
  --ui5KioskKeyboard-dualLabelSize: 0.75em;
}
```

| Property                           | Default  | Description                                                       |
| ---------------------------------- | -------- | ----------------------------------------------------------------- |
| `--ui5KioskKeyboard-dualDirection` | `row`    | Flex direction (`row`, `column`, `row-reverse`, `column-reverse`) |
| `--ui5KioskKeyboard-dualIconSize`  | `1em`    | Icon font size in dual mode                                       |
| `--ui5KioskKeyboard-dualLabelSize` | `1em`    | Label font size in dual mode                                      |
| `--ui5KioskKeyboard-dualGap`       | `0.15em` | Gap between icon and label                                        |

#### Navigation key overrides

Navigation and function keys (`{fkey:*}`) default to column layout with scaled icons. These properties override the dual defaults for nav keys only. In the UI5 package, nav keys are identified by the `.ui5KioskKey--fkey` class (added automatically for keys with `{fkey:*}` values).

| Property                           | Default                                     | Description                                                |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `--ui5KioskKeyboard-fkeyDirection` | `column`                                    | Flex direction for nav/function keys                       |
| `--ui5KioskKeyboard-fkeyIconSize`  | `clamp(1em, 15cqi, 3em)`                    | Icon size, scales with key width via container query units |
| `--ui5KioskKeyboard-fkeyLabelSize` | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)` | Label size, scales responsively with key width             |
| `--ui5KioskKeyboard-fkeyGap`       | `0.05em`                                    | Gap between icon and label                                 |

```css
/* Force nav keys to row layout (icon beside label, like other dual keys) */
.ui5KioskKeyboard {
  --ui5KioskKeyboard-fkeyDirection: row;
  --ui5KioskKeyboard-fkeyIconSize: 1em;
  --ui5KioskKeyboard-fkeyLabelSize: 1em;
  --ui5KioskKeyboard-fkeyGap: 0.15em;
}
```

### Responsive behavior

At narrow key widths (below `5rem` per key), dual keys automatically hide the text label using the sr-only pattern (`clip-path: inset(50%)`). The icon remains visible, and the label stays in the accessibility tree as the key's accessible name.

This behavior is driven by a CSS `@container` query on individual keys (`container-type: inline-size`). It applies only to dual keys (those with both icon and label).

### Accessibility

- **Dual keys (icon + label visible):** The visible text provides the accessible name. No `aria-label` is set (WCAG 2.5.3 Label in Name).
- **Icon-only keys (`label: ""`):** The renderer sets `aria-label` from i18n for built-in special keys, or falls back to `value` for custom keys.
- **Icons** always have `aria-hidden="true"` -- they are decorative when a label is present, and the `aria-label` handles accessibility when the label is suppressed.

### Built-in icons

These special keys render built-in icons by default (no need to set `icon`):

| Key           | Icon                    | Default label (from i18n) |
| ------------- | ----------------------- | ------------------------- |
| `{shift}`     | `sap-icon://arrow-top`  | "Shift"                   |
| `{enter}`     | `sap-icon://accept`     | "Enter"                   |
| `{backspace}` | `sap-icon://arrow-left` | "Backspace"               |

Set `icon: ""` to suppress a built-in icon. Set `label: ""` to suppress the label (icon-only display).

### Caps Lock overrides

On `{shift}` keys, the Caps Lock state can override both icon and label independently:

```ts
{
  value: "{shift}",
  type: "modifier",
  capsLockLabel: "LOCKED",
  capsLockIcon: "\uD83D\uDD12",
}
```

`capsLockIcon` is evaluated independently of `icon` -- setting `icon: ""` does not suppress `capsLockIcon`.

### Renderer method decomposition

The UI5 renderer decomposes key content rendering into overridable methods for subclassing:

- `resolveKeyIcon(oControl, key)` -- returns the effective icon string
- `renderKeyIcon(rm, oControl, icon)` -- renders the icon element
- `renderKeyLabel(rm, oControl, key, label)` -- renders the label element
- `renderKeyContent(rm, oControl, key, icon, label)` -- orchestrates icon + label

Override these in a custom renderer to restructure the icon/label composition entirely.

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
- Each key has `role="button"` with an accessible name from visible text (when icon+label are both present) or `aria-label` (for icon-only keys where `label=""`)
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

For the rationale behind default values, breakpoint thresholds, and scaling factors, see the [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md).

Override these on `.ui5KioskKeyboard` to fine-tune layout without `!important`:

| Property                                 | Default                                                   | Description                                                 |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `--ui5KioskKeyboard-border`              | `1px solid` _(theme)_                                     | Container border (set to `none` for borderless)             |
| `--ui5KioskKeyboard-borderRadius`        | _(theme)_                                                 | Container border radius                                     |
| `--ui5KioskKeyboard-padding`             | `0.75rem`                                                 | Container padding                                           |
| `--ui5KioskKeyboard-keyGap`              | `0.375rem`                                                | Gap between keys and rows                                   |
| `--ui5KioskKeyboard-keyHeight`           | `3rem`                                                    | Key height / touch target                                   |
| `--ui5KioskKeyboard-keyPaddingInline`    | `0.25rem`                                                 | Horizontal key padding                                      |
| `--ui5KioskKeyboard-keyPaddingInlineXs`  | `min(var(--ui5KioskKeyboard-keyPaddingInline), 0.125rem)` | Horizontal key padding in extra-narrow mode                 |
| `--ui5KioskKeyboard-keyFontSize`         | `calc(var(--ui5KioskKeyboard-keyHeight) * 0.375)`         | Key label font size                                         |
| `--ui5KioskKeyboard-keyShadow`           | _(theme)_                                                 | Key resting shadow                                          |
| `--ui5KioskKeyboard-keyShadowHover`      | _(theme)_                                                 | Key hover shadow                                            |
| `--ui5KioskKeyboard-maxWidth`            | `100%`                                                    | Max width for the default inline keyboard                   |
| `--ui5KioskKeyboard-dockedMaxWidth`      | `1024px`                                                  | Max width when docked                                       |
| `--ui5KioskKeyboard-dockedShadow`        | _(theme)_                                                 | Shadow when docked                                          |
| `--ui5KioskKeyboard-dockedZIndex`        | `100`                                                     | Z-index for the docked keyboard                             |
| `--ui5KioskKeyboard-modifierFontSize`    | `@sapUiFontSize`                                          | Modifier / action key font size                             |
| `--ui5KioskKeyboard-modifierShadow`      | _(theme)_                                                 | Modifier key resting shadow                                 |
| `--ui5KioskKeyboard-modifierShadowHover` | _(theme)_                                                 | Modifier key hover shadow                                   |
| `--ui5KioskKeyboard-numpadMaxWidth`      | `20rem`                                                   | Numpad container max-width                                  |
| `--ui5KioskKeyboard-numpadKeyMinWidth`   | `4rem`                                                    | Numpad key min-width                                        |
| `--ui5KioskKeyboard-cqShortThreshold`    | `16rem`                                                   | Height threshold for `ui5KioskKeyboard--cq-short`           |
| `--ui5KioskKeyboard-cqTinyThreshold`     | `12rem`                                                   | Height threshold for `ui5KioskKeyboard--cq-tiny`            |
| `--ui5KioskKeyboard-dualDirection`       | `row`                                                     | Flex direction for dual icon+label keys (`row` or `column`) |
| `--ui5KioskKeyboard-dualIconSize`        | `1em`                                                     | Icon font size in dual mode                                 |
| `--ui5KioskKeyboard-dualLabelSize`       | `1em`                                                     | Label font size in dual mode (inherits modifier cap)        |
| `--ui5KioskKeyboard-dualGap`             | `0.15em`                                                  | Gap between icon and label in dual mode                     |
| `--ui5KioskKeyboard-fkeyDirection`       | `column`                                                  | Flex direction for nav/function keys                        |
| `--ui5KioskKeyboard-fkeyIconSize`        | `clamp(1em, 15cqi, 3em)`                                  | Icon size for nav/function keys (scales with key width)     |
| `--ui5KioskKeyboard-fkeyLabelSize`       | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)`               | Label size for nav/function keys (responsive)               |
| `--ui5KioskKeyboard-fkeyGap`             | `0.05em`                                                  | Gap between icon and label for nav/function keys            |

Override `--ui5KioskKeyboard-dockedZIndex` to adjust the docked keyboard's stacking layer.

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
.ui5KioskKeyboard {
  --ui5KioskKeyboard-maxWidth: 64rem;
}
```

Docked keyboards default to `1024px` max-width and center automatically via `margin-inline: auto`.

Responsive font scaling uses CSS `@container` queries on the keyboard's rendered width, so embedded keyboards react to the width of their actual host container instead of only the viewport. At narrow widths (≤ 30 rem / ≤ 20 rem), `--ui5KioskKeyboard-keyFontSize` is capped to `1rem` / `0.875rem`, but a consumer-provided value that is already smaller than the cap is preserved. In the extra-narrow `≤ 20rem` mode, non-numpad keys also switch from `--ui5KioskKeyboard-keyPaddingInline` to `--ui5KioskKeyboard-keyPaddingInlineXs`. The default reduces horizontal padding from `0.25rem` to `0.125rem` because wide glyphs such as `@`, `%`, and `&` become visually cramped before the touch target itself needs to shrink. The `min(...)` default keeps any smaller consumer override intact, while still letting consumers opt into a roomier or tighter compact mode explicitly. Height-responsive sizing detects when the control's rendered DOM element is smaller than its natural content height and reduces key height, gaps, and modifier font-size automatically.

### Custom Width Breakpoints

The keyboard responds to its container width via CSS container queries
at 30rem (narrow) and 20rem (compact). Because the UI5 control renders
in the light DOM, consumers can reference the keyboard's container name
directly to define custom breakpoints:

```css
@container keyboard (max-width: 40rem) {
  .myKeyboard .ui5KioskKey {
    --ui5KioskKeyboard-keyFontSize: 1rem;
  }
}

@container keyboard (max-width: 25rem) {
  .myKeyboard .ui5KioskKey {
    --ui5KioskKeyboard-keyFontSize: 0.875rem;
    --ui5KioskKeyboard-keyPaddingInline: 0.125rem;
  }
}
```

This is more flexible than the previous threshold variables: you can
set any property at any number of breakpoints.

For a complete guide covering all built-in breakpoints, row wrapping behavior, and patterns for switching entire layouts per device size, see the [Responsive Layout Patterns](../../docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md) guide.

#### Tuning for Complex-Script Layouts

Layouts with visually complex glyphs (Arabic, Thai, Devanagari, CJK) may
appear cramped at narrow widths because their characters need more
horizontal space than Latin letters at the same font size. The built-in
Arabic layout at phone-sm width (320 px) is a good reference case.

Override `--ui5KioskKeyboard-keyFontSize` on the keyboard root to tune
readability for your target script:

```css
/* Reduce font size for a keyboard displaying complex-script glyphs */
.ui5KioskKeyboard {
  --ui5KioskKeyboard-keyFontSize: 0.85rem;
}
```

All component styles live inside `@layer kiosk-keyboard`, so any
unlayered consumer CSS wins regardless of specificity -- no extra wrapper
class is needed. At narrow widths, the responsive container queries cap
font size via `min()` but cannot raise it above your value, so a smaller
override is preserved. At desktop widths no cap applies and your value
is used as-is. This approach works for any layout, including custom
layouts registered via `registerLayout()`.

For troubleshooting, the rendered root toggles internal classes such as `ui5KioskKeyboard--cq-short` and `ui5KioskKeyboard--cq-tiny`. They explain when the responsive CSS variables take effect, but they are implementation details rather than public styling hooks; prefer overriding the documented `--ui5KioskKeyboard-*` variables instead of targeting those classes from app CSS.

The height constraint must affect the **control's own rendered element**. A parent with `overflow: hidden` alone clips the visual rendering but does not shrink the control's layout box, so the keyboard will be clipped instead of adapting. Apply `max-height` directly to the keyboard's root element (via CSS targeting `.ui5KioskKeyboard`), or use a flex parent that propagates the constraint.

Most styling updates are handled automatically through rendering and `ResizeHandler`. When you intentionally change `--ui5KioskKeyboard-*` sizing variables at runtime without changing the rendered outer box, call `refreshResponsiveState()` after the style update so height-responsive classes are recomputed from the live DOM.

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
- **Modifier**: transparent background, no border (Lite button style). Used for Shift, Caps Lock, layout switchers, F-keys (F1-F12), and navigation keys (Home, End, Arrows, PgUp, PgDn).
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

The library ships with an English resource bundle for all accessibility labels and key names. German (`messagebundle_de.properties`), Japanese (`messagebundle_ja.properties`), and Arabic (`messagebundle_ar.properties`) are also included.

**Resource bundle keys:**

| Key                              | Default (English)       | Used for                                                                        |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `KIOSK_KEYBOARD_LABEL`           | Virtual Keyboard        | Default `aria-label` when `ariaLabel` property is empty                         |
| `KIOSK_KEYBOARD_ROLEDESCRIPTION` | keyboard                | `aria-roledescription` on the root element                                      |
| `KEY_SHIFT`                      | Shift                   | Visual label and `aria-label` for the Shift key                                 |
| `KEY_ENTER`                      | Enter                   | Visual label and `aria-label` for the Enter key                                 |
| `KEY_BACKSPACE`                  | Backspace               | Label for the Backspace key (visible text; aria-label when label is suppressed) |
| `KEY_SPACE`                      | Space                   | Label for the Space key (visible text; aria-label when label is suppressed)     |
| `ARIA_CAPS_LOCK`                 | Caps Lock               | `aria-label` for the Shift key when Caps Lock is active                         |
| `ARIA_CAPS_LOCK_ON`              | Caps Lock on            | ARIA live region announcement                                                   |
| `ARIA_SHIFT_ON`                  | Shift on                | ARIA live region announcement                                                   |
| `ARIA_KEYBOARD_OPENED`           | Virtual keyboard opened | ARIA live region announcement on `show()`                                       |
| `ARIA_KEYBOARD_CLOSED`           | Virtual keyboard closed | ARIA live region announcement on `close()`                                      |

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

Consumers can extend or override the keyboard's translatable texts at runtime via a single resolver function:

```ts
KioskKeyboard.setI18nResolver(fn: I18nResolver | null): void
```

The resolver receives each i18n key together with the active locale and the text the library resolved from its built-in bundles. Return a replacement string to override, or `undefined` to keep the default.

**Resolver signature:**

```ts
type I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined;
```

**Adding translations for a new locale** (e.g. French):

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

const frenchTexts: Record<string, string> = {
  KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
  KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
  KEY_SHIFT: "Maj",
  KEY_ENTER: "Entrée",
  KEY_BACKSPACE: "Retour arrière",
  KEY_SPACE: "Espace",
};

KioskKeyboard.setI18nResolver((key, locale, resolvedText) => {
  if (locale.startsWith("fr")) {
    return frenchTexts[key]; // undefined for unknown keys = keep default
  }
  return undefined;
});
```

**Overriding existing English labels** (e.g. tenant-specific wording):

```ts
KioskKeyboard.setI18nResolver((key, _locale, _resolvedText) => {
  if (key === "KIOSK_KEYBOARD_LABEL") {
    return "Terminal Keyboard";
  }
  return undefined; // keep resolvedText for all other keys
});
```

**Transforming resolved text programmatically:**

```ts
KioskKeyboard.setI18nResolver((_key, _locale, resolvedText) => {
  return resolvedText.toUpperCase();
});
```

**Clearing the resolver:**

```ts
KioskKeyboard.setI18nResolver(null);
```

**Resolution order:** the library resolves each key from its built-in resource bundle first, then passes the result to the resolver. The resolver's return value (if not `undefined`) replaces the built-in text.

**Locale reactivity:** when the UI5 locale changes at runtime (e.g. via `Localization.setLanguage()`), all live `KioskKeyboard` instances re-render and the resolver is called again with the new locale.

**Automatic cleanup:** the library automatically clears the resolver when the last `KioskKeyboard` instance is destroyed. Explicit cleanup via `setI18nResolver(null)` is still recommended for apps that manage keyboard instances outside the normal view tree.

**TypeScript types**: import the resolver type for type-safe usage:

```ts
import type { I18nResolver } from "ui5/kiosk/types";
```

| Method                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `setI18nResolver(fn): void` | Set a resolver callback for text overrides, or `null` to clear |

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
KeyboardLayout.JaRomaji; // "ja-romaji"
KeyboardLayout.JaKana; // "ja-kana"
KeyboardLayout.Arabic; // "arabic"
KeyboardLayout.KoHangul; // "ko-hangul"
KeyboardLayout.QwertyEs; // "qwerty-es"

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

# E2E tests, responsive device matrix
npm run test:e2e:phone-sm
npm run test:e2e:phone-md
npm run test:e2e:phone-lg
npm run test:e2e:tablet

# Alias: phone -> phone-md
npm run test:e2e:phone

# Run all device profiles in parallel
npm run test:e2e:all-devices

# Run the same device matrix sequentially (useful when you want lower local CPU/RAM pressure)
npm run test:e2e:all-devices:sequential

# Update visual baselines (desktop / responsive device matrix)
npm run test:e2e:update
npm run test:e2e:phone-sm:update
npm run test:e2e:phone-md:update
npm run test:e2e:phone-lg:update
npm run test:e2e:tablet:update

# Alias: phone:update -> phone-md:update
npm run test:e2e:phone:update

# Visual diff report
npm run test:e2e:report

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
- If `controls` is set, only the listed inputs trigger auto-show
- Check the browser console for `Log.warning` messages from `ui5.kiosk.KioskKeyboard`

**Typing does not update the model/binding:**

- The target control must support `setValue(string)` and fire `liveChange`. All standard `sap.m` input controls support this out of the box
- For custom controls, ensure `getFocusDomRef()` returns the actual `<input>` or `<textarea>` element

**Native keyboard appears alongside the virtual keyboard:**

- Set `mobileKeyboard="Custom"` to suppress native keyboard via `inputmode="none"`
- If the target control re-renders while the keyboard is open, the suppression may be lost; see [Mobile Keyboard Detection](#mobile-keyboard-detection)

**Layout switches cause the keyboard to change size:**

- Set a fixed `contentHeight` on the `sap.m.Popover` to prevent content resizing during layout switches. See [Constrained Containers and Popovers](#constrained-containers-and-popovers)

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
