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

Welcome page with navigation list to every demo scenario. The two truly global shortcuts (`Mod+S`, `Escape`) are registered on the owner Component and are active on every page; everything else lives on dedicated routes below.

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
- `accentVariants` press-and-hold / right-click accent popup on any letter key (hold a for à á â ä, s for ß, Shift+s for ẞ)

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

Five layouts declared as `<kiosk:CustomLayout>` children in the view, with no controller
code configuring them:

- Emoji picker
- IP address pad
- Currency pad
- Icon + Label (dual icon+label rendering, capsLock overrides)
- Arabic digits, shipped as its own element (`<demo:ArabicDigitsCustomLayout>`) carrying
  its rows and `keycapLang` together

Demonstrates key width, action keys, icons, label overrides, and dual icon+label
rendering. Rows arrive through a `layouts>` JSON model, which is why the opening
selection waits for the first render: a control is built before it joins its view, so a
bound `rows` has not resolved during `onInit`.

The **Variant Tiers** section on the same page shows how long-press accents resolve.
The keyboard sets `accentVariants` and a `defaultVariants` house set; one custom layout
overlays the built-in `qwerty` with its own `variants`, and another declares
`suppress="Variants"` on `qwertz-de`:

- QWERTY arms `a`/`s` from the layout's own table, `q`/`w` from the house set, and the
  rest from the built-in Latin table - the three tiers composing per base letter
- QWERTZ arms nothing at all, because a suppressed facet discards every tier below it

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
- A second Hangul keyboard with `suppress="Middleware"` on a rows-less
  `<kiosk:CustomLayout>`: the same built-in layout with its composer turned off, so jamo
  are typed straight into the field instead of composing into syllables. Type the same
  keys into both fields to compare.

### Web Component (`#/kiosk/web-component-tooling`)

- `<kiosk-keyboard>` web component consumed directly via XML namespace (`xmlns:kiosk="kiosk-keyboard-webc"`)
- The `ui5-tooling-modules` middleware auto-generates the UI5 wrapper from the Custom Elements Manifest (CEM)
- No manual bridge, no explicit bundle import - the middleware handles everything

## Web component consumption

The `#/kiosk/web-component-tooling` scenario shows the `<kiosk-keyboard>` custom element consumed in a UI5 app via `ui5-tooling-modules`, which auto-generates the `sap.ui.core.webc.WebComponent` wrapper from the package's Custom Elements Manifest. This demo turns tag scoping off (`pluginOptions.webcomponents.scoping: false` in `ui5.yaml`) so the element registers under the canonical unscoped `<kiosk-keyboard>` tag; the scoping, hashed-tag, and `customElements`-registry tradeoffs are covered in [docs/kiosk-webc/CONSUMPTION.md](../../docs/kiosk-webc/CONSUMPTION.md).

The `kiosk-keyboard-webc` README is the canonical reference for consuming the web component outside this demo:

- [`WebComponent.extend()` bridge](../kiosk-keyboard-webc/README.md#3b-webcomponentextend-bridge-reference) for the hand-written wrapper
- [Public CSS custom properties](../kiosk-keyboard-webc/README.md#public-css-custom-properties) and [CSS parts](../kiosk-keyboard-webc/README.md#css-parts) for the full property and `::part()` lists
- [Layout composition](../kiosk-keyboard-webc/README.md#layout-composition) for building composite layouts from building-block rows
