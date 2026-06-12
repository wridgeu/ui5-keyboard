# Web Component Consumption: Architecture, Limitations, and Workarounds

This document captures the design decisions, tooling limitations, and exploratory
work done to make `kiosk-keyboard-webc` consumable in three scenarios: UI5 tooling-native,
UI5 manual bridge, and native npm/browser. It is meant as a reference for future
contributors and for evaluating upstream tooling improvements.

## Background

The `kiosk-keyboard-webc` package provides the `<kiosk-keyboard>` custom element,
built on the UI5 Web Components framework (`UI5Element`). Unlike `@ui5/webcomponents`
(which ships dozens of independent components), our package is a single component
with a pluggable layout system: 12 built-in keyboard layouts bundled via direct
imports, plus 2 shared building-block rows for composing custom variants.

This "one component, many plugins" pattern is unusual in the web components ecosystem
and surfaced several tooling limitations.

## Consumption Paths

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

### 2. Native npm/Browser

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
sets `codeSplitting: false` so the bundle is a single file (this replaces the
deprecated `inlineDynamicImports: true` under Vite 8 / Rolldown).

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

## How Tag Scoping Works

Tag scoping is a `ui5-tooling-modules` feature designed for **multi-version
isolation**. On a Fiori Launchpad, multiple apps may load different versions of
the same web component package. Without scoping, the second app's
`customElements.define("kiosk-keyboard", ...)` would throw because the tag is
already taken by the first app's version.

Scoping solves this by appending a hash derived from the package version to
every tag name. `kiosk-keyboard` becomes `kiosk-keyboard-e24fedd4`. Each app
version gets its own registry entry, so they coexist without collisions.

**Scoping is universal.** It applies to all packages the middleware detects via
the `customElements` field in `package.json`, including first-party
`@ui5/webcomponents`. A `<ui5-button>` is scoped to `<ui5-button-abc123>` the
same way `<kiosk-keyboard>` is scoped to `<kiosk-keyboard-e24fedd4>`. The
auto-generated `WebComponent` wrapper hides this from the app developer: you
write `<ui5:Button>` in XML, and the wrapper creates the scoped DOM element
internally.

**Why this affects the manual bridge.** A hand-written `WebComponent.extend()`
bridge specifies `tag: "kiosk-keyboard"` (the canonical, unscoped name). At
runtime, the UI5 bridge calls `customElements.get("kiosk-keyboard")` to look up
the constructor. If the component was only loaded through the middleware, only
the scoped tag (`kiosk-keyboard-e24fedd4`) exists in the registry. The
unscoped `kiosk-keyboard` was never defined. The bridge finds nothing, and the
element stays unupgraded.

There is no middleware API to query "what is the scoped name for this tag?" The
bridge cannot dynamically discover the hash. This is why loading the standalone
bundle outside the middleware is a necessity, not a preference: it registers the
canonical unscoped tag so the manual bridge can find it.

**Coexistence.** Both the scoped and unscoped tags can coexist in the same page.
They are separate entries in the `customElements` registry, each pointing to
(potentially different instances of) the component constructor. They share the
same layout registry because it is a module-level singleton. Layout data is
not tied to the tag name.

The demo app's web component tooling page shows the actual registered tag name
at runtime. You will see the scoped tag with its hash (which changes on every
build). The manual bridge demo was removed in the April 2026 architecture
simplification; the bridge pattern is documented as a reference in the
demo-app README.

## Lean Consumption (Advanced)

The default entry (`kiosk-keyboard-webc`) includes the component class and all
built-in layouts. There is no separate `./core` export: the class lives in a
single file, so the default entry already is the lean entry.

Consumers who want selective layout loading can import individual layouts via
subpath imports and pass any custom layouts through the per-element
`instanceLayouts` property:

```typescript
import KioskKeyboard from "kiosk-keyboard-webc";
import "kiosk-keyboard-webc/layouts/qwerty";
import "kiosk-keyboard-webc/layouts/numeric";

const el = document.createElement("kiosk-keyboard");
el.instanceLayouts = { "my-custom": myDefinition };
el.layout = "my-custom";
document.body.appendChild(el);
```

Available layout subpaths: `kiosk-keyboard-webc/layouts/<name>` (e.g., `qwerty`,
`numeric`, `arabic`, `ja-kana`, `ko-hangul`). The shared building-block rows
`kiosk-keyboard-webc/layouts/fkey-row` and `kiosk-keyboard-webc/layouts/nav-row`
are stable imports for composing custom variant layouts.

## Custom Keys

A layout key with a custom token (e.g. `{paste}`) does not insert text on its
own. It fires the cancelable `key-press` event; handle that and use the element's
input methods to edit the target:

```typescript
import KioskKeyboard from "kiosk-keyboard-webc";

const el = document.createElement("kiosk-keyboard");
el.instanceLayouts = {
  pad: [[{ value: "{paste}", label: "", icon: "sap-icon://paste", ariaLabel: "Paste from clipboard" }, { value: "1" }]],
};
el.addEventListener("key-press", (e) => {
  if (e.detail.key === "{paste}") {
    e.preventDefault(); // claim this key
    navigator.clipboard.readText().then((t) => el.insertText(t));
  }
});
el.layout = "pad";
document.body.appendChild(el);
```

The element exposes `insertText(text)`, `deleteBackward()`, and
`getActiveTargetElement()` - all no-ops when there is no active target - so a
`key-press` handler can edit the real target with cursor tracking. Set
`KeyDefinition.ariaLabel` for the accessible name of an icon-only key. Any
unrecognized `{token}` fires `key-press` and is otherwise a no-op (never typed
literally); `preventDefault()` is how you take it over. There is no action
registry: behavior lives in your event handler, the layout stays plain data.

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
in the analyzer. No upstream fix exists as of `@ui5/webcomponents-tools@2.22.0`.

