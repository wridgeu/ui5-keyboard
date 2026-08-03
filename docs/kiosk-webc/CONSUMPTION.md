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

This "one component, many plugins" pattern is unusual in the web components
ecosystem and surfaced several tooling limitations. In the broader ecosystem
(Lit, Shoelace, `@ui5/webcomponents`), tree-shaking happens at the **component
level**: import Button but not Input. No library provides per-component plugin
tree-shaking (e.g., import Button without its icon support). The CEM and UI5
tooling were designed for that component-level pattern, not the plugin-level
pattern, which is why:

- The CEM has no concept of "optional side-effect imports"
- The middleware loads everything the main entry imports
- There is no way to express "this component works without these plugins" in the CEM

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
6. Tag scoping is applied by default (e.g., `kiosk-keyboard` becomes
   `kiosk-keyboard-<hash>`) to prevent collisions between different versions.

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

See [./BUILD-PIPELINE.md](./BUILD-PIPELINE.md) for the tsc + Vite build, the two
distribution formats, and the `codeSplitting: false` rationale.

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

## Tag scoping and the manual bridge

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
element stays unupgraded. There is no middleware API to query "what is the
scoped name for this tag?", so the bridge cannot dynamically discover the hash.

The middleware also intercepts _all_ imports from a `webComponentsPackage`. Once
it detects the package via the `customElements` field, every
`import "kiosk-keyboard-webc/..."` goes through its Rollup pipeline, which wraps
the module in AMD, applies scoping, and generates its own wrapper. The
`ui5.webComponentsPackage` flag is informational only; the middleware does not
check it, and there is no per-package opt-out. A manual bridge in the same app
must therefore load the web component outside the module system (via a
`<script>` tag) so it registers the canonical unscoped tag without interception.

**Resolution.** Two options:

- **Disable scoping** (`pluginOptions.webcomponents.scoping: false`) for a
  single-web-component consumer - what this demo does, on both the task and the
  middleware config (the task config affects `ui5 build`, the middleware config
  affects `ui5 serve`). The middleware then registers the canonical
  `<kiosk-keyboard>`, the auto-generated wrapper resolves it, and no manual
  bridge is needed.
- **Keep scoping on** and load the standalone bundle from a path outside
  `/resources/` (e.g., `webapp/lib/kiosk-keyboard.bundle.js`); the UI5 dev server
  serves `webapp/` files at the root without middleware interception, and the
  bundle registers the canonical unscoped tag for the bridge to find.

**Coexistence.** Both the scoped and unscoped tags can coexist in the same page.
They are separate entries in the `customElements` registry, each pointing to
(potentially different instances of) the component constructor. They share the
same layout registry because it is a module-level singleton. Layout data is
not tied to the tag name.

The demo app's web component tooling page shows the actual registered tag name
at runtime. Because this demo disables scoping, you will see the canonical
unscoped tag `<kiosk-keyboard>`. The manual bridge pattern is documented as a
reference in the demo-app README, including a minimal `WebComponent.extend()`
code example.

**Alternatives considered** (for the scoping-on coexistence case):

- `pluginOptions.webcomponents.skip: true`: disables all webcomponent processing,
  breaking the tooling-native path
- `skipTransform` config: applies to module transformation, not webcomponent
  processing
- Separate `ui5.yaml` configs: possible but adds complexity
- Removing `customElements` from `package.json`: breaks the tooling-native path

## Lean Consumption (Advanced)

The default entry (`kiosk-keyboard-webc`) includes the component class and all
built-in layouts. There is no separate `./core` export: the class lives in a
single file, so the default entry already is the lean entry.

Consumers who want selective layout loading can import individual layouts via
subpath imports and slot any custom layouts into the per-element
`customLayouts` slot:

```typescript
import KioskKeyboard from "kiosk-keyboard-webc";
import "kiosk-keyboard-webc/CustomLayout";
import qwerty from "kiosk-keyboard-webc/layouts/qwerty";
import fkeyRow from "kiosk-keyboard-webc/layouts/fkey-row";

const el = document.createElement("kiosk-keyboard");
// Use a built-in as a base: prepend the shared F-key row to QWERTY.
const custom = document.createElement("kiosk-keyboard-custom-layout");
custom.slot = "customLayouts";
custom.name = "qwerty-fk";
custom.rows = [fkeyRow, ...qwerty];
el.appendChild(custom);
el.layout = "qwerty-fk";
document.body.appendChild(el);
```

