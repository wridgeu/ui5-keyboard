<h1 align="center">ui5-keyboard (kiosk, hotkey)</h1>

<p align="center">
A keyboard mono-repo for the web: declarative <strong>hotkeys</strong> and an on-screen <strong>virtual keyboard</strong>, shipped both as SAPUI5/OpenUI5 TypeScript libraries and as a framework-agnostic Web Component.
</p>

This repository bundles two complementary capabilities (keyboard shortcut management and a touch-friendly virtual keyboard) packaged for different runtimes. It is an npm-workspaces mono-repo: two UI5-native libraries, a standalone Web Component variant of the virtual keyboard, and a demo app that exercises all of them. Pick the package that matches your stack; each is independently consumable and versioned.

> [!CAUTION]
> Large parts of this project were _vibe coded_. I built it with heavy AI assistance while recovering from wrist surgery, one hand and speech-to-text only. If you find rough edges, that is probably why.

## Packages

| Package                                                 | Description                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`ui5-lib-hotkeys`](./packages/hotkeys)                 | Declarative keyboard shortcut management: scopes, multi-key sequences, cross-platform modifiers, hotkey recording |
| [`ui5-lib-kiosk-keyboard`](./packages/kiosk-keyboard)   | On-screen virtual keyboard UI5 control: SAP theming, multiple layouts, docked/auto-show mode, touch support       |
| [`kiosk-keyboard-webc`](./packages/kiosk-keyboard-webc) | Native web component variant of the kiosk keyboard: framework-agnostic, built on UI5 Web Components               |
| [`demo-hotkeys-app`](./packages/demo-app)               | Demo application showcasing all libraries                                                                         |

## Live Demo

The [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) workflow publishes a self-hosted demo to GitHub Pages at **https://wridgeu.github.io/ui5-keyboard/** on pushes to `main` that touch deployable sources (docs- and test-only changes are skipped via `paths-ignore`). It serves a static Fiori Launchpad with two tiles: the SAPUI5 demo app (the `ui5.hotkeys` + `ui5.kiosk` controls) and the framework-less "Raw Web Components Demo". The site is fully self-hosted (the SAPUI5 runtime is bundled into the artifact, no external CDN). The workflow provisions GitHub Pages on its first run, so no manual repository setup is required.

## Kiosk Keyboard Theme Preview

Full-size inline keyboard:

| `sap_horizon`                                                                                       | `sap_horizon_dark`                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon](./docs/kiosk/images/kiosk-inline-wide-sap_horizon.png) | ![Inline wide kiosk keyboard in sap_horizon_dark](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_dark.png) |

| `sap_horizon_hcb`                                                                                           | `sap_horizon_hcw`                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![Inline wide kiosk keyboard in sap_horizon_hcb](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcb.png) | ![Inline wide kiosk keyboard in sap_horizon_hcw](./docs/kiosk/images/kiosk-inline-wide-sap_horizon_hcw.png) |

## Getting Started

The three library packages are not yet published on npm. For local development, install once at the repository root and use the package READMEs for API details:

```bash
npm install
```

Once the packages are published, use the install commands below.
For full API details, see:

- **[ui5-lib-hotkeys README](./packages/hotkeys/README.md)**
- **[ui5-lib-kiosk-keyboard README](./packages/kiosk-keyboard/README.md)**
- **[kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md)**

### Consumption Modes (UI5 Libraries)

Both UI5-native libraries (`ui5-lib-hotkeys` and `ui5-lib-kiosk-keyboard`) ship:

- the source UI5 project (`src/`, `ui5.yaml`) for source-first UI5 Tooling consumption
- prebuilt `dist/resources/...` artifacts, typings, and `dist/.ui5/build-manifest.json` for direct dist serving and tooling reuse

That enables 3 app-side consumption modes. No project shim is required.

