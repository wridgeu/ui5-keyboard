# demo-hotkeys-app

Demo application for both workspace libraries:

- `ui5-lib-hotkeys` (`ui5.hotkeys`)
- `ui5-lib-kiosk-keyboard` (`ui5.kiosk`)

## Run

From repo root:

```bash
npm install
npm start
```

Application URL: `http://localhost:8080/index.html`

## Purpose

This app is a scenario catalog for keyboard-heavy UX in UI5. It shows:

- cross-view and route-scoped hotkeys
- conflict strategies and target-element scoped shortcuts
- input-safe behavior (`ignoreInputs: "auto"`) and conditional hotkeys (`enabled()`)
- virtual keyboard patterns for docked, popover, dialog, multi-instance, and programmatic control
- integration with custom web components (native XML namespace and bridge input approach)

## Hotkeys Scenarios

### Main View (`#/`)

- Global and route-scoped shortcuts (`Mod+S`, `Escape`, `F5`, `Mod+D`)
- Input suppression behavior (single-key suppression in text fields, combos still active)
- Dialog scope stacking and cleanup
- Sequences (`G I`, `G S`) via `SequenceManager`
- Key hold tracking via `KeyStateTracker`
- Dynamic enabled guard (`Mod+P` tied to toggle state)
- Conflict strategies demo (`Ctrl+Shift+K` with Warn/Allow/Replace/Error)
- Target-element scoped hotkey (`Ctrl+Enter` bound to a specific panel)
- Combined hotkeys + kiosk keyboard on one page (`Ctrl+Shift+M` + `KioskKeyboard`)

### Detail View (`#/detail`)

- Same key, different scope behavior (`F5` in `detail` scope)
- Scoped back navigation shortcut (`Mod+B`)
- `HotkeyRecorder` flow for capture/cancel/clear recording

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

### Popover Keyboard (`#/kiosk/popover`)

- On-demand popover keyboard per field
- Input-specific targeting using `CustomData`

### Dialog Integration (`#/kiosk/dialog`)

- Dialog without embedded keyboard (docked keyboard auto-closes/reopens with focus changes)
- Dialog with embedded keyboard (`stableHeight` pattern)

### Input IDs Targeting (`#/kiosk/input-ids`)

- Selective targeting using `inputIds`
- Mixed target controls (`Input`, `StepInput`)
- Bridge integration for custom element typing via hidden UI5 input
- Native custom element usage in XML (`demo.hotkeys.webc` namespace)

### Programmatic Control (`#/kiosk/programmatic`)

- Imperative API: `show()`, `close()`, type switching, `resetKeyboardType()`
- Runtime layout registration and selection
- Lifecycle/status events (`afterOpen`, `afterClose`, layout change)

### Custom Layouts Gallery (`#/kiosk/custom-layouts`)

- Three custom `LayoutDefinition` examples:
  - Emoji picker
  - IP address pad
  - Currency pad
- Demonstrates key width, action keys, icons, and label overrides

### Component-Level Keyboard (`#/kiosk/component`)

- Keyboard created in controller and placed in static UI area
- Persists across navigation (round-trip navigation demo)

## Standalone Web Components

- `standalone-webc/index.html` demonstrates UI5 Web Components usage outside the UI5 runtime.

## Route Map

- `#/` main hotkeys scenarios
- `#/detail` detail hotkeys and recorder
- `#/kiosk` kiosk demo hub
- `#/kiosk/docked` docked + inline numpad
- `#/kiosk/form-workflow` check-in workflow
- `#/kiosk/multi-keyboard` multi-instance isolation
- `#/kiosk/popover` popover keyboard
- `#/kiosk/dialog` dialog integration approaches
- `#/kiosk/input-ids` selective targeting + custom element bridge
- `#/kiosk/programmatic` imperative API and runtime layouts
- `#/kiosk/custom-layouts` custom layout gallery
- `#/kiosk/component` persistent component-level keyboard
- `standalone-webc/index.html` standalone web components page
