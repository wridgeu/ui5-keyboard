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

## Usage

### Standalone (any framework)

> [!NOTE]
> The examples below use bare package specifiers (`kiosk-keyboard-webc/…`), which require a bundler (Vite, webpack, etc.) or an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap). For plain `<script>` usage without a build step, replace the specifier with the resolved path to `dist/kiosk-keyboard.bundle.js` (e.g. `./node_modules/kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js`).

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

### ESM import

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
```

> [!TIP]
> The `kiosk-keyboard.bundle.js` file inlines all UI5 Web Components dependencies into a single file for convenience. If your app already loads `@ui5/webcomponents-base` (e.g., a UI5 Web Components app), prefer the ESM import or the tree-shakeable `kiosk-keyboard-webc` entry point to avoid duplicating framework code.

> [!IMPORTANT]
> **Font loading:** The bundle and ESM entry points automatically load the SAP "72" font via `@ui5/webcomponents-base/dist/FontFace.js` and register theme/i18n assets. The keyboard CSS (`font-size`, `padding`, `key widths`) is tuned for the "72" font metrics. Using a fallback font like Arial can cause visible clipping on narrow keys (e.g. phone-sized viewports). If you use the tree-shakeable `kiosk-keyboard-webc` entry directly, you must also import `kiosk-keyboard-webc/Assets` to register themes and i18n bundles, and ensure the "72" font is loaded (e.g. via the UI5 framework, `@ui5/webcomponents-base/dist/FontFace.js`, or a custom `@font-face` declaration).
>
> **Custom fonts:** If you override `--sapFontFamily` or set a custom `font-family` on the keyboard, the default key sizing may not fit the new font's glyph metrics. You may need to adjust `--kiosk-keyboard-key-height`, `--kiosk-keyboard-key-font-size`, or `--kiosk-keyboard-key-padding` to prevent clipping or excessive whitespace.

### Inside a UI5 app

Use the `WebComponent.extend()` bridge (see `packages/demo-app` for a working example):

```ts
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

### Choosing between the UI5 control and the web component

| Criterion         | `ui5-lib-kiosk-keyboard` (UI5 control)                | `kiosk-keyboard-webc` (web component)                 |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **Framework**     | SAPUI5 / OpenUI5 only                                 | Any (plain HTML, React, Vue, Angular, UI5 via bridge) |
| **Theming**       | LESS variables (`@sapUiButton*`)                      | CSS custom properties + SAP theme token fallbacks     |
| **i18n**          | UI5 ResourceBundle with `configureI18n()` API         | Built-in EN/DE + `setI18nResolver()` callback         |
| **Target inputs** | UI5 associations (`targetInput`) + `setTargetInput()` | `for` attribute + `setTargetElement()`                |
| **Density**       | UI5 content density (`sapUiSizeCompact`)              | `data-ui5-compact-size` attribute                     |

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

| Event                  | Detail                                                                          | Description                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `key-press`            | `{ key: string, shiftKey: boolean, char?: string }`                             | Fired on key click. Cancelable. `char` is the resolved character (after shift); `undefined` for action/F-keys. |
| `after-open`           | -                                                                               | Fired after docked keyboard opens.                                                                             |
| `after-close`          | -                                                                               | Fired after docked keyboard closes.                                                                            |
| `layout-change`        | `{ layout: string }`                                                            | Fired when layout switches.                                                                                    |
| `keyboard-type-change` | `{ keyboardType: string, previousKeyboardType: string, autoDetected: boolean }` | Fired when keyboard type changes.                                                                              |

## Methods

| Method                                 | Description                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `show()`                               | Opens the docked keyboard (sets `open = true`). Logs a warning if `docked` is `false`.                  |
| `close()`                              | Closes the docked keyboard (sets `open = false`).                                                       |
| `isOpen()`                             | Returns whether the docked keyboard is open.                                                            |
| `setTargetElement(el)`                 | Programmatically sets the target input/textarea.                                                        |
| `setTargetResolver(fn)`                | Sets a custom resolver to locate the native input/textarea inside a host element. Pass `null` to clear. |
| `resetKeyboardType()`                  | Resets keyboard type to `"Full"` and re-enables auto-type detection.                                    |
| `registerLayout(name, definition)`     | Registers a custom layout (delegates to shared registry).                                               |
| `unregisterLayout(name)`               | Removes a custom layout (delegates to shared registry).                                                 |
| `registerLocaleLayout(locale, layout)` | Maps a BCP-47 locale to a layout name (delegates to shared registry).                                   |
| `unregisterLocaleLayout(locale)`       | Removes a locale mapping (delegates to shared registry).                                                |

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

## Built-in Layouts

| Name            | Description                               |
| --------------- | ----------------------------------------- |
| `qwerty`        | Standard US QWERTY                        |
| `qwertz-de`     | German QWERTZ with umlauts and ß          |
| `numeric`       | Numbers + common symbols                  |
| `special`       | Extended symbols (`#+=`, currencies)      |
| `numpad`        | Calculator-style number pad               |
| `fkeys`         | F1–F12 function keys                      |
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

