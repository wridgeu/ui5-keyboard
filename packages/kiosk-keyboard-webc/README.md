# kiosk-keyboard-webc

> Part of the [ui5-lib-keyboard](../../README.md) monorepo. See also: [ui5-lib-hotkeys](../hotkeys/README.md) and [ui5-lib-kiosk-keyboard](../kiosk-keyboard/README.md).

Native web component variant of the kiosk on-screen keyboard, built on the [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) framework (`@ui5/webcomponents-base`).

```html
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

## Features

- **Standards-based custom element** (`<kiosk-keyboard>`) usable in any framework: plain HTML, React, Vue, Angular
- **SAP theming**: Horizon light/dark, HCB, HCW via CSS variables (automatic theme switching)
- **UI5 app integration**: consumable inside UI5 apps via the existing `WebComponent.extend()` bridge pattern
- **Multiple layouts**: QWERTY, QWERTZ-DE, Numeric, Numpad, Special, F-keys, Navigation (and composites like `qwerty-fk`, `qwerty-nav`)
- **Locale-aware**: auto-selects layout based on browser locale (e.g. `de` → `qwertz-de`)
- **Shift / Caps Lock**: single-click for one-shot shift, double-click for caps lock
- **Docked mode**: fixed-position keyboard at bottom of viewport with slide animation
- **Auto-show**: opens/closes automatically when target inputs receive/lose focus
- **Auto-type detection**: switches to Numpad for `type="number"`, `inputmode="numeric"`, `data-keyboard-type="Numpad"`, etc.
- **F-key and navigation key support**: configurable modes: `Virtual`, `Native`, `None`
- **Grapheme-aware**: correct backspace/navigation for emoji and multi-code-unit characters
- **Accessible**: ARIA roles, labels, live region announcements, roving tabindex, keyboard navigation, `prefers-reduced-motion`, `forced-colors`
- **i18n**: built-in English/German, extensible via custom resolver
- **Custom layouts**: register/unregister layouts at runtime

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
- **Modifier**: transparent background, no border (`--sapButton_Lite_Background`). Used for Shift, Caps Lock, layout switchers, and similar non-character keys.
- **Action**: emphasized style (`--sapButton_Emphasized_Background`). Used for Enter, Backspace.

### Theme Preview

| `sap_horizon`                                                                      | `sap_horizon_dark`                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ![QWERTY in sap_horizon](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon.png) | ![QWERTY in sap_horizon_dark](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                          | `sap_horizon_hcw`                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ![QWERTY in sap_horizon_hcb](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_hcb.png) | ![QWERTY in sap_horizon_hcw](../../docs/kiosk-webc/images/webc-qwerty-sap_horizon_hcw.png) |

## Installation

> This package is currently workspace-only (`private: true`) and not published to npm.

In this monorepo, install all workspace dependencies once at the repository root:

```bash
npm install
```

If/when this package is published, install it directly from npm:

```bash
npm install kiosk-keyboard-webc
```

## Consumption Modes

### 1. Standalone via `kiosk-keyboard-webc/bundle` (recommended)

Recommended for plain HTML, React, Vue, Angular, and most non-UI5 apps.

`kiosk-keyboard-webc/bundle` is the convenience entry point. It imports `Assets`, registers the custom element, loads theme and i18n assets, and inserts the SAP "72" font face.

> [!NOTE]
> The examples below use bare package specifiers (`kiosk-keyboard-webc/…`), which require a bundler (Vite, webpack, etc.) or an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap). For plain `<script>` usage without a build step, replace the specifier with the resolved path to `dist/kiosk-keyboard.bundle.js` (for example `./node_modules/kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js`).

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
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
> **Font loading:** `kiosk-keyboard-webc/bundle` already imports `kiosk-keyboard-webc/Assets`, which in turn loads the SAP "72" font via `@ui5/webcomponents-base/dist/FontFace.js` and registers theme/i18n assets. If you use the bare `kiosk-keyboard-webc` entry directly, import `kiosk-keyboard-webc/Assets` yourself and make sure the "72" font is available (for example via the UI5 framework, `FontFace.js`, or a custom `@font-face` declaration).
>
> **Custom fonts:** If you override `--sapFontFamily` or set a custom `font-family` on the keyboard, the default key sizing may not fit the new font's glyph metrics. You may need to adjust `--kiosk-keyboard-key-height`, `--kiosk-keyboard-key-font-size`, or `--kiosk-keyboard-key-padding` to prevent clipping or excessive whitespace.

### 3. Inside a UI5 app

This package is not a native UI5 library, so the UI5-app story is different from `ui5-lib-hotkeys` / `ui5-lib-kiosk-keyboard`.

For UI5 apps, make sure your app can resolve npm ESM packages via `ui5-tooling-modules` in `ui5.yaml`. There are two integration paths:

#### 3a. Seamless Web Components (CEM-driven, recommended)

Published builds include `dist/custom-elements.json` (the Custom Elements Manifest), and the package declares the `customElements` field in `package.json`. The `ui5-tooling-modules` middleware reads this manifest and auto-generates a `sap.ui.core.webc.WebComponent` wrapper at serve/build time. No manual wrapper code needed.

```yaml
# ui5.yaml - config for seamless web component consumption
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
<mvc:View xmlns:kb="kiosk-keyboard-webc/dist">
  <kb:KioskKeyboard layout="qwerty" docked="true" />
