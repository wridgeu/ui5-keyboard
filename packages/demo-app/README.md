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
- Programmatic kiosk view includes all registered layouts (including F-key and nav variants)
- `inputIds` targeting, including composite controls (`sap.m.StepInput`)
- Mixed input targeting across `sap.m.Input`, `sap.m.StepInput`, and `sap.m.TextArea`
- Native custom-element consumption in UI5 XML (`demo.hotkeys.webc` namespace)
- Bridge-based custom-element integration for focus/target synchronization
- Standalone UI5 Web Components page: `standalone-webc/index.html`

## Routes

- `#/` main hotkeys page
- `#/detail` scoped detail page
- `#/kiosk` kiosk demo hub
- `#/kiosk/docked` docked mode
- `#/kiosk/popover` popover embedding
- `#/kiosk/input-ids` multi-input targeting and interop
- `#/kiosk/programmatic` imperative API usage
- `#/kiosk/component` component-style embedding
- `standalone-webc/index.html` standalone UI5 Web Components demo (outside UI5 runtime)
