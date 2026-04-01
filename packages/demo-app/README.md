# demo-hotkeys-app

Demo application for all three workspace libraries:

- `ui5-lib-hotkeys` (`ui5.hotkeys`)
- `ui5-lib-kiosk-keyboard` (`ui5.kiosk`)
- `kiosk-keyboard-webc` (native web component, consumed via `WebComponent.extend()` bridge)

## Run

From repo root:

```bash
npm install
npm run build        # required: builds library dist/ artifacts used by the demo
npm start
```

Application URL: `http://localhost:8080/index.html`

## Purpose

This app is a scenario catalog for keyboard-heavy UX in UI5. It shows:

- cross-view and route-scoped hotkeys
- conflict strategies and target-element scoped shortcuts
- input-safe behavior (`ignoreInputs: "auto"`) and conditional hotkeys (`enabled()`)
- virtual keyboard patterns for docked, popover, dialog, multi-instance, and programmatic control
- integration with native UI5 web components and custom web components (bridge input approach)

## Hotkeys Scenarios

### Main View (`#/`)

- Global and route-scoped shortcuts (`Mod+S`, `Escape`, `F5`, `Mod+D`)
- Input suppression behavior (single-key suppression in text fields, combos still active)
- Dialog scope stacking and cleanup
- Sequences (`G I`, `G S`) via `HotkeyManager.registerSequence()`
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
- Focused demo page for `HotkeyManager.registerSequence()` behavior

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
- Isolation through `inputIds` targeting
- Docked full keyboard + inline numpad working simultaneously
- Shared-target ref-count visualization for `inputmode` suppression (open A/B, close order)

### Popover Keyboard (`#/kiosk/popover`)

- On-demand popover keyboard per field
- Input-specific targeting using `CustomData`

### Dialog Integration (`#/kiosk/dialog`)

- Dialog without embedded keyboard (docked keyboard auto-closes/reopens with focus changes)
- Dialog with embedded keyboard

### Input IDs Targeting (`#/kiosk/input-ids`)

- Selective targeting using `inputIds`
- Mixed target controls (`Input`, `StepInput`)
- Native UI5 Web Component input (`@ui5/webcomponents/dist` XML namespace) targeted directly via `inputIds`
- Custom Web Component input targeted directly via `inputIds` (UI5 wrapper control with `setValue` bridge)
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

### Web Component -- Manual Bridge (`#/kiosk/web-component`)

- Native `<kiosk-keyboard>` web component consumed via a hand-written `WebComponent.extend()` bridge control
- Demonstrates the manual integration pattern for apps that want full control over the wrapper metadata

### Web Component -- Tooling Native (`#/kiosk/web-component-tooling`)

- Same `<kiosk-keyboard>` web component consumed directly via XML namespace (`xmlns:kiosk="kiosk-keyboard-webc"`)
- The `ui5-tooling-modules` middleware auto-generates the UI5 wrapper from the Custom Elements Manifest (CEM)
- No manual bridge, no explicit bundle import -- the middleware handles everything

## Web Component Consumption

The `kiosk-keyboard-webc` package provides the `<kiosk-keyboard>` custom element built on the UI5 Web Components framework (`UI5Element`). It can be consumed in three ways.

### 1. Tooling Native (recommended for UI5 apps)

The `ui5-tooling-modules` middleware reads the package's Custom Elements Manifest (`customElements` field in `package.json`) and auto-generates a `sap.ui.core.webc.WebComponent` wrapper at dev/build time. No application code needed beyond the XML namespace:

```xml
<mvc:View xmlns:kiosk="kiosk-keyboard-webc">
  <kiosk:KioskKeyboard docked="true" autoShow="true" />
</mvc:View>
```

The middleware applies **tag scoping** (e.g., `kiosk-keyboard` becomes `kiosk-keyboard-e24fedd4`) to prevent collisions when multiple web component packages or versions coexist. The scoped tag is transparent to the app developer -- the middleware-generated wrapper handles it internally.

**Requirements:**

- `ui5-tooling-modules` middleware configured in `ui5.yaml`
- `kiosk-keyboard-webc` installed as a dependency (not devDependency)
- The webc package must be built (`dist/` must exist with tsc output + CEM)

