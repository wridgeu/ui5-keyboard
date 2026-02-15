# ui5-keyboard

A monorepo of UI5 TypeScript libraries for keyboard interaction in SAPUI5/OpenUI5 applications.

| Library                                                     | npm                      | Description                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ui5-lib-hotkeys](packages/hotkeys/README.md)               | `ui5-lib-hotkeys`        | Declarative keyboard shortcut management with scope-based activation, cross-platform modifier normalization, multi-key sequences, and hotkey recording |
| [ui5-lib-kiosk-keyboard](packages/kiosk-keyboard/README.md) | `ui5-lib-kiosk-keyboard` | On-screen virtual keyboard control with SAP theme integration, touch support, and multiple layouts                                                     |

## Quick Start

```bash
npm install ui5-lib-hotkeys
```

Add the library dependency to your application's `manifest.json`:

```json
{
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "ui5.hotkeys": {}
      }
    }
  }
}
```

Register shortcuts in your component or controllers:

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

// Component.init()
const manager = HotkeyManager.getInstance();
manager.enableRouterIntegration(this.getRouter());

// Global shortcut — Mod resolves to Cmd on Mac, Ctrl on Windows/Linux
manager.register("Mod+S", () => this.onSave(), { description: "Save" });

// View-scoped shortcut — only active when this route is active
manager.register("F5", () => this.onRefresh(), {
  scope: "detail",
  description: "Refresh detail",
});

// Component.destroy()
manager.destroy();
```

## Development

This is a monorepo using npm workspaces.

```bash
# Install dependencies
npm install

# Run all checks (format, lint, typecheck)
npm run check

# Start the demo app
npm start

# Start the hotkeys library test runner
npm run start:hotkeys
# Opens at http://localhost:8081/test-resources/ui5/hotkeys/qunit/testsuite.qunit.html

# Start the kiosk keyboard library test runner
npm run start:kiosk
# Opens at http://localhost:8082/test-resources/ui5/kiosk/qunit/testsuite.qunit.html

# Build all libraries
npm run build

# Build individual libraries
npm run build:hotkeys
npm run build:kiosk

# Individual checks
npm run fmt:check    # Check formatting (oxfmt)
npm run lint         # Lint (oxlint)
npm run typecheck    # TypeScript type checking
```

### Test Suites

**ui5-lib-hotkeys** (`npm run start:hotkeys`)

| Suite                | Tests                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `constants`          | Key aliases, modifier maps, normalizeKeyName                                                                                 |
| `platform`           | Platform detection, Mod resolution                                                                                           |
| `parse`              | Hotkey parsing, normalization, keyboardEventToHotkey, convertToModFormat                                                     |
| `match`              | KeyboardEvent matching with modifiers and edge cases                                                                         |
| `dom`                | Input element detection, Shadow DOM                                                                                          |
| `format`             | Platform-aware display formatting                                                                                            |
| `HotkeyManager`      | Core registration, scopes, conflicts, input/dialog suppression, unhandled callback, setOptions, AltGr guard, target elements |
| `validate`           | Validation, blocklists, assertValidHotkey, checkHotkey                                                                       |
| `router-integration` | Router scope management, cleanup, edge cases                                                                                 |
| `dialog-scope`       | Dialog/fragment scope lifecycle, nesting, fallthrough                                                                        |
| `debug-mode`         | Debug mode toggle, non-interference with dispatch                                                                            |
| `SequenceManager`    | Multi-key sequences, timeout, scope, overlapping sequences, input suppression                                                |
| `KeyStateTracker`    | Held-key tracking, change callback, blur clear, macOS fix                                                                    |
| `HotkeyRecorder`     | Recording, auto-stop, Escape cancel, Backspace clear                                                                         |

**ui5-lib-kiosk-keyboard** (`npm run start:kiosk`)

| Suite           | Tests                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `KioskKeyboard` | Properties, rendering, layout resolution, shift/caps toggle, key events, target input, layout switching, docked, auto-show, accessibility |

## Project Structure

```
ui5-keyboard/
├── packages/
│   ├── hotkeys/                       # ui5.hotkeys library (keyboard shortcuts)
│   │   ├── src/                       # 13 TypeScript modules
│   │   └── test/qunit/               # 14 QUnit test suites
│   ├── kiosk-keyboard/                # ui5.kiosk library (on-screen keyboard)
│   │   ├── src/
│   │   │   ├── layouts/               # QWERTY, numeric, special, numpad
│   │   │   └── themes/                # SAP LESS theming (base + sap_horizon)
│   │   └── test/qunit/
│   └── demo-app/                      # Demo application for both libraries
│       └── webapp/
│           ├── controller/            # Main, Detail, Kiosk controllers
│           └── view/                  # App, Main, Detail, Kiosk views
├── docs/
│   ├── ARCHITECTURE.md                # Hotkeys library internals
│   ├── KIOSK-ARCHITECTURE.md          # Kiosk keyboard internals
│   ├── SEQUENCES.md                   # Multi-key sequence design
│   └── REVIEW.md                      # Comparison with alternatives
└── README.md
```

## License

MIT