</mvc:View>
```

In workspace development, run `npm run generate` in the webc package first so that `dist/custom-elements.json` exists. The `generate` script produces the CEM alongside CSS and i18n assets.

The framework version declared in `ui5.yaml` must be >= 1.120.0 for the seamless web component transformation to activate. The [SAP-samples/uxc-integration](https://github.com/SAP-samples/uxc-integration) project is the official reference for the build-time configuration (`addToNamespace: true` on the task).

`useRelativeModulePaths: true` is required because the middleware's default redirect mechanism has a routing bug for application-type projects during dev serve. See [`UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md`](../../docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) for the config/path reference table and root cause.

The demo app in this repository uses Path B (section 3b below) for the `kiosk-keyboard` web component specifically, because the manual bridge was chosen for explicit metadata control. Path A is used in the demo app for `@ui5/webcomponents/dist` components (e.g. `KioskInputIds.view.xml`).

#### 3b. `WebComponent.extend()` bridge (explicit control)

For full control over the UI5 metadata surface, create a manual bridge using `WebComponent.extend()`. This gives explicit property/event/method/association mappings and typed UI5 events. Since UI5 >= 1.138, camelCase event names in `metadata.events` auto-convert to kebab-case DOM events (e.g. `keyPress` maps to `key-press`), so explicit `mapping: { to: "..." }` on events is not needed.

This repository's demo app includes a complete bridge at `packages/demo-app/webapp/control/KioskKeyboardWebc.ts` that can be used as a template. A dedicated smoke check (`npm run test:demo:webc-bundle`) verifies the bridge entry point stays resolvable.

```ts
import WebComponent from "sap/ui/core/webc/WebComponent";
import "kiosk-keyboard-webc/bundle";

const KioskKeyboardWebc = WebComponent.extend("my.control.KioskKeyboard", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: { type: "string", defaultValue: "", mapping: { type: "property", to: "layout" } },
      docked: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "docked" } },
      // ... see packages/demo-app/webapp/control/KioskKeyboardWebc.ts for full mapping
    },
  },
});
```

Use the bridge when you want predictable XML view metadata, typed UI5 events, or imperative methods such as `show()` / `close()` exposed as a UI5 control API.

### Choosing between the UI5 control and the web component

| Criterion         | `ui5-lib-kiosk-keyboard` (UI5 control)                | `kiosk-keyboard-webc` (web component)                         |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Framework**     | SAPUI5 / OpenUI5 only                                 | Any (plain HTML, React, Vue, Angular, UI5 via wrapper/bridge) |
| **Theming**       | LESS variables (`@sapUiButton*`)                      | CSS custom properties + SAP theme token fallbacks             |
| **i18n**          | UI5 ResourceBundle with `configureI18n()` API         | Built-in EN/DE + `setI18nResolver()` callback                 |
| **Target inputs** | UI5 associations (`targetInput`) + `setTargetInput()` | `for` attribute + `setTargetElement()`                        |
| **Density**       | UI5 content density (`sapUiSizeCompact`)              | `data-ui5-compact-size` attribute                             |

Both packages share the same layout definitions (`KeyDefinition`, `LayoutDefinition`), layout registry API (`registerLayout`, `registerLocaleLayout`), and special-key syntax (`{shift}`, `{backspace}`, `{layout:name}`). Custom layouts work identically across both.

Event naming follows platform conventions: `keyPress` (camelCase) in the UI5 control vs `key-press` (kebab-case) in the web component. Event payloads are structurally identical.

See [`UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md`](../../docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) for general guidance on web component consumption patterns inside UI5 apps.

## API Stability

Recommended stable consumer entry points and imports:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";

import type {
  FKeyMode,
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
} from "kiosk-keyboard-webc/bundle";
```

