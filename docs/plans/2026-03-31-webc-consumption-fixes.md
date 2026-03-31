# Web Component Consumption Fixes & Smoke Tests

Date: 2026-03-31
Branch: `ci/release-please-setup`

## Problem

The `kiosk-keyboard-webc` package has structural issues that prevent it from being consumed correctly in three scenarios:

1. **UI5 tooling-native** (`xmlns:kiosk="kiosk-keyboard-webc"` in XML views) -- the `ui5-tooling-modules` middleware cannot resolve the component's module path because the exports map causes a double-`dist/` resolution.
2. **UI5 manual bridge** (`WebComponent.extend()`) -- the bridge control never imports the web component module, so `<kiosk-keyboard>` is never registered with the browser's custom elements registry.
3. **Native npm/browser** -- untested. No smoke test exists to validate the tsc output or CDN bundle works outside UI5.

## Root Causes

### Exports map missing `"./dist/*"` identity

The middleware constructs the module path from the CEM: `kiosk-keyboard-webc/dist/KioskKeyboard.js`. Without a `"./dist/*": "./dist/*"` identity export, this resolves through `"./*": "./dist/*"`, producing `dist/dist/KioskKeyboard.js` (non-existent). `@ui5/webcomponents` avoids this because it has both exports:

```json
"./dist/*": "./dist/*",
"./*": "./dist/*"
```

Traced in `ui5-tooling-modules/lib/rollup-plugin-webcomponents.js` lines 440-441:

```javascript
const modulePath = `${clazz.package}/${clazz.module}`;
const absModulePath = resolveModule(modulePath);
// resolveModule("kiosk-keyboard-webc/dist/KioskKeyboard.js")
// goes through "./*" -> "./dist/*" -> dist/dist/KioskKeyboard.js (broken)
```

### CEM has Windows backslashes in type references

The `@ui5/webcomponents-tools` CEM analyzer produces backslashes in `references[].module` fields when run on Windows. All type references in our CEM use `dist\\types.js` instead of `dist/types.js`. The `@ui5/webcomponents` team builds on Linux CI and never hits this. This is our responsibility to normalize.

### Bridge control missing web component import

The `import "kiosk-keyboard-webc/bundle"` was removed from the controller (fix #5 in the colleague's work) but was not added to the bridge control itself. The bridge only imports `sap/ui/core/webc/WebComponent` -- nothing triggers `customElements.define("kiosk-keyboard", ...)`.

## Changes

### 1. Add `"./dist/*"` identity export

**File**: `packages/kiosk-keyboard-webc/package.json`

Add `"./dist/*": "./dist/*"` before the `"./*"` wildcard in the exports map. This matches the `@ui5/webcomponents` pattern and ensures that import paths containing `dist/` resolve without doubling.

### 2. Normalize CEM paths after generation

**File**: `packages/kiosk-keyboard-webc/package-scripts.mjs`

Add a post-processing step after CEM validation that reads `dist/custom-elements.json`, replaces all `\\` with `/`, and writes it back. This runs as part of the existing `generateAPI` pipeline.

### 3. Add bundle import to bridge control

**File**: `packages/demo-app/webapp/control/KioskKeyboardWebc.ts`

Add `import "kiosk-keyboard-webc/bundle";` at the top. This ensures the custom element is registered when the bridge is loaded. The import goes in the bridge, not the controller -- the bridge is the self-contained integration point.

### 4. Add native consumption smoke tests

**Directory**: `packages/kiosk-keyboard-webc/test/pages/`

Two minimal HTML files:

**`consume-cdn.html`**: Loads `dist/kiosk-keyboard.bundle.js` via a script tag. Contains a `<kiosk-keyboard>` element and an `<input>`. Validates the CDN bundle is self-contained. No import map, no external dependencies.

**`consume-esm.html`**: Uses an import map to point `kiosk-keyboard-webc/*` to `../../dist/` and `@ui5/webcomponents-base/*`, `@ui5/webcomponents/*`, etc. to their `node_modules/` paths. Imports `kiosk-keyboard-webc/bundle.esm.js`. Same body markup. Validates the flat tsc output and module graph work in a real browser.

Both are manual test pages (open in browser, verify the keyboard renders and types). No test runner, no assertions, no framework.

## What is NOT changing

- No changes to the web component source code (`src/`)
- No changes to the Vite config (CDN-only bundle is correct)
- No changes to the tooling-native demo page (`KioskWebComponentTooling`) -- it already exists and will work once the exports and CEM are fixed
- No changes to `ui5.yaml` or middleware configuration
- No Assets import -- the default theme and English text work without it; Assets can be added later if multi-theme/multi-locale is needed in the demo

## Verification

After implementation:

- `npm run build` in `kiosk-keyboard-webc` succeeds
- `dist/custom-elements.json` contains no backslashes
- `consume-cdn.html` renders the keyboard when opened in a browser
- `consume-esm.html` renders the keyboard when opened via a dev server
- The manual bridge demo page (`kiosk/web-component`) shows the keyboard
- The tooling-native demo page (`kiosk/web-component-tooling`) shows the keyboard