**Fix:** Originally a `patch-package` patch on `@ui5/webcomponents-tools` replaced
`path.join()` / `path.dirname()` with `path.posix.join()` / `path.posix.dirname()`
in `lib/cem/utils.mjs`. That patch (Bug 6) has since been **removed**: flattening
the component into a single module eliminated the cross-module type references that
triggered `getTypeReferenceModulePath`, so the path-normalization issue no longer
affects this project. See `patches/README.md` Bug 6 for the full history.

**Status:** No longer applicable to this project (the trigger was removed). The
upstream bug still exists for components with cross-module type references on Windows.

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
to the build task (`ui5 build`), not the middleware. This is by design - the
dev server always scopes to match production behavior.

**Workaround:** Load the standalone bundle from a path outside `/resources/`
(e.g., `webapp/lib/kiosk-keyboard.bundle.js`). The UI5 dev server serves
`webapp/` files at the root path without middleware interception. The standalone
bundle registers the canonical (unscoped) tag.

**Note (April 2026):** The manual bridge demo page was removed in the
architecture simplification. The bridge pattern is documented as a reference in
the demo-app README, including a minimal `WebComponent.extend()` code example.
Consumers who need the bridge pattern can implement it from that reference
without a dedicated demo page.

**Status:** This is inherent to how scoping works and is not a bug - scoping is
designed for multi-version isolation.

### CEM Re-Export Handling

**Historical context:** When the component class lived in `KioskKeyboardCore.ts`
and was re-exported from `KioskKeyboard.ts`, the CEM analyzer needed to follow
the re-export chain to attribute the class declaration to the correct module.

**Investigation result (pre-April 2026):** The CEM analyzer correctly followed
`export { default } from "./KioskKeyboardCore.js"` and attributed the class
declaration to the re-exporting module (`dist/KioskKeyboard.js`). The
`custom-element-definition` export also appeared in the correct module. A
CEM post-processing step that was initially added to propagate the CE def
export was found to be unnecessary and was removed.

**Known quirk:** The CEM analyzer wrapped re-export `declaration.module` paths
in extra quotes: `"\"./KioskKeyboardCore.js\""` instead of
`"./KioskKeyboardCore.js"`. This was a cosmetic bug in the analyzer but did not
affect the middleware's class lookup because the CE def export was correctly
attributed.

**Resolution (April 2026):** The re-export pattern was eliminated entirely.
The class now lives directly in `KioskKeyboard.ts` with no re-export from a
separate core file. This removes the cross-module reference chain that the CEM
analyzer had to follow and makes the extra-quotes quirk moot.

**Status:** Resolved. The re-export investigation is preserved here for context
in case similar patterns are introduced in the future.

### Named `./core` Export (Removed)

The `"./core"` named export formerly pointed to `dist/KioskKeyboardCore.js`,
providing a lean entry point without layout side-effect imports. Investigation
had confirmed:

1. The CEM analyzer correctly followed re-exports and attributed the class to the
   re-exporting module (`KioskKeyboard.js`), not the declaring module.
2. The middleware never processed the `./core` export because it only resolves the
   main entry from the CEM's `custom-element-definition` export.

**Resolution (April 2026):** The `./core` export was removed when the class was
flattened into a single file. Consumers who want selective layout loading can
import individual layouts via `kiosk-keyboard-webc/layouts/*` subpath imports.

### Middleware Always Intercepts `webComponentsPackage` Imports

**Problem:** When both the tooling-native and manual bridge scenarios coexist
in the same UI5 application, any `import "kiosk-keyboard-webc/..."` goes through
the middleware's Rollup pipeline. The middleware wraps the module in AMD, applies
scoping, and generates its own wrapper. There is no per-package opt-out.

**Root cause:** The middleware detects packages by the `customElements` field in
`package.json`. Once detected, ALL imports from that package are processed. The
`ui5.webComponentsPackage` flag is informational only. The middleware does not
check it.

**Consequence:** A manual bridge in the same app must load the web component
outside the module system (via `<script>` tag) to avoid middleware interception.
This is the approach used in the demo app.

**Alternatives considered:**

- `pluginOptions.webcomponents.skip: true`: disables all webcomponent processing,
  breaking the tooling-native path
- `skipTransform` config: applies to module transformation, not webcomponent
  processing
- Separate `ui5.yaml` configs: possible but adds complexity
- Removing `customElements` from `package.json`: breaks the tooling-native path

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

For lean consumption, consumers can import individual layouts via
`kiosk-keyboard-webc/layouts/*` subpath imports. But the primary consumption
model (main entry, tooling-native) always ships all built-in layouts. This
matches the ecosystem convention.

## Future Considerations

1. **Upstream CEM analyzer fix for Windows paths:** If `@ui5/webcomponents-tools`
   switches from `path.join()` to `path.posix.join()` in the type reference code
   path, the `@ui5/webcomponents-tools` patch in `patches/` can be removed. Note:
   the April 2026 class flattening eliminated the cross-module type references
   that were the primary trigger for this issue. The patch may no longer be needed;
   verify by temporarily removing it and rebuilding on Windows.

2. **Middleware per-package scoping control:** If `ui5-tooling-modules` adds
   per-package scoping config (e.g., `pluginOptions.webcomponents.scopeExclude`),
   consumers using the manual bridge pattern could use a simple `import` instead
   of the standalone bundle workaround.

3. **CEM support for optional imports:** If the CEM spec adds a concept of
   optional or pluggable dependencies, the middleware could distinguish between
   required and optional side-effect imports. This would enable proper lean
   consumption through the tooling path.
