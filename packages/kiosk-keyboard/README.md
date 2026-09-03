<p align="center">
  <a href="https://www.npmjs.com/package/ui5-lib-kiosk-keyboard"><img src="https://img.shields.io/npm/v/ui5-lib-kiosk-keyboard.svg" alt="npm"></a>
  <a href="https://npmx.dev/package/ui5-lib-kiosk-keyboard"><img src="https://img.shields.io/npm/v/ui5-lib-kiosk-keyboard?label=npmx.dev&color=0a0a0a" alt="npmx"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://openui5.org/"><img src="https://img.shields.io/badge/OpenUI5-1.136%20LTS-green.svg" alt="UI5"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript"></a>
</p>

<h1 align="center">ui5-lib-kiosk-keyboard</h1>

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md) and [kiosk-keyboard-webc](../kiosk-keyboard-webc/README.md).

On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications.

> [!IMPORTANT]
> **UI5 compatibility**
> Declared floor: UI5 1.136, a long-term-maintenance (LTS) release and the lowest version SAP's UI5 tooling accepts in `manifest.json`. The package is built, type-checked, and tested against 1.136.
> True implementation floor: UI5 1.120. The library only uses APIs available since 1.120 (`DataType.registerEnum()`, `Localization.getLanguageTag()`, `Lib.init({ apiVersion: 2 })`), so apps pinned to an older LTS down to 1.120 work too.
> `Lib.init()` is available from 1.118, so it does not raise the floor.

