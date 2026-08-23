<p align="center">
  <a href="https://www.npmjs.com/package/kiosk-keyboard-webc"><img src="https://img.shields.io/npm/v/kiosk-keyboard-webc.svg" alt="npm"></a>
  <a href="https://npmx.dev/package/kiosk-keyboard-webc"><img src="https://img.shields.io/npm/v/kiosk-keyboard-webc?label=npmx.dev&color=0a0a0a" alt="npmx"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://ui5.github.io/webcomponents/"><img src="https://img.shields.io/badge/UI5_Web_Components-2.x-green.svg" alt="UI5 Web Components"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript"></a>
</p>

<h1 align="center">kiosk-keyboard-webc</h1>

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md) and [ui5-lib-kiosk-keyboard](../kiosk-keyboard/README.md).

Native web component variant of the kiosk on-screen keyboard, built on the [UI5 Web Components](https://ui5.github.io/webcomponents/) framework (`@ui5/webcomponents-base`).

```html
<kiosk-keyboard layout="qwerty" controls="my-input"></kiosk-keyboard>
```

## Features

- **Standards-based custom element** (`<kiosk-keyboard>`) usable in any framework: plain HTML, React, Vue, Angular
- **SAP theming**: Horizon light/dark, HCB, HCW via CSS variables (automatic theme switching)
- **UI5 app integration**: consumable inside UI5 apps via the existing `WebComponent.extend()` bridge pattern
- **Multiple layouts**: QWERTY, QWERTZ-DE, Japanese Romaji, Japanese Kana (plus a narrow-width compact form), Arabic, Korean Hangul, Spanish, Numeric, Numpad, Special, F-keys, Navigation. Composite variants (e.g., QWERTY + F-key row) are trivial to compose from building block rows.
- **Locale-aware**: auto-selects layout based on browser locale (e.g. `de` → `qwertz-de`, `ja` → `ja-romaji`, `ar` → `arabic`, `ko` → `ko-hangul`, `es` → `qwerty-es`). Slot a `<kiosk-keyboard-custom-layout name="ja-kana" locales="ja">` into an element to switch the Japanese default to kana input for that instance.
- **Shift / Caps Lock**: single-click for one-shot shift, double-click for caps lock
- **Docked mode**: fixed-position keyboard at bottom of viewport with slide animation
- **Auto-show**: opens/closes automatically when target inputs receive/lose focus
- **Auto-type detection**: switches to Numpad for `type="number"`, `inputmode="numeric"`, `data-keyboard-type="Numpad"`, etc.
- **F-key and navigation key support**: configurable modes: `Virtual`, `Native`, `None`
- **Grapheme-aware**: correct backspace/navigation for emoji and multi-code-unit characters
- **Accessible**: ARIA roles, labels, live region announcements, roving tabindex, keyboard navigation, `prefers-reduced-motion`, `forced-colors`
- **i18n**: built-in English/German/Japanese/Arabic, extensible via custom resolver
- **Custom layouts in markup**: `<kiosk-keyboard-custom-layout>` children of the `customLayouts` slot carry a layout's rows, locales, keycap language, middleware and long-press variants, scoped to that one element

## Keyboard Overview

QWERTY (Full):

![QWERTY keyboard](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon.png)

Numpad:

![Numpad keyboard](../../docs/kiosk-webc/images/webc-numpad.png)

Numeric:

![Numeric keyboard](../../docs/kiosk-webc/images/webc-numeric.png)

### Key Types

Keys support different visual styles via the `type` property in `KeyDefinition`:

| Default                                                       | Default (hovered)                                                           | Modifier (`type: "modifier"`)                                   | Modifier (hovered)                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ![Default key](../../docs/shared/images/key-type-default.png) | ![Default key hovered](../../docs/shared/images/key-type-default-hover.png) | ![Modifier key](../../docs/shared/images/key-type-modifier.png) | ![Modifier key hovered](../../docs/shared/images/key-type-modifier-hover.png) |

- **Default**: visible border, `--sapButton_Background`. Used for character keys.
- **Modifier**: transparent background, no border (`--sapButton_Lite_Background`). Used for Shift, Caps Lock, layout switchers, F-keys (F1-F12), and navigation keys (Home, End, Arrows, PgUp, PgDn).
- **Action**: emphasized style (`--sapButton_Emphasized_Background`). Used for Enter, Backspace.

### Theme Preview

| `sap_horizon`                                                                      | `sap_horizon_dark`                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ![QWERTY in sap_horizon](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon.png) | ![QWERTY in sap_horizon_dark](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                          | `sap_horizon_hcw`                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ![QWERTY in sap_horizon_hcb](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_hcb.png) | ![QWERTY in sap_horizon_hcw](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_hcw.png) |

## Installation

Install from npm:

```bash
npm install kiosk-keyboard-webc
```

### Framework dependencies

This package depends on the UI5 Web Components framework (`@ui5/webcomponents`, `@ui5/webcomponents-base`, `@ui5/webcomponents-icons`, `@ui5/webcomponents-theming`) as regular `dependencies`, so they are installed automatically with `kiosk-keyboard-webc`; no separate install step is required.

If your app also uses UI5 Web Components directly (e.g., `@ui5/webcomponents` buttons, inputs), make sure your bundler dedupes a single instance of `@ui5/webcomponents-base` so the framework registries (custom elements, themes, i18n) are shared and duplicate-registration errors are avoided. This package's Vite build already dedupes `@ui5/webcomponents-base`.

### Tree-Shaking

The package declares a `sideEffects` field in `package.json` so that bundlers (Vite/Rollup, webpack) can correctly handle side-effectful modules during tree-shaking (see [Rollup side effects](https://rollupjs.org/configuration-options/#treeshake-modulesideeffects)). Only the genuinely side-effectful modules are listed: the component entries that register the custom elements (`KioskKeyboard`, `CustomLayout`), theme/i18n asset registration (`Assets`, `generated/**`), and the convenience bundle entries (`bundle.esm`, `kiosk-keyboard.bundle`).

> [!NOTE]
> All built-in layouts and their composition middleware (kana, Hangul) are pure data/factory modules that the registries (`core/layout-registry`, `core/middleware-registry`) statically import and reference. They are therefore always included in the bundle through normal tree-shaking, so no `sideEffects` marker is required.

In this monorepo, install all workspace dependencies once at the repository root:

```bash
npm install
```

## Browser Compatibility

The keyboard requires modern browser features for full functionality:

| Feature               | Used for                           | Baseline                                |
| --------------------- | ---------------------------------- | --------------------------------------- |
| `Intl.Segmenter`      | Grapheme-aware Backspace and caret | Chrome 87+, Firefox 125+, Safari 14.1+  |
| CSS Container Queries | Width-responsive sizing            | Chrome 105+, Firefox 110+, Safari 16+   |
| ResizeObserver        | Height-responsive sizing           | Chrome 64+, Firefox 69+, Safari 13.1+   |
| CSS `min()` / `max()` | Font-size capping                  | Chrome 79+, Firefox 75+, Safari 13.1+   |
| CSS Custom Properties | Consumer overrides                 | Chrome 49+, Firefox 31+, Safari 9.1+    |
| CSS `color-mix()`     | Theme-adaptive shadows             | Chrome 111+, Firefox 113+, Safari 16.2+ |
| Shadow DOM v1         | Component encapsulation            | Chrome 53+, Firefox 63+, Safari 10+     |

`Intl.Segmenter` is the effective floor. It reached Baseline in April 2024, when
Firefox 125 became the last engine to ship it, so that release is the oldest
Firefox the element supports. It is also the one entry with no graceful
degradation: the segmenter is constructed at module scope, so an engine without
it throws on import rather than losing a feature. Everything else degrades -
without container queries or `min()` the keyboard renders at full size with no
width-responsive font scaling, and without `color-mix()` the shadows stop
adapting to the theme.

## Consumption Modes

### 1. Standalone via `kiosk-keyboard-webc/bundle` (recommended)

Recommended for plain HTML, React, Vue, Angular, and most non-UI5 apps.

`kiosk-keyboard-webc/bundle` is the convenience entry point. It imports `Assets`, registers the custom element, loads theme and i18n assets, and inserts the SAP "72" font face.

> [!NOTE]
> The examples below use bare package specifiers (`kiosk-keyboard-webc/…`), which require a bundler (Vite, webpack, etc.) or an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap). For plain `<script>` usage without a build step, replace the specifier with the resolved path to `dist/kiosk-keyboard.bundle.js` (for example `./node_modules/kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js`).

> [!NOTE]
> The element is **client-only**: importing the bundle runs `customElements.define()` and registers the SAP font at module load, which throws during server-side rendering (Next.js, Nuxt, Analog). In an SSR framework, import it on the client only - e.g. Next.js `dynamic(() => import("kiosk-keyboard-webc/bundle"), { ssr: false })`, or import inside `useEffect` / `onMounted`.

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" controls="my-input"></kiosk-keyboard>
```

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
```

### 2. Advanced ESM via `kiosk-keyboard-webc` + `kiosk-keyboard-webc/Assets`

Use this when your app already manages UI5 Web Components dependencies and you want the bare component class entry point.

```ts
import "kiosk-keyboard-webc/Assets";
import KioskKeyboard from "kiosk-keyboard-webc";
```

Use this mode when you want to avoid the convenience bundle and keep control over how the component is composed into your app build. `Assets` is required here because the bare `kiosk-keyboard-webc` entry exports the component class only.

> [!IMPORTANT]
> **Font loading:**
>
> `kiosk-keyboard-webc/bundle` already imports `kiosk-keyboard-webc/Assets`, which in turn loads the SAP "72" font via `@ui5/webcomponents-base/dist/FontFace.js` and registers theme/i18n assets. If you use the bare `kiosk-keyboard-webc` entry directly, import `kiosk-keyboard-webc/Assets` yourself and make sure the "72" font is available (for example via the UI5 framework, `FontFace.js`, or a custom `@font-face` declaration).
>
> **Custom fonts:**
>
> If you override `--sapFontFamily` or set a custom `font-family` on the keyboard, the default key sizing may not fit the new font's glyph metrics. You may need to adjust `--kiosk-keyboard-key-height`, `--kiosk-keyboard-key-font-size`, or `--kiosk-keyboard-key-padding` to prevent clipping or excessive whitespace.

### 3. Inside a UI5 app

This package is not a native UI5 library, so the UI5-app story is different from `ui5-lib-hotkeys` / `ui5-lib-kiosk-keyboard`.

For UI5 apps, make sure your app can resolve npm ESM packages via `ui5-tooling-modules` in `ui5.yaml`. There are two integration paths:

#### 3a. Auto-Generated Wrapper (CEM-driven, recommended)

Published builds include `dist/custom-elements.json` (the Custom Elements Manifest), and the package declares the `customElements` field in `package.json`. The `ui5-tooling-modules` middleware reads this manifest and auto-generates a `sap.ui.core.webc.WebComponent` wrapper at serve/build time. No manual wrapper code needed.

```yaml
# ui5.yaml - config for CEM-driven web component consumption
builder:
  customTasks:
    - name: ui5-tooling-modules-task
      afterTask: replaceVersion
      configuration:
        addToNamespace: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
    - name: ui5-tooling-modules-middleware
      afterMiddleware: ui5-tooling-transpile-middleware
      configuration:
        addToNamespace: true
        useRelativeModulePaths: true
```

Then use the component directly in XML views:

```xml
<mvc:View xmlns:kb="kiosk-keyboard-webc">
  <kb:KioskKeyboard layout="qwerty" docked="true" />
</mvc:View>
```

In workspace development, run `npm run build` (or at least `npm run generateAPI`) in the webc package first so that `dist/custom-elements.json` exists. The CEM is produced by `generateAPI`; `npm run generate` only emits the CSS and i18n assets, not the manifest.

The framework version declared in `ui5.yaml` must be >= 1.120.0 for the CEM-driven web component transformation to activate. The [SAP-samples/uxc-integration](https://github.com/SAP-samples/uxc-integration) project is the official reference for the build-time configuration (`addToNamespace: true` on the task).

`useRelativeModulePaths: true` is needed for dev serve. Without it, the middleware redirects module requests to a namespace-prefixed path (`demo/hotkeys/thirdparty/...`) that only exists after `ui5 build`. During dev serve, modules are stored under their original npm names and the redirect target does not resolve. This is intentional middleware design ([ui5-community/ui5-ecosystem-showcase#1049](https://github.com/ui5-community/ui5-ecosystem-showcase/issues/1049)); the namespace rewriting of entry-point modules is a build-only step. `useRelativeModulePaths: true` skips the redirect and serves modules at their npm paths directly. See [`UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md`](../../docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) for a full path-mapping reference.

The demo app in this repository uses Path A (CEM-driven) for the `kiosk-keyboard` web component. The manual bridge (Path B below) is documented as a reference for consumers who need explicit metadata control.

#### 3b. `WebComponent.extend()` bridge (reference)

For full control over the UI5 metadata surface, create a manual bridge using `WebComponent.extend()`. This gives explicit property/event/method/association mappings and typed UI5 events. Since UI5 >= 1.138, camelCase event names in `metadata.events` auto-convert to kebab-case DOM events (e.g. `keyPress` maps to `key-press`), so explicit `mapping: { to: "..." }` on events is not needed.

> [!IMPORTANT]
> The bridge below binds `tag: "kiosk-keyboard"`, the canonical unscoped name. The module-system import registers that tag **only if scoping is off** (`pluginOptions.webcomponents.scoping: false`) on **both** the `ui5-tooling-modules` task and its middleware - the configuration in 3a above does not set it. With scoping left on, the middleware intercepts the import and registers `kiosk-keyboard-<hash>` instead; `customElements.get("kiosk-keyboard")` then finds nothing and the element stays unupgraded, with no error. Either turn scoping off, or load `dist/kiosk-keyboard.bundle.js` from a `<script>` tag outside `/resources/` so it registers the canonical tag without interception. See [CONSUMPTION.md](../../docs/kiosk-webc/CONSUMPTION.md#tag-scoping-and-the-manual-bridge).

```ts
import WebComponent from "sap/ui/core/webc/WebComponent";
import "kiosk-keyboard-webc/bundle"; // requires scoping: false (see note above)

const KioskKeyboardWebc = WebComponent.extend("my.control.KioskKeyboard", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: { type: "string", defaultValue: "", mapping: { type: "property", to: "layout" } },
      docked: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "docked" } },
      // ... additional property/event/method/association mappings
    },
  },
});
```

Use the bridge when you want predictable XML view metadata, typed UI5 events, or imperative methods such as `show()` / `close()` exposed as a UI5 control API.

### Choosing between the UI5 control and the web component

| Criterion         | `ui5-lib-kiosk-keyboard` (UI5 control)                       | `kiosk-keyboard-webc` (web component)                                    |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Framework**     | SAPUI5 / OpenUI5 only                                        | Any (plain HTML, React, Vue, Angular, UI5 via wrapper/bridge)            |
| **Theming**       | LESS variables (`@sapUiButton*`)                             | CSS custom properties + SAP theme token fallbacks                        |
| **i18n**          | UI5 ResourceBundle + `setI18nResolver()` callback            | Built-in EN/DE/JA/AR + `setI18nResolver()` callback                      |
| **Target inputs** | `controls` property + `setControls()` + `getActiveControl()` | `controls` attribute + `setTargetElement()` + `getActiveTargetElement()` |
| **Density**       | UI5 content density (`sapUiSizeCompact`)                     | `data-ui5-compact-size` attribute                                        |

Both packages share the same layout definitions (`KeyDefinition`, `LayoutDefinition`), the same custom-layout model (one element per layout carrying its rows, locales, keycap language, role, middleware and variants, plus a `defaultVariants` table on the host), and the same special-key syntax (`{shift}`, `{backspace}`, `{layout:name}`). The UI5 control collects those elements in a `customLayouts` aggregation, the web component in a `customLayouts` slot; the fields, their merge rules and the diagnostics are identical.

Event naming follows platform conventions: `keyPress` (camelCase) in the UI5 control vs `key-press` (kebab-case) in the web component. `layout-change` and `keyboard-type-change` carry the same payload on both sides. The others do not, so a handler written against one twin needs adapting for the other:

| Event                       | `ui5-lib-kiosk-keyboard`                                             | `kiosk-keyboard-webc`                                                 |
| --------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Key event payload           | `key`, `shiftKey`                                                    | `key`, `shiftKey`, `char`                                             |
| `key` for a character       | the resolved character (`"A"` while shifted)                         | the layout's raw value (`"a"`), with `char` carrying the resolved one |
| `key` for Backspace / Enter | `"Backspace"` / `"Enter"` (`KeyName` constants)                      | `"{backspace}"` / `"{enter}"` (the raw token)                         |
| Key event for `{shift}`     | not fired                                                            | fired; cancelling it vetoes the toggle                                |
| Key event for `{layout:*}`  | not fired                                                            | fired with the wrapped form; cancelling it vetoes the switch          |
| Composition middleware      | runs before the key event, so a consumed key never reaches a handler | runs after it, so the handler sees every key                          |
| Active-control event        | `activeControlChange` with `controlId`                               | `active-control-change` with `activeElement`                          |
| Open / close events         | `afterOpen` / `afterClose`, no parameters                            | `after-open` / `after-close` with `activeElement`                     |

One-shot Shift is spent on the same set of keys on both: any key that acts on the target - a character, an unknown `{...}` token, `{backspace}`, `{enter}`, an `{fkey:*}`, a committed accent variant, or a key the composition middleware consumed. A latched modifier is spent by the next non-modifier key, which is also what XKB, AccessX and Sticky Keys do.

Vetoing `key-press` does not change that set on either twin: the latch is consumed to produce the payload, so `preventDefault()` cancels the insertion, not the spend.

Caps Lock is sticky on both and never auto-releases. `{shift}` and `{layout:*}` spend nothing; selecting a layout resets the whole typing context, Caps Lock included.

Activating a focused keycap from the physical keyboard differs in one respect: the web component activates Space on release, following native `<button>` semantics, while the UI5 control routes Space through UI5's `sapselect`, a keydown pseudo-event, and so activates on press. Neither twin repeats on a held key, and `{backspace}` repeats only from pointer input. Both treat Shift+Enter and Shift+Space as "type the shifted glyph" and both reject Ctrl, Alt and Meta.

See [`UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md`](../../docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) for general guidance on web component consumption patterns inside UI5 apps.

## API Stability

Recommended stable consumer entry points and imports:

```ts
import {
  KioskKeyboard,
  CustomLayout,
  FKeyMode,
  KeyboardType,
  LayoutFacet,
  LayoutRole,
  MobileKeyboard,
} from "kiosk-keyboard-webc/bundle";

import type {
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  ActiveControlChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  CustomLayoutSpec,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
} from "kiosk-keyboard-webc/bundle";
```

For most applications, prefer `kiosk-keyboard-webc/bundle`. The bare `kiosk-keyboard-webc` entry point is also supported for advanced setups when paired with `kiosk-keyboard-webc/Assets`. Both register `<kiosk-keyboard-custom-layout>` alongside `<kiosk-keyboard>`; `kiosk-keyboard-webc/CustomLayout` is the subpath for the element class on its own.

Customization is per element via the `customLayouts` slot and the `defaultVariants` property. The static methods on `KioskKeyboard` are read-only inspectors (`getRegisteredLayout`, `getRegisteredLayoutNames`, `isBuiltInLayout`, `isSecondaryLayout`, `getLocaleLayout`), the global `setI18nResolver`, and `composeLayout` for splicing rows together. Import the class and call them directly:

```js
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";

const qwerty = KioskKeyboard.getRegisteredLayout("qwerty");
KioskKeyboard.setI18nResolver((key) => undefined);
```

Internal modules under `core/*` (e.g. `shift-state`, `dom-utils`, `input-operations`, `layout-registry`) are implementation details and may change without notice. Individual layout files under `layouts/*` are likewise internal; layouts are consumed by name through the `layout` attribute or the `rows` of a `<kiosk-keyboard-custom-layout>`. The shared row modules (`kiosk-keyboard-webc/layouts/fkey-row`, `kiosk-keyboard-webc/layouts/fkey-row-compact`, `kiosk-keyboard-webc/layouts/nav-row`, `kiosk-keyboard-webc/layouts/nav-row-compact`) are stable imports for composing custom variant layouts. Their keys are declared as `type: "modifier"` (the transparent Lite button style); override `type` on individual keys if you want the default bordered style instead. `nav-row-compact` seats the same eight nav keys as two rows of four, for keyboards narrower than about 20rem where one row of eight leaves each key around 30px wide; `fkey-row-compact` does the same for the twelve function keys, as two rows of six.

> [!NOTE]
> See the [API Stability Policy](../../docs/shared/API-STABILITY.md) for full details on stable vs internal import boundaries across all packages.

## Attributes / Properties

| Attribute             | Property          | Type                   | Default     | Description                                                                                                                                                                                                                                                     |
| --------------------- | ----------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`              | `layout`          | `string`               | `""`        | Layout **asked for** (e.g. `qwerty`, `qwertz-de`). Empty = auto-detect from locale. Not rewritten by what renders; read `effectiveLayout` for that.                                                                                                             |
| _(read-only)_         | `effectiveLayout` | `string`               | -           | The layout actually rendering, after the locale default, a `{layout:*}` key, a `keyboard-type` constraint and the `auto-compact` width tier. See [Requested vs. effective layout](#requested-vs-effective-layout).                                              |
| `keyboard-type`       | `keyboardType`    | `string`               | `"Full"`    | `"Full"`, `"Numpad"`, or `"Numeric"`.                                                                                                                                                                                                                           |
| `open`                | `open`            | `boolean`              | `false`     | Opens/closes the docked keyboard. Equivalent to `show()`/`close()`.                                                                                                                                                                                             |
| `docked`              | `docked`          | `boolean`              | `false`     | Fixed-position mode at bottom of viewport.                                                                                                                                                                                                                      |
| `auto-show`           | `autoShow`        | `boolean`              | `false`     | Auto open/close when target inputs gain/lose focus (requires `docked`).                                                                                                                                                                                         |
| `auto-type`           | `autoType`        | `boolean`              | `false`     | Auto-detect keyboard type from focused input's type/inputmode.                                                                                                                                                                                                  |
| `auto-compact`        | `autoCompact`     | `boolean`              | `false`     | Swap the resolved layout for its compact counterpart while the keyboard is too narrow to seat its rows, and back when the room returns. Of the built-ins only `ja-kana` declares a counterpart; a custom layout names its own with `compact`.                   |
| `disabled`            | `disabled`        | `boolean`              | `false`     | Disables all key interaction.                                                                                                                                                                                                                                   |
| `controls`            | `controls`        | `string`               | `""`        | Comma-separated IDs of target elements. Supports single or multiple inputs.                                                                                                                                                                                     |
| `accessible-name`     | `accessibleName`  | `string`               | `""`        | Custom ARIA label for the keyboard. Falls back to i18n "Virtual Keyboard".                                                                                                                                                                                      |
| `mobile-keyboard`     | `mobileKeyboard`  | `string`               | `"Auto"`    | `"Auto"` (defer to native on touch), `"Custom"`, or `"Native"`.                                                                                                                                                                                                 |
| `f-key-mode`          | `fKeyMode`        | `string`               | `"Virtual"` | `"Virtual"` (fire event + move cursor), `"Native"` (dispatch keydown), `"None"`.                                                                                                                                                                                |
| `accent-variants`     | `accentVariants`  | `boolean`              | `false`     | Overlay the built-in Latin-diacritics table so any Latin base key of the resolved layout exposes a long-press / right-click accent-variant popup. The five non-Latin built-ins are excluded by default. See [Accent variants](#accent-variants-german-umlauts). |
| _(programmatic only)_ | `defaultVariants` | `VariantTable \| null` | `null`      | Long-press variants applied under **every** layout, merged per base letter beneath anything a slotted `<kiosk-keyboard-custom-layout>` declares. Effective only with `accent-variants`. See [Accent variants](#accent-variants-german-umlauts).                 |

### Requested vs. effective layout

`layout` is a declaration and `effectiveLayout` is a resolved value, the same split the platform draws between `src` and [`currentSrc`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/currentSrc), and that `@ui5/webcomponents-base` draws between `dir` and `UI5Element.effectiveDir`.

Four things change what renders without writing to `layout`: the locale default when `layout` is empty, a `{layout:*}` key the user taps, a `keyboard-type` of `Numpad` or `Numeric` pinning its own surface, and an `auto-compact` width swap. Leaving the declaration alone is what lets each of them be undone - `auto-compact` needs the layout you asked for in order to restore it when the room comes back.

```ts
const kb = document.querySelector("kiosk-keyboard");
kb.layout; // "ja-kana"          - what you asked for
kb.effectiveLayout; // "ja-kana-compact"  - what is on screen right now
```

`effectiveLayout` is read-only and has no attribute. To be told when it changes rather than polling it, listen for `layout-change`, whose `autoDetected` flag separates a width swap from a request.

> [!NOTE]
> The UI5 control splits this differently: `KioskKeyboard#getLayout()` returns the **effective** layout, because a UI5 control property is live control state rather than an author declaration. Port `kb.effectiveLayout` to `kb.getLayout()`, not to the control's `layout` setting. See [Custom Layouts](../kiosk-keyboard/README.md#custom-layouts) in the control's README.

### Slots

| Slot            | Accepts                          | Description                                                                                                                             |
| --------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `customLayouts` | `<kiosk-keyboard-custom-layout>` | Per-element layouts and overlays, applied in DOM order. Never projected, so they render nothing. See [Custom Layouts](#custom-layouts). |

### Keyboard type override via `data-keyboard-type`

When `auto-type` is enabled, the keyboard detects the type from `inputmode` and `type` attributes. For cases where these don't convey the right keyboard type (e.g., composite web component hosts), you can set an explicit override via the `data-keyboard-type` attribute on the input or any ancestor element:

```html
<!-- Force Numpad for a custom control -->
<my-amount-field data-keyboard-type="Numpad">
  <input type="text" />
</my-amount-field>

<!-- Force Full keyboard even for type="number" -->
<input type="number" data-keyboard-type="Full" />
```

Valid values: `"Full"`, `"Numpad"`. This attribute takes priority over `inputmode` and `type` detection.

## Events

| Event                   | Detail                                                                          | Description                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key-press`             | `{ key: string, shiftKey: boolean, char?: string }`                             | Fired on key click. Cancelable. `char` is the resolved character (after shift); `undefined` for action/F-keys.                                                                    |
| `after-open`            | `{ activeElement: HTMLInputElement \| HTMLTextAreaElement \| null }`            | Fired when the docked keyboard enters the open state. `activeElement` is the input that's now active. State-change hook only; not a CSS transition-end event.                     |
| `after-close`           | `{ activeElement: HTMLInputElement \| HTMLTextAreaElement \| null }`            | Fired when the docked keyboard enters the closed state. `activeElement` is the input that was active just before closing. State-change hook only; not a CSS transition-end event. |
| `layout-change`         | `{ layout: string, autoDetected: boolean }`                                     | Fired when layout switches. `autoDetected` marks an `auto-compact` width swap rather than a request.                                                                              |
| `keyboard-type-change`  | `{ keyboardType: string, previousKeyboardType: string, autoDetected: boolean }` | Fired when keyboard type changes.                                                                                                                                                 |
| `active-control-change` | `{ activeElement: HTMLInputElement \| HTMLTextAreaElement \| null }`            | Fired when the active control changes (auto-show focus switch or programmatic `setTargetElement`).                                                                                |

## Text Insertion

Keys write into the target the way the platform does. While the target input holds focus, the keyboard selects the range it is about to replace and performs the edit through `document.execCommand("insertText" | "delete")`, so the browser applies `maxlength` itself and records the edit on its own undo stack - Ctrl+Z in the target reverts keyboard input exactly as it reverts physical typing. The grapheme cluster Backspace removes is still resolved in JS beforehand, because the engines disagree on where one ends. An input inside an open shadow root qualifies; the focus check descends shadow roots to find it.

When the target does not hold focus - after `setTargetElement()` without a focus move, for instance - or the command is unavailable or declines it, the value is assigned instead and `maxlength` is applied in JS. The resulting text is the same on both paths; what dispatches the `input` event is not.

|                    | Target focused (platform edit)  | Target not focused (assignment)                                                                          |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `maxlength`        | Applied by the browser          | Applied in JS                                                                                            |
| Browser undo stack | Edit recorded                   | Not recorded                                                                                             |
| `input` event      | One, dispatched by the platform | One synthesized `InputEvent` (`inputType` of `insertText`, `insertLineBreak` or `deleteContentBackward`) |

Either path produces exactly one `input` event per edit, so a listener on the target sees every edit regardless. An edit that a saturated `maxlength` leaves empty writes nothing and dispatches nothing. Read-only and disabled targets are never written to.

## Methods

| Method                     | Description                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show()`                   | Opens the docked keyboard (sets `open = true`) when the current `mobileKeyboard` mode allows custom rendering. Logs a warning if `docked` is `false`.                                                 |
| `close()`                  | Closes the docked keyboard (sets `open = false`).                                                                                                                                                     |
| `setTargetElement(el)`     | Programmatically sets the target input/textarea.                                                                                                                                                      |
| `setTargetResolver(fn)`    | Sets a custom resolver to locate the native input/textarea inside a host element. Pass `null` to clear.                                                                                               |
| `resetKeyboardType()`      | Resets keyboard type to `"Full"` and re-enables auto-type detection.                                                                                                                                  |
| `reset()`                  | Clears transient input state (shift/caps latch, in-progress composition, backspace auto-repeat, variant popover) and returns to the base layout. Leaves the bound value and configuration untouched.  |
| `refreshResponsiveState()` | Recomputes responsive height classes after runtime styling changes that do not emit a reliable resize signal. Usually not needed for normal container resizing.                                       |
| `insertText(text)`         | Inserts text at the caret of the active target (cursor-tracked, dispatches a native `input` event). No-op with no active target. Call from a `key-press` handler to implement a custom `{token}` key. |
| `deleteBackward()`         | Deletes one grapheme before the caret of the active target. Returns whether anything was removed; no-op with no active target.                                                                        |
| `getActiveTargetElement()` | Returns the resolved native input/textarea of the active target, or `null` (re-resolves each call). Mirrors the UI5 control's method of the same name.                                                |

## Static API

The static surface carries no layout registration; custom layouts come from the `customLayouts` slot (see [Custom Layouts](#custom-layouts)).

| Method                                     | Description                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `KioskKeyboard.getRegisteredLayout(name)`  | Returns a built-in layout definition by name.                                                                          |
| `KioskKeyboard.getRegisteredLayoutNames()` | Returns all built-in layout names.                                                                                     |
| `KioskKeyboard.isBuiltInLayout(name)`      | Checks if a layout is built-in.                                                                                        |
| `KioskKeyboard.isSecondaryLayout(name)`    | Checks if a layout is secondary (non-alphabetic).                                                                      |
| `KioskKeyboard.getLocaleLayout()`          | Returns the layout for the active UI5 Web Components locale (configured language, falling back to the browser locale). |
| `KioskKeyboard.setI18nResolver(fn)`        | Sets a custom i18n resolver callback.                                                                                  |
| `KioskKeyboard.composeLayout(...sources)`  | Splices rows from built-in layout names and row arrays, in order, into one layout definition.                          |

`KioskKeyboard.DOM` is a supported read-only DOM hook contract for tests and DOM assertions. Prefer it over hard-coded shadow selectors. Styling customizations should still use the documented host attributes and public `--kiosk-keyboard-*` CSS custom properties.

## DOM Contract

Use `KioskKeyboard.DOM` when you need stable selectors for tests or DOM assertions:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import type { KioskKeyboardDomContract } from "kiosk-keyboard-webc/bundle";

const DOM: KioskKeyboardDomContract = KioskKeyboard.DOM;
const firstKey = keyboard.shadowRoot?.querySelector(DOM.selectors.key);
```

The contract is intentionally read-only. It is not the styling API; continue to customize appearance through the documented public CSS custom properties.

## Built-in Layouts

| Name              | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `qwerty`          | Standard US QWERTY                                                      |
| `qwertz-de`       | German QWERTZ with umlauts and ss                                       |
| `ja-romaji`       | Japanese Romaji (QWERTY base with JIS punctuation)                      |
| `ja-kana`         | Japanese Kana direct-input (JIS X 6002)                                 |
| `ja-kana-compact` | Japanese Kana for narrow keyboards, no row wider than twelve key widths |
| `arabic`          | Arabic (standard Arabic 101 layout)                                     |
| `numeric`         | Numbers + common symbols                                                |
| `special`         | Extended symbols (`#+=`, currencies)                                    |
| `numpad`          | Calculator-style number pad                                             |
| `fkeys`           | F1-F12 function keys                                                    |
| `nav`             | Navigation keys (arrows, Home, End, etc.)                               |
| `ko-hangul`       | Korean Hangul Dubeolsik (KS X 5002)                                     |
| `qwerty-es`       | Spanish QWERTY with accented vowels and ñ                               |

Combined variants (e.g., QWERTY + F-key row) are not built-in. They are
trivial compositions - see [Layout Composition](#layout-composition) below.

## Custom Layouts

Everything one layout _is_ - its rows, the locales that select it, its keycap language, whether it is an auxiliary surface, its composition middleware and its long-press variants - is declared together on a `<kiosk-keyboard-custom-layout>` element in the `customLayouts` slot of a `<kiosk-keyboard>`. It shadows the built-in registry for that element only, without touching module-level state.

A custom layout that declares `rows` declares a layout. One **without** rows overlays the layout its `name` already resolves to, so a built-in can be given different variants, a different middleware or a different locale binding without restating its keys.

`name`, `keycap-lang`, `compact`, `locales`, `layout-role` and `suppress` are string attributes, so an overlay is a plain markup declaration:

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard controls="my-input" accent-variants>
  <!-- Point the Japanese locale at the BUILT-IN kana layout. -->
  <kiosk-keyboard-custom-layout slot="customLayouts" name="ja-kana" locales="ja"></kiosk-keyboard-custom-layout>

  <!-- Opt a layout out of accents entirely. -->
  <kiosk-keyboard-custom-layout slot="customLayouts" name="arabic" suppress="Variants"></kiosk-keyboard-custom-layout>

  <!-- Type the Hangul keycaps directly, without the built-in composer. -->
  <kiosk-keyboard-custom-layout
    slot="customLayouts"
    name="ko-hangul"
    suppress="Middleware"
  ></kiosk-keyboard-custom-layout>
</kiosk-keyboard>
```

Every child carries `slot="customLayouts"`. The children render nothing: the shadow template has no `<slot name="customLayouts">` for them, so a custom layout is never projected and never affects layout or styling.

`rows`, `variants` and `middleware` are object-typed properties with no attribute, so a full layout is assembled in script:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import type CustomLayout from "kiosk-keyboard-webc/CustomLayout";
import { createKanaDakutenMiddleware } from "kiosk-keyboard-webc/middleware/kana-dakuten";
import warehousePos from "./warehouse-pos-layout";

const kb = document.createElement("kiosk-keyboard") as KioskKeyboard;
kb.setAttribute("controls", "my-input");
kb.accentVariants = true;
kb.layout = "warehouse-pos";

const pos = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
pos.slot = "customLayouts";
pos.name = "warehouse-pos";
pos.rows = warehousePos;
pos.locales = "de,de-AT";
pos.keycapLang = "de";
pos.variants = { s: ["ś", "š"] };

// Rows-less overlay: give the built-in kana layout a different middleware.
const kana = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
kana.slot = "customLayouts";
kana.name = "ja-kana";
kana.middleware = createKanaDakutenMiddleware;

kb.append(pos, kana);
document.body.appendChild(kb);
```

Assemble the subtree before mounting the host, as above, and a slotted layout resolves on the keyboard's first paint. Afterwards the slot stays live: adding, removing, reordering or editing a custom layout re-folds the maps and re-renders.

No teardown is needed: the custom layouts are children of the element and are released with it. The component maintains no window-global mutable customization state, so multiple apps sharing the same page (Fiori Launchpad, micro-frontends) cannot pollute each other through the keyboard.

Each key of a `rows` array is a `KeyDefinition`:

```ts
interface KeyDefinition {
  value: string; // Character to insert, or action like "{shift}", "{enter}", "{backspace}", "{layout:numeric}", "{fkey:F5}"
  label?: string; // Display label; omit for auto-resolve (i18n for special keys, value for regular); "" suppresses
  shiftLabel?: string; // Label when shifted
  shiftValue?: string; // Value when shifted (defaults to value.toUpperCase() for single chars)
  capsLockLabel?: string; // Label for {shift} key in Caps Lock state; omit for i18n "Caps Lock"; "" suppresses
  capsLockIcon?: string; // Icon for {shift} key in Caps Lock state; independent of icon; defaults to locked icon
  width?: KeyWidth; // "1.25" | "1.5" | "1.75" | "2" | "2.25" | "2.75" | "space"
  type?: KeyType; // "default" | "modifier" | "action" | "space"
  icon?: string; // SAP icon URI or Unicode char/emoji; renders inline with label when both present
  ariaLabel?: string; // Accessible name when the key has no visible label (icon-only); resolution: ariaLabel -> label -> built-in i18n. Set this for icon-only custom keys ({paste} etc.)
  variants?: string[]; // Long-press / right-click accent-variant glyphs; overrides the built-in accent-variants table, [] suppresses the popup (e.g. ["ä", "à", "á", "â"])
}
```

### Fields and how they resolve

| Property     | Attribute     | Type               | Across custom layouts with the same name                                    | Across tiers                                 |
| ------------ | ------------- | ------------------ | --------------------------------------------------------------------------- | -------------------------------------------- |
| `name`       | `name`        | `string`           | matched after trim + lowercase; duplicates are the overlay mechanism        | -                                            |
| `rows`       | _(none)_      | `LayoutDefinition` | last declaration wins                                                       | custom layout → built-in                     |
| `keycapLang` | `keycap-lang` | `string`           | last declaration wins                                                       | custom layout → built-in                     |
| `compact`    | `compact`     | `string`           | last declaration wins                                                       | custom layout → built-in                     |
| `layoutRole` | `layout-role` | `LayoutRole`       | last declaration wins                                                       | `Inherit` takes the built-in's               |
| `locales`    | `locales`     | token `string`     | additive union; per prefix, last wins                                       | custom layouts → built-in map                |
| `middleware` | _(none)_      | `() => …`          | last declaration wins                                                       | custom layout → built-in                     |
| `variants`   | _(none)_      | `VariantTable`     | additive per base letter; a letter mapped to `[]` drops it                  | built-in → `defaultVariants` → custom layout |
| `suppress`   | `suppress`    | token `string`     | discards the inherited value of each listed facet at this layout's position | -                                            |

Custom layouts apply in **DOM order**. `layoutRole` is a tri-state: `Inherit` (the default) takes the built-in layout of the same name's role, `Base` un-marks a built-in's secondary flag, `Secondary` marks an auxiliary surface. Nothing can throw on an attribute here, so an unrecognised value inherits rather than promoting the layout to a base surface. `suppress` is how a facet is turned _off_ rather than replaced - a value the same custom layout declares still applies, so `suppress="Variants"` plus a `variants` table stands that table alone.

`compact` names the layout that renders instead of this one on a keyboard too narrow to seat its rows - the same key set in a denser arrangement, matched after trim and lowercase, and read only while the host's `auto-compact` is on. It may name a built-in (`ja-kana` ships `ja-kana-compact`) or another custom layout. `suppress` cannot turn it off: the suppressible facets are `Variants` and `Middleware`, so an overlay can replace an inherited counterpart but not remove it.

`locales` and `suppress` are token strings rather than arrays, split on commas and whitespace alike: `locales="pl,pl-PL"` and `locales="pl pl-PL"` are the same declaration, as are `suppress="Variants,Middleware"` and `suppress="Variants Middleware"`.

`rows` and `variants` are read by object identity: assign a new array or object to change them; mutating in place is not observed.

### What the element reports

A misconfiguration is logged once per element per distinct complaint, naming the layout and the remedy, rather than resolving silently to nothing:

| Code                   | Trigger                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `empty-name`           | a custom layout whose `name` is empty after trim                       |
| `invalid-rows`         | `rows` that are not a layout definition (the other facets still apply) |
| `invalid-variants`     | `variants` (or `defaultVariants`) that are not a variant table         |
| `invalid-middleware`   | `middleware` that is not a function                                    |
| `invalid-locale`       | a `locales` token that is empty after trim                             |
| `unknown-target`       | facets declared with no `rows`, for a name no layout has               |
| `unknown-suppress`     | a `suppress` token outside `Variants` / `Middleware`                   |
| `unknown-compact`      | `compact` that names a layout nothing declares                         |
| `duplicate-rows`       | two custom layouts declare `rows` for one name                         |
| `duplicate-middleware` | two custom layouts declare `middleware` for one name                   |
| `duplicate-locale`     | two custom layouts claim one BCP-47 prefix for different layouts       |

Any other element in the slot is ignored with a warning naming its tag, so a stray child cannot quietly take part in the fold.

### In a framework

The string attributes work the same in every framework; only the three object-typed properties need the framework's escape hatch for setting a DOM property rather than an attribute.

**React** - reach the element with a ref and assign the property in an effect:

```tsx
import { useEffect, useRef } from "react";
import "kiosk-keyboard-webc/bundle";
import type CustomLayout from "kiosk-keyboard-webc/CustomLayout";
import warehousePos from "./warehouse-pos-layout";

export function Keyboard() {
  const custom = useRef<CustomLayout>(null);

  useEffect(() => {
    if (custom.current) custom.current.rows = warehousePos;
  }, []);

  return (
    <kiosk-keyboard layout="warehouse-pos" controls="my-input">
      <kiosk-keyboard-custom-layout
        ref={custom}
        slot="customLayouts"
        name="warehouse-pos"
        keycap-lang="de"
        locales="de"
      />
    </kiosk-keyboard>
  );
}
```

**Vue** - the `.prop` modifier binds a DOM property; `markRaw` keeps the rows out of Vue's reactivity system, since the element reads them by identity and would otherwise receive a proxy:

```vue
<script setup lang="ts">
import { markRaw } from "vue";
import "kiosk-keyboard-webc/bundle";
import warehousePos from "./warehouse-pos-layout";

const rows = markRaw(warehousePos);
</script>

<template>
  <kiosk-keyboard layout="warehouse-pos" controls="my-input">
    <kiosk-keyboard-custom-layout slot="customLayouts" name="warehouse-pos" keycap-lang="de" :rows.prop="rows" />
  </kiosk-keyboard>
</template>
```

**Angular** - property binding already writes a DOM property, so `[rows]` is enough (declare `CUSTOM_ELEMENTS_SCHEMA` on the component or module):

```html
<kiosk-keyboard layout="warehouse-pos" controls="my-input">
  <kiosk-keyboard-custom-layout
    slot="customLayouts"
    name="warehouse-pos"
    keycap-lang="de"
    [rows]="warehousePos"
  ></kiosk-keyboard-custom-layout>
</kiosk-keyboard>
```

## Accent variants (German umlauts)

The `qwertz-de` layout ships dedicated **ä / ö / ü** keys and **ß**, and a German-locale page selects it automatically (`de` → `qwertz-de`). To reach accented letters from _any_ Latin layout, a key can carry a long-press popup of variants.

**Long-press / right-click popup.** Press and hold a key (or right-click it) to open a popup of accent variants; tap, drag-and-release, or arrow-and-Enter to insert one, Escape to dismiss. A plain tap still inserts the key's base character. When Shift or Caps Lock is active, the popup surfaces the uppercase forms, including the capital sharp S **ẞ** for `s`/`ß`.

**Accessibility.** A variant key carries a corner-triangle hint and advertises the popup to assistive technology with `aria-haspopup="dialog"`. Keyboard users open it with the context-menu gesture (the Menu key, or Shift+F10) on the focused key; the key's own Enter/Space still types its base character, so the key carries no `aria-expanded` state.

**Built-in Latin-diacritics table.** The `accent-variants` attribute merges a broad Latin-diacritics table (à á â ä, ç, è é ê ë, ñ, ö œ ø, ß, ü, …) onto every matching base letter of the resolved layout, so umlauts and accents work on any Latin layout without editing layout data:

```html
<kiosk-keyboard accent-variants controls="my-input"></kiosk-keyboard>
```

**Per-key `variants`.** Author or override the popup for a single key with the `variants` field on its `KeyDefinition`. An explicit `variants` always wins over the built-in table; the key's own `value` stays the tap default and is not repeated in the list:

```ts
import type { LayoutDefinition } from "kiosk-keyboard-webc/bundle";

const myRows: LayoutDefinition = [
  [
    { value: "a", variants: ["ä", "à", "á", "â"] },
    { value: "o", variants: ["ö", "ø"] },
  ],
];
```

Because an explicit `variants` wins, declaring `variants: []` suppresses the popup on a single key the built-in table would otherwise cover, e.g. to skip a diacritic already reachable as its own dedicated key on the layout.

**Per-layout variant tables.**

With `accent-variants` on, the built-in Latin table is resolved through two further tiers before it is applied: the host's `defaultVariants` table, which applies under every layout, and the `variants` of the custom layouts naming that layout. The tiers are layered **built-in → `defaultVariants` → custom layout**, each **merged onto** the one below per base letter, so a tier extends the one under it rather than replacing it and only the letters it names change. This targets a locale's layout without editing layout data, e.g. Polish variants on the layout the current locale resolves to:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import type CustomLayout from "kiosk-keyboard-webc/CustomLayout";

const kb = document.querySelector("kiosk-keyboard") as KioskKeyboard;
kb.accentVariants = true;

const polish = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
polish.slot = "customLayouts";
polish.name = KioskKeyboard.getLocaleLayout();
polish.variants = { s: ["ś", "š"], z: ["ż", "ź", "ž"] };
kb.appendChild(polish);
```

Base letters must be **lowercase**; a mis-keyed letter is logged and the entry skipped, rather than silently arming nothing.

Three levels of opt-out, narrowest first:

| Recipe                                    | Effect                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `variants = { s: [] }` on a custom layout | Drops one base letter, leaving the rest of the table     |
| `suppress="Variants"` on a custom layout  | Opts that layout out of variants entirely                |
| `variants: []` on a `KeyDefinition`       | Suppresses the popup on that one key, whatever the table |

The `defaultVariants` tier only ever adds; it has no suppression spelling. Turn the whole affordance off by leaving `accent-variants` unset, which is the default.

The five non-Latin built-in layouts (`ja-romaji`, `ja-kana`, `ja-kana-compact`, `arabic`, `ko-hangul`) resolve the built-in table to nothing, so `accent-variants` adds no popups there; supply a `variants` table on a custom layout (or a `defaultVariants` table) to opt one back in, and because there is no built-in tier to merge onto, those tiers stand alone. That exclusion list is only the shipped default for those built-ins; it never locks you out. A **custom** layout whose Latin-looking keys should _not_ surface accent popups (a transliteration IME, say) opts out with `suppress="Variants"`, which discards `defaultVariants` along with the built-in tier. Action, modifier, and space keys never take table variants even when a table is keyed to their value.

`LATIN_DIACRITIC_VARIANTS` is exported from the `kiosk-keyboard-webc/variants` subpath for inspection (to read what the defaults are, or to build a table from them). A custom table only needs the base letters it changes.

Declaring a variant table while `accent-variants` is off applies nothing, and logs a warning saying so.

## Function Keys (F1-F12)

### F-key modes

The `f-key-mode` attribute controls how function key presses are handled:

| Value       | Behavior                                                                                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"Virtual"` | (default) F-key press fires the `key-press` event only. No keyboard event is sent to the target input. Navigation keys move the caret in the target input (`ArrowLeft`/`ArrowRight`, `ArrowUp`/`ArrowDown`, `Home`/`PageUp` to the start, `End`/`PageDown` to the end). |
| `"Native"`  | F-key press dispatches a synthetic `KeyboardEvent("keydown")` to the target input, then fires `key-press`. The component also provides built-in workarounds for F5 and F11 (see below).                                                                                 |
| `"None"`    | F-key and navigation presses are ignored (silent no-op); the row is still rendered.                                                                                                                                                                                     |

### Native mode: synthetic keydown events

When `f-key-mode="Native"`, the component dispatches a synthetic `keydown` event to the target input for all F-keys (F1-F12) and navigation keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown).

> [!IMPORTANT]
> Browsers treat synthetic `KeyboardEvent` instances as untrusted (`isTrusted: false`) and block them from triggering security-sensitive browser actions. A synthetic F5 keydown does **not** reload the page. A synthetic F11 does **not** toggle fullscreen.

To work around this limitation, the component has built-in action handlers for exactly two keys:

- **F5**: calls `location.reload()`
- **F11**: toggles fullscreen via `document.requestFullscreen()` / `document.exitFullscreen()`

All other F-keys (F1-F4, F6-F10, F12) dispatch the synthetic `keydown` to the target input but have no built-in browser action beyond what the app handles.

### Handling F-keys in consumer code

For any F-key the app wants to act on, listen to the `key-press` event. The `key` detail contains the bare key name (the `{fkey:*}` wrapping is stripped before dispatch, matching the names used by `KeyboardEvent.key`):

```typescript
keyboard.addEventListener("key-press", (e) => {
  const { key } = e.detail;
  if (key === "F1") {
    e.preventDefault(); // optional: suppress default key-press behavior
    showHelpDialog();
  }
});
```

> [!NOTE]
> Layout-switch keys (`{layout:*}`) fire `key-press` with the wrapped form (`"{layout:numeric}"`, `"{layout:base}"`) so consumers can distinguish the layout-switch action from a literal text key. This is asymmetric with F-keys for historical reasons; consult `e.detail.key` directly.

When `f-key-mode="Native"`, the cancelable `key-press` event fires **first**; the synthetic `keydown` is dispatched to the target input only if no handler calls `preventDefault()`. This means a global keyboard shortcut system listening on the document (for example, a hotkeys library) sees the F-key event only when the `key-press` handler does not call `preventDefault()` - cancelling `key-press` suppresses the native dispatch entirely.

To suppress the built-in F5 reload or F11 fullscreen actions specifically, call `preventDefault()` on the `key-press` event:

```typescript
keyboard.addEventListener("key-press", (e) => {
  if (e.detail.key === "F5") {
    e.preventDefault(); // prevent location.reload()
    myApp.refreshData();
  }
});
```

## Subpath Imports

The default entry (`kiosk-keyboard-webc`) includes all built-in layouts. The package also exposes subpath imports for layout definitions, middleware, the convenience bundle entry, asset registration, and the custom-elements manifest:

| Import                                  | Description                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `kiosk-keyboard-webc`                   | Full entry (all built-in layouts)                                                                                            |
| `kiosk-keyboard-webc/CustomLayout`      | The `<kiosk-keyboard-custom-layout>` element class and its type                                                              |
| `kiosk-keyboard-webc/layouts/<name>`    | Built-in layout definitions (data for custom composition)                                                                    |
| `kiosk-keyboard-webc/middleware/<name>` | Composition middleware                                                                                                       |
| `kiosk-keyboard-webc/variants`          | Built-in accent-variant table (`LATIN_DIACRITIC_VARIANTS`) and its `VariantTable` type                                       |
| `kiosk-keyboard-webc/bundle`            | Convenience entry: element + Assets (needs a bundler/import map; for a plain `<script>` use `dist/kiosk-keyboard.bundle.js`) |
| `kiosk-keyboard-webc/Assets`            | Theme + i18n registration                                                                                                    |
| `kiosk-keyboard-webc/customElements`    | Custom Elements Manifest (`custom-elements.json`) for IDE/tooling                                                            |

### Layout Composition

The package ships primary layouts and building block rows (`fkey-row`, `fkey-row-compact`, `nav-row`, `nav-row-compact`).
Combined layouts (e.g., QWERTY + F-key row) are not built-in - they are trivial
compositions consumers can build:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import type CustomLayout from "kiosk-keyboard-webc/CustomLayout";
import fkeyRow from "kiosk-keyboard-webc/layouts/fkey-row";

const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
const composed = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
composed.slot = "customLayouts";
composed.name = "my-qwerty-fk";
composed.rows = KioskKeyboard.composeLayout([fkeyRow], "qwerty");
el.appendChild(composed);
el.layout = "my-qwerty-fk";
document.body.appendChild(el);
```

`composeLayout` splices its sources in order: a string names a built-in layout and contributes its rows, anything else contributes rows directly.

A custom layout declares its own attributes alongside its rows, which is how it marks itself an auxiliary surface or states the language of its keycaps:

```html
<kiosk-keyboard-custom-layout
  id="ar-symbols"
  slot="customLayouts"
  name="ar-symbols"
  keycap-lang="ar"
  layout-role="Secondary"
></kiosk-keyboard-custom-layout>
```

```ts
const arSymbols = document.getElementById("ar-symbols") as CustomLayout;
arSymbols.rows = KioskKeyboard.composeLayout([symbolRow], "arabic");
```

An attribute left out falls back to the built-in layout of the same name, so overriding a built-in keeps its attributes until the custom layout says otherwise.

## Composition Middleware

Some scripts require processing between key press and text insertion. For example, Japanese Kana needs dakuten/handakuten composition (ka + dakuten = ga), and Korean Hangul needs jamo-to-syllable composition (individual consonants and vowels combine into syllable blocks).

Composition middleware handles this automatically. The built-in kana and Hangul middleware are **bundled with the component**: no import or configuration is needed. Each activates automatically when its associated layout (`ja-kana`, `ja-kana-compact` / `ko-hangul`) is active and deactivates (committing any in-progress composition) on layout switch.

The `kiosk-keyboard-webc/middleware/*` subpaths export the middleware **factories as data**, so you can reuse or override a built-in on a specific element via the `middleware` property of a [custom layout](#custom-layouts); importing them has no side effect on the bundled defaults.

### Built-in Middleware

| Module                                          | Layout                       | Behavior                                                 |
| ----------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `kiosk-keyboard-webc/middleware/kana-dakuten`   | `ja-kana`, `ja-kana-compact` | Composes base kana + dakuten/handakuten into voiced kana |
| `kiosk-keyboard-webc/middleware/hangul-compose` | `ko-hangul`                  | Composes jamo into Hangul syllable blocks with preedit   |

### Custom Middleware

Implement the `CompositionMiddleware` interface and supply the factory on the custom layout for that layout:

```ts
import type { CompositionMiddleware } from "kiosk-keyboard-webc";
import type CustomLayout from "kiosk-keyboard-webc/CustomLayout";
import "kiosk-keyboard-webc/bundle";

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

const el = document.createElement("kiosk-keyboard");
const custom = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
custom.slot = "customLayouts";
custom.name = "my-layout";
custom.rows = myRows;
custom.middleware = createMyMiddleware;
el.appendChild(custom);
el.setAttribute("layout", "my-layout");
document.body.appendChild(el);
```

The `handleKey` method receives:

- `key`: the raw key value from the layout definition (e.g., `"a"`, `"{backspace}"`, `"{enter}"`)
- `target`: the input element the keyboard is typing into

When `handleKey` returns `true`, the keyboard skips its default text insertion, backspace, and enter handling. The middleware is responsible for modifying the target's value.

Middleware lifecycle:

- **Layout switch**: `commit()` is called, instance discarded. A fresh instance is created when the layout activates again.
- **Component destroyed**: `reset()` is called. In-progress composition is discarded, not flushed.
- **Focus change**: `commit()` is called to avoid orphaned preedit text.

> [!NOTE]
> A `middleware` on a custom layout shadows the built-in factory for the same layout (for example, `name="ja-kana"` with a `middleware` of your own replaces the bundled kana-dakuten middleware on that element), and `suppress="Middleware"` disables the built-in composer for that layout so its keycaps type directly.

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

- **SAP icon URI** (e.g. `"sap-icon://accept"`): rendered via `<ui5-icon>`
- **Unicode character or emoji** (e.g. `"\u2191"`, `"\u23CE"`, `"\uD83D\uDD0D"`): rendered as a text span styled at icon size

```ts
// SAP icon with label
{ value: "{enter}", icon: "sap-icon://accept", label: "Enter", type: "action" }

// Unicode arrow icon, label suppressed (icon-only)
{ value: "{fkey:ArrowUp}", icon: "\u2191", label: "", type: "modifier" }

// Unicode icon with label (dual rendering)
{ value: "{fkey:Home}", icon: "\u21F1", label: "Home", type: "modifier" }

// Emoji icon with label
{ value: "search", icon: "\uD83D\uDD0D", label: "Search" }
```

### Custom key icons

There is no icon markup field: `icon` is a plain string, and raw HTML, `<svg>` and `<img>` sources are not accepted. Anything beyond the two built-in value types comes from the icon registry.

**SAP icons beyond the built-ins.** The element imports only the five its own keys use - `arrow-top`, `arrow-left`, `accept`, `locked` and `nav-back`. Every other `sap-icon://` name must be registered by the consuming app:

```ts
import "@ui5/webcomponents-icons/dist/paste.js"; // one icon
import "@ui5/webcomponents-icons/dist/AllIcons.js"; // or the whole collection
```

An unregistered name renders no glyph: `<ui5-icon>` logs `Required icon is not registered...` and hides itself, so a missing import shows up as a gap rather than an error.

**Registering a custom glyph.** `registerIcon()` from `@ui5/webcomponents-base` puts an SVG path into the registry under a name, which `icon` then references like any SAP icon:

```ts
import { registerIcon } from "@ui5/webcomponents-base/dist/asset-registries/Icons.js";

registerIcon("my-search", {
  pathData: "M11.5 10h-.8l-.3-.3a5.5 5.5 0 1 0-.7.7l.3.3v.8l4 4 1.2-1.2-4-4Z",
  viewBox: "0 0 16 16",
  collection: "SAP-icons-v5",
});

custom.rows = [[{ value: "{find}", icon: "sap-icon://my-search", label: "", ariaLabel: "Find" }]];
```

The registry key is `` `${collection}/${name}` ``, and the effective collection follows the theme family - `SAP-icons-v5` under Horizon, `SAP-icons-v4` under the legacy themes - so register the same name into both if the app can switch families. Registering an existing name replaces that icon application-wide, not only inside the keyboard. `unsafeRegisterIcon()` (since 2.14.0) takes a raw SVG string via `customTemplateAsString` instead; per its own documentation that string is not sanitized, and improperly sanitized SVG can lead to XSS.

**Emoji and Unicode glyphs** need no registration and no icon module - any value that is not a `sap-icon://` URI is rendered as text at icon size, over the symbol-font fallback stack.

**Restyling with `::part(key-icon)`.** The part matches both branches - the `<ui5-icon>` and the Unicode span - and restyles them without touching layout data. The SVG paints with `currentColor`, so `color` reaches the glyph:

```css
kiosk-keyboard::part(key-icon) {
  color: var(--sapNegativeColor);
}
```

`::part()` cannot be qualified by an attribute on the shadow-internal element, so there is no per-key selector from outside: the rule hits every icon in the keyboard. To change what a single key shows, set that key's `icon` in the layout data or register a different glyph under the name it uses. See [CSS Parts](#css-parts) for the full part list and [Public CSS Custom Properties](#public-css-custom-properties) for the `--kiosk-keyboard-dual-icon-size` / `--kiosk-keyboard-fkey-icon-size` sizing hooks.

**Accessible names.** Icons are always decorative, so a key with `label: ""` needs `ariaLabel` unless it is a built-in special key with an i18n name. Without one the element logs `Icon-only key "<value>" has no accessible name; set ariaLabel on the KeyDefinition.` and falls back to `value`.

### Dual rendering (icon + label)

When both `icon` and a non-empty `label` resolve, the key renders in **dual mode**: icon and label side by side. The layout direction defaults to `row` (inline) and is customizable via CSS custom properties:

```css
/* Stack icon above label instead of side by side */
kiosk-keyboard {
  --kiosk-keyboard-dual-direction: column;
  --kiosk-keyboard-dual-gap: 0.1em;
  --kiosk-keyboard-dual-icon-size: 0.85em;
  --kiosk-keyboard-dual-label-size: 0.75em;
}
```

The `--kiosk-keyboard-dual-*` properties are documented in [Public CSS Custom Properties](#public-css-custom-properties).

#### Navigation key overrides

Navigation and function keys (`{fkey:*}`) default to column layout with scaled icons. The `--kiosk-keyboard-fkey-*` properties (see [Public CSS Custom Properties](#public-css-custom-properties)) override the dual defaults for nav keys only:

```css
/* Force nav keys to row layout (icon beside label, like other dual keys) */
kiosk-keyboard {
  --kiosk-keyboard-fkey-direction: row;
  --kiosk-keyboard-fkey-icon-size: 1em;
  --kiosk-keyboard-fkey-label-size: 1em;
  --kiosk-keyboard-fkey-gap: 0.15em;
}
```

### Responsive behavior

At narrow key widths (at or below `7rem` per key), dual keys automatically hide the text label using the sr-only pattern (`clip-path: inset(50%)`). The icon remains visible and is scaled up to `--kiosk-keyboard-key-font-size` so the key does not look empty, and the label stays in the accessibility tree as the key's accessible name. This prevents text truncation ("H...", "P...") while keeping keys distinguishable by their icons.

Below this threshold `--kiosk-keyboard-dual-icon-size` and `--kiosk-keyboard-fkey-icon-size` no longer apply, since both scale an icon against a visible label and there is none.

This behavior is driven by a CSS `@container` query on individual keys (`container-type: inline-size`). It applies only to dual keys (those with both icon and label).

### Accessibility

- **Dual keys (icon + label visible):** The visible text provides the accessible name. No `aria-label` is set (WCAG 2.5.3 Label in Name).
- **Icon-only keys (`label: ""`):** The renderer sets `aria-label` from i18n for built-in special keys, or falls back to `value` for custom keys.
- **Icons** always have `aria-hidden="true"`. They are decorative when a label is present, and the `aria-label` handles accessibility when the label is suppressed.
- **Accent-variant keys.** A key carrying variants advertises them with `aria-haspopup="dialog"`. Keyboard users open the popup with the context-menu gesture (the Menu key, or Shift+F10) on the focused key, arrow/Home/End to choose, Enter or Space to insert, and Escape to dismiss and return focus to the key. The key carries no `aria-expanded`: its own Enter/Space types the base character rather than toggling the popup.
- **Language of keycaps.** Keycaps written in a script other than the UI language carry a `lang` attribute on their label, so a screen reader announces them with that language's pronunciation rules (WCAG 2.2 SC 3.1.2 Language of Parts). The built-in `arabic`, `ja-kana`, `ja-kana-compact` and `ko-hangul` layouts declare `ar` / `ja` / `ja` / `ko`; `ja-romaji` declares none, because its keycaps are Latin letters and JIS punctuation and only the text they compose is Japanese. The attribute sits on the key label alone, since the keyboard's own label and its live region are UI-language text. Only a key that types a character carries the layout's script: space and the action keys take their label from i18n, and a layout-switch key is a control affordance rather than keycap content. A custom layout declares its own with the `keycap-lang` attribute of a `<kiosk-keyboard-custom-layout>`.
- **Target size.** Keys hold a 24x24 CSS px floor on both axes, meeting the WCAG 2.5.8 minimum touch target size, and grow with the root font size. The inline half is lifted below a 20rem-wide keyboard, where the densest rows cannot fit a full set of floored keys: keys shrink to fit there so that every key stays reachable rather than being clipped off the edge of a center-justified row. Below that width the 24x24 minimum is therefore not met. The block half holds at every width, so a `--kiosk-keyboard-key-height` set below 24px is raised to it, and a keyboard in a height-capped container clips rather than shrinking past the floor.

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
  capsLockLabel: "LOCKED",     // replaces label during Caps Lock
  capsLockIcon: "\uD83D\uDD12", // replaces icon during Caps Lock
}
```

`capsLockIcon` is evaluated independently of `icon`. Setting `icon: ""` does not suppress `capsLockIcon`.

## Custom Target Resolver

By default, the keyboard finds the native `<input>` or `<textarea>` inside a host element by traversing light DOM and up to 3 levels of shadow DOM. This covers standard HTML inputs, UI5 web components (`<ui5-input>`, `<ui5-step-input>`, `<ui5-textarea>`), and similar.

For custom controls with non-standard DOM structures, set a **target resolver** callback:

```ts
const kb = document.querySelector("kiosk-keyboard");

kb.setTargetResolver((el) => {
  // Custom control: find the deeply nested input
  return el.querySelector(".my-wrapper .inner-editor input");
});
```

The callback receives the focused `HTMLElement` (the host element) and must return:

- The native `<input>` or `<textarea>` to type into, **or**
- `null` to fall back to the built-in resolver

If the callback throws, the error is caught and logged, and the built-in resolver is used as fallback.

Pass `null` to clear the custom resolver:

```ts
kb.setTargetResolver(null);
```

> [!NOTE]
> Virtual key presses dispatch `InputEvent("input")` on the target, matching native keyboard behavior. The `"change"` event is _not_ dispatched on character input; it fires only on Enter (for single-line inputs), consistent with how browsers handle `"change"` (on blur/commit).

## Internationalization (i18n)

The keyboard ships with English, German, Japanese, and Arabic translations for all ARIA labels, role descriptions, and screen reader announcements. The built-in UI5 Web Components i18n infrastructure loads the correct locale bundle automatically based on `navigator.language`.

Visible key text (e.g. "q", "123", "Fn") is driven by layout definitions, not i18n. The i18n system controls both visible labels for special keys (Shift, Enter, Backspace, Space), `aria-label` for icon-only keys (where `label=""`), the keyboard's `aria-label`, `aria-roledescription`, and live region announcements (shift/caps lock state changes, keyboard open/close, accent-variant popup open/close).

**Resource bundle keys:**

| Key                              | Default (English)                             | Used for                                                                        |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `KIOSK_KEYBOARD_LABEL`           | Virtual Keyboard                              | Default `aria-label` when `accessibleName` is empty                             |
| `KIOSK_KEYBOARD_ROLEDESCRIPTION` | keyboard                                      | `aria-roledescription` on the root element                                      |
| `KEY_SHIFT`                      | Shift                                         | Visual label and `aria-label` for the Shift key                                 |
| `KEY_ENTER`                      | Enter                                         | Visual label and `aria-label` for the Enter key                                 |
| `KEY_BACKSPACE`                  | Backspace                                     | Label for the Backspace key (visible text; aria-label when label is suppressed) |
| `KEY_SPACE`                      | Space                                         | Label for the Space key (visible text; aria-label when label is suppressed)     |
| `KEY_CAPS_LOCK`                  | Caps Lock                                     | Visible Shift-key label and its `aria-label` when Caps Lock is active           |
| `ARIA_CAPS_LOCK_ON`              | Caps Lock on                                  | ARIA live region announcement                                                   |
| `ARIA_CAPS_LOCK_OFF`             | Caps Lock off                                 | ARIA live region announcement when Caps Lock is released                        |
| `ARIA_SHIFT_ON`                  | Shift on                                      | ARIA live region announcement                                                   |
| `ARIA_SHIFT_OFF`                 | Shift off                                     | ARIA live region announcement                                                   |
| `ARIA_KEYBOARD_OPENED`           | Virtual keyboard opened                       | ARIA live region announcement on `show()`                                       |
| `ARIA_KEYBOARD_CLOSED`           | Virtual keyboard closed                       | ARIA live region announcement on `close()`                                      |
| `ARIA_RETURN_TO_NUMBERS`         | Return to numbers                             | Accessible name for the back key that returns to the numbers surface            |
| `ARIA_VARIANTS_OPENED`           | {0} variants for {1}                          | ARIA live region announcement when the accent-variant popup opens               |
| `ARIA_VARIANTS_CLOSED`           | Variants closed                               | ARIA live region announcement when the accent-variant popup is dismissed        |
| `ARIA_LAYOUT_COMPACTED`          | Switched to the compact keyboard layout       | ARIA live region announcement when `auto-compact` takes a layout's compact form |
| `ARIA_LAYOUT_UNCOMPACTED`        | Switched back to the standard keyboard layout | ARIA live region announcement when `auto-compact` gives it back                 |

The two `auto-compact` announcements name no layout on purpose: the layout a width picks is one the user never chose and never sees named, and an identifier dropped into a translated sentence stays untranslated. They also have to differ from each other - the live region re-announces only on a text change, so one shared wording would leave every second crossing unspoken.

### Custom i18n Resolver

Use `KioskKeyboard.setI18nResolver()` to override or extend translations at runtime without modifying the library. The resolver receives the i18n key, the current locale (from the configured UI5 Web Components locale via `getLocale()`), and the text resolved from the built-in bundle:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";

KioskKeyboard.setI18nResolver((key, locale, defaultText) => {
  const fr: Record<string, string> = {
    KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
    KEY_SHIFT: "Maj",
    KEY_ENTER: "Entree",
    KEY_BACKSPACE: "Retour",
    KEY_SPACE: "Espace",
    KEY_CAPS_LOCK: "Verrouillage majuscules",
    ARIA_CAPS_LOCK_ON: "Verrouillage majuscules active",
    ARIA_CAPS_LOCK_OFF: "Verrouillage majuscules desactive",
    ARIA_SHIFT_ON: "Majuscules activees",
    ARIA_SHIFT_OFF: "Majuscules desactivees",
    ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
    ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferme",
  };
  if (locale === "fr" && fr[key]) return fr[key];
  return undefined; // fall through to built-in text
});
```

**Resolution order:** custom resolver (highest priority) -> UI5 WC i18n bundle (locale-aware) -> English defaults.

Calling `KioskKeyboard.setI18nResolver()` automatically re-renders connected keyboard instances, so mounted components pick up new labels without a manual refresh.

Return `undefined` from the resolver for any key you don't want to override. The built-in translation chain handles the rest. If the resolver throws, the error is logged and the default text is used.

Pass `null` to clear a previously set resolver:

```ts
KioskKeyboard.setI18nResolver(null);
```

**Dynamic translations:**

The resolver is called on every render, so it can return different values based on runtime state (e.g. a tenant-specific translation service, user preferences, or an external i18n library):

```ts
import { get } from "my-i18n-library";

KioskKeyboard.setI18nResolver((key, locale) => {
  return get(`kiosk.${key}`, locale); // returns string or undefined
});
```

**Adding built-in translations (library contributors):**

To add a new locale to the library itself, create a properties file in `src/i18n/` following the naming convention `messagebundle_<locale>.properties` (e.g. `messagebundle_fr.properties`). The UI5 Web Components build pipeline picks it up automatically.

> [!NOTE]
> Both the UI5 native control and the web component use the same `setI18nResolver()` callback pattern for i18n customization. The resolver receives the key, current locale, and base text, and returns a string override or `undefined` to keep the default. The UI5 control additionally resolves base text from a UI5 ResourceBundle, while the web component uses built-in EN/DE/JA/AR strings.

## CSS Parts

The component exposes CSS shadow parts for structural styling from outside the shadow DOM. Use `::part()` selectors to customize elements that CSS custom properties alone cannot reach (e.g., changing `display`, adding borders to specific elements, or adjusting flex behavior).

| Part             | Element                            | Description                                                                                                                                                      |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyboard`       | Root container (`.kiosk-keyboard`) | The outermost keyboard wrapper                                                                                                                                   |
| `row`            | Row container (`.kiosk-row`)       | Each row of keys                                                                                                                                                 |
| `key`            | Every key element                  | All keys (regular, modifier, and action)                                                                                                                         |
| `modifier`       | Modifier keys (Shift, 123, Fn)     | Combined with `key`, ahead of any per-key name: `part="key modifier key-shift"`                                                                                  |
| `action`         | Action keys (Enter, Backspace)     | Combined with `key`, ahead of any per-key name: `part="key action key-enter"`                                                                                    |
| `fkey`           | Function/navigation keys           | Combined with `key`: `part="key modifier fkey"`. Targets keys with `{fkey:*}` values (Home, End, PgUp, PgDn, Arrow keys) independently from other modifier keys. |
| `key-label`      | Text label inside a key            | The `<span>` rendering the key's text                                                                                                                            |
| `key-icon`       | Icon inside a key                  | The `<ui5-icon>` rendering built-in icons                                                                                                                        |
| `variant-popup`  | Accent-variant option row          | The button toolbar slotted inside the long-press `ui5-popover`                                                                                                   |
| `variant-option` | Each accent-variant option         | The `ui5-button` for a single variant glyph                                                                                                                      |

```css
/* Example: round action keys and increase row gap */
kiosk-keyboard::part(action) {
  border-radius: 1rem;
}
kiosk-keyboard::part(row) {
  gap: 0.5rem;
}

/* Target all keys */
kiosk-keyboard::part(key) {
  border-color: transparent;
}
```

Multi-name parts allow targeting specific key types. `::part(key)` matches all keys, while `::part(modifier)` or `::part(action)` match only those subtypes.

### Styling a single key

The category parts above reach a _group_ of keys. To reach one key, use its per-key part name. The keys carry a `data-key` attribute too, but that one is shadow-trapped and unreachable from outside - and `::part()` accepts pseudo-classes but neither attribute nor class selectors, so `::part(key)[data-key="{enter}"]` is invalid rather than merely unsupported.

| Per-key part        | Key                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `key-shift`         | The `{shift}` key                                                                                          |
| `key-backspace`     | The `{backspace}` key                                                                                      |
| `key-enter`         | The `{enter}` key                                                                                          |
| `key-space`         | The space key                                                                                              |
| `key-layout`        | Every `{layout:*}` switch key                                                                              |
| `key-layout-<name>` | The switch key for one built-in layout - `key-layout-numeric`, `key-layout-special`, `key-layout-fkeys`, … |
| `key-layout-base`   | The switch back to the tracked base layout (`{layout:base}`)                                               |

```css
/* Example: make Enter the accent key and tint the numeric switcher */
kiosk-keyboard::part(key-enter) {
  background: var(--sapButton_Emphasized_Background);
}
kiosk-keyboard::part(key-layout-numeric) {
  font-weight: bold;
}
```

Per-key parts combine with the category ones, so `{enter}` renders as `part="key action key-enter"` and the numeric switcher as `part="key modifier key-layout key-layout-numeric"`.

Two boundaries are deliberate:

- **Character keys get no per-key part.** `a`, `1` and `ä` render as `part="key"` alone. Naming every glyph would make each one public API that can never change; style character keys as a group, or reach one by position from your own layout.
- **Custom layouts get `key-layout` only.** A `{layout:*}` key pointing at a slotted `<kiosk-keyboard-custom-layout>` carries no `key-layout-<name>` twin, because the name is yours rather than the component's. The set of part names stays closed, which is what lets `exportparts` - which has no wildcard form - forward all of them.

> [!NOTE]
> The UI5 control twin needs none of this: it renders into light DOM, so its `[data-key]` attribute is directly targetable with an ordinary attribute selector. See [Styling a single key in the `kiosk-keyboard` README](../kiosk-keyboard/README.md#styling-a-single-key).

### Forwarding Parts (`exportparts`)

CSS `::part()` selectors do not cross multiple shadow DOM boundaries, and `exportparts` has no wildcard form. If you wrap `<kiosk-keyboard>` inside another web component, you must forward the parts using the `exportparts` attribute on the inner `<kiosk-keyboard>` element.

The `KioskKeyboard.DOM.exportParts` constant provides a ready-to-use attribute value listing every part, so a hand-written list cannot fall behind:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";

// Inside your wrapper component's connectedCallback or render:
this.shadowRoot.querySelector("kiosk-keyboard").setAttribute("exportparts", KioskKeyboard.DOM.exportParts);
```

With `exportparts` set, consumers of your wrapper can style the keyboard parts:

```css
my-wrapper::part(key) {
  /* styles forwarded through */
}
```

> [!NOTE]
> `KioskKeyboard.DOM.parts` (frozen array) and `KioskKeyboard.DOM.exportParts` (comma-separated string) are part of the stable API. They stay in sync with the template and are covered by automated tests.

## Public CSS Custom Properties

The documented `--kiosk-keyboard-*` variables are the supported styling API. Internal `--_kiosk-keyboard-*` aliases and raw shadow DOM class names remain private implementation details. For tests and DOM assertions, use the stable `KioskKeyboard.DOM` contract instead of hard-coded selectors.

For the rationale behind default values, breakpoint thresholds, and scaling factors, see the [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md).

Override these on the `:host` or a parent element to customize appearance:

| Property                                   | Default                                                                                                                             | Description                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--kiosk-keyboard-border`                  | `1px solid` _(theme)_                                                                                                               | Container border (set to `none` for borderless)                                                                  |
| `--kiosk-keyboard-border-radius`           | _(theme)_                                                                                                                           | Container border radius                                                                                          |
| `--kiosk-keyboard-padding`                 | `0.75rem`                                                                                                                           | Container padding                                                                                                |
| `--kiosk-keyboard-key-gap`                 | `0.375rem`                                                                                                                          | Gap between keys                                                                                                 |
| `--kiosk-keyboard-key-height`              | `3rem`                                                                                                                              | Key height                                                                                                       |
| `--kiosk-keyboard-key-font-size`           | `calc(var(--kiosk-keyboard-key-height) * 0.375)`                                                                                    | Key font size (all key types in Numpad/Numeric)                                                                  |
| `--kiosk-keyboard-key-padding-inline`      | `0.25rem`                                                                                                                           | Horizontal key padding                                                                                           |
| `--kiosk-keyboard-key-padding`             | `0 0.25rem`                                                                                                                         | Full padding shorthand (uses padding-inline)                                                                     |
| `--kiosk-keyboard-key-padding-inline-xs`   | `min(var(--kiosk-keyboard-key-padding-inline), 0.125rem)`                                                                           | Horizontal key padding in extra-narrow mode                                                                      |
| `--kiosk-keyboard-key-padding-xs`          | `0 var(--kiosk-keyboard-key-padding-inline-xs)`                                                                                     | Full padding shorthand in extra-narrow mode                                                                      |
| `--kiosk-keyboard-key-shadow`              | _(subtle)_                                                                                                                          | Box shadow for keys at rest                                                                                      |
| `--kiosk-keyboard-key-shadow-hover`        | _(subtle)_                                                                                                                          | Box shadow for keys on hover                                                                                     |
| `--kiosk-keyboard-key-border-color`        | _(not declared)_                                                                                                                    | Override all key border colors when set                                                                          |
| `--kiosk-keyboard-variant-hint-inset`      | `0.1875rem`                                                                                                                         | Accent-variant corner hint inset from the key's top/end edge                                                     |
| `--kiosk-keyboard-variant-hint-size`       | `0.3125rem`                                                                                                                         | Accent-variant corner hint size                                                                                  |
| `--kiosk-keyboard-variant-hint-color`      | `var(--sapContent_LabelColor)` at 71% alpha on the resting fill, the key's own text color at 71% on the emphasized and active fills | Accent-variant corner hint color. Setting it pins one color across every key state (ignored under forced colors) |
| `--kiosk-keyboard-max-width`               | `100%`                                                                                                                              | Max width for the default inline keyboard                                                                        |
| `--kiosk-keyboard-docked-max-width`        | `64rem`                                                                                                                             | Max width in docked mode                                                                                         |
| `--kiosk-keyboard-docked-shadow`           | _(subtle)_                                                                                                                          | Box shadow for the docked container                                                                              |
| `--kiosk-keyboard-docked-z-index`          | `100`                                                                                                                               | Z-index for the docked keyboard                                                                                  |
| `--kiosk-keyboard-modifier-font-size`      | `var(--sapFontSize, 0.875rem)`                                                                                                      | Modifier / action key font size                                                                                  |
| `--kiosk-keyboard-modifier-font-scale`     | `0.8`                                                                                                                               | Max modifier font as a fraction of key font                                                                      |
| `--kiosk-keyboard-modifier-shadow`         | _(subtle)_                                                                                                                          | Box shadow for modifier keys at rest                                                                             |
| `--kiosk-keyboard-modifier-shadow-hover`   | _(subtle)_                                                                                                                          | Box shadow for modifier keys on hover                                                                            |
| `--kiosk-keyboard-numpad-max-width`        | `20rem`                                                                                                                             | Max width for numpad layout                                                                                      |
| `--kiosk-keyboard-numpad-key-min-width`    | `4rem`                                                                                                                              | Minimum key width in numpad layout                                                                               |
| `--kiosk-keyboard-cq-short-threshold`      | `16rem`                                                                                                                             | Height threshold for the `cq-tier="short"` host attribute                                                        |
| `--kiosk-keyboard-cq-tiny-threshold`       | `12rem`                                                                                                                             | Height threshold for the `cq-tier="tiny"` host attribute                                                         |
| `--kiosk-keyboard-auto-compact-threshold`  | `22rem`                                                                                                                             | Width at or below which `auto-compact` takes the compact layout                                                  |
| `--kiosk-keyboard-dual-direction`          | `row`                                                                                                                               | Flex direction for dual icon+label keys (`row` or `column`)                                                      |
| `--kiosk-keyboard-dual-icon-size`          | `1em`                                                                                                                               | Icon font size in dual mode                                                                                      |
| `--kiosk-keyboard-dual-label-size`         | `1em`                                                                                                                               | Label font size in dual mode (inherits modifier cap)                                                             |
| `--kiosk-keyboard-dual-gap`                | `0.3em`                                                                                                                             | Gap between icon and label in dual mode                                                                          |
| `--kiosk-keyboard-fkey-direction`          | `column`                                                                                                                            | Flex direction for nav/function keys                                                                             |
| `--kiosk-keyboard-fkey-icon-size`          | `clamp(1em, 15cqi, 1.6em)`                                                                                                          | Icon size for nav/function keys (scales with key width)                                                          |
| `--kiosk-keyboard-fkey-label-size`         | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)`                                                                                         | Label size for nav/function keys (responsive)                                                                    |
| `--kiosk-keyboard-fkey-gap`                | `0.05em`                                                                                                                            | Gap between icon and label for nav/function keys                                                                 |
| `--kiosk-keyboard-cjk-font-family`         | _(not declared)_                                                                                                                    | Override font stack for CJK glyph labels                                                                         |
| `--kiosk-keyboard-hangul-font-family`      | _(not declared)_                                                                                                                    | Override font stack for Hangul glyph labels                                                                      |
| `--kiosk-keyboard-indic-font-family`       | _(not declared)_                                                                                                                    | Override font stack for Indic glyph labels                                                                       |
| `--kiosk-keyboard-arabic-font-family`      | _(not declared)_                                                                                                                    | Override font stack for Arabic glyph labels                                                                      |
| `--kiosk-keyboard-variant-popup-gap`       | `0.25rem`                                                                                                                           | Gap between options in the accent-variant popup                                                                  |
| `--kiosk-keyboard-variant-popup-padding`   | `0.25rem`                                                                                                                           | Padding around the accent-variant option row                                                                     |
| `--kiosk-keyboard-variant-popup-max-width` | `92vw`                                                                                                                              | Max width before the accent-variant option row wraps                                                             |

One name in this namespace is not a knob: `--kiosk-keyboard-variant-option-width` carries the anchor key's measured width onto the accent-variant options, and the element writes it as an inline style on the `variant-popup` part every time the popup opens. It is public-prefixed only because it has to cross into the slotted `ui5-button`s; an inline style outranks anything you declare, so size the options through `--kiosk-keyboard-key-height` instead, which is the fallback it resolves to.

In Numpad and Numeric modes, `--kiosk-keyboard-key-font-size` is overridden to a larger value and applies uniformly to all key types (including modifier and action keys).

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
kiosk-keyboard {
  --kiosk-keyboard-max-width: 64rem;
}
```

Docked keyboards default to `64rem` (1024px at the default root font-size) max-width and center automatically via `margin-inline: auto`.

### Responsive Sizing

The keyboard adapts to its container automatically. Width-responsive font scaling uses CSS `@container` queries (capped at narrow widths, though a smaller consumer override is preserved), and height-responsive scaling reduces key height, gaps, and padding when the host's layout box is smaller than the keyboard's natural content height. Override any `--kiosk-keyboard-*` property on the host or a parent (including the `--kiosk-keyboard-cq-*-threshold` height breakpoints) to tune this behavior. See the [CSS Sizing Reference](../../docs/shared/CSS-SIZING-REFERENCE.md) for default values, breakpoint thresholds, scaling factors, constrained-container patterns, and complex-script tuning.

When height-constrained, the component reflects a `cq-tier` attribute (`short` / `tiny`, absent when unconstrained) on the host. Style off it from the outer document with `kiosk-keyboard[cq-tier="short"]` / `[cq-tier="tiny"]`. It is an attribute rather than a class so framework `className` reconciliation cannot wipe it. See [CONSUMPTION.md](../../docs/kiosk-webc/CONSUMPTION.md#height-responsiveness) for the full contract.

If you change `--kiosk-keyboard-*` sizing variables at runtime within a fixed-height host, the rendered outer size may not change, so `ResizeObserver` will not fire; call `refreshResponsiveState()` after the style update to force a fresh responsive measurement.

Override `--kiosk-keyboard-docked-z-index` to adjust the docked keyboard's stacking layer.

When `docked` is combined with `mobile-keyboard="Auto"` (the default), coarse-pointer devices defer to the native on-screen keyboard. Calling `show()` in that mode intentionally keeps the custom docked keyboard closed; use `mobile-keyboard="Custom"` if you want to force the component to open on touch devices.

Shadow custom properties derive from the active SAP theme's `--sapContent_ShadowColor` via `color-mix()`. Consumers can override `--kiosk-keyboard-key-shadow` and related properties for full control.

### Compact Density

Compact density is activated via the `data-ui5-compact-size` attribute (set automatically by the UI5 Web Components framework):

```html
<kiosk-keyboard data-ui5-compact-size></kiosk-keyboard>
```

## Development

```bash
# Install dependencies
npm install

# Generate theme + i18n assets (required before build)
npm run generate

# Build
npm run build

# Unit tests (Vitest, jsdom)
npm test

# Component tests (Web Test Runner, Playwright)
npm run test:component

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

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── KioskKeyboard.ts          # Main web component class
├── KioskKeyboardTemplate.tsx  # JSX template
├── CustomLayout.ts            # <kiosk-keyboard-custom-layout> configuration element
├── Assets.ts                  # Theme + i18n asset registration
├── bundle.esm.ts              # ESM entry point with re-exports
├── types.ts                   # Public type definitions
├── jsx.d.ts                   # JSX type augmentations
├── core/
│   ├── dom-utils.ts           # DOM helpers (ID generation, input resolution)
│   ├── grapheme.ts            # Grapheme-aware cursor utilities
│   ├── i18n.ts                # i18n module (UI5 WC + custom resolver)
│   ├── input-operations.ts    # Text insertion, backspace, navigation
│   ├── keyboard-type-detector.ts  # Auto-detect numpad vs full
│   ├── layout-registry.ts    # Layout storage + locale mapping
│   └── shift-state.ts        # Shift / Caps Lock state machine
├── layouts/                   # Built-in layout definitions
│   ├── default-layout.ts     # Default layout name constant
│   ├── qwerty.ts, qwertz-de.ts, ja-romaji.ts, ja-kana.ts, ja-kana-compact.ts, arabic.ts, ko-hangul.ts, qwerty-es.ts, numeric.ts, special.ts, numpad.ts
│   ├── fkeys.ts, nav.ts      # Standalone F-key/nav layouts
│   └── fkey-row{,-compact}.ts, nav-row{,-compact}.ts  # Shared rows for composite layouts
├── themes/
│   ├── KioskKeyboard.css      # Component styles
│   └── sap_horizon*/          # Theme parameter bundles
├── i18n/                      # Message bundles (.properties)
└── generated/                 # Build output (do not edit)
test/
├── unit/                      # Vitest unit tests
├── component/                 # Web Test Runner component tests
├── e2e/                       # Playwright E2E + visual regression tests
└── pages/                     # Demo pages for screenshots and manual testing
```

## License

MIT
