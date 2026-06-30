# Build Pipelines

The three library packages have different build pipelines because they target different runtimes.

## UI5 Libraries (hotkeys, kiosk-keyboard)

These are standard UI5 libraries built by the UI5 CLI:

```
src/*.ts  -->  ui5-tooling-transpile  -->  dist/resources/ui5/{namespace}/
```

The UI5 CLI handles TypeScript transpilation, version replacement, and library packaging. No separate code generation step is needed because UI5 libraries use LESS for theming (processed by the UI5 builder) and standard `.properties` files for i18n (resolved at runtime by the UI5 resource bundle mechanism).

## Web Component (kiosk-keyboard-webc)

The web component package uses the [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) framework and its tooling. This requires a multi-step build because the framework converts source assets into TypeScript modules that are compiled alongside the component code.

### Build steps

```bash
npm run build -w packages/kiosk-keyboard-webc
# Expands to: npm run build:dev && npm run build:bundle && npm run generateAPI
```

| Step           | Command               | What it does                                                         |
| -------------- | --------------------- | -------------------------------------------------------------------- |
| 1. generate    | `ui5nps generate`     | Converts source assets into TypeScript (see data flow below)         |
| 2. tsc         | `tsc --build --force` | Compiles all TypeScript (source + generated) to `dist/`              |
| 3. bundle      | `vite build`          | Creates the standalone all-in-one bundle from the tsc output         |
| 4. generateAPI | `ui5nps generateAPI`  | Analyzes the compiled source to produce the Custom Elements Manifest |

Each step depends on the previous one's output. The `--force` flag on tsc is required because the `generate` step writes into `src/generated/` right before compilation, and the incremental build cache can miss those changes.

### Code generation data flow

The `generate` step uses processors from `@ui5/webcomponents-tools` to convert source assets into importable TypeScript modules:

```
SOURCE FILES                         GENERATED OUTPUT                          CONSUMED BY
-------------------------------      ------------------------------------      ---------------------------

1. generate.styles
   src/themes/KioskKeyboard.css      src/generated/themes/                     KioskKeyboard.ts imports
   src/themes/{theme}/*.css          KioskKeyboard.css.ts                      the CSS as a JS string.
                                     {theme}/parameters-bundle.css.ts          Registers theme property
                                                                               loaders at module scope.

2. generate.i18n.defaults
   src/i18n/messagebundle             src/generated/i18n/                      Component code imports typed
   *.properties                       i18n-defaults.ts                         i18n keys like
                                      (typed constants:                        KIOSK_KEYBOARD_LABEL.
                                       {key, defaultText})

3. generate.i18n.json
   src/i18n/messagebundle             dist/generated/assets/i18n/              Lazy-loaded at runtime.
   *.properties                       messagebundle_{locale}.json              When the browser locale is
                                      (per-locale JSON files)                  "de", the framework fetches
                                                                               messagebundle_de.json.

4. generate.jsonImports
   (reads i18n + themes dirs)         src/generated/json-imports/              Assets.ts imports these.
                                      i18n.ts                                  They call
                                      Themes.ts                                registerI18nLoader() and
                                      (loader stubs with dynamic               registerThemePropertiesLoader()
                                       import() to JSON assets)                at module scope.

5. syncAssets
   dist/generated/assets/**           src/generated/assets/**                  The jsonImports files use
                                      (mirror copy)                            relative paths like
                                                                               "../assets/i18n/...json".
                                                                               Vite dev server serves from
                                                                               src/, so the JSON files
                                                                               must exist there too.
```

Steps 1-4 are standard UI5 Web Components framework requirements. Step 5 (`syncAssets`) is a local workaround because the upstream i18n tooling hardcodes JSON output to `dist/generated/assets/`, but the Vite dev server resolves imports from `src/`. The upstream framework does not need this step because it serves from `dist/`.

### ui5nps script runner

The generate steps are orchestrated by `ui5nps`, a script runner provided by `@ui5/webcomponents-tools`. It reads `package-scripts.mjs` in the package root, which defines a tree of named scripts. Each script either delegates to a processor from `@ui5/webcomponents-tools/lib/` or chains other scripts together:

```javascript
// package-scripts.mjs (simplified)
generate: {
  default: "ui5nps generate.styles generate.i18n generate.jsonImports generate.syncAssets",
  styles: {
    components: `ui5nps-script "${LIB}/css-processors/css-processor-components.mjs"`,
    themes:     `ui5nps-script "${LIB}/css-processors/css-processor-themes.mjs"`,
  },
  i18n: {
    defaults: `ui5nps-script "${LIB}/i18n/defaults.js" ...`,
    json:     `ui5nps-script "${LIB}/i18n/toJSON.js" ...`,
  },
  // ...
}
```

This is the same build mechanism used by all UI5 Web Components packages (e.g., `@ui5/webcomponents`). The upstream packages use `getScripts()` from `@ui5/webcomponents-tools/components-package/nps.js` which defines a much larger script tree (including illustrations, HBS templates, legacy JS copy, scoping). Our `package-scripts.mjs` only defines the scripts we actually need.

### Two distribution formats

The build produces two independent distribution formats:

| Format                     | Produced by  | Entry point                     | `@ui5/*` deps                | Use case                                                        |
| -------------------------- | ------------ | ------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| **Individual ESM modules** | `tsc`        | `dist/KioskKeyboard.js`         | External (consumer provides) | Bundler-based apps (Vite, webpack, rollup, ui5-tooling-modules) |
| **Standalone bundle**      | `vite build` | `dist/kiosk-keyboard.bundle.js` | Inlined                      | `<script>` tag, CDN, apps that cannot install the external deps |

The upstream `@ui5/webcomponents` packages only produce the individual ESM modules. The Vite build step for the standalone bundle is our addition, configured in `vite.config.ts` using Vite's library mode with `output.codeSplitting: false` (the Vite 8 / Rolldown replacement for the deprecated `inlineDynamicImports: true`) to produce a single self-contained file. The Vite config also sets `emptyOutDir: false` so the bundle step does not wipe the `tsc` output already written to `dist/`.

### Custom Elements Manifest (CEM)

The `generateAPI` step runs at the end of the build (after `tsc`) to produce `dist/custom-elements.json`. This is the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest), a standardized JSON format that describes the component's public API (tag name, attributes, properties, events, methods, CSS parts, slots).

The CEM is consumed by:

- **ui5-tooling-modules** reads it to auto-generate the UI5 wrapper for XML view consumption.
- **IDE tooling** uses it for autocomplete and validation of the `<kiosk-keyboard>` tag.
- **Documentation generators** extract API tables from the manifest.

The CEM analyzer reads the `.ts` source files and the `@customElement`, `@property`, and `@event` decorators to extract the public API surface. See [Custom Elements Manifest](./CUSTOM-ELEMENTS-MANIFEST.md) for the JSDoc rules that govern what it can extract.

### Tree shaking and sideEffects

The `package.json` declares which modules have side effects:

```json
"sideEffects": [
  "./dist/bundle.esm.js",
  "./dist/Assets.js",
  "./dist/generated/**"
]
```

These modules execute code at import time (theme/i18n asset registration and the convenience bundle entry). Bundlers preserve them even when no explicit export is consumed. Layouts and middleware are pure data/factory modules and are intentionally not listed (see issue #108).

All other modules (core utilities, types, the main `KioskKeyboard.js`) are tree-shakeable. A bundler that imports only specific layouts or only the component class can eliminate the rest.

The standalone bundle (`kiosk-keyboard.bundle.js`) includes everything and is not tree-shakeable. Tree shaking only applies to consumers who import individual ESM modules.
