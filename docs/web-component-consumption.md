# Web Component Consumption: Architecture, Limitations, and Workarounds

This document captures the design decisions, tooling limitations, and exploratory
work done to make `kiosk-keyboard-webc` consumable in three scenarios: UI5 tooling-native,
UI5 manual bridge, and native npm/browser. It is meant as a reference for future
contributors and for evaluating upstream tooling improvements.

## Background

The `kiosk-keyboard-webc` package provides the `<kiosk-keyboard>` custom element,
built on the UI5 Web Components framework (`UI5Element`). Unlike `@ui5/webcomponents`
(which ships dozens of independent components), our package is a single component
with a pluggable layout system -- 16 built-in keyboard layouts that self-register
via side-effect imports.

This "one component, many plugins" pattern is unusual in the web components ecosystem
and surfaced several tooling limitations.

## Three Consumption Paths

### 1. UI5 Tooling-Native

The recommended path for UI5 apps. The `ui5-tooling-modules` middleware reads the
package's Custom Elements Manifest (CEM) and auto-generates a `sap.ui.core.webc.WebComponent`
wrapper at dev/build time.

```xml
<mvc:View xmlns:kiosk="kiosk-keyboard-webc">
  <kiosk:KioskKeyboard docked="true" autoShow="true" />
</mvc:View>
```

**How it works:**

1. The middleware detects the `customElements` field in `package.json`.
2. It parses the CEM (`dist/custom-elements.json`) and registers all classes.
3. When an XML view references `kiosk-keyboard-webc`, the middleware resolves
   the class via an alias created from `declaration.module` in the CEM exports.
4. A Rollup pipeline bundles the component + dependencies into AMD modules.
5. A UI5 wrapper is generated from the CEM metadata (properties, events, slots).
6. Tag scoping is applied (e.g., `kiosk-keyboard` becomes `kiosk-keyboard-<hash>`)
   to prevent collisions between different versions.

**Requirements:**

- `ui5-tooling-modules` middleware configured in `ui5.yaml`
- Package installed as a dependency (not devDependency)
- Package built (`dist/` must exist with tsc output + CEM)
- The main entry (`KioskKeyboard.js`) must import all layouts, because the
  middleware only loads the module the CEM points to

### 2. UI5 Manual Bridge (`WebComponent.extend()`)

For apps that want explicit control over the wrapper metadata or cannot use
`ui5-tooling-modules`. The developer writes a `WebComponent.extend()` bridge
and loads the web component outside the middleware.

**Why not a simple import?** When `ui5-tooling-modules` is active, it intercepts
ALL imports from packages with a `customElements` field. The middleware converts
the import to AMD, applies tag scoping, and generates its own wrapper -- which
conflicts with a hand-written bridge using the unscoped tag. Loading the standalone
bundle as a `<script type="module">` from a path outside `/resources/` bypasses
the middleware entirely.

**Scoping interaction:** The tooling-native path registers `kiosk-keyboard-<hash>`
(scoped). The manual bridge registers `kiosk-keyboard` (unscoped). These are
separate entries in the browser's `customElements` registry and coexist without
conflict. Both share the same layout registry (singleton module state).

### 3. Native npm/Browser

For non-UI5 consumers:

- **Standalone bundle** (`dist/kiosk-keyboard.bundle.js`): Self-contained Vite
  build, zero external dependencies. Load via `<script type="module">`.
- **ESM modules** (`dist/*.js`): Flat tsc output with bare specifiers. Requires
  a bundler or dev server that resolves `@ui5/webcomponents-base/*`.

## Build Pipeline

The build produces two kinds of output:

| Output                                              | Tool  | Purpose                                            |
| --------------------------------------------------- | ----- | -------------------------------------------------- |
| Individual ESM modules (`dist/*.js`)                | `tsc` | Consumed by `ui5-tooling-modules` and npm bundlers |
| Standalone bundle (`dist/kiosk-keyboard.bundle.js`) | Vite  | Self-contained bundle for `<script>` tags          |

Vite's `emptyOutDir: false` ensures the tsc output is not wiped. The Vite build
has `inlineDynamicImports: true` so the bundle is a single file.

## Package Structure Alignment with `@ui5/webcomponents`

The package mirrors the `@ui5/webcomponents` structure:

| Field                      | `@ui5/webcomponents`          | `kiosk-keyboard-webc` |
| -------------------------- | ----------------------------- | --------------------- |
| `customElements`           | `"dist/custom-elements.json"` | Same                  |
| `ui5.webComponentsPackage` | `true`                        | Same                  |
| `"./dist/*"` export        | `"./dist/*"`                  | Same                  |
| `"./*"` export             | `"./dist/*"`                  | Same                  |
| `type`                     | `"module"`                    | Same                  |

