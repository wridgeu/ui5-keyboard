# kiosk-keyboard-webc

Native web component variant of the kiosk on-screen keyboard, built on the [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) framework (`@ui5/webcomponents-base`).

```html
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

## Features

- **Standards-based custom element** (`<kiosk-keyboard>`) usable in any framework — plain HTML, React, Vue, Angular
- **SAP theming** — Horizon light/dark, HCB, HCW via CSS variables (automatic theme switching)
- **UI5 app integration** — consumable inside UI5 apps via the existing `WebComponent.extend()` bridge pattern
- **Multiple layouts** — QWERTY, QWERTZ-DE, Numeric, Numpad, Special, F-keys, Navigation (and composites like `qwerty-fk`, `qwerty-nav`)
- **Locale-aware** — auto-selects layout based on browser locale (e.g. `de` → `qwertz-de`)
- **Shift / Caps Lock** — single-click for one-shot shift, double-click for caps lock
- **Docked mode** — fixed-position keyboard at bottom of viewport with slide animation
- **Auto-show** — opens/closes automatically when target inputs receive/lose focus
- **Auto-type detection** — switches to Numpad for `type="number"`, `inputmode="numeric"`, etc.
- **F-key and navigation key support** — configurable modes: `Event`, `Native`, `None`
- **Grapheme-aware** — correct backspace/navigation for emoji and multi-code-unit characters
- **Accessible** — ARIA roles, labels, live region announcements, roving tabindex, keyboard navigation, `prefers-reduced-motion`, `forced-colors`
- **i18n** — built-in English/German, extensible via custom resolver
- **Custom layouts** — register/unregister layouts at runtime

## Installation

```bash
npm install kiosk-keyboard-webc
```

## Usage

### Standalone (any framework)

```html
<script type="module">
  import "kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

### ESM import

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/dist/bundle.esm.js";
```

### Inside a UI5 app

Use the `WebComponent.extend()` bridge (see `packages/demo-app` for a working example):

```ts
import "kiosk-keyboard-webc/dist/bundle.esm.js";

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

## Attributes / Properties

| Attribute         | Property         | Type      | Default   | Description                                                                    |
| ----------------- | ---------------- | --------- | --------- | ------------------------------------------------------------------------------ |
| `layout`          | `layout`         | `string`  | `""`      | Layout name (e.g. `qwerty`, `qwertz-de`). Empty = auto-detect from locale.     |
| `keyboard-type`   | `keyboardType`   | `string`  | `"Full"`  | `"Full"`, `"Numpad"`, or `"Numeric"`.                                          |
| `docked`          | `docked`         | `boolean` | `false`   | Fixed-position mode at bottom of viewport.                                     |
| `auto-show`       | `autoShow`       | `boolean` | `false`   | Auto open/close when target inputs gain/lose focus (requires `docked`).        |
| `auto-type`       | `autoType`       | `boolean` | `false`   | Auto-detect keyboard type from focused input's type/inputmode.                 |
| `disabled`        | `disabled`       | `boolean` | `false`   | Disables all key interaction.                                                  |
| `for`             | `for`            | `string`  | `""`      | ID of the target input element.                                                |
| `input-ids`       | `inputIds`       | `string`  | `""`      | Comma-separated IDs to restrict auto-show to specific inputs.                  |
| `stable-height`   | `stableHeight`   | `boolean` | `false`   | Maintains the maximum observed height (prevents layout shifts).                |
| `mobile-keyboard` | `mobileKeyboard` | `string`  | `"Auto"`  | `"Auto"` (defer to native on touch), `"Custom"`, or `"Native"`.                |
| `f-key-mode`      | `fKeyMode`       | `string`  | `"Event"` | `"Event"` (fire event + move cursor), `"Native"` (dispatch keydown), `"None"`. |

## Events

| Event                  | Detail                               | Description                         |
| ---------------------- | ------------------------------------ | ----------------------------------- |
| `key-press`            | `{ key: string, shiftKey: boolean }` | Fired on key click. Cancelable.     |
| `after-open`           | —                                    | Fired after docked keyboard opens.  |
| `after-close`          | —                                    | Fired after docked keyboard closes. |
| `layout-change`        | `{ layout: string }`                 | Fired when layout switches.         |
| `keyboard-type-change` | `{ keyboardType: string }`           | Fired when keyboard type changes.   |

## Methods

| Method                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `show()`               | Opens the docked keyboard.                       |
| `close()`              | Closes the docked keyboard.                      |
| `isOpen()`             | Returns whether the docked keyboard is open.     |
| `setTargetElement(el)` | Programmatically sets the target input/textarea. |
| `resetKeyboardType()`  | Resets keyboard type to `"Full"`.                |

## Static API

| Method                                               | Description                                        |
| ---------------------------------------------------- | -------------------------------------------------- |
| `KioskKeyboard.registerLayout(name, definition)`     | Registers a custom layout.                         |
| `KioskKeyboard.unregisterLayout(name)`               | Removes a custom layout.                           |
| `KioskKeyboard.resetCustomLayouts()`                 | Removes all custom layouts.                        |
| `KioskKeyboard.getRegisteredLayout(name)`            | Returns a layout definition by name.               |
| `KioskKeyboard.getRegisteredLayoutNames()`           | Returns all registered layout names.               |
| `KioskKeyboard.isBuiltInLayout(name)`                | Checks if a layout is built-in.                    |
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
import { KioskKeyboard } from "kiosk-keyboard-webc/dist/bundle.esm.js";

KioskKeyboard.registerLayout("my-layout", [
  [{ value: "a" }, { value: "b" }, { value: "c" }, { value: "{backspace}", type: "action" }],
  [
    { value: " ", width: "space", type: "space" },
    { value: "{enter}", type: "action" },
  ],
]);
```

Each key is a `KeyDefinition`:

```ts
interface KeyDefinition {
  value: string; // Character to insert, or action like "{shift}", "{enter}", "{backspace}", "{layout:numeric}", "{fkey:F5}"
  label?: string; // Display label (defaults to value)
  shiftLabel?: string; // Label when shifted
  shiftValue?: string; // Value when shifted (defaults to value.toUpperCase() for single chars)
  width?: KeyWidth; // "1.25" | "1.5" | "1.75" | "2" | "2.25" | "2.75" | "space"
  type?: KeyType; // "default" | "modifier" | "action" | "space"
  icon?: string; // Custom text icon (rendered as label, not <ui5-icon>)
}
```

## CSS Custom Properties

Override these on the `:host` or a parent element to customize appearance:

| Property                            | Default    | Description                 |
| ----------------------------------- | ---------- | --------------------------- |
| `--kiosk-keyboard-padding`          | `0.75rem`  | Container padding           |
| `--kiosk-keyboard-key-gap`          | `0.375rem` | Gap between keys            |
| `--kiosk-keyboard-key-height`       | `3rem`     | Key height                  |
| `--kiosk-keyboard-key-font-size`    | `1.125rem` | Key font size               |
| `--kiosk-keyboard-docked-max-width` | `1024px`   | Max width in docked mode    |
| `--kiosk-keyboard-docked-z-index`   | `100`      | Z-index in docked mode      |
| `--kiosk-keyboard-numpad-max-width` | `20rem`    | Max width for numpad layout |

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

# E2E tests (WebdriverIO)
npm run test:e2e

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
└── pages/                     # Standalone test page
```

## License

MIT