Stable layout subpaths: `kiosk-keyboard-webc/layouts/<name>` (e.g., `qwerty`,
`numeric`, `arabic`, `ja-kana`, `ko-hangul`) - import a built-in to use as a base
or to pass as a custom layout's `rows`. The shared building-block rows
`kiosk-keyboard-webc/layouts/fkey-row` and `kiosk-keyboard-webc/layouts/nav-row`
are stable imports for composing custom variant layouts.

## Custom Keys

A layout key with a custom token (e.g. `{paste}`) does not insert text on its
own. It fires the cancelable `key-press` event; handle that and use the element's
input methods to edit the target:

```typescript
import KioskKeyboard from "kiosk-keyboard-webc";
import "kiosk-keyboard-webc/CustomLayout";

const el = document.createElement("kiosk-keyboard");
const pad = document.createElement("kiosk-keyboard-custom-layout");
pad.slot = "customLayouts";
pad.name = "pad";
pad.rows = [
  [{ value: "{paste}", label: "", icon: "sap-icon://paste", ariaLabel: "Paste from clipboard" }, { value: "1" }],
];
el.appendChild(pad);
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

## Height Responsiveness

The component compacts itself when its container grants it less height than it naturally needs. The contract is shared with the UI5 control twin: the keyboard reflects a `cq-tier` attribute (`short` / `tiny`, absent when unconstrained) on the host when the height the container actually grants the keyboard's rendered box, measured in untransformed layout pixels (the host's content-box height), is smaller than the keyboard's natural content height, with the tier chosen against the 16rem/12rem thresholds (overridable via `--kiosk-keyboard-cq-short-threshold` / `--kiosk-keyboard-cq-tiny-threshold`). Ancestor `transform: scale()` never shifts breakpoints.

To style off the tier, target `kiosk-keyboard[cq-tier="short"]` / `[cq-tier="tiny"]` from the outer document. It is an attribute rather than a class so framework `className` reconciliation cannot wipe it. (The light-DOM UI5 control twin uses root classes instead, `.ui5KioskKeyboard--cqShort` / `--cqTiny`, idiomatic for UI5 1.x.)

Practical notes:

- **Host padding is accounted for.** Breakpoints compare against the host's content box, so padding you put on `kiosk-keyboard` shrinks the space the keyboard sees and shifts compaction accordingly.
- **The keyboard's own border is accounted for.** The natural height includes the root's border (`--kiosk-keyboard-border`), so a thick border does not create a range of undetected clipping.
- **Keep `overflow: hidden` on the host** (the default). `overflow: clip` can collapse `scrollHeight` to `clientHeight` in some browsers and break constrained detection.
- **Docked and Numpad keyboards are exempt**: docked sizing is viewport-driven, and the numpad is already compact.

No CSS is required from the consumer for this to work: a flex or grid parent with a resolved height constrains the host automatically (`:host` ships `max-height: 100%; min-height: 0; overflow: hidden`).

## Limitations and Workarounds

### Windows Backslashes in CEM Type References

Not applicable to this package: its single-module output never emits cross-module
type-reference paths, so the `@ui5/webcomponents-tools` analyzer's `path.join()`
backslash bug is never exercised. The upstream bug persists for components with
cross-module type references on Windows.

### Exports Map Double-Dist Resolution

**Problem:**

The middleware constructs the module path from the CEM:

```javascript
// ui5-tooling-modules/lib/rollup-plugin-webcomponents.js:440-441
const modulePath = `${clazz.package}/${clazz.module}`;
const absModulePath = resolveModule(modulePath);
```

If the CEM says `module: "dist/KioskKeyboard.js"`, the constructed path is
`kiosk-keyboard-webc/dist/KioskKeyboard.js`. Without `"./dist/*": "./dist/*"`,
this resolves through `"./*": "./dist/*"`, producing `dist/dist/KioskKeyboard.js`.

**Root cause:**

The exports map lacked the identity mapping that `@ui5/webcomponents`
has. Without it the middleware could not resolve the component module path, which
manifested as a dev-server "hang".

**Fix:**

The exports map lists `"./dist/*": "./dist/*"` before `"./*": "./dist/*"`, so the identity mapping resolves the component module path (`kiosk-keyboard-webc/dist/KioskKeyboard.js`) instead of falling through to `dist/dist/KioskKeyboard.js`.

## Future Considerations

1. **Middleware per-package scoping control:** If `ui5-tooling-modules` adds
   per-package scoping config (e.g., `pluginOptions.webcomponents.scopeExclude`),
   consumers using the manual bridge pattern could use a simple `import` instead
   of the standalone bundle workaround.

2. **CEM support for optional imports:** If the CEM spec adds a concept of
   optional or pluggable dependencies, the middleware could distinguish between
   required and optional side-effect imports. This would enable proper lean
   consumption through the tooling path.