The `"./dist/*": "./dist/*"` identity export is critical. Without it, imports
containing `dist/` in the path (e.g., `kiosk-keyboard-webc/dist/KioskKeyboard.js`)
resolve through `"./*": "./dist/*"`, producing `dist/dist/KioskKeyboard.js`
(double-dist, non-existent). The middleware constructs this path from the CEM's
`declaration.module` field. See the "Exports Map Double-Dist" section below.

## Lean Consumption (Advanced)

The package offers two entry points:

| Entry          | Import path                | What you get                        |
| -------------- | -------------------------- | ----------------------------------- |
| Full (default) | `kiosk-keyboard-webc`      | Component + all 16 built-in layouts |
| Core (lean)    | `kiosk-keyboard-webc/core` | Component only, no layouts          |

The `"./core"` named export points to `dist/KioskKeyboardCore.js`, which contains
the component class without any layout side-effect imports. The CEM correctly
handles this re-export pattern -- the class and `custom-element-definition` are
attributed to the full entry (`dist/KioskKeyboard.js`), not the core file.
The middleware never sees the core export; it only processes the main entry.

With the core entry, consumers cherry-pick layouts:

```typescript
import KioskKeyboard from "kiosk-keyboard-webc/core";
import "kiosk-keyboard-webc/layouts/qwerty";
import "kiosk-keyboard-webc/layouts/numeric";
KioskKeyboard.registerLayout("my-custom", myDefinition);
```

## Limitations and Workarounds

### Windows Backslashes in CEM Type References

**Problem:** The `@ui5/webcomponents-tools` CEM analyzer uses `path.join()` in
`lib/cem/utils.mjs:169` for type reference module paths:

```javascript
path.join(path.dirname(modulePath), currentModuleSpecifier.text);
```

On Windows, this produces backslashes (e.g., `dist\\types.js`). The CEM spec
itself does not mandate a separator format, but `ui5-tooling-modules` expects
forward slashes for module path alias matching, and the de facto convention
across the ecosystem (ES module specifiers, npm, @ui5/webcomponents) is
forward slashes.

**Root cause:** The `@ui5/webcomponents` team builds on Linux CI and has never
encountered this. The fix would be `path.posix.join()` or a post-normalization
in the analyzer. No upstream fix exists as of `@ui5/webcomponents-tools@2.19.2`.

**Fix:** A `patch-package` patch on `@ui5/webcomponents-tools` replaces
`path.join()` / `path.dirname()` with `path.posix.join()` / `path.posix.dirname()`
in `lib/cem/utils.mjs`. This produces forward slashes on all platforms. The input
is a CEM module path (not a filesystem path), so `path.posix` is semantically
correct. See `patches/README.md` Bug 6 for the full rationale and evidence from
`ui5-tooling-modules` source code.

**Status:** Fixed via patch. Remove when the upstream adopts `path.posix`.

### Exports Map Double-Dist Resolution

**Problem:** The middleware constructs the module path from the CEM:

```javascript
// ui5-tooling-modules/lib/rollup-plugin-webcomponents.js:440-441
const modulePath = `${clazz.package}/${clazz.module}`;
const absModulePath = resolveModule(modulePath);
```

If the CEM says `module: "dist/KioskKeyboard.js"`, the constructed path is
`kiosk-keyboard-webc/dist/KioskKeyboard.js`. Without `"./dist/*": "./dist/*"`,
this resolves through `"./*": "./dist/*"`, producing `dist/dist/KioskKeyboard.js`.

**Root cause:** The exports map lacked the identity mapping that `@ui5/webcomponents`
has. This was the primary cause of the middleware "hang" the colleague reported --
the middleware couldn't resolve the component module path.

**Fix:** Added `"./dist/*": "./dist/*"` before `"./*": "./dist/*"`.

**Status:** Fixed permanently.

### Tag Scoping Prevents Manual Bridge

**Problem:** The `ui5-tooling-modules` middleware applies tag scoping to all
`webComponentsPackage` imports. The scoped tag (e.g., `kiosk-keyboard-e24fedd4`)
is different from the canonical tag (`kiosk-keyboard`). A hand-written
`WebComponent.extend()` bridge uses the canonical tag, which is never registered.

**Root cause:** Scoping is always enabled in the middleware's dev server
(`ui5 serve`). The `pluginOptions.webcomponents.scoping` config only applies
to the build task (`ui5 build`), not the middleware. This is by design -- the
dev server always scopes to match production behavior.

**Workaround:** Load the standalone bundle from a path outside `/resources/`
(e.g., `webapp/lib/kiosk-keyboard.bundle.js`). The UI5 dev server serves
`webapp/` files at the root path without middleware interception. The standalone
bundle registers the canonical (unscoped) tag. The demo app's `prestart` script
copies the bundle from the webc package's dist.

**Status:** Workaround in place. This is inherent to how scoping works and is
not a bug -- scoping is designed for multi-version isolation.