For most applications, prefer `kiosk-keyboard-webc/bundle`. The bare `kiosk-keyboard-webc` entry point is also supported for advanced setups when paired with `kiosk-keyboard-webc/Assets`.

All static methods on `KioskKeyboard` (layout registry, locale mapping, `setI18nResolver`) and instance convenience delegates (`registerLayout`, `unregisterLayout`, `registerLocaleLayout`, `unregisterLocaleLayout`) are part of the stable API surface.

Internal modules under `core/*` (e.g. `shift-state`, `dom-utils`, `input-operations`, `layout-registry`) are implementation details and may change without notice. Individual layout files under `layouts/*` are likewise internal; layouts are consumed by name through the `layout` attribute or the `registerLayout` API. The two shared row modules (`kiosk-keyboard-webc/layouts/fkey-row`, `kiosk-keyboard-webc/layouts/nav-row`) are stable for composing custom variant layouts. These rows omit `type` (defaulting to regular keys with visible borders); set `type: "modifier"` on individual keys to get the transparent Lite button style instead.

> [!NOTE]
> See the [API Stability Policy](../../docs/shared/API-STABILITY.md) for full details on stable vs internal import boundaries across all packages.

## Attributes / Properties

| Attribute         | Property         | Type      | Default     | Description                                                                                                                                                                                     |
| ----------------- | ---------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`          | `layout`         | `string`  | `""`        | Layout name (e.g. `qwerty`, `qwertz-de`). Empty = auto-detect from locale.                                                                                                                      |
| `keyboard-type`   | `keyboardType`   | `string`  | `"Full"`    | `"Full"`, `"Numpad"`, or `"Numeric"`.                                                                                                                                                           |
| `open`            | `open`           | `boolean` | `false`     | Opens/closes the docked keyboard. Equivalent to `show()`/`close()`.                                                                                                                             |
| `docked`          | `docked`         | `boolean` | `false`     | Fixed-position mode at bottom of viewport.                                                                                                                                                      |
| `auto-show`       | `autoShow`       | `boolean` | `false`     | Auto open/close when target inputs gain/lose focus (requires `docked`).                                                                                                                         |
| `auto-type`       | `autoType`       | `boolean` | `false`     | Auto-detect keyboard type from focused input's type/inputmode.                                                                                                                                  |
| `disabled`        | `disabled`       | `boolean` | `false`     | Disables all key interaction.                                                                                                                                                                   |
| `for`             | `for`            | `string`  | `""`        | ID of the target element (native input or host with nested input).                                                                                                                              |
| `input-ids`       | `inputIds`       | `string`  | `""`        | Comma-separated IDs to restrict auto-show to specific inputs.                                                                                                                                   |
| `stable-height`   | `stableHeight`   | `boolean` | `false`     | Maintains the maximum observed height (prevents layout shifts). Only effective for non-docked Full keyboards. Latches and never auto-shrinks; toggle off/on to reset after orientation changes. |
| `accessible-name` | `accessibleName` | `string`  | `""`        | Custom ARIA label for the keyboard. Falls back to i18n "Virtual Keyboard".                                                                                                                      |
| `mobile-keyboard` | `mobileKeyboard` | `string`  | `"Auto"`    | `"Auto"` (defer to native on touch), `"Custom"`, or `"Native"`.                                                                                                                                 |
| `f-key-mode`      | `fKeyMode`       | `string`  | `"Virtual"` | `"Virtual"` (fire event + move cursor), `"Native"` (dispatch keydown), `"None"`.                                                                                                                |

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

| Event                  | Detail                                                                          | Description                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `key-press`            | `{ key: string, shiftKey: boolean, char?: string }`                             | Fired on key click. Cancelable. `char` is the resolved character (after shift); `undefined` for action/F-keys.  |
| `after-open`           | -                                                                               | Fired when the docked keyboard enters the open state. State-change hook only; not a CSS transition-end event.   |
| `after-close`          | -                                                                               | Fired when the docked keyboard enters the closed state. State-change hook only; not a CSS transition-end event. |
| `layout-change`        | `{ layout: string }`                                                            | Fired when layout switches.                                                                                     |
| `keyboard-type-change` | `{ keyboardType: string, previousKeyboardType: string, autoDetected: boolean }` | Fired when keyboard type changes.                                                                               |

## Methods

| Method                                 | Description                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show()`                               | Opens the docked keyboard (sets `open = true`) when the current `mobileKeyboard` mode allows custom rendering. Logs a warning if `docked` is `false`.                 |
| `close()`                              | Closes the docked keyboard (sets `open = false`).                                                                                                                     |
| `isOpen()`                             | Returns whether the docked keyboard is open.                                                                                                                          |
| `setTargetElement(el)`                 | Programmatically sets the target input/textarea.                                                                                                                      |
| `setTargetResolver(fn)`                | Sets a custom resolver to locate the native input/textarea inside a host element. Pass `null` to clear.                                                               |
| `resetKeyboardType()`                  | Resets keyboard type to `"Full"` and re-enables auto-type detection.                                                                                                  |
| `refreshResponsiveState()`             | Recomputes responsive width/height classes after runtime styling changes that do not emit a reliable resize signal. Usually not needed for normal container resizing. |
| `registerLayout(name, definition)`     | Registers a custom layout (delegates to shared registry).                                                                                                             |
| `unregisterLayout(name)`               | Removes a custom layout (delegates to shared registry).                                                                                                               |
| `registerLocaleLayout(locale, layout)` | Maps a BCP-47 locale to a layout name (delegates to shared registry).                                                                                                 |
| `unregisterLocaleLayout(locale)`       | Removes a locale mapping (delegates to shared registry).                                                                                                              |

