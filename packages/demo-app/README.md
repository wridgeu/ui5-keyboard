# demo-hotkeys-app

Demo application for all three workspace libraries:

- `ui5-lib-hotkeys` (`ui5.hotkeys`)
- `ui5-lib-kiosk-keyboard` (`ui5.kiosk`)
- `kiosk-keyboard-webc` (native web component, consumed via `ui5-tooling-modules`)

## Run

From repo root:

```bash
npm install
npm start
```

Application URL: `http://localhost:8080/index.html`

### Build dependencies

The demo app consumes three workspace libraries:

- `ui5-lib-hotkeys` and `ui5-lib-kiosk-keyboard` are transpiled from source at dev time by `ui5-tooling-transpile` (no pre-build needed).
- `kiosk-keyboard-webc` must be built before the demo can start because `ui5-tooling-modules` reads the Custom Elements Manifest (CEM) from its `dist/` folder to auto-generate the UI5 wrapper. `npm start` at the repo root handles this automatically via `npm run build:kiosk-webc`.

If you start the demo app directly (`npm run start -w packages/demo-app`), you must build the webc package first:

```bash
npm run build:kiosk-webc
npm run start -w packages/demo-app
```

## Purpose

This app is a scenario catalog for keyboard-heavy UX in UI5. It shows:

- cross-view and route-scoped hotkeys
- conflict strategies and target-element scoped shortcuts
- input-safe behavior (`ignoreInputs: "auto"`) and conditional hotkeys (`enabled()`)
- virtual keyboard patterns for docked, popover, dialog, multi-instance, and programmatic control
- integration with native UI5 web components and custom web components

## Hotkeys Scenarios

### Main View (`#/`)

- Global and route-scoped shortcuts (`Mod+S`, `Escape`, `F5`, `Mod+D`)
- Input suppression behavior (single-key suppression in text fields, combos still active)
- Dialog scope stacking and cleanup
- Sequences (`G I`, `G S`) via `HotkeyManager.register("g i", cb)` (space-separated format)
- Key hold tracking via `KeyStateTracker`
- Dynamic enabled guard (`Mod+P` tied to toggle state)
- Conflict strategies demo (`Ctrl+Shift+K` with Warn/Allow/Replace/Error)
- Target-element scoped hotkey (`Ctrl+Enter` bound to a specific panel)
- Combined hotkeys + kiosk keyboard on one page (`Ctrl+Shift+M` + `KioskKeyboard`)

### Detail View (`#/detail`)

- Same key, different scope behavior (`F5` in `detail` scope)
- Scoped back navigation shortcut (`Mod+B`)
- `HotkeyRecorder` flow for capture/cancel/clear recording

### Hotkeys Hub (`#/hotkeys`)

Landing page linking to the dedicated hotkeys demos.

### Sequences (`#/hotkeys/sequences`)

- Two-step command sequences with pending-state feedback
- Focused demo page for `HotkeyManager.register()` sequence behavior

### Target Bubbling (`#/hotkeys/target-bubbling`)

- Nested targets with innermost-wins matching
- `stopPropagation` behavior for scoped target handlers

### Conflict Behavior (`#/hotkeys/conflict`)

- Warn / Allow / Replace / Error strategies for duplicate registrations
- Side-by-side comparison of conflict resolution outcomes

## Integration Demo

### Combined Page (`#/integration`)

- Combined page showing `ui5.hotkeys` and `ui5.kiosk` together in one flow
- Demonstrates shortcut-driven focus plus virtual keyboard interaction on the same page

## Kiosk Keyboard Scenarios

### Kiosk Hub (`#/kiosk`)

Landing page linking to all kiosk demos.

### Docked Keyboard (`#/kiosk/docked`)

- Docked auto-show keyboard for multiple input types
- `autoType` switching (Full vs Numpad based on focused control)
- Layout and F-key mode switching
- Mobile keyboard behavior toggle (`Custom` / `Native` / `Auto`)
- Inline numpad as non-docked secondary keyboard

### Form Workflow (`#/kiosk/form-workflow`)

