# ui5-keyboard

UI5 TypeScript libraries for keyboard interaction in SAPUI5/OpenUI5 applications.

## Packages

| Package                                                 | Description                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`ui5-lib-hotkeys`](./packages/hotkeys)                 | Declarative keyboard shortcut management — scopes, multi-key sequences, cross-platform modifiers, hotkey recording |
| [`ui5-lib-kiosk-keyboard`](./packages/kiosk-keyboard)   | On-screen virtual keyboard UI5 control — SAP theming, multiple layouts, docked/auto-show mode, touch support       |
| [`kiosk-keyboard-webc`](./packages/kiosk-keyboard-webc) | Native web component variant of the kiosk keyboard — framework-agnostic, built on UI5 Web Components               |
| [`demo-hotkeys-app`](./packages/demo-app)               | Demo application showcasing all libraries                                                                          |

## Kiosk Keyboard Theme Preview

Full-size inline keyboard:

| `sap_horizon`                                                                                       | `sap_horizon_dark`                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon](./docs/kiosk/images/kiosk-inline-wide-sap_horizon.png) | ![Inline wide kiosk keyboard in sap_horizon_dark](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                                           | `sap_horizon_hcw`                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon_hcb](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcb.png) | ![Inline wide kiosk keyboard in sap_horizon_hcw](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcw.png) |

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
- **[kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md)**

### Consumption Modes (Both Libraries)

Both `ui5-lib-hotkeys` and `ui5-lib-kiosk-keyboard` are packaged in a dual-mode way:

- **UI5-native development mode (source-based):** keep `src` in the npm package so UI5 tooling can resolve library sources via `ui5.yaml` and transpile dependencies during local development.
- **Runtime/published mode (dist-based):** ship prebuilt `dist/resources/...` artifacts and typings for stable runtime consumption.

For app projects that consume these libraries in development with transpilation of dependencies, enable UI5 transpile middleware with dependency transpilation:

```yaml
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
```

Notes:

- `main`/`types` in the library `package.json` point to `dist` for predictable runtime/type resolution.
- Sourcemaps are included in `dist` with embedded source content, so debugging remains usable even when consuming built resources.

#### UI5 Dist-Based Consumption (No Dependency Transpile)

If you want a pure runtime setup in a UI5 app (no source transpilation of dependencies), mount the prebuilt library resources from `dist/resources` via static middleware.

Install middleware in the consuming app:

```bash
npm install -D ui5-middleware-servestatic
```

```yaml
server:
  customMiddleware:
    - name: ui5-middleware-servestatic
      afterMiddleware: compression
      mountPath: /resources/ui5/hotkeys/
      configuration:
        npmPackagePath: ui5-lib-hotkeys/dist/resources/ui5/hotkeys
    - name: ui5-middleware-servestatic
      afterMiddleware: compression
      mountPath: /resources/ui5/kiosk/
      configuration:
        npmPackagePath: ui5-lib-kiosk-keyboard/dist/resources/ui5/kiosk
```

Use this mode when you want UI5 to load only built artifacts from dependencies while keeping your app build pipeline minimal and predictable.

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

### Kiosk Keyboard (UI5 Control)

```bash
npm install ui5-lib-kiosk-keyboard
```

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="myInput" />
  <kiosk:KioskKeyboard targetInput="myInput" docked="true" autoShow="true" />
</mvc:View>
```

### Kiosk Keyboard (Web Component)

The web component variant (`kiosk-keyboard-webc`) provides the same virtual keyboard as a native custom element, usable in any framework — plain HTML, React, Vue, Angular — and inside UI5 apps via the `WebComponent.extend()` bridge.

```bash
npm install kiosk-keyboard-webc
```

```html
<script type="module">
  import "kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

See the [kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md) for full API reference, attributes, events, and custom layout examples.

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

| Command                      | Description                               | Port |
| ---------------------------- | ----------------------------------------- | ---- |
| `npm start`                  | Demo app                                  | 8080 |
| `npm run start:demo`         | Demo app (explicit alias)                 | 8080 |
| `npm run start:flp`          | Demo app in FLP sandbox (SAPUI5 + ushell) | 8080 |
| `npm run start:hotkeys`      | Hotkeys library + test runner             | 8081 |
| `npm run start:kiosk`        | Kiosk keyboard library + test runner      | 8082 |
| `npm run start:kiosk:visual` | Kiosk visual test page                    | 8082 |
| `npm run start:kiosk-webc`   | Kiosk web component standalone demo       | 8084 |

### Build & Test