`after-open` and `after-close` fire synchronously when the `open` state flips.
They report the state transition itself, not animation completion.

## Static API

| Method                                               | Description                                        |
| ---------------------------------------------------- | -------------------------------------------------- |
| `KioskKeyboard.registerLayout(name, definition)`     | Registers a custom layout.                         |
| `KioskKeyboard.unregisterLayout(name)`               | Removes a custom layout.                           |
| `KioskKeyboard.resetCustomLayouts()`                 | Removes all custom layouts.                        |
| `KioskKeyboard.getRegisteredLayout(name)`            | Returns a layout definition by name.               |
| `KioskKeyboard.getRegisteredLayoutNames()`           | Returns all registered layout names.               |
| `KioskKeyboard.isBuiltInLayout(name)`                | Checks if a layout is built-in.                    |
| `KioskKeyboard.isSecondaryLayout(name)`              | Checks if a layout is secondary (non-alphabetic).  |
| `KioskKeyboard.registerLocaleLayout(locale, layout)` | Maps a BCP-47 locale to a layout name.             |
| `KioskKeyboard.unregisterLocaleLayout(locale)`       | Removes a locale mapping.                          |
| `KioskKeyboard.resetLocaleLayouts()`                 | Resets locale mappings to defaults.                |
| `KioskKeyboard.getLocaleLayout()`                    | Returns the layout for the current browser locale. |
| `KioskKeyboard.setI18nResolver(fn)`                  | Sets a custom i18n resolver callback.              |

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