- Self-service check-in flow with progress tracking
- Enter-to-advance behavior across fields
- Keyboard type adaptation per field type

### Multi-Keyboard (`#/kiosk/multi-keyboard`)

- Two independent keyboard instances on one page
- Isolation through `controls` targeting
- Docked full keyboard + inline numpad working simultaneously
- Shared-target ref-count visualization for `inputmode` suppression (open A/B, close order)

### Popover Keyboard (`#/kiosk/popover`)

- On-demand popover keyboard per field
- Input-specific targeting using `CustomData`

### Dialog Integration (`#/kiosk/dialog`)

- Dialog without embedded keyboard (docked keyboard auto-closes/reopens with focus changes)
- Dialog with embedded keyboard

### Controls Targeting (`#/kiosk/input-ids`)

- Selective targeting using `controls`
- Mixed target controls (`Input`, `StepInput`)
- Native UI5 Web Component input (`@ui5/webcomponents/dist` XML namespace) targeted directly via `controls`
- Custom Web Component input targeted directly via `controls` (UI5 wrapper control with `setValue` bridge)
- Native custom element usage in XML via `sap.ui.core.webc.WebComponent` wrapper controls

### Programmatic Control (`#/kiosk/programmatic`)

- Imperative API: `show()`, `close()`, type switching, `resetKeyboardType()`
- Runtime layout registration and selection (all built-in layouts including Japanese Kana appear in the layout dropdown)
- Lifecycle/status events (`afterOpen`, `afterClose`, layout change)

### Custom Layouts Gallery (`#/kiosk/custom-layouts`)

- Four custom `LayoutDefinition` examples:
  - Emoji picker
  - IP address pad
  - Currency pad
  - Icon + Label (dual icon+label rendering, capsLock overrides)
- Demonstrates key width, action keys, icons, label overrides, and dual icon+label rendering

### Component-Level Keyboard (`#/kiosk/component`)

- Keyboard created in controller and placed in static UI area
- Reused across route round-trips while the demo controller remains alive

### Focus Scenarios (`#/kiosk/focus-scenarios`)

- Focus transitions, deferred close behavior, and composite-control targeting
- Live focus event log for troubleshooting docked `autoShow` flows

### i18n Extensibility (`#/kiosk/i18n-extensibility`)

- New language bundles and label overrides
- Programmatic override hooks for runtime text customization

### Script Input (`#/kiosk/script-input`)

- Multi-language script input demo with composition middleware
- Arabic, Japanese Kana, Korean Hangul layouts with live input

### Web Component (`#/kiosk/web-component-tooling`)

- `<kiosk-keyboard>` web component consumed directly via XML namespace (`xmlns:kiosk="kiosk-keyboard-webc"`)
- The `ui5-tooling-modules` middleware auto-generates the UI5 wrapper from the Custom Elements Manifest (CEM)
- No manual bridge, no explicit bundle import - the middleware handles everything

## Web Component Consumption

The `kiosk-keyboard-webc` package provides the `<kiosk-keyboard>` custom element built on the UI5 Web Components framework (`UI5Element`). It can be consumed in three ways.

### 1. UI5 Consumption (Tooling Native)

The recommended path for UI5 apps. The `ui5-tooling-modules` middleware reads the package's Custom Elements Manifest (`customElements` field in `package.json`) and auto-generates a `sap.ui.core.webc.WebComponent` wrapper at dev/build time. No application code needed beyond the XML namespace:

```xml
<mvc:View xmlns:kiosk="kiosk-keyboard-webc">
  <kiosk:KioskKeyboard docked="true" autoShow="true" />
</mvc:View>
```

The middleware applies **tag scoping** (e.g., `kiosk-keyboard` becomes `kiosk-keyboard-e24fedd4`) to prevent collisions when multiple web component packages or versions coexist. The scoped tag is transparent to the app developer - the middleware-generated wrapper handles it internally.

**Requirements:**

- `ui5-tooling-modules` middleware configured in `ui5.yaml`
- `kiosk-keyboard-webc` installed as a dependency (not devDependency)
- The webc package must be built (`dist/` must exist with tsc output + CEM)

### Alternative: Manual Bridge (Reference)

