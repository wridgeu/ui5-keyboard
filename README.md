# ui5-lib-hotkeys

Declarative keyboard shortcut management for SAPUI5/OpenUI5 applications.

A UI5 TypeScript library (`ui5.hotkeys`) providing document-level keyboard shortcuts with scope-based activation, cross-platform modifier normalization, multi-key sequences, hotkey recording, and proper UI5 lifecycle integration.

For the full API reference and detailed documentation, see the [library README](packages/lib/README.md).

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

# Start the library test runner
npm run start -w packages/lib
# Opens at http://localhost:8081/test-resources/ui5/hotkeys/qunit/testsuite.qunit.html

# Build the library
npm run build

# Individual checks
npm run fmt:check    # Check formatting (oxfmt)
npm run lint         # Lint (oxlint)
npm run typecheck    # TypeScript type checking
```

### Test Suites

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

## Project Structure

```
ui5-lib-hotkeys/
├── packages/
│   ├── lib/                           # ui5.hotkeys library
│   │   ├── src/
│   │   │   ├── library.ts            # Lib.init(), enum registration, GLOBAL_SCOPE
│   │   │   ├── HotkeyManager.ts      # Singleton manager (core)
│   │   │   ├── SequenceManager.ts     # Multi-key sequence matching
│   │   │   ├── KeyStateTracker.ts     # Held-key state tracking
│   │   │   ├── HotkeyRecorder.ts      # Keyboard shortcut recorder
│   │   │   ├── validate.ts           # Validation + browser/SAP blocklists
│   │   │   ├── types.ts              # TypeScript interfaces, types, Hotkey union
│   │   │   ├── constants.ts          # Key aliases, modifier maps, display symbols
│   │   │   ├── platform.ts           # Platform detection, Mod resolution
│   │   │   ├── parse.ts              # Hotkey string parsing + conversion
│   │   │   ├── match.ts              # KeyboardEvent matching
│   │   │   ├── dom.ts                # Input element detection
│   │   │   └── format.ts             # Platform-aware display formatting
│   │   └── test/qunit/               # 14 QUnit test suites
│   └── demo-app/                      # Demo application with routing and dialogs
├── docs/
│   ├── ARCHITECTURE.md
│   └── SEQUENCES.md
└── README.md
```

## License

MIT