| Name            | Description                               |
| --------------- | ----------------------------------------- |
| `qwerty`        | Standard US QWERTY                        |
| `qwertz-de`     | German QWERTZ with umlauts and ß          |
| `numeric`       | Numbers + common symbols                  |
| `special`       | Extended symbols (`#+=`, currencies)      |
| `numpad`        | Calculator-style number pad               |
| `fkeys`         | F1-F12 function keys                      |
| `nav`           | Navigation keys (arrows, Home, End, etc.) |
| `qwerty-fk`     | QWERTY + F-key row                        |
| `qwertz-de-fk`  | QWERTZ-DE + F-key row                     |
| `qwerty-nav`    | QWERTY + navigation row                   |
| `qwertz-de-nav` | QWERTZ-DE + navigation row                |

## Custom Layouts

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";

KioskKeyboard.registerLayout("my-layout", [
  [{ value: "a" }, { value: "b" }, { value: "c" }, { value: "{backspace}", type: "action" }],
  [
    { value: " ", width: "space", type: "space" },
    { value: "{enter}", type: "action" },
  ],
]);
```

Or via DOM (no ES import needed; requires a bundler or import map, see note above):

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard id="kb" layout="pin-pad" for="my-input"></kiosk-keyboard>

<script>
  const kb = document.querySelector("#kb");
  kb.registerLayout("pin-pad", [
    [{ value: "1" }, { value: "2" }, { value: "3" }],
    [{ value: "4" }, { value: "5" }, { value: "6" }],
    [{ value: "7" }, { value: "8" }, { value: "9" }],
    [{ value: "{backspace}", type: "action" }, { value: "0" }, { value: "{enter}", type: "action" }],
  ]);
</script>
```

> [!NOTE]
> The layout registry is shared across all `<kiosk-keyboard>` instances on the page. A layout registered on one element is available to all others.

Each key is a `KeyDefinition`:

```ts
interface KeyDefinition {
  value: string; // Character to insert, or action like "{shift}", "{enter}", "{backspace}", "{layout:numeric}", "{fkey:F5}"
  label?: string; // Display label (defaults to value)
  shiftLabel?: string; // Label when shifted
  shiftValue?: string; // Value when shifted (defaults to value.toUpperCase() for single chars)
  width?: KeyWidth; // "1.5" | "1.75" | "2" | "2.25" | "space"
  type?: KeyType; // "default" | "modifier" | "action" | "space"
  icon?: string; // Custom text icon (rendered as label, not <ui5-icon>)
}
```

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

The keyboard ships with English and German translations for all ARIA labels, role descriptions, and screen reader announcements. The built-in UI5 Web Components i18n infrastructure loads the correct locale bundle automatically based on `navigator.language`.

Visible key text (e.g. "q", "123", "Fn") is driven by layout definitions, not i18n. The i18n system controls accessibility-facing strings: the keyboard's `aria-label`, `aria-roledescription`, key `aria-label` attributes (for icon-only keys like Shift, Enter, Backspace, Space), and live region announcements (shift/caps lock state changes, keyboard open/close).

**Resource bundle keys:**

| Key                              | Default (English)       | Used for                                                |
| -------------------------------- | ----------------------- | ------------------------------------------------------- |
| `KIOSK_KEYBOARD_LABEL`           | Virtual Keyboard        | Default `aria-label` when `accessibleName` is empty     |
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

### Custom i18n Resolver

Use `KioskKeyboard.setI18nResolver()` to override or extend translations at runtime without modifying the library. The resolver receives the i18n key, the current locale (from `navigator.language`), and the text resolved from the built-in bundle:

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
    ARIA_CAPS_LOCK: "Verrouillage majuscules",
    ARIA_CAPS_LOCK_ON: "Verrouillage majuscules active",
    ARIA_SHIFT_ON: "Majuscules activees",
    ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
    ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferme",
  };
  if (locale === "fr" && fr[key]) return fr[key];
  return undefined; // fall through to built-in text
});
```

**Resolution order:** custom resolver (highest priority) -> UI5 WC i18n bundle (locale-aware) -> English defaults.

Calling `KioskKeyboard.setI18nResolver()` automatically re-renders connected keyboard instances, so mounted components pick up new labels without a manual refresh.

Return `undefined` from the resolver for any key you don't want to override -- the built-in translation chain handles the rest. If the resolver throws, the error is logged and the default text is used.

Pass `null` to clear a previously set resolver:

```ts
KioskKeyboard.setI18nResolver(null);
```

**Dynamic translations:** The resolver is called on every render, so it can return different values based on runtime state (e.g. a tenant-specific translation service, user preferences, or an external i18n library):

```ts
import { get } from "my-i18n-library";

