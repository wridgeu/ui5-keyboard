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

## Using Both Libraries Together

The two libraries are independent — neither depends on the other — but they complement each other well. A typical kiosk application uses hotkeys for global shortcuts and the virtual keyboard for text input:

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="searchField" placeholder="Search..." />
  <kiosk:KioskKeyboard docked="true" autoShow="true" targetInput="searchField" />
</mvc:View>
```

```ts
// Controller — register hotkeys alongside the virtual keyboard
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

onInit(): void {
  const manager = HotkeyManager.getInstance();
  manager.register("Mod+K", () => this.byId("searchField")?.focus(), {
    description: "Focus search",
  });
}
```

Both libraries use standard UI5 lifecycle management (`destroy()`) and coexist on the same page without conflicts. The KioskKeyboard fires `keyPress` events (not native `keydown`), so virtual key taps do not trigger hotkeys registered via HotkeyManager.

## Development

Monorepo using npm workspaces. Requires Node >= 22.

```bash
npm install                 # Install all workspaces
```

### Dev Servers

| Command                      | Description                          | Port |
| ---------------------------- | ------------------------------------ | ---- |
| `npm start`                  | Demo app                             | 8080 |
| `npm run start:demo`         | Demo app (explicit alias)            | 8080 |
| `npm run start:hotkeys`      | Hotkeys library + test runner        | 8081 |
| `npm run start:kiosk`        | Kiosk keyboard library + test runner | 8082 |
| `npm run start:kiosk:visual` | Kiosk visual test page               | 8082 |

### Build & Test

```bash
npm run build               # Build both libraries
npm run build:hotkeys       # Build hotkeys only
npm run build:kiosk         # Build kiosk-keyboard only

npm test                    # Run all tests (headless)
npm run test:hotkeys        # Hotkeys QUnit tests
npm run test:kiosk          # Kiosk QUnit + e2e tests
npm run test:kiosk:e2e      # Kiosk e2e tests only
npm run test:kiosk:e2e:update # Update kiosk visual baselines
```

### Code Quality

```bash
npm run check               # fmt:check + lint + typecheck (CI gate)
npm run fmt                 # Format (oxfmt)
npm run lint                # Lint (oxlint)
npm run typecheck           # Generate kiosk typings + tsc -b + demo-app typecheck
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

| Document                                                                             | Description                            |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| [Hotkeys Architecture](./docs/ARCHITECTURE.md)                                       | Internal design of the hotkeys library |
| [Kiosk Keyboard Architecture](./docs/KIOSK-ARCHITECTURE.md)                          | Internal design of the kiosk keyboard  |
| [Multi-key Sequences](./docs/SEQUENCES.md)                                           | Sequence system design and rationale   |
| [Alternatives Research](./docs/RESEARCH.md)                                          | Comparison with alternative approaches |
| [Known Limitations](./docs/KNOWN-LIMITATIONS.md)                                     | Known limitations and workarounds      |
| [API Stability Policy](./docs/API-STABILITY.md)                                      | Stable vs internal import boundaries   |
| [UI5 Event Handling Deep Dive](./docs/UI5-EVENT-HANDLING-DEEP-DIVE.md)               | How UI5 processes keyboard events      |
| [UI5 TypeScript Event Typing](./docs/UI5-TYPESCRIPT-EVENT-TYPING.md)                 | TypeScript patterns for UI5 events     |
| [Hotkeys Backward Compatibility](./docs/features/FEATURE-BACKWARD-COMPAT-HOTKEYS.md) | Hotkeys compatibility guarantees       |
| [Kiosk Backward Compatibility](./docs/features/FEATURE-BACKWARD-COMPAT-KIOSK.md)     | Kiosk compatibility guarantees         |
| [Tab and Done Keys](./docs/features/FEATURE-TAB-AND-DONE-KEYS.md)                    | Tab and Done key behavior details      |
| [Implemented Feature Notes](./docs/implemented-features/)                            | Historical implementation notes        |

## License

[MIT](./LICENSE)
