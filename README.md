# ui5-lib-keyboard

UI5 TypeScript libraries for keyboard interaction in SAPUI5/OpenUI5 applications.

## Packages

| Package                                                 | Description                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`ui5-lib-hotkeys`](./packages/hotkeys)                 | Declarative keyboard shortcut management: scopes, multi-key sequences, cross-platform modifiers, hotkey recording |
| [`ui5-lib-kiosk-keyboard`](./packages/kiosk-keyboard)   | On-screen virtual keyboard UI5 control: SAP theming, multiple layouts, docked/auto-show mode, touch support       |
| [`kiosk-keyboard-webc`](./packages/kiosk-keyboard-webc) | Native web component variant of the kiosk keyboard: framework-agnostic, built on UI5 Web Components               |
| [`demo-hotkeys-app`](./packages/demo-app)               | Demo application showcasing all libraries                                                                         |

## Kiosk Keyboard Theme Preview

Full-size inline keyboard:

| `sap_horizon`                                                                                       | `sap_horizon_dark`                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon](./docs/kiosk/images/kiosk-inline-wide-sap_horizon.png) | ![Inline wide kiosk keyboard in sap_horizon_dark](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                                           | `sap_horizon_hcw`                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon_hcb](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcb.png) | ![Inline wide kiosk keyboard in sap_horizon_hcw](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcw.png) |

## Getting Started

This monorepo currently keeps all three library packages workspace-local (`private: true`).
For local development, install once at the repository root and use the package READMEs for API details:

```bash
npm install
```

If/when the packages are published, use the install commands below.
For full API details, see:

- **[ui5-lib-hotkeys README](./packages/hotkeys/README.md)**
- **[ui5-lib-kiosk-keyboard README](./packages/kiosk-keyboard/README.md)**
- **[kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md)**

### Consumption Modes (UI5 Libraries)

Both UI5-native libraries (`ui5-lib-hotkeys` and `ui5-lib-kiosk-keyboard`) ship:

- the source UI5 project (`src/`, `ui5.yaml`) for source-first UI5 Tooling consumption
- prebuilt `dist/resources/...` artifacts, typings, and `dist/.ui5/build-manifest.json` for direct dist serving and tooling reuse

That enables 3 app-side consumption modes:

#### 1. Tooling + dist resources

Recommended for published/runtime usage when you want UI5 Tooling to serve and build the prebuilt library artifacts without transpiling dependency sources.

Use a project shim to map the dependency's `dist/resources/...` folder into the normal UI5 runtime paths. Add `includeDependency` when your app build should copy those resources into its own `dist/` output.

```yaml
builder:
  settings:
    includeDependency:
      - ui5-lib-hotkeys
      - ui5-lib-kiosk-keyboard
---
specVersion: "4.0"
kind: extension
type: project-shim
metadata:
  name: my.app.ui5-lib-dist
shims:
  configurations:
    ui5-lib-hotkeys:
      specVersion: "4.0"
      type: module
      metadata:
        name: ui5-lib-hotkeys-dist
      resources:
        configuration:
          paths:
            /resources/ui5/hotkeys/: dist/resources/ui5/hotkeys
    ui5-lib-kiosk-keyboard:
      specVersion: "4.0"
      type: module
      metadata:
        name: ui5-lib-kiosk-keyboard-dist
      resources:
        configuration:
          paths:
            /resources/ui5/kiosk/: dist/resources/ui5/kiosk
```

#### 2. Tooling + source project

Recommended for monorepos and local development when you want UI5 Tooling to consume the dependency's source project directly from npm/workspaces.

Enable dependency transpilation in both the build task and the dev server middleware:

```yaml
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
```

No `framework.libraries` entry is required for these custom libraries; UI5 Tooling resolves them from the package dependency and your app declares them in `manifest.json`.

#### 3. Static middleware escape hatch

Use this when you only need runtime serving from `dist/resources/...` and do not want the dependency to participate in your app build.

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

In all 3 modes, keep the custom library declarations in your app `manifest.json`:

```json
{
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "ui5.hotkeys": {},
        "ui5.kiosk": {}
      }
    }
  }
}
```

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

The web component variant (`kiosk-keyboard-webc`) provides the same virtual keyboard as a native custom element, usable in any framework (plain HTML, React, Vue, Angular) and inside UI5 apps via the `WebComponent.extend()` bridge.

```bash
npm install kiosk-keyboard-webc
```

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" for="my-input"></kiosk-keyboard>
```

See the [kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md) for full API reference, attributes, events, and custom layout examples.

## Using Hotkeys and the UI5 Kiosk Keyboard Together

The two UI5 libraries are independent (neither depends on the other) but they complement each other well. A typical kiosk application uses hotkeys for global shortcuts and the virtual keyboard for text input:

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="searchField" placeholder="Search..." />
  <kiosk:KioskKeyboard docked="true" autoShow="true" targetInput="searchField" />
</mvc:View>
```