For apps that want explicit control over the wrapper metadata, or apps that cannot use `ui5-tooling-modules`, a hand-written `WebComponent.extend()` bridge maps web component attributes, events, and methods to UI5 control APIs. There is no demo page for this pattern; the documentation below is a complete reference.

**Minimal bridge example:**

```typescript
import WebComponent from "sap/ui/core/webc/WebComponent";

const KioskKeyboardBridge = WebComponent.extend("my.app.control.KioskKeyboard", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: { type: "string", defaultValue: "", mapping: { type: "property", to: "layout" } },
      docked: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "docked" } },
      autoShow: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "auto-show" } },
      autoType: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "auto-type" } },
    },
    events: {
      keyPress: { parameters: { key: { type: "string" }, shiftKey: { type: "boolean" } } },
      layoutChange: { parameters: { layout: { type: "string" } } },
      keyboardTypeChange: { parameters: { keyboardType: { type: "string" } } },
      afterOpen: {},
      afterClose: {},
    },
    methods: ["show", "close", "isOpen", "setTargetElement", "resetKeyboardType"],
  },
});

export default KioskKeyboardBridge;
```

**When to use this:** The manual bridge is useful when `ui5-tooling-modules` is not available, or when you need explicit control over the wrapper metadata (property types, event parameters, exposed methods).

**Scoping constraint:** The bridge specifies `tag: "kiosk-keyboard"` (the canonical, unscoped name). The `ui5-tooling-modules` middleware registers only the scoped tag (`kiosk-keyboard-<hash>`), which the bridge cannot discover. You must load the standalone bundle (`dist/kiosk-keyboard.bundle.js`) as a `<script type="module">` tag from a path outside the middleware's `/resources/` scope so that the unscoped tag is registered in the browser's `customElements` registry. An ES module import like `import "kiosk-keyboard-webc/bundle"` will not work when the middleware is active, because it intercepts all imports from packages with a `customElements` field.

**Coexistence:** The tooling-native scoped tag and the bridge's unscoped tag are separate entries in the `customElements` registry and coexist without conflict. Both share the same layout registry (singleton module state).

### 2. Native npm/Browser Consumption (no UI5)

For non-UI5 apps, the package provides:

- **standalone bundle** (`dist/kiosk-keyboard.bundle.js`): Self-contained, zero external dependencies. Load via `<script type="module">` and use `<kiosk-keyboard>` directly in HTML.
- **ESM modules** (`dist/*.js`): Flat tsc output with bare specifiers (`@ui5/webcomponents-base/*`). Requires a bundler or dev server (e.g., Vite) that resolves bare imports.

Smoke test pages in the webc package: `test/pages/consume-bundle.html` and `test/pages/consume-esm.html`.

### Key Technical Details

| Aspect                         | Tooling Native                   | Manual Bridge (reference, no demo page) | Native npm                         |
| ------------------------------ | -------------------------------- | --------------------------------------- | ---------------------------------- |
| Wrapper                        | Auto-generated from CEM          | Hand-written `WebComponent.extend()`    | None (raw custom element)          |
| Tag name                       | Scoped (`kiosk-keyboard-<hash>`) | Unscoped (`kiosk-keyboard`)             | Unscoped                           |
| Element registration           | Middleware Rollup pipeline       | standalone bundle `<script>` tag        | ESM import or standalone bundle    |
| Layouts included               | Yes (main entry imports all)     | Yes (standalone bundle includes all)    | CDN: all; ESM: via `bundle.esm.js` |
| UI5 data binding               | Yes                              | Yes                                     | N/A                                |
| Requires `ui5-tooling-modules` | Yes                              | No                                      | No                                 |
| Requires built `dist/`         | Yes                              | Yes (standalone bundle)                 | Yes                                |

## Layout Composition

The package ships primary layouts (qwerty, numpad, arabic, etc.) and building block rows (`fkey-row`, `nav-row`). Combined layouts like `qwerty-fk` (QWERTY + F-key row) are not built-in - they are trivial compositions that consumers can build at runtime:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import fkeyRow from "kiosk-keyboard-webc/layouts/fkey-row";