KioskKeyboard.setI18nResolver((key, locale) => {
  return get(`kiosk.${key}`, locale); // returns string or undefined
});
```

**Adding built-in translations (library contributors):** To add a new locale to the library itself, create a properties file in `src/i18n/` following the naming convention `messagebundle_<locale>.properties` (e.g. `messagebundle_fr.properties`). The UI5 Web Components build pipeline picks it up automatically.

> [!NOTE]
> The UI5 native control (`ui5-lib-kiosk-keyboard`) offers a richer i18n API with enhancement bundles and locale configuration via `configureI18n()`. The web component intentionally uses a simpler single-callback approach since it operates outside the UI5 resource bundle infrastructure. The resolver callback covers the same use cases -- adding languages, overriding texts, connecting to external translation systems -- through a pattern that is more natural for standalone web component consumption.

## CSS Parts

The component exposes CSS shadow parts for structural styling from outside the shadow DOM. Use `::part()` selectors to customize elements that CSS custom properties alone cannot reach (e.g., changing `display`, adding borders to specific elements, or adjusting flex behavior).

| Part        | Element                            | Description                                |
| ----------- | ---------------------------------- | ------------------------------------------ |
| `keyboard`  | Root container (`.kiosk-keyboard`) | The outermost keyboard wrapper             |
| `row`       | Row container (`.kiosk-row`)       | Each row of keys                           |
| `key`       | Every key element                  | All keys (regular, modifier, and action)   |
| `modifier`  | Modifier keys (Shift, 123, Fn)     | Combined with `key`: `part="key modifier"` |
| `action`    | Action keys (Enter, Backspace)     | Combined with `key`: `part="key action"`   |
| `key-label` | Text label inside a key            | The `<span>` rendering the key's text      |
| `key-icon`  | Icon inside a key                  | The `<ui5-icon>` rendering built-in icons  |

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

### Forwarding Parts (`exportparts`)

CSS `::part()` selectors do not cross multiple shadow DOM boundaries. If you wrap `<kiosk-keyboard>` inside another web component, you must forward the parts using the `exportparts` attribute on the inner `<kiosk-keyboard>` element.

The `KioskKeyboard.DOM.exportParts` constant provides a ready-to-use attribute value:

```html
<!-- Inside my-wrapper's shadow DOM template -->
<kiosk-keyboard exportparts="keyboard, row, key, modifier, action, key-label, key-icon"></kiosk-keyboard>
```

Or programmatically:

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

The documented `--kiosk-keyboard-*` variables are the supported styling API. Internal `--_kiosk-keyboard-*` aliases and raw shadow DOM class names remain private implementation details. For tests and DOM assertions, use the stable `KioskKeyboard.DOM` contract instead of hard-coded selectors. This package currently expects customization through host attributes and public CSS variables rather than shadow-internal selectors.

Override these on the `:host` or a parent element to customize appearance:

| Property                                 | Default                                                   | Description                                     |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `--kiosk-keyboard-padding`               | `0.75rem`                                                 | Container padding                               |
| `--kiosk-keyboard-key-gap`               | `0.375rem`                                                | Gap between keys                                |
| `--kiosk-keyboard-key-height`            | `3rem`                                                    | Key height                                      |
| `--kiosk-keyboard-key-font-size`         | `calc(var(--kiosk-keyboard-key-height) * 0.375)`          | Key font size (all key types in Numpad/Numeric) |
| `--kiosk-keyboard-key-padding-inline`    | `0.25rem`                                                 | Horizontal key padding                          |
| `--kiosk-keyboard-key-padding`           | `0 0.25rem`                                               | Full padding shorthand (uses padding-inline)    |
| `--kiosk-keyboard-key-padding-inline-xs` | `min(var(--kiosk-keyboard-key-padding-inline), 0.125rem)` | Horizontal key padding in extra-narrow mode     |
| `--kiosk-keyboard-key-padding-xs`        | `0 var(--kiosk-keyboard-key-padding-inline-xs)`           | Full padding shorthand in extra-narrow mode     |
| `--kiosk-keyboard-key-shadow`            | _(subtle)_                                                | Box shadow for keys at rest                     |
| `--kiosk-keyboard-key-shadow-hover`      | _(subtle)_                                                | Box shadow for keys on hover                    |
| `--kiosk-keyboard-max-width`             | `100%`                                                    | Max width for the default inline keyboard       |
| `--kiosk-keyboard-docked-max-width`      | `1024px`                                                  | Max width in docked mode                        |
| `--kiosk-keyboard-docked-shadow`         | _(subtle)_                                                | Box shadow for the docked container             |
| `--kiosk-keyboard-docked-z-index`        | `100`                                                     | Z-index for the docked keyboard                 |
| `--kiosk-keyboard-modifier-font-size`    | `var(--sapFontSize, 0.875rem)`                            | Modifier / action key font size                 |
| `--kiosk-keyboard-modifier-shadow`       | _(subtle)_                                                | Box shadow for modifier keys at rest            |
| `--kiosk-keyboard-modifier-shadow-hover` | _(subtle)_                                                | Box shadow for modifier keys on hover           |
| `--kiosk-keyboard-numpad-max-width`      | `20rem`                                                   | Max width for numpad layout                     |
| `--kiosk-keyboard-numpad-key-min-width`  | `4rem`                                                    | Minimum key width in numpad layout              |
| `--kiosk-keyboard-cq-narrow-threshold`   | `30rem`                                                   | Width threshold for `--cq-sm` class             |
| `--kiosk-keyboard-cq-compact-threshold`  | `20rem`                                                   | Width threshold for `--cq-xs` class             |
| `--kiosk-keyboard-cq-short-threshold`    | `16rem`                                                   | Height threshold for `--cq-short` class         |
| `--kiosk-keyboard-cq-tiny-threshold`     | `12rem`                                                   | Height threshold for `--cq-tiny` class          |

In Numpad and Numeric modes, `--kiosk-keyboard-key-font-size` is overridden to a larger value and applies uniformly to all key types (including modifier and action keys).

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
kiosk-keyboard {
  --kiosk-keyboard-max-width: 64rem;
}
```