1. **Installed package + UI5 Tooling** (default, recommended for runtime). Resolve the library from `node_modules`; add the UI5 project names (`ui5.hotkeys`, `ui5.kiosk`, as shown by `ui5 tree --flat`) to `builder.settings.includeDependency` if your app build should copy the resources into `dist/`. For CDN-bootstrapped static deployments, map the namespaces to the copied `resources/` via `data-sap-ui-resource-roots`.
2. **Source package + UI5 Tooling transpilation** (monorepos, local development). Enable `ui5-tooling-transpile` with `transpileDependencies: true` in both the build task and the dev-server middleware.
3. **Static middleware escape hatch**. Serve the dist `resources/` via `ui5-middleware-servestatic` without the dependency participating in your app's UI5 dependency resolution.

The full per-package `ui5.yaml`, CDN, and middleware snippets live in the package READMEs ([hotkeys](./packages/hotkeys/README.md), [kiosk-keyboard](./packages/kiosk-keyboard/README.md)). Both libraries add no CSP requirements (no `eval`, inline script, or remote connections); under a strict Content-Security-Policy, self-hosting the copied `resources/` avoids any cross-origin `script-src` allowance.

In all three modes, keep the custom library declarations in your app `manifest.json`:

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

Ensure the consuming app's `minUI5Version` (under `sap.ui5.dependencies`) is at least **1.144.0**, the floor both libraries declare in their `manifest.json` and are built, type-checked, and tested against.

`ui5.hotkeys` is lightweight (no CSS, no heavy dependencies) and best loaded eagerly at app startup.

`ui5.kiosk` includes CSS, theming, and i18n bundles. If the keyboard is only used on specific views or routes, consider `"lazy": true` to defer library loading until the keyboard is first needed:

```json
"ui5.kiosk": { "lazy": true }
```

When the library is used declaratively in an XML view (e.g. `<kiosk:KioskKeyboard .../>`), the framework loads it automatically on first view instantiation. For programmatic usage, load it explicitly before creating controls:

```ts
import Lib from "sap/ui/core/Lib";
await Lib.load({ name: "ui5.kiosk" });
```

### Hotkeys

```bash
npm install ui5-lib-hotkeys
```

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = new HotkeyManager();
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
  <kiosk:KioskKeyboard controls="myInput" docked="true" autoShow="true" />
</mvc:View>
```

### Kiosk Keyboard (Web Component)

The web component variant (`kiosk-keyboard-webc`) provides the same virtual keyboard as a native custom element. Its consumption model is different from the native UI5 libraries:

- standalone apps: prefer `kiosk-keyboard-webc/bundle`
- advanced ESM setups: use `kiosk-keyboard-webc` with `kiosk-keyboard-webc/Assets`
- UI5 apps: resolve npm modules via `ui5-tooling-modules`, then choose CEM-driven wrapper consumption or a `WebComponent.extend()` bridge

```bash
# once published
npm install kiosk-keyboard-webc
```

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<input id="my-input" type="text" />
<kiosk-keyboard layout="qwerty" controls="my-input"></kiosk-keyboard>
```

See the [kiosk-keyboard-webc README](./packages/kiosk-keyboard-webc/README.md) for the detailed consumption modes, UI5 integration notes, API reference, attributes, events, and custom layout examples.

## Using Hotkeys and the UI5 Kiosk Keyboard Together

The two UI5 libraries are independent (neither depends on the other) but they complement each other well. A typical kiosk application uses hotkeys for global shortcuts and the virtual keyboard for text input:

```xml
<mvc:View xmlns:kiosk="ui5.kiosk" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc">
  <m:Input id="searchField" placeholder="Search..." />
  <kiosk:KioskKeyboard docked="true" autoShow="true" controls="searchField" />
</mvc:View>
```

```ts
// Controller - register hotkeys alongside the virtual keyboard
onInit(): void {
  const manager = this.getOwnerComponent().getHotkeyManager();
  const group = manager.createGroup();
  group.register("Mod+K", () => this.byId("searchField")?.focus(), {
    description: "Focus search",
  });
}
```