## CSS Custom Properties

Override these on the `:host` or a parent element to customize appearance:

| Property                                 | Default                                          | Description                                     |
| ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `--kiosk-keyboard-padding`               | `0.75rem`                                        | Container padding                               |
| `--kiosk-keyboard-key-gap`               | `0.375rem`                                       | Gap between keys                                |
| `--kiosk-keyboard-key-height`            | `3rem`                                           | Key height                                      |
| `--kiosk-keyboard-key-font-size`         | `calc(var(--kiosk-keyboard-key-height) * 0.375)` | Key font size (all key types in Numpad/Numeric) |
| `--kiosk-keyboard-key-padding-inline`    | `0.25rem`                                        | Horizontal key padding                          |
| `--kiosk-keyboard-key-padding`           | `0 0.25rem`                                      | Full padding shorthand (uses padding-inline)    |
| `--kiosk-keyboard-key-shadow`            | _(subtle)_                                       | Box shadow for keys at rest                     |
| `--kiosk-keyboard-key-shadow-hover`      | _(subtle)_                                       | Box shadow for keys on hover                    |
| `--kiosk-keyboard-max-width`             | `100%`                                           | Max width for the default inline keyboard       |
| `--kiosk-keyboard-docked-max-width`      | `1024px`                                         | Max width in docked mode                        |
| `--kiosk-keyboard-docked-shadow`         | _(subtle)_                                       | Box shadow for the docked container             |
| `--kiosk-keyboard-docked-z-index`        | `100`                                            | Z-index for the docked keyboard                 |
| `--kiosk-keyboard-modifier-font-size`    | `var(--sapFontSize, 0.875rem)`                   | Modifier / action key font size                 |
| `--kiosk-keyboard-modifier-shadow`       | _(subtle)_                                       | Box shadow for modifier keys at rest            |
| `--kiosk-keyboard-modifier-shadow-hover` | _(subtle)_                                       | Box shadow for modifier keys on hover           |
| `--kiosk-keyboard-numpad-max-width`      | `20rem`                                          | Max width for numpad layout                     |
| `--kiosk-keyboard-numpad-key-min-width`  | `4rem`                                           | Minimum key width in numpad layout              |

In Numpad and Numeric modes, `--kiosk-keyboard-key-font-size` is overridden to a larger value and applies uniformly to all key types (including modifier and action keys).

By default, the inline keyboard takes the full width of its container (`100%`). To prevent wide desktop containers from stretching the rows indefinitely, cap the width explicitly:

```css
kiosk-keyboard {
  --kiosk-keyboard-max-width: 64rem;
}
```

Docked keyboards default to `1024px` max-width and center automatically via `margin-inline: auto`.

Width-responsive font scaling uses CSS container queries in capable browsers and falls back to JS-driven classes (via `ResizeObserver`) in older webviews that lack container query support. At narrow widths (≤ 30 rem / ≤ 20 rem), `--kiosk-keyboard-key-font-size` is capped to `1rem` / `0.875rem`, but a consumer-provided value that is already smaller than the cap is preserved. Height-responsive sizing detects externally constrained containers and reduces key height, gaps, and modifier font-size automatically.

#### Label Sizing

Key labels use three scaling tiers:

| Tier                  | Applies to                                     | Scaling                                                                                                                                           |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glyph**             | Single-grapheme labels (`a`, `@`, `€`)         | No scaling, rendered at the key's font-size with `overflow: visible` so wide glyphs are not clipped.                                              |
| **Multi**             | Multi-character labels (`F10`, `Home`, `PgUp`) | Scales proportionally to the key's inline width via `clamp(0.5rem, 100cqi × 0.35, 1em)`.                                                          |
| **Modifier / Action** | Shift, Enter, Backspace, layout switches       | Defaults to the theme's base font-size (`--sapFontSize`). Scaled down in height-constrained containers via `--kiosk-keyboard-modifier-font-size`. |

Override `--kiosk-keyboard-docked-z-index` to adjust the docked keyboard's stacking layer.

When `docked` is combined with `mobile-keyboard="Auto"` (the default), coarse-pointer devices defer to the native on-screen keyboard. Calling `show()` in that mode intentionally keeps the custom docked keyboard closed; use `mobile-keyboard="Custom"` if you want to force the component to open on touch devices.

Shadow custom properties use `color-mix()` with `--sapContent_ShadowColor` for theme-aware shadows, with static `rgba()` fallbacks for browsers that do not support `color-mix()`. Consumers can override `--kiosk-keyboard-key-shadow` and related properties for full control.

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

# E2E tests, phone (360x800) / tablet (768x1024) device emulation
npm run test:e2e:phone
npm run test:e2e:tablet

# Run all device profiles in parallel
npm run test:e2e:all-devices

# Update visual baselines (desktop / phone / tablet)
npm run test:e2e:update
npm run test:e2e:phone:update
npm run test:e2e:tablet:update

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