Docked keyboards default to `1024px` max-width and center automatically via `margin-inline: auto`.

Width-responsive font scaling uses CSS container queries in capable browsers and falls back to JS-driven classes (via `ResizeObserver`) in older webviews that lack container query support. At narrow widths (≤ 30 rem / ≤ 20 rem), `--kiosk-keyboard-key-font-size` is capped to `1rem` / `0.875rem`, but a consumer-provided value that is already smaller than the cap is preserved. In the extra-narrow `≤ 20rem` mode, non-numpad keys also switch from `--kiosk-keyboard-key-padding` to `--kiosk-keyboard-key-padding-xs`. The default reduces horizontal padding from `0.25rem` to `0.125rem` because wide glyphs such as `@`, `%`, and `&` become visually cramped before the touch target itself needs to shrink. The `min(...)` default keeps any smaller consumer override intact, while still letting consumers opt into a roomier or tighter compact mode explicitly. Height-responsive sizing detects when the host element's layout box is smaller than the keyboard's natural content height and reduces key height, gaps, and modifier font-size automatically.

The four `--kiosk-keyboard-cq-*-threshold` variables control when responsive classes (`--cq-sm`, `--cq-xs`, `--cq-short`, `--cq-tiny`) activate. Override them to tune breakpoints for your container:

```css
/* Trigger compact mode earlier for a tight sidebar */
kiosk-keyboard {
  --kiosk-keyboard-cq-narrow-threshold: 25rem;
  --kiosk-keyboard-cq-short-threshold: 14rem;
}
```

> [!NOTE]
> The default width behavior uses native CSS `@container` breakpoints at `30rem` / `20rem` for instant response. When you override `--kiosk-keyboard-cq-narrow-threshold` or `--kiosk-keyboard-cq-compact-threshold`, the component automatically switches to class-driven width styling so the custom breakpoints become authoritative in CQ and non-CQ browsers alike.