```bash
npm run build                  # Build all libraries (hotkeys + kiosk + kiosk-webc)
npm run build:hotkeys          # Build hotkeys only
npm run build:kiosk            # Build kiosk-keyboard only
npm run build:kiosk-webc       # Build kiosk-keyboard-webc only
npm run build:demo             # Build demo app only
npm run build:all              # Build libraries + demo app

npm test                       # Run all tests (headless)
npm run test:qunit             # Run all library QUnit tests
npm run test:hotkeys           # Hotkeys QUnit tests
npm run test:kiosk             # Kiosk QUnit + e2e tests
npm run test:kiosk:e2e         # Kiosk e2e tests only
npm run test:kiosk:e2e:flp     # FLP lifecycle e2e tests (SAPUI5 sandbox)
npm run test:kiosk:e2e:update  # Update kiosk visual baselines (explicit only)
npm run test:kiosk:e2e:docs    # Regenerate README kiosk screenshots
npm run test:kiosk-webc        # Kiosk web component unit tests (Vitest)
npm run test:kiosk-webc:component  # Kiosk web component tests (Web Test Runner)
npm run test:kiosk-webc:e2e    # Kiosk web component e2e tests (WebdriverIO)
```

### Code Quality

```bash
npm run check               # fmt:check + lint + lint:ui5 + typecheck + test:guardrails + test (project quality gate)
npm run fmt                 # Format (oxfmt)
npm run lint                # Lint (oxlint)
npm run lint:ui5            # UI5 linter across all workspaces
npm run typecheck           # Typecheck all workspaces (includes kiosk e2e tests)
npm run test:guardrails     # Fails on hard-wait anti-patterns in test code
```

## Project Structure

```
ui5-keyboard/
├── packages/
│   ├── hotkeys/               # ui5-lib-hotkeys (ui5.hotkeys namespace)
│   ├── kiosk-keyboard/        # ui5-lib-kiosk-keyboard (ui5.kiosk namespace)
│   ├── kiosk-keyboard-webc/   # kiosk-keyboard-webc (native web component)
│   └── demo-app/              # Demo application
│       ├── ui5.yaml           # OpenUI5 dev server config (default)
│       └── ui5-flp.yaml       # SAPUI5 + FLP sandbox config (preview-middleware)
├── tools/                     # Shared test infrastructure (wdio server, QUnit helpers)
└── docs/                      # Architecture & design documents
```

## Documentation

| Document                                                                                         | Description                            |
| ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| [Hotkeys Architecture](./docs/hotkeys/ARCHITECTURE.md)                                           | Internal design of the hotkeys library |
| [Kiosk Keyboard Architecture](./docs/kiosk/ARCHITECTURE.md)                                      | Internal design of the kiosk keyboard  |
| [Kiosk Error Handling and DX](./docs/kiosk/ERROR-HANDLING-DX.md)                                 | Error handling consistency proposal    |
| [Docs Index & Conventions](./docs/README.md)                                                     | Doc structure, naming, and lifecycle   |
| [Glossary](./docs/GLOSSARY.md)                                                                   | Shared terms and concepts              |
| [Multi-key Sequences](./docs/hotkeys/SEQUENCES.md)                                               | Sequence system design and rationale   |
| [Alternatives Research](./docs/hotkeys/ALTERNATIVES-RESEARCH.md)                                 | Comparison with alternative approaches |
| [Kiosk Popover Layout Switch Behavior](./docs/kiosk/POPOVER-LAYOUT-SWITCH-BEHAVIOR.md)           | Known popover behavior and mitigation  |
| [UI5 Transpile Crash Deep Dive](./docs/kiosk/AS-CONST-UI5-TRANSPILE-CRASH-DEEP-DIVE.md)          | Tooling crash analysis and fixes       |
| [API Stability Policy](./docs/shared/API-STABILITY.md)                                           | Stable vs internal import boundaries   |
| [UI5 Event Handling Deep Dive](./docs/shared/UI5-EVENT-HANDLING-DEEP-DIVE.md)                    | How UI5 processes keyboard events      |
| [UI5 TypeScript Event Typing](./docs/shared/UI5-TYPESCRIPT-EVENT-TYPING.md)                      | TypeScript patterns for UI5 events     |
| [UI5 Web Component Consumption Research](./docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) | UI5 vs standalone consumption guidance |
| [Hotkeys Backward Compatibility Proposal](./docs/hotkeys/proposals/BACKWARD-COMPATIBILITY.md)    | Planned compatibility work             |
| [Kiosk Backward Compatibility Proposal](./docs/kiosk/proposals/BACKWARD-COMPATIBILITY.md)        | Planned compatibility work             |
| [Tab and Done Keys Proposal](./docs/kiosk/proposals/TAB-AND-DONE-KEYS.md)                        | Proposed special-key behavior          |
| [Kiosk i18n Extensibility Notes](./docs/kiosk/history/I18N-EXTENSIBILITY.md)                     | Historical i18n extension notes        |
| [Kiosk Web Component Package Proposal](./docs/kiosk/proposals/WEBCOMPONENT-PACKAGE.md)           | Proposed web component package         |
| [Kiosk History Notes](./docs/kiosk/history/)                                                     | Archived implementation design notes   |

## License

[MIT](./LICENSE)