```ts
// Controller - register hotkeys alongside the virtual keyboard
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

onInit(): void {
  const manager = HotkeyManager.getInstance();
  manager.register("Mod+K", () => this.byId("searchField")?.focus(), {
    description: "Focus search",
  });
}
```

Both UI5 libraries use standard UI5 lifecycle management (`destroy()`) and coexist on the same page without conflicts. The KioskKeyboard fires `keyPress` events (not native `keydown`), so virtual key taps do not trigger hotkeys registered via HotkeyManager.

## Development

Monorepo using npm workspaces. Requires Node >= 22.

```bash
npm install                 # Install all workspaces
```

### Dev Servers

| Command                      | Description                                   | Port |
| ---------------------------- | --------------------------------------------- | ---- |
| `npm start`                  | Demo app (alias for `start:demo`)             | 8080 |
| `npm run start:flp`          | Demo app in FLP sandbox (SAPUI5 + ushell)     | 8080 |
| `npm run start:hotkeys`      | Hotkeys QUnit test runner                     | 8081 |
| `npm run start:kiosk`        | Kiosk keyboard QUnit test runner              | 8082 |
| `npm run start:kiosk:visual` | Kiosk visual test page (same server as kiosk) | 8082 |
| `npm run start:kiosk-webc`   | Kiosk web component standalone demo (Vite)    | 8084 |

### Build

```bash
npm run build              # Build all libraries (hotkeys + kiosk + kiosk-webc)
npm run build:hotkeys      # Build hotkeys only
npm run build:kiosk        # Build kiosk-keyboard only
npm run build:kiosk-webc   # Build kiosk-keyboard-webc only
npm run build:demo         # Build demo app only
npm run build:all          # Build libraries + demo app
npm run clean              # Clean all dist outputs
```

### Test

```bash
# Core test suite (QUnit + desktop e2e + Vitest + Web Test Runner)
npm test                               # All core tests across all packages

# Per-package
npm run test:hotkeys                   # Hotkeys QUnit tests
npm run test:kiosk                     # Kiosk QUnit + desktop e2e tests
npm run test:kiosk:e2e                 # Kiosk desktop e2e only (no QUnit)
npm run test:kiosk-webc                # Kiosk webc unit tests (Vitest)
npm run test:kiosk-webc:component      # Kiosk webc integration tests (Web Test Runner)
npm run test:kiosk-webc:e2e            # Kiosk webc e2e tests (WebdriverIO)
npm run test:qunit                     # All QUnit tests only (hotkeys + kiosk)

# Multi-device e2e
npm run test:e2e:all-devices           # All e2e across all device profiles (kiosk + webc, concurrent)
npm run test:e2e:all-devices:sequential # Same matrix, but sequential for lower local CPU/RAM pressure
npm run test:kiosk:e2e:flp             # FLP lifecycle e2e tests (SAPUI5 sandbox)

# Visual baseline management
npm run test:kiosk:e2e:update          # Update kiosk desktop visual baselines
npm run test:kiosk-webc:e2e:update     # Update webc desktop visual baselines
npm run test:kiosk:e2e:docs            # Regenerate README kiosk screenshots

# Coverage
npm run test:coverage                  # Kiosk webc coverage (unit + component)
```

### Code Quality

```bash
npm run check              # Full quality gate (fmt + lint + typecheck + all tests + concurrent multi-device e2e)
npm run fmt                # Format (oxfmt)
npm run fmt:check          # Check formatting without fixing
npm run lint               # Lint (oxlint)
npm run lint:fix           # Lint with auto-fix
npm run lint:ui5           # UI5 linter across all workspaces
npm run typecheck          # Typecheck all workspaces (incl. e2e tests)
```

## Project Structure

```
ui5-lib-keyboard/
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

| Document                                                                                | Description                                          |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Glossary](./docs/GLOSSARY.md)                                                          | Shared terms and concepts across all packages        |
| [API Stability Policy](./docs/shared/API-STABILITY.md)                                  | Stable vs internal import boundaries                 |
| [Multi-key Sequences](./docs/hotkeys/SEQUENCES.md)                                      | Hotkeys sequence system design and rationale         |
| [UI5 Web Component Consumption](./docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) | UI5 vs standalone consumption guidance               |
| [Docs Index](./docs/README.md)                                                          | Full index of all docs (incl. internal & historical) |

## License

[MIT](./LICENSE)