### CEM Re-Export Handling

**Problem (initially assumed):** When the component class lives in
`KioskKeyboardCore.ts` and is re-exported from `KioskKeyboard.ts`, the CEM
analyzer might put the class declaration in the wrong module.

**Investigation result:** The CEM analyzer correctly follows `export { default }
from "./KioskKeyboardCore.js"` and attributes the class declaration to the
re-exporting module (`dist/KioskKeyboard.js`). The `custom-element-definition`
export also appears in the correct module.

**Previous workaround (removed):** A CEM post-processing step propagated the
CE def export from the declaring module to the re-exporting module. This was
unnecessary -- the analyzer handles it natively.

**Known quirk:** The CEM analyzer wraps re-export `declaration.module` paths in
extra quotes: `"\"./KioskKeyboardCore.js\""` instead of `"./KioskKeyboardCore.js"`.
This is a cosmetic bug in the analyzer but does not affect the middleware's class
lookup because the CE def export (which the middleware uses) is correctly attributed.

**Status:** No workaround needed. The extra quotes are in the `js` export's
`declaration.module`, not in the `custom-element-definition` export.

### Named `./core` Export

The `"./core"` named export in `package.json` points to `dist/KioskKeyboardCore.js`.
This was initially abandoned due to concerns about CEM re-export handling and
middleware interference. Investigation revealed:

1. The CEM analyzer correctly follows re-exports and attributes the class to the
   re-exporting module (`KioskKeyboard.js`), not the declaring module (`KioskKeyboardCore.js`).
2. The middleware never processes the `./core` export because it only resolves the
   main entry from the CEM's `custom-element-definition` export.
3. The extra quotes bug in `declaration.module` for re-exports is cosmetic -- it
   only affects the `js` export, not the `custom-element-definition` export.

**Status:** Named `./core` export is in place. The lean path also works via the
wildcard (`kiosk-keyboard-webc/KioskKeyboardCore`).

### Middleware Always Intercepts `webComponentsPackage` Imports

**Problem:** When both the tooling-native and manual bridge scenarios coexist
in the same UI5 application, any `import "kiosk-keyboard-webc/..."` goes through
the middleware's Rollup pipeline. The middleware wraps the module in AMD, applies
scoping, and generates its own wrapper. There is no per-package opt-out.

**Root cause:** The middleware detects packages by the `customElements` field in
`package.json`. Once detected, ALL imports from that package are processed. The
`ui5.webComponentsPackage` flag is informational only -- the middleware does not
check it.

**Consequence:** A manual bridge in the same app must load the web component
outside the module system (via `<script>` tag) to avoid middleware interception.
This is the approach used in the demo app.

**Alternatives considered:**

- `pluginOptions.webcomponents.skip: true` -- disables all webcomponent processing,
  breaking the tooling-native path
- `skipTransform` config -- applies to module transformation, not webcomponent
  processing
- Separate `ui5.yaml` configs -- possible but adds complexity
- Removing `customElements` from `package.json` -- breaks the tooling-native path

**Status:** No upstream solution. The demo works around it by serving the
standalone bundle from `webapp/lib/`.

## Web Component Design Principle

In the broader web components ecosystem (Lit, Shoelace, @ui5/webcomponents),
tree-shaking happens at the **component level**: import Button but not Input.
No library provides per-component plugin tree-shaking (e.g., import Button
without its icon support).

Our kiosk keyboard is a single component with a plugin system (layouts and
middleware). The CEM and UI5 tooling were designed for the component-level
pattern, not the plugin-level pattern. This is why:

- The CEM has no concept of "optional side-effect imports"
- The middleware loads everything the main entry imports
- There is no way to express "this component works without these plugins" in the CEM

For lean consumption, the package offers the `KioskKeyboardCore` wildcard path
as an escape hatch. But the primary consumption model (main entry, tooling-native)
always ships all built-in layouts. This matches the ecosystem convention.

## Future Considerations

1. **Upstream CEM analyzer fix for Windows paths:** If `@ui5/webcomponents-tools`
   switches from `path.join()` to `path.posix.join()` in the type reference code
   path, the `normalize-cem-paths.mjs` workaround can be removed.

2. **Middleware per-package scoping control:** If `ui5-tooling-modules` adds
   per-package scoping config (e.g., `pluginOptions.webcomponents.scopeExclude`),
   the manual bridge demo could use a simple `import` instead of the standalone
   bundle workaround.

3. **Middleware `pluginOptions` in dev server:** The `scoping` option currently
   only works in the build task, not the middleware. If the middleware exposes
   `pluginOptions.webcomponents`, the demo app could disable scoping during
   development.

4. **CEM support for optional imports:** If the CEM spec adds a concept of
   optional or pluggable dependencies, the middleware could distinguish between
   required and optional side-effect imports. This would enable proper lean
   consumption through the tooling path.