Both UI5 libraries use standard UI5 lifecycle management (`destroy()`) and coexist on the same page without conflicts. The KioskKeyboard fires `keyPress` events (not native `keydown`), so virtual key taps do not trigger hotkeys registered via HotkeyManager.

## Development

Monorepo using npm workspaces. Requires Node >= 24. CI runs on Node 24 for OIDC-based npm provenance publishing.

```bash
npm install                 # Install all workspaces
npm run build               # Build library dist/ artifacts (required before starting the demo app)
```

### Dev Servers

| Command                      | Description                                   | Port |
| ---------------------------- | --------------------------------------------- | ---- |
| `npm start`                  | Build the web component, then serve the demo  | 8080 |
| `npm run start:flp`          | Demo app in FLP sandbox (SAPUI5 + ushell)     | 8080 |
| `npm run start:hotkeys`      | Hotkeys QUnit test runner                     | 8081 |
| `npm run start:kiosk`        | Kiosk keyboard QUnit test runner              | 8082 |
| `npm run start:kiosk:visual` | Kiosk visual test page (same server as kiosk) | 8082 |
| `npm run start:kiosk-webc`   | Kiosk web component standalone demo (Vite)    | 8084 |

The test runners start their own servers on fixed ports (8081-8086) when debugging port conflicts. See the **Port Map** in [docs/shared/TESTING.md](./docs/shared/TESTING.md) for the full list and which config owns each port.

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
npm test                          # Core suite across all packages (QUnit + desktop e2e + Vitest + Web Test Runner)
npm run test:hotkeys              # Hotkeys QUnit
npm run test:kiosk                # Kiosk QUnit + desktop e2e
npm run test:kiosk-webc           # Kiosk webc unit tests (Vitest)
npm run test:e2e:all-devices      # All e2e across the device matrix (kiosk + webc)
```

The full per-package catalog (multi-device matrix, FLP lifecycle, smoke checks, visual-baseline management, coverage) and the e2e prerequisites are documented in [docs/shared/TESTING.md](./docs/shared/TESTING.md).

### Code Quality

```bash
npm run check              # Full quality gate with smoke checks + sequential multi-device e2e
npm run check:parallel     # Same gate, but with the concurrent multi-device matrix
npm run fmt                # Format (oxfmt)
npm run fmt:check          # Check formatting without fixing
npm run lint               # Lint (oxlint)
npm run lint:fix           # Lint with auto-fix
npm run lint:ui5           # UI5 linter across all workspaces
npm run typecheck          # Typecheck all workspaces (incl. e2e tests)
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
├── tools/                     # Custom oxlint JS plugins (code-quality, comment-quality, test-guardrails) and shared test infrastructure
├── patches/                   # Local dependency patches (patch-package), applied on npm install
└── docs/                      # Architecture & design documents
```

## Documentation

| Document                                                                       | Description                                           |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [Glossary](./docs/GLOSSARY.md)                                                 | Shared terms and concepts across all packages         |
| [API Stability Policy](./docs/shared/API-STABILITY.md)                         | Stable vs internal import boundaries                  |
| [Multi-key Sequences](./docs/hotkeys/SEQUENCES.md)                             | Hotkeys sequence system design and rationale          |
| [Web Component Consumption](./docs/kiosk-webc/CONSUMPTION.md)                  | Build pipeline, exports, tag scoping, and limitations |
| [Consumption Research](./docs/shared/UI5-WEBCOMPONENT-CONSUMPTION-RESEARCH.md) | UI5 vs standalone consumption comparison              |
| [Docs Index](./docs/README.md)                                                 | Entry point to the per-area doc indexes               |
| [Patches](./patches/README.md)                                                 | Local dependency patches applied via patch-package    |
| [Tools](./tools/README.md)                                                     | Custom oxlint plugins, shared test infra, dev scripts |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, commit conventions, and PR guidelines.

## License

[MIT](./LICENSE)
