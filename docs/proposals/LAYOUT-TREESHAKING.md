# Layout Tree-Shaking and Bundle Optimization

> Design spec for [#45](https://github.com/wridgeu/ui5-lib-keyboard/issues/45)
> Related: [#53 -- optional kana composition engine](https://github.com/wridgeu/ui5-lib-keyboard/issues/53)

## Problem

All built-in layouts are statically imported at module load time in both packages. Consumers who need 2 of 16+ layouts still bundle all of them. As the library grows (more layouts, optional engines like kana composition), modularity becomes essential -- not just for bundle size, but as an architectural principle.

### Current measurements (16 layouts)

| Metric                         | kiosk-keyboard | kiosk-keyboard-webc |
| ------------------------------ | -------------: | ------------------: |
| All layouts raw source         |        25.0 KB |             24.0 KB |
| All layouts gzipped source     |         4.7 KB |              4.5 KB |
| All layouts minified + gzipped |     **2.1 KB** |                 n/a |

Layout data is small today. The motivation is architectural: the library should be modular so consumers only import what they use, and future features (engines, complex script support) follow the same pattern.

## Design Decisions

### Each package follows its own ecosystem

The two packages do not force consistency. Each follows what is natural and effective for its ecosystem:

- **WebC** gets real tree-shaking via split entry points and Vite code splitting.
- **UI5** stays as-is. The `library-preload.js` bundles everything under the namespace (glob-based, no tree-shaking). Splitting into `KioskKeyboardCore` + individual layout modules would not reduce what the consumer downloads. The UI5 package structure is already well-organized and does not need restructuring.

### Self-registering side-effect imports (WebC)

Layout modules self-register when imported. The consumer does not need to call `registerLayout` -- importing the module is enough. This is the same pattern used by `@ui5/webcomponents` (each import triggers `customElements.define`).

### Two-level registration

- **`_registerBuiltInLayout(name, def)`** -- internal, used by self-registering modules. Idempotent: silently skips if the name is already registered. Prevents duplicate work when the same layout is imported via multiple paths (e.g., full entry + direct import).
- **`registerLayout(name, def)`** -- public API, unchanged. Consumers can override any layout, including built-ins. Validates structure as today. The current protection that blocks built-in overwriting is removed to give consumers full control.

### Two-tier entry points (WebC only)

| Entry                           | What it includes                              |
| ------------------------------- | --------------------------------------------- |
| `kiosk-keyboard-webc` (default) | All built-in layouts, works out of the box    |
| `kiosk-keyboard-webc/core`      | Zero layouts, consumer imports what they need |

The full entry is a thin wrapper: imports core + all built-in layout modules (triggering self-registration), then re-exports core. This keeps the "just set `layout='qwerty-es'`" experience for consumers who don't need optimization.

### UI5 declarative XML usage

UI5 consumers use `<kiosk:KioskKeyboard layout="qwerty-es" />` in XML views. The full entry (`ui5/kiosk/KioskKeyboard`) includes all layouts -- declarative usage works without any extra imports or registration steps. This does not change.

## WebC Module Architecture

### Self-registering layout module structure

```ts
// layouts/qwerty-es.ts
import { _registerBuiltInLayout } from "../internal/layout-registry";

const qwertyEs: LayoutDefinition = [
  /* ... */
];

_registerBuiltInLayout("qwerty-es", qwertyEs);

export default qwertyEs;
```

### Full entry (all layouts)

```ts
// KioskKeyboard.ts (full entry)
import "./layouts/qwerty";
import "./layouts/qwertz-de";
import "./layouts/numeric";
// ... all built-in layouts
import "./layouts/ko-hangul";

export { default } from "./KioskKeyboardCore";
```

### Consumer usage

```js
// Option 1: Full entry -- everything included
import { KioskKeyboard } from "kiosk-keyboard-webc";

// Option 2: Core + selective imports
import { KioskKeyboard } from "kiosk-keyboard-webc/core";
import "kiosk-keyboard-webc/layouts/qwerty";
import "kiosk-keyboard-webc/layouts/numeric";
// Only qwerty and numeric are registered

// Option 3: Core + fully custom layouts
import { KioskKeyboard } from "kiosk-keyboard-webc/core";
KioskKeyboard.registerLayout("my-layout", [
  /* ... */
]);
```

### Package exports map

```jsonc
// package.json
{
  "exports": {
    ".": "./dist/KioskKeyboard.js",
    "./core": "./dist/KioskKeyboardCore.js",
    "./layouts/*": "./dist/layouts/*.js",
    "./bundle": "./dist/bundle.esm.js",
  },
}
```

### Vite build configuration

The current single-bundle build (`codeSplitting: false`) changes to multi-entry:

**Entry points:**

- `src/KioskKeyboard.ts` -- full (imports all layouts, re-exports core)
- `src/KioskKeyboardCore.ts` -- core (component + registry, no layouts)
- `src/layouts/*.ts` -- one entry per layout
- `src/bundle.esm.ts` -- single-file bundle (kept for CDN/script-tag usage)

**Key changes:**

- Code splitting enabled (or implied by multiple entries)
- `lib.entry` becomes an object of all entry points
- Shared code (registry, base component) extracted into common chunks by Vite/Rollup

**Output structure:**

```
dist/
  KioskKeyboard.js
  KioskKeyboardCore.js
  layouts/
    qwerty.js
    qwertz-de.js
    ...
  bundle.esm.js
  chunks/            # shared code extracted by Vite
```

## UI5 Package

No structural changes. The UI5 package stays as-is:

- All layouts centrally imported in the layout registry
- Single entry point: `ui5/kiosk/KioskKeyboard`
- `library-preload.js` bundles everything under the `ui5/kiosk/` namespace
- `registerLayout` public API unchanged (consumers can add custom layouts)

### Library-preload note for consumers

All built-in layouts are included in `library-preload.js` by design. At ~2 KB gzipped total this is negligible for most consumers. If you need to exclude specific layouts, you can patch the library's `ui5.yaml` locally (e.g., via `patch-package`) using `builder.libraryPreload.excludes`:

```yaml
builder:
  libraryPreload:
    excludes:
      - "ui5/kiosk/layouts/ko-hangul/"
      - "ui5/kiosk/layouts/arabic/"
```

See the [UI5 Tooling Configuration docs](https://sap.github.io/ui5-tooling/v4/pages/Configuration/) for full syntax. Available since specVersion 2.3 / UI5 CLI v2.10.0.

## Registration API Changes

### `_registerBuiltInLayout(name, def)` (new, internal)

Used by self-registering layout modules. Idempotent:

```ts
function _registerBuiltInLayout(name: string, def: LayoutDefinition): void {
  if (layouts.has(name)) return; // already registered, skip silently
  layouts.set(name, def);
  BUILTIN_LAYOUTS.add(name);
}
```

### `registerLayout(name, def)` (existing, public)

Allows overriding any layout, including built-ins. The current guard that blocks built-in overwriting is removed:

```ts
function registerLayout(name: string, def: LayoutDefinition): void {
  const normalized = normalizeLowerString(name, "layout name");
  if (!normalized) return;
  if (!isValidLayoutDefinition(def)) {
    Log.warning(`Invalid layout "${normalized}": ...`);
    return;
  }
  layouts.set(normalized, def); // overrides if exists
}
```

## Testing and Verification

### WebC smoke tests

1. **Full entry** -- import from `kiosk-keyboard-webc`, verify all built-in layouts are registered, render the component with `layout="qwerty-es"`
2. **Core + individual layouts** -- import from `kiosk-keyboard-webc/core`, import two layout modules, verify only those are registered, verify unimported layouts are NOT registered
3. **Idempotent registration** -- import the same layout twice (directly + via full entry), verify no errors, layout registered once
4. **Custom layout override of built-in** -- import full entry, call `registerLayout("qwerty", customDef)`, verify the custom definition takes precedence
5. **Bundle entry** -- import from `kiosk-keyboard-webc/bundle`, verify single-file bundle works

### UI5 smoke tests

6. **Standard consumption** -- `sap.ui.define` with `ui5/kiosk/KioskKeyboard`, verify all layouts available, XML view renders correctly
7. **Custom layout registration** -- call `registerLayout` with a custom layout, verify it's usable via the `layout` property

### Build verification

8. **WebC tree-shaking** -- build a minimal app importing only core + one layout, verify the output does NOT contain data from excluded layouts (grep for unique strings)
9. **UI5 library-preload** -- verify `library-preload.js` builds successfully and contains all expected modules

### E2e

10. **Existing e2e test suite passes** -- proves UI5 consumption of the web component is unbroken

## Engine Module Pattern (#53)

The engine registry (e.g., kana composition from #53) follows the same self-registering pattern established here for layouts. The engine API and implementation will be designed in a separate design session and implemented in this PR. The architecture mirrors layouts:

- `engines/` directory with self-registering modules
- `_registerBuiltInEngine` (internal, idempotent) + `registerEngine` (public, overridable)
- Exported via `kiosk-keyboard-webc/engines/*`
- UI5 includes engines in `library-preload.js` as with layouts

See #53 for the engine-specific design session.

## Industry Reference

This design is informed by how other libraries handle modularity:

| Library                | Pattern                                         | Relevance                                                     |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| **Chart.js**           | `chart.js/auto` (full) vs `chart.js` (register) | Two-tier entry, explicit `Chart.register()`, idempotent by id |
| **UI5 Web Components** | Side-effect imports, `customElements.define`    | Self-registering pattern, idempotent via tag registry         |
| **Day.js**             | `dayjs.extend(plugin)` with `$i` flag           | Lightweight idempotency marker on plugin function             |
| **Moment.js**          | Dynamic `require()`, bundles all locales        | Anti-pattern: no way to exclude unused code                   |

## Scope

**In scope:**

- WebC: split entry points (full + core), self-registering layout modules, Vite multi-entry build, package.json exports map
- WebC: `_registerBuiltInLayout` (internal, idempotent) for self-registering modules
- Both: allow `registerLayout` to override built-ins (remove current protection)
- Smoke tests for all consumption patterns
- E2e tests pass
- Documentation note for UI5 consumers about library-preload

**Out of scope:**

- UI5 package structural changes (not needed, no benefit)
- Engine registry API design (separate design session, implemented in this PR per #53)
- Dynamic imports / lazy loading (approach B from #45 -- rejected in favor of split entry points)
- Build-time configuration plugins (approach C from #45 -- rejected as too complex)