For troubleshooting, the root element toggles internal classes such as `kiosk-keyboard--cq-sm`, `kiosk-keyboard--cq-xs`, `kiosk-keyboard--cq-short`, and `kiosk-keyboard--cq-tiny`. They explain when the responsive CSS variables take effect, but they are implementation details rather than public styling hooks; prefer overriding the documented `--kiosk-keyboard-*` variables instead of targeting those classes from app CSS.

The height constraint must affect the **host element's own dimensions** -- the component measures `clientHeight` on itself. A parent with `overflow: hidden` alone clips the visual rendering but does not shrink the host's layout box, so the keyboard will be clipped instead of adapting.

```html
<!-- Works: constraint on the host element -->
<kiosk-keyboard style="max-height: 250px; overflow: hidden"></kiosk-keyboard>

<!-- Works: flex parent propagates constraint to the host -->
<div style="display: flex; flex-direction: column; height: 250px">
  <kiosk-keyboard style="flex: 1; min-height: 0; overflow: hidden"></kiosk-keyboard>
</div>

<!-- Does NOT work: wrapper clips paint but host renders at natural height -->
<div style="max-height: 250px; overflow: hidden">
  <kiosk-keyboard></kiosk-keyboard>
</div>
```

Most runtime style changes are picked up automatically through rendering and `ResizeObserver`. If you intentionally combine `stable-height` with styling changes that alter intrinsic height without changing the rendered outer box (for example toggling compact mode or swapping `--kiosk-keyboard-*` sizing variables at runtime), call `refreshResponsiveState()` after the style update to force a fresh height measurement.

#### Label Sizing

Key labels use three scaling tiers:

| Tier                  | Applies to                                     | Scaling                                                                                                                                           |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glyph**             | Single-grapheme labels (`a`, `@`, `€`)         | No scaling, rendered at the key's font-size with `overflow: visible` so wide glyphs are not clipped.                                              |
| **Multi**             | Multi-character labels (`F10`, `Home`, `PgUp`) | Scales proportionally to the key's inline width via `clamp(0.5rem, 100cqi × 0.35, 1em)`.                                                          |
| **Modifier / Action** | Shift, Enter, Backspace, layout switches       | Defaults to the theme's base font-size (`--sapFontSize`). Scaled down in height-constrained containers via `--kiosk-keyboard-modifier-font-size`. |

Override `--kiosk-keyboard-docked-z-index` to adjust the docked keyboard's stacking layer.

When `docked` is combined with `mobile-keyboard="Auto"` (the default), coarse-pointer devices defer to the native on-screen keyboard. Calling `show()` in that mode intentionally keeps the custom docked keyboard closed; use `mobile-keyboard="Custom"` if you want to force the component to open on touch devices.

Shadow custom properties use static `rgba()` fallbacks by default and apply `color-mix()` theme-aware overrides only inside a guarded `@supports` block. Browsers that do not support `color-mix()` therefore keep the fallback shadows instead of dropping them. Consumers can override `--kiosk-keyboard-key-shadow` and related properties for full control.

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

## Project Structure

```
src/
├── KioskKeyboard.ts          # Main web component class
├── KioskKeyboardTemplate.tsx  # JSX template
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
│   ├── index.ts               # Layout registry
│   ├── default-layout.ts     # Default layout name constant
│   ├── qwerty.ts, qwertz-de.ts, numeric.ts, special.ts, numpad.ts
│   ├── fkeys.ts, nav.ts      # Standalone F-key/nav layouts
│   ├── fkey-row.ts, nav-row.ts  # Shared rows for composite layouts
│   └── qwerty-fk.ts, qwertz-de-fk.ts, qwerty-nav.ts, qwertz-de-nav.ts
├── themes/
│   ├── KioskKeyboard.css      # Component styles
│   └── sap_horizon*/          # Theme parameter bundles
├── i18n/                      # Message bundles (.properties)
└── generated/                 # Build output (do not edit)
test/
├── unit/                      # Vitest unit tests
├── component/                 # Web Test Runner component tests
├── e2e/                       # WebdriverIO E2E + visual regression tests
└── pages/                     # Demo pages for screenshots and manual testing
```

## License

MIT