A UI5 TypeScript library (`ui5.kiosk`) providing a themed, accessible virtual keyboard that types into any UI5 input control. Supports multiple layouts, Shift/Caps Lock, docked mode with auto-show, and integrates with SAP Horizon theming.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Browser Compatibility](#browser-compatibility)
- [Getting Started](#getting-started)
- [Quick Start](#quick-start)
- [API Stability](#api-stability)
- [Custom Layouts](#custom-layouts)
  - [Fields and how they resolve](#fields-and-how-they-resolve)
  - [What the control reports](#what-the-control-reports)
  - [In an XML view](#in-an-xml-view)
- [KioskKeyboard Control](#kioskkeyboard-control)
  - [Properties](#properties)
  - [Associations](#associations)
  - [Aggregations](#aggregations)
  - [Events](#events)
  - [Public Methods](#public-methods)
  - [Static Methods](#static-methods)
- [Layouts](#layouts)
  - [Constrained Containers and Popovers](#constrained-containers-and-popovers)
  - [Layout Definition Format](#layout-definition-format)
  - [Accent variants (German umlauts)](#accent-variants-german-umlauts)
- [Composition Middleware](#composition-middleware)
- [Function Keys (F1-F12)](#function-keys-f1-f12)
- [Locale-Based Default Layout](#locale-based-default-layout)
- [Docked Mode](#docked-mode)
- [Auto-Show](#auto-show)
  - [Input Detection](#input-detection)
- [Text Insertion](#text-insertion)
- [Interop Cookbook](#interop-cookbook)
- [Auto-Type](#auto-type)
- [controls](#controls)
- [Icon + Label Rendering](#icon--label-rendering)
- [Custom Target Resolver](#custom-target-resolver)
- [Mobile Keyboard Detection](#mobile-keyboard-detection)
- [Shift & Caps Lock](#shift--caps-lock)
- [Accessibility](#accessibility)
- [Theming](#theming)
- [Internationalization (i18n)](#internationalization-i18n)
  - [i18n Extension API](#i18n-extension-api)
- [Library Enums & Constants](#library-enums--constants)
- [Development](#development)
- [Further Reading](#further-reading)
- [Troubleshooting](#troubleshooting)
- [When NOT to Use This Library](#when-not-to-use-this-library)
- [License](#license)

---

## Features

**Core**

- Pure UI5 Control with flat DOM and event delegation (no child controls)
- Types into any UI5 input control (`sap.m.Input`, `sap.m.TextArea`, etc.) via association
- Cursor-aware text insertion, backspace, and selection replacement
- Fires `liveChange` on the target for proper data binding integration
- Shift toggle (single tap) and Caps Lock (double tap) with auto-release

**Layouts**

- Built-in layouts: QWERTY, QWERTZ-DE, Spanish QWERTY, Japanese Romaji, Japanese Kana (plus a narrow-width compact form), Korean Hangul, Arabic, numeric, special characters, numpad, function keys, navigation keys
- Locale-based default layout (auto-detects from UI5 language setting)
- Runtime layout switching via `{layout:name}` keys
- `keyboardType` property for quick switching between Full, Numeric, and Numpad modes
- Extensible layout definition format (`LayoutDefinition` type)
- Custom layouts, locale mappings, composition middleware and accent tables declared together on the per-control `customLayouts` aggregation
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

| Feature               | Used for                           | Baseline                                |
| --------------------- | ---------------------------------- | --------------------------------------- |
| `Intl.Segmenter`      | Grapheme-aware Backspace and caret | Chrome 87+, Firefox 125+, Safari 14.1+  |
| CSS Container Queries | Width-responsive sizing            | Chrome 105+, Firefox 110+, Safari 16+   |
| CSS Cascade Layers    | Keeping app CSS above library CSS  | Chrome 99+, Firefox 97+, Safari 15.4+   |
| ResizeObserver        | Height-responsive sizing           | Chrome 64+, Firefox 69+, Safari 13.1+   |
| CSS `min()` / `max()` | Font-size capping                  | Chrome 79+, Firefox 75+, Safari 13.1+   |
| CSS `color-mix()`     | Accent-variant hint tint           | Chrome 111+, Firefox 113+, Safari 16.2+ |
| CSS Custom Properties | Consumer overrides                 | Chrome 49+, Firefox 31+, Safari 9.1+    |

`Intl.Segmenter` is the effective floor. It reached Baseline in April 2024, when
Firefox 125 became the last engine to ship it, so that release is the oldest
Firefox the library supports. It is also the one entry with no graceful
degradation: the segmenter is constructed at module scope, so an engine without
it throws on import rather than losing a feature. Everything else degrades -
without container queries or `min()` the keyboard renders at full size with no
width-responsive font scaling, without `color-mix()` the accent-variant hint
loses its tint, and without cascade layers the library's own rules compete with
the app's on ordinary specificity.

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

Ensure your app's `minUI5Version` (under `sap.ui5.dependencies`) is at least **1.136**, the libraries' declared LTS floor. The code only needs 1.120, so an app pinned to an older LTS down to 1.120 also works.

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

> [!NOTE]
>
> - Use the UI5 project name `ui5.kiosk` here, not the npm package name `ui5-lib-kiosk-keyboard`.
> - `includeDependency` is a build concern. `ui5 serve` can resolve the installed UI5 dependency without it.
> - The packaged build manifest exists so the distributable can be reused as a build result in dist-based setups instead of always rebuilding from source.

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
        transpileDependencies: true # source-mode only: transpiles the library's shipped src/*.ts (dist needs none)
        transformTypeScript:
          allowDeclareFields: true # match the library build; keeps the TS controls' typed class fields
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
```

> [!NOTE]
>
> - Do not add `ui5.kiosk` under `framework.libraries`; this is a custom UI5 dependency, not a framework library.
> - Keep using the `manifest.json` dependency shown above.
> - If your app build should include the library resources in its own `dist/`, keep `builder.settings.includeDependency: [ui5.kiosk]` in addition to the transpile setup.

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

Advanced/internal modules are available but should not be treated as a semver-stable API surface. In particular, anything under `ui5/kiosk/internal/*` is internal-only. This includes renderer internals and helper modules such as input operations and low-level DOM utilities. Under `ui5/kiosk/layouts/*`, the built-in layout definitions (e.g. `qwerty`, `numeric`, `ja-kana`) and the shared row fragments `ui5/kiosk/layouts/fkey-row`, `ui5/kiosk/layouts/fkey-row-compact`, `ui5/kiosk/layouts/nav-row` and `ui5/kiosk/layouts/nav-row-compact` are supported as stable consumer imports - for use as a base layout or for composing custom variants. All four row fragments set `type: "modifier"` on every key (transparent Lite button style); override `type` per key only if you want bordered/regular key styling instead.

`KioskKeyboard.DOM` is also a supported read-only DOM hook contract for tests and DOM assertions. Prefer it over hard-coded class names or selectors. Styling customizations should still use the public `--ui5KioskKeyboard-*` CSS variables rather than DOM classes.

## Custom Layouts

Everything one layout _is_ - its rows, the locales that select it, its keycap language, whether it is an auxiliary surface, its composition middleware and its long-press variants - is declared together on a `CustomLayout` element in the control's `customLayouts` aggregation. It shadows the built-in registry for that control only, without touching module-level state.

A custom layout that declares `rows` declares a layout. One **without** rows overlays the layout its `name` already resolves to, so a built-in can be given different variants, a different middleware or a different locale binding without restating its keys.

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { LayoutFacet, LayoutRole } from "ui5/kiosk/library";

const kb = new KioskKeyboard({
  accentVariants: true,
  layout: "warehouse-pos",
  customLayouts: [
    new CustomLayout({
      name: "warehouse-pos",
      rows: myPosLayout,
      locales: ["de"],
      keycapLang: "de",
      variants: { s: ["ś", "š"] },
    }),
    // Rows-less overlay: give the built-in kana layout a different middleware.
    new CustomLayout({ name: "ja-kana", middleware: kanaDakutenFactory }),
    // A transliteration IME whose Latin-looking keys take no accent popups.
    new CustomLayout({ name: "my-ime", rows: myImeLayout, suppress: [LayoutFacet.Variants] }),
    // Promote the built-in secondary `numeric` to a base alphabetic layout.
    new CustomLayout({ name: "numeric", layoutRole: LayoutRole.Base, rows: symbolSurface }),
  ],
});
```

The aggregation carries the usual generated accessors - `addCustomLayout`, `insertCustomLayout`, `removeCustomLayout`, `removeAllCustomLayouts`, `indexOfCustomLayout`, `destroyCustomLayouts`, `bindCustomLayouts` - and needs no teardown: the elements are owned by the control and destroyed with it.

**JavaScript callers may pass object literals** (`customLayouts: [{ name: "x", rows }]`), which the aggregation coerces into `CustomLayout` elements. **TypeScript callers construct `new CustomLayout({...})`**: the interface generator does not model that coercion, so the generated type is the element union.

### Fields and how they resolve

| Field        | Type               | Across custom layouts with the same name                                    | Across tiers                                 |
| ------------ | ------------------ | --------------------------------------------------------------------------- | -------------------------------------------- |
| `name`       | `string`           | matched after trim + lowercase; duplicates are the overlay mechanism        | -                                            |
| `rows`       | `LayoutDefinition` | last declaration wins                                                       | custom layout → built-in                     |
| `keycapLang` | `string`           | last declaration wins                                                       | custom layout → built-in                     |
| `compact`    | `string`           | last declaration wins                                                       | custom layout → built-in                     |
| `layoutRole` | `LayoutRole`       | last declaration wins                                                       | `Inherit` takes the built-in's               |
| `locales`    | `string[]`         | additive union; per prefix, last wins                                       | custom layouts → built-in map                |
| `middleware` | `() => …`          | last declaration wins                                                       | custom layout → built-in                     |
| `variants`   | `VariantTable`     | additive per base letter; a letter mapped to `[]` drops it                  | built-in → `defaultVariants` → custom layout |
| `suppress`   | `LayoutFacet[]`    | discards the inherited value of each listed facet at this layout's position | -                                            |

Custom layouts apply in **aggregation order**. `layoutRole` is a tri-state: `Inherit` (the default) takes the built-in layout of the same name's role, `Base` un-marks a built-in's secondary flag, `Secondary` marks an auxiliary surface. `suppress` is how a facet is turned _off_ rather than replaced - a value the same custom layout declares still applies, so `suppress="Variants"` plus a `variants` table stands that table alone. `suppress` is comma-separated and whitespace around a name is not part of it, so `suppress="Variants, Middleware"` and `suppress="Variants,Middleware"` are the same list.

`compact` names the layout that renders instead of this one on a keyboard too narrow to seat its rows - the same key set in a denser arrangement, matched after trim and lowercase, and read only while the control's `autoCompact` is on. It may name a built-in (`ja-kana` ships `ja-kana-compact`) or another custom layout. `suppress` cannot turn it off: the suppressible facets are `Variants` and `Middleware`, so an overlay can replace an inherited counterpart but not remove it.

`rows` and `variants` are read by object identity: assign a new array or object to change them; mutating in place is not observed. The shape a `rows` array takes - and every field a key in it can carry - is in [Layout Definition Format](#layout-definition-format).

### What the control reports

A misconfiguration is logged once per control per distinct complaint, naming the layout and the remedy, rather than resolving silently to nothing:

| Code                   | Trigger                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `empty-name`           | a custom layout whose `name` is empty after trim                       |
| `invalid-rows`         | `rows` that are not a layout definition (the other facets still apply) |
| `invalid-variants`     | `variants` (or `defaultVariants`) that are not a variant table         |
| `invalid-middleware`   | `middleware` that is not a function                                    |
| `invalid-locale`       | a `locales` entry that is empty after trim                             |
| `unknown-target`       | facets declared with no `rows`, for a name no layout has               |
| `unknown-compact`      | `compact` that names a layout nothing declares                         |
| `duplicate-rows`       | two custom layouts declare `rows` for one name                         |
| `duplicate-middleware` | two custom layouts declare `middleware` for one name                   |
| `duplicate-locale`     | two custom layouts claim one BCP-47 prefix for different layouts       |

A typo in `layoutRole` or `suppress` **throws** rather than being reported: they are closed enums, so `ManagedObject` rejects the value the way `mobileKeyboard="Bogus"` already does.

### In an XML view

A complete layout extension is declarable with no controller code. `rows` and `variants` are object-typed, so they arrive through a model binding; `middleware` resolves through `core:require`.

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns:kiosk="ui5.kiosk">
  <kiosk:KioskKeyboard id="kb" controls="name,email" accentVariants="true"
    defaultVariants="{layouts>/houseAccents}">
    <kiosk:customLayouts>

      <!-- A whole layout: rows, locale binding, keycap language, IME, accents. -->
      <kiosk:CustomLayout core:require="{ Warehouse: 'demo/middleware/warehouse' }"
        name="pl-warehouse" locales="pl,pl-PL" keycapLang="pl"
        rows="{layouts>/plWarehouse}"
        middleware="Warehouse.createMiddleware"
        variants="{layouts>/plVariants}" />

      <!-- Rows-less overlay: point the Japanese locale at the BUILT-IN kana layout. -->
      <kiosk:CustomLayout name="ja-kana" locales="ja" />

      <!-- Opt a layout out of accents entirely. -->
      <kiosk:CustomLayout name="arabic" suppress="Variants" />

      <!-- Disable the built-in Hangul composer for directly-typed rows. -->
      <kiosk:CustomLayout name="ko-hangul" suppress="Middleware" rows="{layouts>/hangulDirect}" />

    </kiosk:customLayouts>
  </kiosk:KioskKeyboard>
</mvc:View>
```

## KioskKeyboard Control

### Properties

| Property          | Type                       | Default     | Description                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`          | `string`                   | `"qwerty"`  | Active layout name, **written back as the active layout changes** - see the note below. Auto-detected from locale when omitted. Drives the displayed surface when `keyboardType="Full"`, and after a user `{layout:X}` tap regardless of `keyboardType`.        |
| `keyboardType`    | `ui5.kiosk.KeyboardType`   | `"Full"`    | Display type: `Full`, `Numeric`, or `Numpad`.                                                                                                                                                                                                                   |
| `enabled`         | `boolean`                  | `true`      | Whether the keyboard is interactive.                                                                                                                                                                                                                            |
| `ariaLabel`       | `string`                   | `""`        | Accessible label for the keyboard group. Defaults to "Virtual Keyboard" from i18n when empty.                                                                                                                                                                   |
| `docked`          | `boolean`                  | `false`     | Anchor to the bottom of the viewport with slide animation.                                                                                                                                                                                                      |
| `autoShow`        | `boolean`                  | `false`     | Auto-open on input focus, auto-close when focus leaves. Requires `docked`.                                                                                                                                                                                      |
| `autoType`        | `boolean`                  | `false`     | Auto-switch between Full/Numpad based on focused input type. Requires `autoShow`.                                                                                                                                                                               |
| `autoCompact`     | `boolean`                  | `false`     | Swap the resolved layout for its compact counterpart while the keyboard is too narrow to seat its rows, and back when the room returns. Of the built-ins only `ja-kana` declares a counterpart; a custom layout names its own with `compact`.                   |
| `mobileKeyboard`  | `ui5.kiosk.MobileKeyboard` | `"Auto"`    | Native keyboard behavior: `Auto` (device-aware), `Custom` (suppress), `Native` (defer).                                                                                                                                                                         |
| `fKeyMode`        | `ui5.kiosk.FKeyMode`       | `"Virtual"` | F-key handling: `Virtual` (emit `keyPress` + built-in caret navigation), `Native` (adds a synthetic keydown + native actions), `None` (event only, no navigation, no native action).                                                                            |
| `accentVariants`  | `boolean`                  | `false`     | Overlay the built-in Latin-diacritics table so any Latin base key of the resolved layout exposes a long-press / right-click accent-variant popup. The five non-Latin built-ins are excluded by default. See [Accent variants](#accent-variants-german-umlauts). |
| `controls`        | `ui5.kiosk.ControlID[]`    | `[]`        | Input control IDs for targeting. Supports single or multiple inputs. See [controls](#controls).                                                                                                                                                                 |
| `defaultVariants` | `VariantTable \| null`     | `null`      | Long-press variants applied under **every** layout, merged per base letter beneath anything a `customLayouts` entry declares. Effective only with `accentVariants`. See [Accent variants](#accent-variants-german-umlauts).                                     |

> [!IMPORTANT]
> `layout` holds the **effective** layout, not the one you last set. A `{layout:X}` tap, `setLayout()`, and an `autoCompact` width swap all write it, so `getLayout()` always answers "what is on screen" - the same contract `keyboardType` has under `autoType`.
>
> Two consequences worth knowing before you bind it:
>
> - **A two-way binding is written back.** `layout="{/prefs/layout}"` receives `"ja-kana-compact"` when the keyboard narrows, so persisting that model field persists an arrangement the user never chose - and two-way is every model's _default_ mode, so this needs no opting in. Bind one-way (`layout="{path: '/prefs/layout', mode: 'OneWay'}"`) when the value is a stored preference, and take user-driven changes from the `layoutChange` event, whose `autoDetected` flag separates a width swap from a request. The control logs a warning once per instance when a width swap is about to write through a two-way `layout`, so the case is never silent; a `{layout:X}` tap writes back without a warning, since persisting the user's own choice is the point.
>
>   `keyboardType` needs no such care despite sharing the contract: `autoType` only detects while the type has not been set explicitly, and a binding delivers its value through `setKeyboardType`, which marks it exactly that. Binding the property is what switches the detection off, so it has no path on which to write back.
>
> - **The web component splits this the other way.** `<kiosk-keyboard>.layout` keeps the layout you asked for and exposes the resolved one as the read-only `effectiveLayout`, because a custom-element attribute is an author declaration rather than live state. Port `getLayout()` to `effectiveLayout`. See [Requested vs. effective layout](../kiosk-keyboard-webc/README.md#requested-vs-effective-layout).

### Associations

| Association       | Type                  | Cardinality | Description                                                  |
| ----------------- | --------------------- | ----------- | ------------------------------------------------------------ |
| `ariaLabelledBy`  | `sap.ui.core.Control` | 0..n        | Additional labels announced by assistive technologies.       |
| `ariaDescribedBy` | `sap.ui.core.Control` | 0..n        | Additional descriptions announced by assistive technologies. |

### Aggregations

| Aggregation     | Type                     | Cardinality | Description                                                                                                                              |
| --------------- | ------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `customLayouts` | `ui5.kiosk.CustomLayout` | `0..n`      | Per-control layouts and overlays, applied in aggregation order. See [Custom Layouts](#custom-layouts). Bindable via `bindCustomLayouts`. |

### Events

| Event                 | Parameters                                                                      | Description                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyPress`            | `key: string`, `shiftKey: boolean`                                              | Fired when a virtual key is pressed, except for `{shift}` and `{layout:*}`, which switch without asking. Call `preventDefault()` to skip default input action. Use `KeyName` constants for non-character keys. |
| `layoutChange`        | `layout: string`, `autoDetected: boolean`                                       | Fired when the active layout changes. `autoDetected` marks an `autoCompact` width swap rather than a request.                                                                                                  |
| `keyboardTypeChange`  | `keyboardType: string`, `previousKeyboardType: string`, `autoDetected: boolean` | Fired when the keyboard type changes.                                                                                                                                                                          |
| `afterOpen`           | -                                                                               | Fired when `show()` opens the docked keyboard (state/event hook, not CSS transition end).                                                                                                                      |
| `afterClose`          | -                                                                               | Fired when `close()` closes the docked keyboard (state/event hook, not CSS transition end).                                                                                                                    |
| `activeControlChange` | `controlId: string`                                                             | Fired when the active control changes (auto-show focus switch or programmatic target change).                                                                                                                  |

### Public Methods

KioskKeyboard-specific public instance methods (excluding inherited UI5 base class methods):

| Method                     | Returns                                           | Description                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setLayout(layout)`        | `this`                                            | Set the active `layout` property programmatically. Effective when `keyboardType="Full"`; under `Numeric`/`Numpad` it sets the property but the rendered surface stays constrained until a user `{layout:X}` tap.                                                 |
| `getBaseLayout()`          | `string`                                          | Get the tracked base (alphabetic) layout used by `{layout:base}`.                                                                                                                                                                                                |
| `resetLayout()`            | `this`                                            | Switch back to the tracked base layout.                                                                                                                                                                                                                          |
| `setKeyboardType(type)`    | `this`                                            | Set keyboard display type (`Full`, `Numeric`, `Numpad`) and lock auto-type.                                                                                                                                                                                      |
| `resetKeyboardType()`      | `this`                                            | Clear explicit lock, re-enable auto-type.                                                                                                                                                                                                                        |
| `reset()`                  | `this`                                            | Clear transient input state (shift/caps latch, in-progress composition, backspace auto-repeat, accent-variant popover) and return to the base layout. Leaves the bound value, active target, docked visibility, and all configuration untouched.                 |
| `setAutoShow(autoShow)`    | `this`                                            | Enable/disable focus-driven open/close behavior (docked mode).                                                                                                                                                                                                   |
| `setDocked(docked)`        | `this`                                            | Enable/disable docked positioning and related open state handling.                                                                                                                                                                                               |
| `setControls(ids)`         | `this`                                            | Set the list of control IDs to target (no re-render).                                                                                                                                                                                                            |
| `getControls()`            | `ControlID[]`                                     | Get the current list of control IDs.                                                                                                                                                                                                                             |
| `getActiveControl()`       | `Control \| null`                                 | Resolve the currently active (last focused) target control instance.                                                                                                                                                                                             |
| `insertText(text)`         | `void`                                            | Insert text at the caret of the active target (cursor-tracked, fires `liveChange`). No-op with no active target. Call from a `keyPress` handler to implement a custom `{token}` key.                                                                             |
| `deleteBackward()`         | `boolean`                                         | Delete one grapheme before the caret of the active target. Returns whether anything was removed; no-op with no active target.                                                                                                                                    |
| `getActiveTargetElement()` | `HTMLInputElement \| HTMLTextAreaElement \| null` | The resolved native input/textarea of the active target, or `null`.                                                                                                                                                                                              |
| `show()`                   | `this`                                            | Open the docked keyboard. Idempotent.                                                                                                                                                                                                                            |
| `close()`                  | `this`                                            | Close the docked keyboard. Idempotent.                                                                                                                                                                                                                           |
| `isOpen()`                 | `boolean`                                         | Whether the docked keyboard is currently open.                                                                                                                                                                                                                   |
| `refreshResponsiveState()` | `this`                                            | Recompute responsive width/height classes after runtime `--ui5KioskKeyboard-*` sizing changes inside a fixed-height host, where the rendered outer size does not change so no `ResizeObserver` callback fires. Usually not needed for normal container resizing. |
| `setTargetResolver(fn)`    | `this`                                            | Set an instance-level custom resolver for locating native inputs. Pass `null` to clear.                                                                                                                                                                          |
| `getTargetResolver()`      | `Function\|null`                                  | Returns the instance-level target resolver, or `null`.                                                                                                                                                                                                           |
| `getFocusDomRef()`         | `Element \| null`                                 | Returns the keyboard root DOM reference used for focus handling.                                                                                                                                                                                                 |
| `getFocusInfo()`           | `object`                                          | Returns focus state snapshot for UI5 focus restoration.                                                                                                                                                                                                          |
| `applyFocusInfo(info)`     | `this`                                            | Restores focus state snapshot previously returned by `getFocusInfo()`.                                                                                                                                                                                           |
| `getAccessibilityInfo()`   | `object`                                          | Returns UI5 accessibility metadata for assistive technologies.                                                                                                                                                                                                   |

For full generated typings (including property/event accessors from UI5 metadata), see [`src/KioskKeyboard.gen.d.ts`](src/KioskKeyboard.gen.d.ts) (regenerated by `npm run generate`).

The generated file above covers UI5 metadata accessors. The convenience/runtime methods listed here (for example `show()`, `close()`, `refreshResponsiveState()`) and the read-only `KioskKeyboard.DOM` hook contract live in [`src/KioskKeyboard.ts`](src/KioskKeyboard.ts).

### Static Methods

The static surface carries no layout registration; custom layouts come from the per-control `customLayouts` aggregation (see [Custom Layouts](#custom-layouts)).

| Method                        | Returns             | Description                                                                                                            |
| ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `getRegisteredLayout(name)`   | `LayoutDefinition?` | Get the definition for a built-in layout name, or `undefined`.                                                         |
| `getRegisteredLayoutNames()`  | `string[]`          | List all built-in layout names.                                                                                        |
| `isBuiltInLayout(name)`       | `boolean`           | Whether the given name is a built-in layout.                                                                           |
| `isSecondaryLayout(name)`     | `boolean`           | Whether the layout is secondary (non-alphabetic, e.g. `numeric`, `fkeys`).                                             |
| `getLocaleLayout()`           | `string`            | Detect the best built-in layout for the current UI5 locale. Falls back to `"qwerty"`.                                  |
| `composeLayout(...sources)`   | `LayoutDefinition`  | Splice rows from built-in layout names and row arrays, in order. A name no built-in has contributes nothing and warns. |
| `getKeyIcon(keyValue)`        | `string?`           | Default icon URI for a special key value, or `undefined` if none.                                                      |
| `setI18nResolver(fn)`         | `void`              | Set a resolver callback for i18n text overrides, or `null` to clear.                                                   |
| `setGlobalTargetResolver(fn)` | `void`              | Set a global custom resolver for locating native inputs. Pass `null` to clear.                                         |
| `getGlobalTargetResolver()`   | `Function \| null`  | Returns the global target resolver, or `null`.                                                                         |

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

The library ships with thirteen built-in layouts:

| Layout            | Description                                                             | Rows |
| ----------------- | ----------------------------------------------------------------------- | ---- |
| `qwerty`          | Standard QWERTY with number row                                         | 5    |
| `qwertz-de`       | German QWERTZ with Umlaute (ä, ö, ü, ß)                                 | 5    |
| `numeric`         | Numbers with basic operators                                            | 4    |
| `special`         | Special characters and symbols                                          | 4    |
| `numpad`          | Compact numeric keypad (calculator)                                     | 5    |
| `fkeys`           | Function keys F1-F12 (standalone)                                       | 3    |
| `nav`             | Navigation keys (arrows, Home/End, Pg)                                  | 4    |
| `ja-romaji`       | Japanese Romaji (QWERTY base with JIS punctuation)                      | 5    |
| `ja-kana`         | Japanese Kana direct-input (JIS X 6002)                                 | 5    |
| `ja-kana-compact` | Japanese Kana for narrow keyboards, no row wider than twelve key widths | 5    |
| `arabic`          | Arabic (standard Arabic 101 layout)                                     | 5    |
| `ko-hangul`       | Korean Hangul Dubeolsik (KS X 5002)                                     | 5    |
| `qwerty-es`       | Spanish QWERTY with accented vowels and ñ                               | 5    |

Layout switching is driven by special key values in the layout definition:

```ts
// A key that switches to the numeric layout when tapped
{ value: "{layout:numeric}", label: "123", type: "modifier" }
```

The `keyboardType` property provides a shortcut for common configurations:

- **`Full`**: renders the active `layout` property (default: QWERTY)
- **`Numeric`**: renders the numeric layout regardless of the `layout` property
- **`Numpad`**: renders the numpad layout regardless of the `layout` property

`keyboardType` is a _constraint on the default_ rather than a hard lock. A user-initiated `{layout:X}` tap (e.g. a custom `{layout:special}` key added through a `customLayouts` entry on the numpad surface) takes precedence and shows the user's pick. A subsequent `{layout:base}` tap re-engages the `keyboardType` constraint and returns to the constrained default. `setLayout`, `setKeyboardType`, `resetKeyboardType`, and auto-type detection all clear the user pick. A cleared pick returns to the tracked base layout, so Full -> Numpad -> Full lands on the base; a pick of a primary layout (for example `{layout:qwertz-de}`) is itself the base and stays.

While the `Numpad`/`Numeric` constraint is active (even on a user-driven pick that overrides it), a rendered layout reshapes its `{layout:base}` key. Where the key is useless it is dropped: on the constrained layout itself (tapping it would re-render the same surface), and on a layout that also carries a `{layout:numpad}`/`{layout:numeric}` key matching the constraint (there the key would sit dead next to one reaching the same numbers surface, e.g. next to "123" on the numeric keyboard's symbols layout). Where `{layout:base}` is instead the only route back to the constrained default (on the numpad's symbols layout "123" leads to the numeric layout, so `{layout:base}` is the only way back to the numpad; likewise the `nav` and `fkeys` layouts), the key is kept but relabeled: under the constraint it returns to the number surface rather than letters, so it renders as a back icon (accessible name "Return to numbers") instead of the misleading "ABC" text.

Programmatic base-layout helpers make layout round-trips explicit:

```ts
const kb = this.byId("keyboard") as KioskKeyboard;

kb.setLayout("qwertz-de");
kb.setLayout("numeric");

kb.getBaseLayout(); // "qwertz-de"
kb.resetLayout(); // back to qwertz-de
```

### Responsive Behavior Overview

| Scenario                                                     | Detection                                                                  | Adapts automatically?      | Consumer CSS needed?                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| **Width** (any container width)                              | CSS `@container` queries at 30rem / 20rem                                  | Yes                        | No                                            |
| **Layout rows** (a layout with a compact counterpart)        | `ResizeObserver` on the keyboard's own box, at 22rem                       | With `autoCompact`         | No                                            |
| **Height** (flex/grid parent with fixed height)              | Root element inherits constraint via `max-height: 100%; min-height: 0`     | Yes                        | No                                            |
| **Height** (explicit constraint on root)                     | `max-height` or `height` on the keyboard root                              | Yes                        | No                                            |
| **Height** (`height: auto` parent, unconstrained)            | `max-height: 100%` resolves to no constraint                               | Correctly stays full size  | No                                            |
| **Height** (deeply nested ancestor constraint, no flex/grid) | Intermediate `height: auto` ancestors break `max-height: 100%` propagation | No                         | `max-height` or `height` on the keyboard root |
| **Docked mode**                                              | Viewport-driven, fixed positioning                                         | Skipped (always full size) | No                                            |
| **Compact density**                                          | `sapUiSizeCompact` CSS class                                               | Yes                        | No                                            |

### Constrained Containers and Popovers

The keyboard root element sets `max-height: 100%; min-height: 0; overflow: hidden` by default, so placing it inside a flex or grid parent with a fixed height automatically triggers responsive scaling without any additional CSS.

| Container height | Behavior                                              |
| ---------------- | ----------------------------------------------------- |
| Above 16 rem     | Full layout (default key sizes)                       |
| 12-16 rem        | Compact layout (`cqShort`, reduced key height)        |
| Below 12 rem     | Minimal layout (`cqTiny`, further reduced key height) |

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

> [!TIP]
> You can also fine-tune key sizes via `--ui5KioskKeyboard-keyHeight` and other [CSS custom properties](#public-css-custom-properties) to fit more content into a smaller container without relying solely on the automatic breakpoints.

### Layout Definition Format

Layouts are arrays of rows, where each row is an array of `KeyDefinition` objects. This is the shape a `CustomLayout`'s `rows` takes:

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

| Field           | Type       | Description                                                                                                                                                                             |
| --------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | `string`   | Character or action (`{backspace}`, `{enter}`, `{shift}`, `{layout:name}`, `{fkey:name}`)                                                                                               |
| `label`         | `string`   | Display label. Omit to resolve automatically (i18n for special keys, `value` for regular keys). Set to `""` to suppress (icon-only). When `icon` is also present, both render together. |
| `shiftLabel`    | `string`   | Label when Shift is active.                                                                                                                                                             |
| `shiftValue`    | `string`   | Value when Shift is active (defaults to uppercase of `value`).                                                                                                                          |
| `capsLockLabel` | `string`   | Label for `{shift}` key when Caps Lock is active. Omit for i18n "Caps Lock". Set to `""` to suppress. Only meaningful on `{shift}` keys.                                                |
| `capsLockIcon`  | `string`   | Icon for `{shift}` key when Caps Lock is active. Independent of `icon`. Defaults to `sap-icon://locked`. Only meaningful on `{shift}` keys.                                             |
| `width`         | `KeyWidth` | Proportional key width, from the closed set `"1.25"` \| `"1.5"` \| `"1.75"` \| `"2"` \| `"2.25"` \| `"2.75"` \| `"space"`. Omit for a standard 1x key; any other string renders at 1x.  |
| `type`          | `KeyType`  | `"default"` \| `"modifier"` (subdued) \| `"action"` (prominent) \| `"space"`. Styling, except that `modifier`, `action` and `space` keys never take an accent-variant table.            |
| `icon`          | `string`   | SAP icon URI or Unicode character. Renders inline with label when both are present (customizable via `--ui5KioskKeyboard-dualDirection`). Set `label=""` for icon-only.                 |
| `variants`      | `string[]` | Long-press / right-click accent-variant popup glyphs for this key. Overrides the built-in `accentVariants` table; `[]` suppresses the popup. E.g. `["ä", "à", "á", "â"]`.               |
| `ariaLabel`     | `string`   | Explicit accessible name for the key; highest priority in the name-resolution chain (else label, else i18n, else value).                                                                |

### Accent variants (German umlauts)

The `qwertz-de` layout ships dedicated **ä / ö / ü** keys and **ß**, and a German-locale app selects it automatically (`de` → `qwertz-de`, see [Locale-Based Default Layout](#locale-based-default-layout)). To reach accented letters from _any_ Latin layout, a key can carry a long-press popup of variants.

**Long-press / right-click popup.** Press and hold a key (or right-click it) to open a small popup of accent variants; tap, drag-and-release, or arrow-and-Enter to insert one, Escape to dismiss. A plain tap still inserts the key's base character. When Shift or Caps Lock is active, the popup surfaces the uppercase forms, including the capital sharp S **ẞ** for `s`/`ß`.

**Accessibility.** A variant key carries a corner-triangle hint and advertises the popup to assistive technology with `aria-haspopup="dialog"`. Keyboard users open it with the context-menu gesture (the Menu key, or Shift+F10) on the focused key; the key's own Enter/Space still types its base character, so the key carries no `aria-expanded` state.

**Built-in Latin-diacritics table.** Set the `accentVariants` property to merge a broad Latin-diacritics table (à á â ä, ç, è é ê ë, ñ, ö œ ø, ß, ü, …) onto every matching base letter of the resolved layout, so umlauts and accents work on any Latin layout without editing layout data:

```xml
<kiosk:KioskKeyboard accentVariants="true" controls="myInput" />
```

**Per-key `variants`.** Author or override the popup for a single key with the `variants` field on its `KeyDefinition`. An explicit `variants` always wins over the built-in table; the key's own `value` stays the tap default and is not repeated in the list:

```ts
const myLayout: LayoutDefinition = [
  [
    { value: "a", variants: ["ä", "à", "á", "â"] },
    { value: "o", variants: ["ö", "ø"] },
  ],
];
```

Because an explicit `variants` wins, declaring `variants: []` suppresses the popup on a single key the built-in table would otherwise cover, e.g. to skip a diacritic already reachable as its own dedicated key on the layout.

**Per-layout variant tables.**

With `accentVariants` on, the built-in Latin table is resolved through two further tiers before it is applied: the host's `defaultVariants` table, which applies under every layout, and the `variants` of the `customLayouts` entries naming that layout. The tiers are layered **built-in → `defaultVariants` → custom layout**, each **merged onto** the one below per base letter, so a tier extends the one under it rather than replacing it and only the letters it names change. This targets a locale's layout without editing layout data, e.g. Polish variants on the layout the current locale resolves to:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";

const kb = new KioskKeyboard({
  accentVariants: true,
  customLayouts: [
    new CustomLayout({
      name: KioskKeyboard.getLocaleLayout(),
      variants: { s: ["ś", "š"], z: ["ż", "ź", "ž"] },
    }),
  ],
});
```

Base letters must be **lowercase**; a mis-keyed letter is logged and the entry skipped, rather than silently arming nothing.

Three levels of opt-out, narrowest first:

| Recipe                              | Effect                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| `variants: { s: [] }` on the entry  | Drops one base letter, leaving the rest of the table     |
| `suppress: [LayoutFacet.Variants]`  | Opts that layout out of variants entirely                |
| `variants: []` on a `KeyDefinition` | Suppresses the popup on that one key, whatever the table |

The `defaultVariants` tier only ever adds; it has no suppression spelling. Turn the whole affordance off with `accentVariants="false"`, which is the default.

The five non-Latin built-in layouts (`ja-romaji`, `ja-kana`, `ja-kana-compact`, `arabic`, `ko-hangul`) resolve the built-in table to nothing, so `accentVariants` adds no popups there; supply a `variants` table on a custom layout (or a `defaultVariants` table) to opt one back in, and because there is no built-in tier to merge onto, those tiers stand alone. That exclusion list is only the shipped default for those built-ins; it never locks you out. A **custom** layout whose Latin-looking keys should _not_ surface accent popups (a transliteration IME, say) opts out with `suppress="Variants"`, which discards `defaultVariants` along with the built-in tier. Action, modifier, and space keys never take table variants even when a table is keyed to their value.

`LATIN_DIACRITIC_VARIANTS` is re-exported from `ui5/kiosk/library` for inspection (to read what the defaults are, or to build a table from them); merging means you no longer need to spread it to extend the defaults.

Declaring a variant table while `accentVariants` is off applies nothing, and logs a warning saying so.

---

## Composition Middleware

Some scripts require processing between key press and text insertion. For example, Japanese Kana needs dakuten/handakuten composition (ka + dakuten = ga), and Korean Hangul needs jamo-to-syllable composition (individual consonants and vowels combine into syllable blocks).

The UI5 library includes composition middleware that activates automatically when the associated layout is active. No configuration needed. The middleware is always available in the library preload.

### Built-in Middleware

| Middleware       | Layout                       | Behavior                                                 |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| `kana-dakuten`   | `ja-kana`, `ja-kana-compact` | Composes base kana + dakuten/handakuten into voiced kana |
| `hangul-compose` | `ko-hangul`                  | Composes jamo into Hangul syllable blocks with preedit   |

### Custom Middleware

Implement the `CompositionMiddleware` interface and supply the factory on the `customLayouts` entry for that layout:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
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

const kb = new KioskKeyboard({
  customLayouts: [new CustomLayout({ name: "my-layout", rows: myRows, middleware: createMyMiddleware })],
  layout: "my-layout",
});
```

The `handleKey` method receives:

- `key`: the raw key value from the layout definition (e.g., `"a"`, `"{backspace}"`, `"{enter}"`)
- `target`: the DOM input element the keyboard is typing into

When `handleKey` returns `true`, the keyboard skips default handling. The middleware is responsible for modifying the target's value. Use the control's public `keyboard.insertText(text)` and `keyboard.deleteBackward()` methods to do so: they update the caret/selection and fire UI5 `liveChange` so the control's model binding stays in sync. (Do not reach into `ui5/kiosk/internal/*`, which is unstable, see [API stability](#api-stability).)

Middleware lifecycle:

- **Layout switch**: `commit()` is called, instance discarded. A fresh instance is created when the layout activates again. Covers both the `{layout:*}` key and a programmatic `setLayout()`.
- **Target switch**: `commit()` is called and the instance is discarded, so an in-progress syllable is flushed to the old input and the new target starts a fresh composition.
- **Component destroyed**: `reset()` is called. In-progress composition is discarded, not flushed.

---

## Function Keys (F1-F12)

SAP GUI transactions rely heavily on function keys (F1 Help, F3 Back, F4 Value Help, F5 Refresh, F8 Execute). Kiosk and terminal setups that lack physical keyboards need virtual F-key access. The library provides three approaches:

### Approach 1: Fn button on base layouts

Every built-in base layout except `ja-romaji` includes an **Fn** button on the bottom row, as does the secondary `nav` layout. Tapping it switches to the standalone `fkeys` layout (F1-F12 + ABC to return). This is the default, no configuration needed. `ja-romaji` omits it by Japanese IME convention, which claims that key position for the Romaji/Kana toggle; switch to `ja-kana` to reach the F-keys.

### Approach 2: Composed layout with permanent F-key row

Compose a custom layout with the shared `fkey-row` module to render a full keyboard with an F1-F12 row permanently visible on top (6 rows total):

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";

const kb = new KioskKeyboard({
  customLayouts: [new CustomLayout({ name: "qwerty-fk", rows: KioskKeyboard.composeLayout([fkeyRow], "qwerty") })],
  layout: "qwerty-fk",
  controls: ["myInput"],
});
```

`composeLayout` splices its sources in order: a string names a built-in layout and contributes its rows, anything else contributes rows directly.

A custom layout declares its own attributes alongside its rows, which is how it marks itself an auxiliary surface or states the language of its keycaps:

```ts
new CustomLayout({
  name: "ar-symbols",
  rows: KioskKeyboard.composeLayout([symbolRow], "arabic"),
  keycapLang: "ar",
  layoutRole: LayoutRole.Secondary,
});
```

An attribute left out falls back to the built-in layout of the same name, so overriding a built-in keeps its attributes until the custom layout says otherwise.

In a declarative XML view the rows come from a JSON model: `<kiosk:CustomLayout name="ar-symbols" rows="{layouts>/arSymbols}" keycapLang="ar" layoutRole="Secondary" />`. See [Custom Layouts](#custom-layouts).

See [Custom F-key variant layouts](#custom-f-key-variant-layouts) for more details.

### Approach 3: Standalone fkeys layout

Use the `fkeys` layout directly for an F-key keyboard. F1-F12 fill the first two rows; the bottom row carries an **ABC** key (returns to the base layout), a **Nav** key (switches to the navigation layout), and **Enter**:

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

`keyPress` fires first. If it is not cancelled, the component then dispatches a synthetic `KeyboardEvent("keydown")` to the target input for all F-keys (F1-F12) and navigation keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown).

> [!IMPORTANT]
> Browsers treat synthetic `KeyboardEvent` instances as untrusted (`isTrusted: false`) and block them from triggering security-sensitive browser actions such as page reload, fullscreen, or developer tools. A synthetic F5 keydown does **not** reload the page.

To work around this limitation, the component has built-in action handlers for exactly two keys:

- **F5**: calls `location.reload()` (unless `keyPress` is cancelled with `preventDefault()`)
- **F11**: toggles fullscreen via `document.documentElement.requestFullscreen()` / `document.exitFullscreen()` (unless cancelled)

All other F-keys (F1-F4, F6-F10, F12) dispatch the synthetic `keydown` to the target input but have no built-in browser action. The `keyPress` event is where the consuming app handles those keys.

```xml
<kiosk:KioskKeyboard layout="qwerty" fKeyMode="Native" controls="myInput" />
```

Handle other F-keys via the `keyPress` event:

```typescript
onKeyPress(event: Event<{ key: string }>): void {
  if (event.getParameter("key") === KeyName.F1) {
    event.preventDefault(); // optional: suppress default key-press behavior
    this.showHelpDialog();
  }
}
```

Or in XML view:

```xml
<kiosk:KioskKeyboard fKeyMode="Native" keyPress=".onKeyPress" />
```

When `fKeyMode="Native"`, `keyPress` fires **before** the synthetic `keydown` is dispatched, so `preventDefault()` in the handler suppresses everything downstream: the synthetic `keydown`, the built-in F5/F11 action, and the caret move. A global keyboard shortcut system listening on the document (for example, ui5-lib-hotkeys) sees the F-key event only when the press was not vetoed.

This mirrors how SAP GUI intercepts physical F-keys and maps them to transaction commands. The virtual keyboard fires the event; your application provides the meaning.

### Custom F-key variant layouts

Import the shared `fkey-row` module to compose custom layouts with an F-key row on top:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import navRow from "ui5/kiosk/layouts/nav-row";
import navRowCompact from "ui5/kiosk/layouts/nav-row-compact";
import fkeyRowCompact from "ui5/kiosk/layouts/fkey-row-compact";
import type { LayoutDefinition } from "ui5/kiosk/types";

// Define your custom base layout
const azertyFr: LayoutDefinition = [/* ... */];

// Compose variants with F-keys, nav, or both on top
const azertyFrFk: LayoutDefinition = [fkeyRow, ...azertyFr];
const azertyFrNav: LayoutDefinition = [navRow, ...azertyFr];
const azertyFrFkNav: LayoutDefinition = [fkeyRow, navRow, ...azertyFr];

// `nav-row-compact` seats the same eight nav keys as two rows of four, for
// keyboards narrower than about 20rem where one row of eight leaves each key
// around 30px wide. See docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md for switching.
const azertyFrNavCompact: LayoutDefinition = [...navRowCompact, ...azertyFr];
const azertyFrFkCompact: LayoutDefinition = [...fkeyRowCompact, ...azertyFr];

const kb = new KioskKeyboard({
  customLayouts: [
    new CustomLayout({ name: "azerty-fr", rows: azertyFr }),
    new CustomLayout({ name: "azerty-fr-fk", rows: azertyFrFk }),
    new CustomLayout({ name: "azerty-fr-nav", rows: azertyFrNav }),
    new CustomLayout({ name: "azerty-fr-fk-nav", rows: azertyFrFkNav }),
    new CustomLayout({ name: "azerty-fr-nav-compact", rows: azertyFrNavCompact }),
    new CustomLayout({ name: "azerty-fr-fk-compact", rows: azertyFrFkCompact }),
  ],
  layout: "azerty-fr-fk",
});
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

An F-key tap spends one-shot Shift like any other non-modifier key (Caps Lock is unaffected), and the `shiftKey` parameter is passed along so applications can distinguish shifted F-key presses.

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

Additional mappings are supplied by the `locales` of a `customLayouts` entry:

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";

const kb = new KioskKeyboard({
  customLayouts: [
    new CustomLayout({ name: "azerty-fr", rows: azertyFr, locales: ["fr"] }),
    new CustomLayout({ name: "custom-pt-br", rows: customPtBr, locales: ["pt-br"] }),
  ],
});
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

Both `show()` and `close()` are idempotent; calling them multiple times has no effect. They fire `afterOpen` and `afterClose` immediately.

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

> For host controls/wrappers, typing and auto-type resolve inner native `<input>/<textarea>` from either light DOM or Shadow DOM when available via `getFocusDomRef()`. Auto-show claiming still depends on the focused event target and UI5 control resolution.

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

All standard `sap.m` input controls (`Input`, `TextArea`, `SearchField`, `StepInput`) satisfy these requirements by default.

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

## Text Insertion

Keys write into the target the way the platform does. While the target input holds focus, the keyboard selects the range it is about to replace and performs the edit through `document.execCommand("insertText" | "delete")`, so the browser applies `maxlength` itself and records the edit on its own undo stack - Ctrl+Z in the target reverts keyboard input exactly as it reverts physical typing. The grapheme cluster Backspace removes is still resolved in JS beforehand, because the engines disagree on where one ends.

The platform path needs a focused target **whose input type supports selection**. When the target does not hold focus - a programmatic `setControls()` + `show()` that never moved focus, for instance - or its type refuses `setSelectionRange()` (`type="number"` and `type="email"` throw), or the command is unavailable or declines it, the value is assigned instead and `maxlength` is applied in JS. The resulting text is the same on both paths; the eventing is not.

|                                    | Platform edit                                                                              | Assignment                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| `maxlength`                        | Applied by the browser                                                                     | Applied in JS               |
| Browser undo stack                 | Edit recorded                                                                              | Not recorded                |
| DOM `input` event on the target    | One, dispatched by the platform                                                            | None                        |
| `liveChange` on the target control | One - the control's own where it raises one from `input`, otherwise raised by the keyboard | One, raised by the keyboard |

So `liveChange` fires once per edit either way and data binding stays in step on both paths. Bind to it rather than to the DOM `input` event: **a raw `input` listener on the target's DOM element observes the keyboard's edits only while that target holds focus.** An edit that a saturated `maxlength` leaves empty writes nothing and raises nothing.

Read-only and disabled targets are never written to.

## Interop Cookbook

### Integration Style

- Declarative (XML properties like `controls`, `autoShow`, `autoType`) is recommended for standard UI5 forms.
- Imperative (`setControls()`, `show()`, `close()`) is recommended for dynamic targets, custom controls, and web component bridges.
- Mixing both is valid: use declarative defaults, then override imperatively for edge flows.

### Standard UI5 Controls

Use `sap.m.Input`, `sap.m.TextArea`, or `sap.m.StepInput` with the `controls` property (single or multiple field IDs):

```xml
<m:Input id="firstName" />
<m:Input id="lastName" />
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" controls="firstName,lastName" />
```

### Custom UI5 Controls

For auto-show + typing to work, the control should:

- resolve from DOM to UI5 control via `Element.closestTo()`
- expose `getFocusDomRef()` that returns `HTMLInputElement` or `HTMLTextAreaElement`
- ideally support `setValue(string)` plus `liveChange` (and optionally `change`)

Minimal programmatic fallback:

```ts
keyboard.setControls([myCustomControl.getId()]);
keyboard.show();
```

### Web Components and Shadow DOM

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

## Auto-Type

When `autoType="true"` (requires `autoShow="true"`), the keyboard inspects the focused input's metadata and automatically switches between Full and Numpad keyboard types.

```xml
<kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" />
```

**Detection order** (first match wins):

1. UI5 control `getType()`: `"Number"` or `"Tel"` → Numpad
2. UI5 control name: `sap.m.StepInput` → Numpad
3. DOM `inputmode` attribute: `"numeric"`, `"decimal"`, or `"tel"` (case-insensitive) → Numpad
4. HTML `type` attribute: `"number"` or `"tel"` → Numpad
5. Fallback → Full

When the user tabs from a numeric input to a text input, the keyboard switches back to Full automatically.

**Explicit override:**

Setting `keyboardType` explicitly (via XML, constructor, or `setKeyboardType()`) disables auto-type detection. The keyboard respects the explicit type and never overrides it. Call `resetKeyboardType()` to re-enable auto-type. The `keyboardTypeChange` event reports whether a change was auto-detected via its `autoDetected` parameter.

---

## controls

The `controls` property provides declarative input targeting. List one or more input control IDs and the keyboard will automatically target whichever one last received focus.

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

<kiosk:KioskKeyboard controls="firstName, lastName, email" />
```

**How it works:**

1. The keyboard attaches a focus delegation to each resolved control.
2. When any of them receives focus, the keyboard sets it as the active target. In docked + `autoShow` mode, the keyboard also opens automatically.
3. When `autoShow` is active, `controls` acts as a filter: only the listed inputs trigger auto-show. Focusing an input **not** in the list will not open the keyboard.
4. IDs are resolved against the parent View first (view-local IDs), then globally, safe for XML views where IDs are prefixed.
5. IDs are comma-separated, and whitespace around one is not part of it: `controls="firstName, lastName"` and `controls="firstName,lastName"` are the same list.
6. **Composite controls** (e.g. `sap.m.StepInput`) are supported: when focus lands on the inner input, the keyboard walks the UI5 parent chain to find the registered ancestor.
7. An entry that names no control is skipped - the rest of the list still resolves - and is reported once as a `Log.warning` from `ui5.kiosk.KioskKeyboard`.

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

- **SAP icon URI** (e.g. `"sap-icon://accept"`): rendered via `rm.icon()` with `aria-hidden="true"`
- **Unicode character or emoji** (e.g. `"\u2191"`, `"\u23CE"`, `"\uD83D\uDD0D"`): rendered as a text span styled at icon size

Invalid SAP icon URIs are validated via `IconPool.getIconInfo()`. If an icon is not found, a warning is logged and the icon is skipped (the key degrades gracefully to label-only).

```ts
// SAP icon with label
{ value: "{enter}", icon: "sap-icon://accept", label: "Enter", type: "action" }

// Unicode arrow icon, label suppressed (icon-only)
{ value: "{fkey:ArrowUp}", icon: "\u2191", label: "", type: "modifier" }

// Unicode icon with label (dual rendering)
{ value: "{fkey:Home}", icon: "\u21F1", label: "Home", type: "modifier" }
```

### Custom key icons

There is no icon markup field: `icon` is a plain string, and raw HTML, `<svg>` and `<img>` sources are not accepted. Anything beyond the two built-in value types comes from the UI5 icon registry, which reaches Font Awesome, Material Symbols or any other icon font.

**Third-party icon fonts.** A font registered through `IconPool.registerFont()` (public since UI5 1.56) becomes addressable as `sap-icon://<collectionName>/<iconName>`. Register it once, before the keyboard renders:

```ts
import IconPool from "sap/ui/core/IconPool";

IconPool.registerFont({
  fontFamily: "FontAwesome-Solid", // also the file base name
  collectionName: "fa", // the sap-icon:// host segment
  fontURI: sap.ui.require.toUrl("my/app/fonts"),
});
```

Two files must sit in `fontURI`, both named after `fontFamily`: `FontAwesome-Solid.woff2` (UI5 adds the `@font-face` itself, no CSS import needed) and `FontAwesome-Solid.json`, mapping icon name to hexadecimal code point:

```json
{ "paste": "e900", "send": "e901" }
```

Pass `metadata` inline instead to skip the JSON fetch. The metadata loads asynchronously; `IconPool.fontLoaded(collectionName)` resolves once it is available. A registered collection then renders exactly like a built-in SAP icon:

```ts
{ value: "{paste}", icon: "sap-icon://fa/paste", label: "", ariaLabel: "Paste", type: "action" }
```

**Emoji and Unicode glyphs** need no registration at all - any value that is not a `sap-icon://` URI is rendered as text at icon size, over the symbol-font fallback stack:

```ts
{ value: "{enter}", icon: "\uD83D\uDD0D", label: "" }
```

**Restyling in CSS.** The control renders in the light DOM, so page CSS reaches every icon without touching layout data. SAP icon glyphs come from `content: attr(data-sap-ui-icon-content)` on the core `.sapUiIcon::before` rule, which an author rule overrides without `!important`:

```css
/* Swap one key's glyph */
.ui5KioskKey[data-key="{enter}"] .ui5KioskKey__icon::before {
  content: "\21B5";
  font-family: "Segoe UI Symbol";
}
```

Declare `font-family` on `::before`, not on the icon span: the span carries an inline `font-family` written by the renderer that a class-level rule cannot beat. Icons that mirror in right-to-left mode carry `sapUiIconMirrorInRTL` and a replacement glyph inherits that flip; add `transform: none` to opt out. For a Unicode or emoji icon the glyph is a text node rather than a pseudo-element, so `::before` adds a second glyph instead of replacing it - restyle or hide the span instead.

`data-key` and the key/icon class names are part of the [DOM Contract](#dom-contract). The supported _styling_ API remains the `--ui5KioskKeyboard-*` custom properties, none of which carries a glyph.

**Accessible names.** Icons are always `aria-hidden="true"`, so a key with `label: ""` needs a name of its own. It resolves as `ariaLabel` -> visible label -> the built-in i18n entry for the token -> the raw `value`. A custom icon-only token has no i18n entry, so it would announce its raw value, and the control logs once per key value:

```
Icon-only key "{paste}" has no accessible name; set ariaLabel on the KeyDefinition.
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

| Property                           | Default | Description                                                       |
| ---------------------------------- | ------- | ----------------------------------------------------------------- |
| `--ui5KioskKeyboard-dualDirection` | `row`   | Flex direction (`row`, `column`, `row-reverse`, `column-reverse`) |
| `--ui5KioskKeyboard-dualIconSize`  | `1em`   | Icon font size in dual mode                                       |
| `--ui5KioskKeyboard-dualLabelSize` | `1em`   | Label font size in dual mode                                      |
| `--ui5KioskKeyboard-dualGap`       | `0.3em` | Gap between icon and label                                        |

#### Navigation key overrides

Navigation and function keys (`{fkey:*}`) default to column layout with scaled icons. These properties override the dual defaults for nav keys only. In the UI5 package, nav keys are identified by the `[data-fkey]` attribute (added automatically for keys with `{fkey:*}` values).

| Property                           | Default                                     | Description                                                |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `--ui5KioskKeyboard-fkeyDirection` | `column`                                    | Flex direction for nav/function keys                       |
| `--ui5KioskKeyboard-fkeyIconSize`  | `clamp(1em, 15cqi, 1.6em)`                  | Icon size, scales with key width via container query units |
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

At narrow key widths (at or below `7rem` per key), dual keys automatically hide the text label using the sr-only pattern (`clip-path: inset(50%)`). The icon remains visible and is scaled up to `--ui5KioskKeyboard-keyFontSize` so the key does not look empty, and the label stays in the accessibility tree as the key's accessible name. Nav/function keys get the same treatment: below this threshold `--ui5KioskKeyboard-fkeyIconSize` no longer applies, since its container-query scaling exists to balance an icon against a visible label.

This behavior is driven by a CSS `@container` query on individual keys (`container-type: inline-size`). It applies only to dual keys (those with both icon and label).

### Icon and label accessibility

- **Dual keys (icon + label visible):** The visible text provides the accessible name. No `aria-label` is set (WCAG 2.5.3 Label in Name).
- **Icon-only keys (`label: ""`):** The renderer sets `aria-label` from i18n for built-in special keys, or falls back to `value` for custom keys.
- **Icons** always have `aria-hidden="true"`. They are decorative when a label is present, and the `aria-label` handles accessibility when the label is suppressed.

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

`capsLockIcon` is evaluated independently of `icon`. Setting `icon: ""` does not suppress `capsLockIcon`.

### Renderer method decomposition

The UI5 renderer decomposes key content rendering into overridable methods for subclassing:

- `resolveKeyIcon(oControl, key)`: returns the effective icon string
- `renderKeyIcon(rm, oControl, icon)`: renders the icon element
- `renderKeyLabel(rm, oControl, key, label)`: renders the label element
- `renderKeyContent(rm, oControl, key, icon, label)`: orchestrates icon + label

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

| Value      | Behavior                                                                   | Use when                                         |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `"Custom"` | Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. | Dedicated kiosk terminal (no physical keyboard)  |
| `"Native"` | Always defer to the native keyboard; KioskKeyboard does not open on focus. | Desktop/mobile app where desktops have keyboards |
| `"Auto"`   | Desktop browsers → use KioskKeyboard. Phone/tablet → defer to native.      | Kiosk terminal that also serves mobile visitors  |

> [!NOTE]
> `"Auto"` relies on `sap/ui/Device` for device detection. Browsers cannot detect whether a physical keyboard is attached, so on any desktop browser, including a regular laptop, the virtual keyboard **will** appear. Use `"Native"` if that is not desired.

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

When Shift is active, the renderer shows uppercase labels and the Shift key gets the `ui5KioskKey--shiftActive` CSS class.

---

## Accessibility

- The keyboard root has `role="group"` with a configurable `aria-label` and `aria-roledescription="keyboard"`
- The keyboard root carries `aria-controls` naming the id of the control it is currently typing into, and drops the attribute when no target is active
- Each key has `role="button"` with an accessible name from visible text (when icon+label are both present) or `aria-label` (for icon-only keys where `label=""`)
- The Shift key has `aria-pressed` reflecting its toggle state
- Arrow keys navigate between virtual keys via roving tabindex; Home/End jump to the first/last key in the current row, Ctrl+Home/Ctrl+End to the first/last key of the whole grid
- Enter or Space activates the focused key, once per press: holding the key down does not repeat it. `{backspace}` is the only key that repeats on hold, and only from pointer input
- Shift held on that keystroke types the key's shifted glyph, so a capital is reachable without first activating `{shift}`. The Shift is transient: it does not latch the on-screen Shift state, so the keycap labels stay as they are. Ctrl, Alt and Meta do not activate a key
- A key activated from the keyboard shows the same pressed styling a pointer press gives, for as long as the activating key is held
- The keyboard is an F6 navigation group (`data-sap-ui-fastnavgroup="true"`)
- Disabled state applies `aria-disabled="true"` to both the root and individual keys
- ARIA live region announces keyboard open/close, Shift and Caps Lock, layout compaction, and accent-variant
  popup open/close to screen readers. The control speaks through `sap.ui.core.InvisibleMessage`, so the region
  is the framework's shared one in the static area (`#sap-ui-static`) rather than a node inside the keyboard -
  a docked keyboard hidden between uses cannot take its own announcements out of the accessibility tree with it
- A key carrying accent variants advertises them with `aria-haspopup="dialog"`. Keyboard users open the popup with the context-menu gesture (the Menu key, or Shift+F10) on the focused key, arrow/Home/End to choose, Enter or Space to insert, and Escape to dismiss and return focus to the key. The key carries no `aria-expanded`: its own Enter/Space types the base character rather than toggling the popup
- Keycaps written in a script other than the UI language carry a `lang` attribute on their label, so a screen reader announces them with that language's pronunciation rules (WCAG 2.2 SC 3.1.2 Language of Parts). The built-in `arabic`, `ja-kana`, `ja-kana-compact` and `ko-hangul` layouts declare `ar` / `ja` / `ja` / `ko`; `ja-romaji` declares none, because its keycaps are Latin letters and JIS punctuation and only the text they compose is Japanese. The attribute sits on the key label alone, since the keyboard's own label and its live region are UI-language text. Only a key that types a character carries the layout's script: space and the action keys take their label from i18n, and a layout-switch key is a control affordance rather than keycap content. A custom layout declares its own with the `keycapLang` property of a `customLayouts` entry
- Closing the keyboard or switching targets fires a `change` event on modified single-line inputs (mirrors physical keyboard commit behavior)
- Keys hold a 24x24 CSS px floor on both axes, meeting the WCAG 2.5.8 minimum touch target size, and grow with the root font size. The inline half is lifted below a 20rem-wide keyboard, where the densest rows cannot fit a full set of floored keys: keys shrink to fit there so that every key stays reachable rather than being clipped off the edge of a center-justified row. Below that width the 24x24 minimum is therefore not met. The block half holds at every width, so a `--ui5KioskKeyboard-keyHeight` set below 24px is raised to it, and a keyboard in a height-capped container clips rather than shrinking past the floor.

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

### Styling a single key

The control renders into the light DOM, so page CSS reaches any one key through the `data-key` attribute the renderer writes - no shadow boundary, no part names, no `!important`:

```css
/* Tint just the Enter key, and just the switch to the numeric layout */
.ui5KioskKey[data-key="{enter}"] {
  background: var(--sapButton_Emphasized_Background);
}
.ui5KioskKey[data-key="{layout:numeric}"] {
  font-weight: bold;
}
```

The value is the key's authored `value`, so `{shift}`, `{backspace}`, `{enter}`, `{layout:*}`, `{fkey:*}`, a space, or a single character all work, as does `[data-shift-value]` for the shifted face. Both attributes are part of the [DOM Contract](#dom-contract). Swapping a key's _glyph_ rather than its box is covered under [Custom key icons](#custom-key-icons).

> [!NOTE]
> The web component twin cannot offer this: its `data-key` is inside a shadow root, and `::part()` takes no attribute selectors. It exposes a bounded set of per-key `::part()` names instead - see [Styling a single key in the `kiosk-keyboard-webc` README](../kiosk-keyboard-webc/README.md#styling-a-single-key).

### Public CSS Custom Properties

The documented `--ui5KioskKeyboard-*` variables are the supported styling API. Internal `--_ui5KioskKeyboard-*` aliases and renderer classes remain private implementation details and may change without notice.

For the rationale behind default values, breakpoint thresholds, and scaling factors, see the [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md).

Override these on `.ui5KioskKeyboard` to fine-tune layout without `!important`:

| Property                                  | Default                                                                                                                        | Description                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `--ui5KioskKeyboard-border`               | `1px solid` _(theme)_                                                                                                          | Container border (set to `none` for borderless)                                                                  |
| `--ui5KioskKeyboard-borderRadius`         | _(theme)_                                                                                                                      | Container border radius                                                                                          |
| `--ui5KioskKeyboard-padding`              | `0.75rem`                                                                                                                      | Container padding                                                                                                |
| `--ui5KioskKeyboard-keyGap`               | `0.375rem`                                                                                                                     | Gap between keys and rows                                                                                        |
| `--ui5KioskKeyboard-keyHeight`            | `3rem`                                                                                                                         | Key height / touch target                                                                                        |
| `--ui5KioskKeyboard-keyPaddingInline`     | `0.25rem`                                                                                                                      | Horizontal key padding                                                                                           |
| `--ui5KioskKeyboard-keyPaddingInlineXs`   | `min(var(--ui5KioskKeyboard-keyPaddingInline), 0.125rem)`                                                                      | Horizontal key padding in extra-narrow mode                                                                      |
| `--ui5KioskKeyboard-keyPadding`           | `0 var(--ui5KioskKeyboard-keyPaddingInline)`                                                                                   | Full key padding shorthand                                                                                       |
| `--ui5KioskKeyboard-keyPaddingXs`         | `0 var(--ui5KioskKeyboard-keyPaddingInlineXs)`                                                                                 | Key padding at narrow widths                                                                                     |
| `--ui5KioskKeyboard-keyBorderColor`       | _(not declared)_                                                                                                               | Override all key border colors                                                                                   |
| `--ui5KioskKeyboard-variantHintInset`     | `0.1875rem`                                                                                                                    | Accent-variant corner hint inset from the key's top/end edge                                                     |
| `--ui5KioskKeyboard-variantHintSize`      | `0.3125rem`                                                                                                                    | Accent-variant corner hint size                                                                                  |
| `--ui5KioskKeyboard-variantHintColor`     | `@sapUiContentLabelColor` at 71% alpha on the resting fill, the key's own text color at 71% on the emphasized and active fills | Accent-variant corner hint color. Setting it pins one color across every key state (ignored under forced colors) |
| `--ui5KioskKeyboard-keyFontSize`          | `calc(var(--ui5KioskKeyboard-keyHeight) * 0.375)`                                                                              | Key label font size                                                                                              |
| `--ui5KioskKeyboard-keyShadow`            | _(theme)_                                                                                                                      | Key resting shadow                                                                                               |
| `--ui5KioskKeyboard-keyShadowHover`       | _(theme)_                                                                                                                      | Key hover shadow                                                                                                 |
| `--ui5KioskKeyboard-maxWidth`             | `100%`                                                                                                                         | Max width for the default inline keyboard                                                                        |
| `--ui5KioskKeyboard-dockedMaxWidth`       | `64rem`                                                                                                                        | Max width when docked                                                                                            |
| `--ui5KioskKeyboard-dockedShadow`         | _(theme)_                                                                                                                      | Shadow when docked                                                                                               |
| `--ui5KioskKeyboard-dockedZIndex`         | `100`                                                                                                                          | Z-index for the docked keyboard                                                                                  |
| `--ui5KioskKeyboard-modifierFontSize`     | `@sapUiFontSize`                                                                                                               | Modifier / action key font size                                                                                  |
| `--ui5KioskKeyboard-modifierFontScale`    | `0.8`                                                                                                                          | Scale factor capping modifier font relative to key font size                                                     |
| `--ui5KioskKeyboard-modifierShadow`       | _(theme)_                                                                                                                      | Modifier key resting shadow                                                                                      |
| `--ui5KioskKeyboard-modifierShadowHover`  | _(theme)_                                                                                                                      | Modifier key hover shadow                                                                                        |
| `--ui5KioskKeyboard-numpadMaxWidth`       | `20rem`                                                                                                                        | Numpad container max-width                                                                                       |
| `--ui5KioskKeyboard-numpadKeyMinWidth`    | `4rem`                                                                                                                         | Numpad key min-width                                                                                             |
| `--ui5KioskKeyboard-cqShortThreshold`     | `16rem`                                                                                                                        | Height threshold for `ui5KioskKeyboard--cqShort`                                                                 |
| `--ui5KioskKeyboard-cqTinyThreshold`      | `12rem`                                                                                                                        | Height threshold for `ui5KioskKeyboard--cqTiny`                                                                  |
| `--ui5KioskKeyboard-autoCompactThreshold` | `22rem`                                                                                                                        | Width at or below which `autoCompact` takes the compact layout                                                   |
| `--ui5KioskKeyboard-dualDirection`        | `row`                                                                                                                          | Flex direction for dual icon+label keys (`row` or `column`)                                                      |
| `--ui5KioskKeyboard-dualIconSize`         | `1em`                                                                                                                          | Icon font size in dual mode                                                                                      |
| `--ui5KioskKeyboard-dualLabelSize`        | `1em`                                                                                                                          | Label font size in dual mode (inherits modifier cap)                                                             |
| `--ui5KioskKeyboard-dualGap`              | `0.3em`                                                                                                                        | Gap between icon and label in dual mode                                                                          |
| `--ui5KioskKeyboard-fkeyDirection`        | `column`                                                                                                                       | Flex direction for nav/function keys                                                                             |
| `--ui5KioskKeyboard-fkeyIconSize`         | `clamp(1em, 15cqi, 1.6em)`                                                                                                     | Icon size for nav/function keys (scales with key width)                                                          |
| `--ui5KioskKeyboard-fkeyLabelSize`        | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)`                                                                                    | Label size for nav/function keys (responsive)                                                                    |
| `--ui5KioskKeyboard-fkeyGap`              | `0.05em`                                                                                                                       | Gap between icon and label for nav/function keys                                                                 |
| `--ui5KioskKeyboard-cjkFontFamily`        | _(not declared)_                                                                                                               | Override font stack for CJK glyph labels                                                                         |
| `--ui5KioskKeyboard-hangulFontFamily`     | _(not declared)_                                                                                                               | Override font stack for Hangul glyph labels                                                                      |
| `--ui5KioskKeyboard-indicFontFamily`      | _(not declared)_                                                                                                               | Override font stack for Indic glyph labels                                                                       |
| `--ui5KioskKeyboard-arabicFontFamily`     | _(not declared)_                                                                                                               | Override font stack for Arabic glyph labels                                                                      |

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
.ui5KioskKeyboard {
  --ui5KioskKeyboard-maxWidth: 64rem;
}
```

Docked keyboards default to `64rem` (1024px at the default root font-size) max-width and center automatically via `margin-inline: auto`.

Responsive font scaling uses CSS `@container` queries on the keyboard's rendered width, so embedded keyboards react to the width of their actual host container instead of only the viewport. For the scaling factors, the narrow-width font caps and `min()` override behavior, the padding swap, and height-responsive sizing, see the [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md) and [Responsive Layout Patterns](../../docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md).

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

This is more flexible than the threshold variables: you can
set any property at any number of breakpoints.

For a complete guide covering all built-in breakpoints, row wrapping behavior, and patterns for switching entire layouts per device size, see the [Responsive Layout Patterns](../../docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md) guide.

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

| Key                              | Default (English)                             | Used for                                                                               |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `KIOSK_KEYBOARD_LABEL`           | Virtual Keyboard                              | Default `aria-label` when `ariaLabel` property is empty                                |
| `KIOSK_KEYBOARD_ROLEDESCRIPTION` | keyboard                                      | `aria-roledescription` on the root element                                             |
| `KEY_SHIFT`                      | Shift                                         | Visual label and `aria-label` for the Shift key                                        |
| `KEY_ENTER`                      | Enter                                         | Visual label and `aria-label` for the Enter key                                        |
| `KEY_BACKSPACE`                  | Backspace                                     | Label for the Backspace key (visible text; aria-label when label is suppressed)        |
| `KEY_SPACE`                      | Space                                         | Label for the Space key (visible text; aria-label when label is suppressed)            |
| `ARIA_RETURN_TO_NUMBERS`         | Return to numbers                             | `aria-label` for `{layout:base}` while a Numpad/Numeric constraint is active           |
| `ARIA_CAPS_LOCK`                 | Caps Lock                                     | `aria-label` for the Shift key when Caps Lock is active                                |
| `ARIA_CAPS_LOCK_ON`              | Caps Lock on                                  | ARIA live region announcement                                                          |
| `ARIA_CAPS_LOCK_OFF`             | Caps Lock off                                 | ARIA live region announcement when Caps Lock is released                               |
| `ARIA_SHIFT_ON`                  | Shift on                                      | ARIA live region announcement                                                          |
| `ARIA_SHIFT_OFF`                 | Shift off                                     | ARIA live region announcement when Shift is released                                   |
| `ARIA_KEYBOARD_OPENED`           | Virtual keyboard opened                       | ARIA live region announcement on `show()`                                              |
| `ARIA_KEYBOARD_CLOSED`           | Virtual keyboard closed                       | ARIA live region announcement on `close()`                                             |
| `ARIA_LAYOUT_COMPACTED`          | Switched to the compact keyboard layout       | ARIA live region announcement when `autoCompact` takes a layout's compact form         |
| `ARIA_LAYOUT_UNCOMPACTED`        | Switched back to the standard keyboard layout | ARIA live region announcement when `autoCompact` gives it back                         |
| `ARIA_VARIANTS_OPENED`           | `Variants for {1}: {0}`                       | ARIA live region announcement when the accent-variant popup opens (count, base letter) |
| `ARIA_VARIANTS_CLOSED`           | Variants closed                               | ARIA live region announcement when the accent-variant popup closes                     |

The two `autoCompact` announcements name no layout on purpose: the layout a width picks is one the user never chose and never sees named, and an identifier dropped into a translated sentence stays untranslated. They also have to differ from each other: the two crossings are opposite moves, and one shared wording would not say which way the layout just went.

`ARIA_VARIANTS_OPENED` keeps `{0}` (the count) last on purpose: neither runtime substitutes a plural form, so a count placed in front of the noun would announce "1 variants for a" in every language that inflects. Keep the count trailing when you translate this key or supply it through a resolver.

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
ARIA_CAPS_LOCK_OFF=Verrouillage majuscules désactivé
ARIA_SHIFT_ON=Majuscules activées
ARIA_SHIFT_OFF=Majuscules désactivées
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

**Resolution order:**

The library resolves each key from its built-in resource bundle first, then passes the result to the resolver. The resolver's return value (if not `undefined`) replaces the built-in text.

**Locale reactivity:**

When the UI5 locale changes at runtime (e.g. via `Localization.setLanguage()`), all live `KioskKeyboard` instances re-render and the resolver is called again with the new locale.

**Automatic cleanup:**

The library automatically clears the resolver when the last live `KioskKeyboard` instance is destroyed. Explicit cleanup via `setI18nResolver(null)` is still recommended for apps that manage keyboard instances outside the normal view tree.

**TypeScript types:**

Import the resolver type for type-safe usage:

```ts
import type { I18nResolver } from "ui5/kiosk/types";
```

---

## Library Enums & Constants

The library exports TypeScript string enums and frozen `const` objects for type-safe comparisons. The UI5 property enums (`KeyboardLayout`, `KeyboardType`, `MobileKeyboard`, `FKeyMode`, and `LayoutRole` from [Custom Layouts](#custom-layouts)) are string enums registered via `DataType.registerEnum()` for XML view binding. `LayoutFacet` is a string enum too, but registers as a `DataType` over `string` because it is the component type of the `suppress` array property; `KeyName` and `NativeDispatchableKeyNames` are frozen `const` objects.

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
KeyboardLayout.JaKanaCompact; // "ja-kana-compact"
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
FKeyMode.None; // "None"

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

> [!NOTE]
> `KeyName` is not a UI5 DataType enum; it is a consumer convenience for type-safe comparisons in `keyPress` event handlers. Regular character keys fire their literal value (e.g. `"a"`, `"A"`, `"1"`) and are not covered by `KeyName`. Custom `{fkey:CustomAction}` keys fire their action name directly; use a string literal for those.

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# QUnit tests (ui5-test-runner, puppeteer backend)
npm run test:qunit

# E2E tests (Playwright), desktop
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

# Open the Playwright HTML report (includes visual diffs for failed snapshots)
npm run test:e2e:report

# NOTE: Visual baselines are tied to the Chromium build bundled with
# @playwright/test (pinned at the repo root). Bumping that version can shift
# rendering; regenerate ALL visual baselines across all packages when it changes.
# They also carry no platform suffix: a baseline is only valid for the OS it was
# generated on.

# Type check
npm run typecheck
```

---

## Further Reading

- [Architecture & Internals](../../docs/kiosk/ARCHITECTURE.md): control design, rendering, theming approach
- [Responsive Layout Patterns](../../docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md): breakpoints, per-tier customization, swapping layouts by size
- [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md): every custom property, its default, and the rationale behind it
- [Popover Layout-Switch Behavior](../../docs/kiosk/POPOVER-LAYOUT-SWITCH-BEHAVIOR.md): a known `sap.m.Popover` limitation and its workaround
- [Testing](../../docs/shared/TESTING.md): suites, visual baselines, and what CI runs

---

## Troubleshooting

**Keyboard does not open on input focus:**

- Ensure both `docked="true"` and `autoShow="true"` are set
- The focused element must be a text-entry `<input>` or `<textarea>` owned by a UI5 control (`Element.closestTo()` must resolve)
- If `controls` is set, only the listed inputs trigger auto-show
- Check the browser console for `Log.warning` messages from `ui5.kiosk.KioskKeyboard`

**Typing does not update the model/binding:**

- The target control must support `setValue(string)` and fire `liveChange`. All standard `sap.m` input controls support this by default
- For custom controls, ensure `getFocusDomRef()` returns the actual `<input>` or `<textarea>` element

**Native keyboard appears alongside the virtual keyboard:**

- Set `mobileKeyboard="Custom"` to suppress native keyboard via `inputmode="none"`
- If the target control re-renders while the keyboard is open, the suppression may be lost; see [Mobile Keyboard Detection](#mobile-keyboard-detection)

**Layout switches cause the keyboard to change size:**

- Set a fixed `contentHeight` on the `sap.m.Popover` to prevent content resizing during layout switches. See [Constrained Containers and Popovers](#constrained-containers-and-popovers)

**Physical keyboard highlighting doesn't work for custom layout keys:**

- Ensure custom key `value` strings don't conflict with built-in action keys (`{backspace}`, `{enter}`, `{shift}`, etc.)

**`change` fires later than expected:**

- On a single-line input `change` is commit-oriented: it fires on Enter, on close, and on a target switch, not per keystroke. Bind `liveChange` for per-keystroke updates

---

## When NOT to Use This Library

| Scenario                             | Use Instead                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Desktop-only application             | Physical keyboard (no virtual keyboard needed)                                |
| Mobile browser with native keyboard  | The default `mobileKeyboard="Auto"`, which defers to it on phones and tablets |
| Kanji conversion / candidate windows | Native OS input methods                                                       |
| Rich text editing                    | Dedicated rich text editor controls                                           |

This library is designed for **kiosk terminals**, **industrial touchscreens**, and **point-of-sale** applications where the OS does not provide a virtual keyboard or where a controlled input experience is required. Mixed desktop/mobile use needs no configuration: `mobileKeyboard` already defaults to `"Auto"`. The Japanese and Korean layouts ship composition middleware for kana voicing marks and Hangul syllable assembly, so those scripts are typable, but there is no candidate window and no kanji conversion.

---

## License

[MIT](../../LICENSE)
