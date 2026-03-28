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

### Web Component (Native) (`#/kiosk/web-component`)

- Native `<kiosk-keyboard>` web component consumed via `WebComponent.extend()` bridge
- Demonstrates the web component variant inside the UI5 demo shell

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
- `#/kiosk/web-component` native web component bridge demo