const qwerty = KioskKeyboard.getRegisteredLayout("qwerty");
KioskKeyboard.registerLayout("my-qwerty-fk", [fkeyRow, ...qwerty]);
```

The Custom Layouts demo page (`#/kiosk/custom-layouts`) shows examples of building composite layouts from rows and individual key definitions.

## CSS for Custom Layouts and Foreign Scripts

The component's CSS handles responsive behavior automatically via `@container` queries and `ResizeObserver`. Consumers typically do not need custom CSS, but the following details are useful when building custom or foreign-script layouts.

**F-key rows:** At container widths of 35rem or below, `flex-wrap` splits 12 F-keys into two rows of six. This targets elements with `[data-row-kind="fkey"]`, an attribute set by the template's `classifyRow()` function.

**Navigation rows:** Nav keys render with both an icon and a text label (dual rendering). At narrow key widths (below 7rem per key), the text label is visually hidden using the sr-only pattern so the label remains in the accessibility tree while only the icon is visible.

**Arabic and RTL:** The component detects the `dir` attribute on the host element. Arabic layout keys use an Arabic-first font stack via the `--kiosk-keyboard-arabic-font-family` custom property.

**Height-responsive classes:** The `.kiosk-keyboard--cq-short` and `.kiosk-keyboard--cq-tiny` classes are driven by a `ResizeObserver` on the host element, not by media queries. They activate when the host's layout box height drops below configurable thresholds (`--kiosk-keyboard-cq-short-threshold` at 16rem, `--kiosk-keyboard-cq-tiny-threshold` at 12rem). These reduce key height, gap, and padding automatically.

**CSS custom properties consumers can override:**

- `--kiosk-keyboard-key-font-size` - base key font size (container queries cap this at narrow widths)
- `--kiosk-keyboard-key-height` - key height
- `--kiosk-keyboard-key-gap` - gap between keys
- `--kiosk-keyboard-padding` - container padding
- `--kiosk-keyboard-max-width` - max width for inline keyboards
- `--kiosk-keyboard-docked-max-width` - max width for docked keyboards
- `--kiosk-keyboard-cjk-font-family` - font stack for CJK glyph keys
- `--kiosk-keyboard-hangul-font-family` - font stack for Korean Hangul keys
- `--kiosk-keyboard-arabic-font-family` - font stack for Arabic glyph keys

See the [webc package README](../kiosk-keyboard-webc/README.md#public-css-custom-properties) for the full property list.

**`::part()` selectors for external styling:**

- `keyboard` - root container
- `row` - each row of keys
- `key` - every key element
- `modifier` - modifier keys (Shift, layout switches, F-keys)
- `action` - action keys (Enter, Backspace)
- `fkey` - function/navigation keys specifically
- `key-label` - text label inside a key
- `key-icon` - icon inside a key

## Route Map

- `#/` main hotkeys scenarios
- `#/detail` detail hotkeys and recorder
- `#/integration` combined hotkeys + kiosk flow
- `#/hotkeys` hotkeys demo hub
- `#/hotkeys/sequences` sequence demo
- `#/hotkeys/target-bubbling` nested target bubbling demo
- `#/hotkeys/conflict` registration conflict demo
- `#/kiosk` kiosk demo hub
- `#/kiosk/docked` docked + inline numpad
- `#/kiosk/popover` popover keyboard
- `#/kiosk/input-ids` controls targeting + custom element bridge
- `#/kiosk/programmatic` imperative API and runtime layouts
- `#/kiosk/component` persistent component-level keyboard
- `#/kiosk/form-workflow` check-in workflow
- `#/kiosk/multi-keyboard` multi-instance isolation
- `#/kiosk/dialog` dialog integration approaches
- `#/kiosk/custom-layouts` custom layout gallery
- `#/kiosk/focus-scenarios` focus transition and deferred close demo
- `#/kiosk/i18n-extensibility` i18n extension demo
- `#/kiosk/script-input` script input and composition middleware demo
- `#/kiosk/web-component-tooling` web component demo (auto-generated wrapper via CEM, scoped tag)
