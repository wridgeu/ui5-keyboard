# ui5-keyboard

UI5 TypeScript libraries for keyboard interaction in SAPUI5/OpenUI5 applications.

## Packages

| Package                                               | Description                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`ui5-lib-hotkeys`](./packages/hotkeys)               | Declarative keyboard shortcut management — scopes, multi-key sequences, cross-platform modifiers, hotkey recording |
| [`ui5-lib-kiosk-keyboard`](./packages/kiosk-keyboard) | On-screen virtual keyboard control — SAP theming, multiple layouts, docked/auto-show mode, touch support           |
| [`demo-hotkeys-app`](./packages/demo-app)             | Demo application showcasing both libraries                                                                         |

## Getting Started

This monorepo currently keeps both libraries workspace-local (`private: true`).
For local development, install once at the repository root and use the package READMEs for API details:

```bash
npm install
```

If/when the packages are published, use the install commands below.
For full API details, see:

- **[ui5-lib-hotkeys README](./packages/hotkeys/README.md)**
- **[ui5-lib-kiosk-keyboard README](./packages/kiosk-keyboard/README.md)**

### Hotkeys

```bash
npm install ui5-lib-hotkeys
```

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = HotkeyManager.getInstance();
const hotkeys = manager.createGroup();

hotkeys.register("Mod+S", () => onSave(), { description: "Save" });
```

### Kiosk Keyboard

```bash
npm install ui5-lib-kiosk-keyboard
```

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="myInput" />
  <kiosk:KioskKeyboard targetInput="myInput" docked="true" autoShow="true" />
</mvc:View>
```

## Development

Monorepo using npm workspaces. Requires Node >= 22.

```bash
npm install                 # Install all workspaces
```

### Dev Servers

| Command                 | Description                          | Port |
| ----------------------- | ------------------------------------ | ---- |
| `npm start`             | Demo app                             | 8080 |
| `npm run start:hotkeys` | Hotkeys library + test runner        | 8081 |
| `npm run start:kiosk`   | Kiosk keyboard library + test runner | 8082 |

### Build & Test

```bash
npm run build               # Build both libraries
npm run build:hotkeys       # Build hotkeys only
npm run build:kiosk         # Build kiosk-keyboard only

npm test                    # Run all tests in parallel (headless)
npm run test:hotkeys        # Hotkeys QUnit tests
npm run test:kiosk          # Kiosk QUnit + e2e tests
```

### Code Quality

```bash
npm run check               # fmt:check + lint + typecheck (CI gate)
npm run fmt                 # Format (oxfmt)
npm run lint                # Lint (oxlint)
npm run typecheck           # TypeScript type checking (tsc -b)
```

## Project Structure

```
ui5-keyboard/
├── packages/
│   ├── hotkeys/               # ui5-lib-hotkeys (ui5.hotkeys namespace)
│   ├── kiosk-keyboard/        # ui5-lib-kiosk-keyboard (ui5.kiosk namespace)
│   └── demo-app/              # Demo application
└── docs/                      # Architecture & design documents
```

## Documentation

| Document                                                               | Description                            |
| ---------------------------------------------------------------------- | -------------------------------------- |
| [Hotkeys Architecture](./docs/ARCHITECTURE.md)                         | Internal design of the hotkeys library |
| [Kiosk Keyboard Architecture](./docs/KIOSK-ARCHITECTURE.md)            | Internal design of the kiosk keyboard  |
| [Multi-key Sequences](./docs/SEQUENCES.md)                             | Sequence system design and rationale   |
| [Alternatives Review](./docs/REVIEW.md)                                | Comparison with alternative approaches |
| [Known Issues](./docs/KNOWN-ISSUES.md)                                 | Known issues and workarounds           |
| [API Stability Policy](./docs/API-STABILITY.md)                        | Stable vs internal import boundaries   |
| [UI5 Event Handling Deep Dive](./docs/UI5-EVENT-HANDLING-DEEP-DIVE.md) | How UI5 processes keyboard events      |
| [UI5 TypeScript Event Typing](./docs/UI5-TYPESCRIPT-EVENT-TYPING.md)   | TypeScript patterns for UI5 events     |

## License

[MIT](./LICENSE)
