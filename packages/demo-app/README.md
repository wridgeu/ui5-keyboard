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

The app runs on `http://localhost:8080`.

## What It Demonstrates

- Hotkey registration, scopes, router integration, and sequence handling
- Kiosk keyboard modes: docked, popover, programmatic, component integration
- `inputIds` targeting, including composite controls (`sap.m.StepInput`)
- UI5 Web Components wrapper interop (for example `sap.ui.webc.main.Input`)

## Routes

- `#/` main hotkeys page
- `#/detail` scoped detail page
- `#/kiosk` kiosk demo hub
- `#/kiosk/docked` docked mode
- `#/kiosk/popover` popover embedding
- `#/kiosk/input-ids` multi-input targeting and interop
- `#/kiosk/programmatic` imperative API usage
- `#/kiosk/component` component-style embedding