### 2. Manual Bridge (`WebComponent.extend()`)

For apps that want explicit control over the wrapper metadata, or apps that cannot use `ui5-tooling-modules`, a hand-written bridge control maps web component attributes, events, and methods to UI5 control APIs:

```typescript
import WebComponent from "sap/ui/core/webc/WebComponent";

const MyBridge = WebComponent.extend("my.app.control.KioskKeyboard", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: { layout: { type: "string", mapping: { type: "property", to: "layout" } } },
    events: { keyPress: { parameters: { key: { type: "string" } } } },
    methods: ["show", "close"],
  },
});
```

The bridge requires the `<kiosk-keyboard>` custom element to be **registered in the browser's custom elements registry** before the bridge creates elements. In the demo app this is done by loading the self-contained standalone bundle (`kiosk-keyboard.bundle.js`) via a `<script type="module">` tag.

**Why not `import "kiosk-keyboard-webc/bundle"`?** When `ui5-tooling-modules` is active, it intercepts all imports from packages that have a `customElements` field in `package.json`. The middleware converts the import to an AMD module, applies tag scoping, and generates its own wrapper -- which conflicts with the manual bridge's unscoped `tag: "kiosk-keyboard"`. Loading the standalone bundle outside the middleware's `/resources/` path bypasses this entirely.

**Scoping interaction:** The tooling-native path registers the scoped tag (`kiosk-keyboard-<hash>`). The manual bridge path registers the unscoped tag (`kiosk-keyboard`). These are separate entries in the browser's `customElements` registry and coexist without conflict. Both share the same layout registry (singleton module state).

### 3. Native npm/Browser Consumption (no UI5)

For non-UI5 apps, the package provides:

- **standalone bundle** (`dist/kiosk-keyboard.bundle.js`): Self-contained, zero external dependencies. Load via `<script type="module">` and use `<kiosk-keyboard>` directly in HTML.
- **ESM modules** (`dist/*.js`): Flat tsc output with bare specifiers (`@ui5/webcomponents-base/*`). Requires a bundler or dev server (e.g., Vite) that resolves bare imports.

Smoke test pages in the webc package: `test/pages/consume-bundle.html` and `test/pages/consume-esm.html`.

### Key Technical Details

| Aspect                         | Tooling Native                   | Manual Bridge                        | Native npm                         |
| ------------------------------ | -------------------------------- | ------------------------------------ | ---------------------------------- |
| Wrapper                        | Auto-generated from CEM          | Hand-written `WebComponent.extend()` | None (raw custom element)          |
| Tag name                       | Scoped (`kiosk-keyboard-<hash>`) | Unscoped (`kiosk-keyboard`)          | Unscoped                           |
| Element registration           | Middleware Rollup pipeline       | standalone bundle `<script>` tag     | ESM import or standalone bundle    |
| Layouts included               | Yes (main entry imports all)     | Yes (standalone bundle includes all) | CDN: all; ESM: via `bundle.esm.js` |
| UI5 data binding               | Yes                              | Yes                                  | N/A                                |
| Requires `ui5-tooling-modules` | Yes                              | No                                   | No                                 |
| Requires built `dist/`         | Yes                              | Yes (standalone bundle)              | Yes                                |

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
- `#/kiosk/input-ids` selective targeting + custom element bridge
- `#/kiosk/programmatic` imperative API and runtime layouts
- `#/kiosk/component` persistent component-level keyboard
- `#/kiosk/form-workflow` check-in workflow
- `#/kiosk/multi-keyboard` multi-instance isolation
- `#/kiosk/dialog` dialog integration approaches
- `#/kiosk/custom-layouts` custom layout gallery
- `#/kiosk/focus-scenarios` focus transition and deferred close demo
- `#/kiosk/i18n-extensibility` i18n extension demo
- `#/kiosk/script-input` script input and composition middleware demo
- `#/kiosk/web-component` bridge demo (manual WebComponent.extend, unscoped tag)
- `#/kiosk/web-component-tooling` tooling demo (auto-generated wrapper, scoped tag)
