# Feature: Backward Compatibility: Kiosk Keyboard Library

> Status: Rejected (2026-03-31). The current minUI5Version of 1.144 is intentional; lowering it is not a priority at this time.

## Problem

The kiosk keyboard library declares `minUI5Version: "1.144.0"` but uses only a handful of APIs introduced after 1.118. Three API groups push the version floor above the library registration baseline:

| API                             | Since     | Usages | Location                                |
| ------------------------------- | --------- | ------ | --------------------------------------- |
| `Localization.getLanguageTag()` | **1.120** | 1      | `KioskKeyboard.ts:486`                  |
| `Element.getElementById()`      | **1.119** | 4      | `KioskKeyboard.ts:646, 839, 1315, 1420` |
| `Element.getActiveElement()`    | **1.119** | 1      | `KioskKeyboard.ts:532`                  |

Everything else in the library is available at 1.118 or earlier.

## Analysis

### Complete UI5 API inventory (source only)

#### Version-constraining APIs

| Module                       | API                                                      | Since     | File                                    |
| ---------------------------- | -------------------------------------------------------- | --------- | --------------------------------------- |
| `sap/base/i18n/Localization` | `Localization.getLanguageTag()` → `.language`, `.region` | **1.120** | `KioskKeyboard.ts:486-488`              |
| `sap/ui/core/Element`        | `Element.getElementById(id)`                             | **1.119** | `KioskKeyboard.ts:646, 839, 1315, 1420` |
| `sap/ui/core/Element`        | `Element.getActiveElement()`                             | **1.119** | `KioskKeyboard.ts:532`                  |

#### Non-constraining APIs (all available at 1.118 or earlier)

| Module                      | APIs used                                                                                                                              | Since                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `sap/ui/core/Lib`           | `Lib.init({ apiVersion: 2 })`, `Lib.getResourceBundleFor()`                                                                            | 1.118                  |
| `sap/ui/core/Control`       | `extends Control`, all lifecycle/property/event methods                                                                                | < 1.60                 |
| `sap/ui/core/Element`       | `Element.closestTo()`                                                                                                                  | 1.106                  |
| `sap/ui/core/Element`       | `addEventDelegate()`, `removeEventDelegate()`, `getMetadata()`, `getFocusDomRef()`, `isA()`, `getId()`, `fireEvent()`, `setProperty()` | < 1.60                 |
| `sap/ui/base/ManagedObject` | `getParent()` chain traversal                                                                                                          | < 1.60                 |
| `sap/ui/core/mvc/View`      | `instanceof View`, `view.byId()`                                                                                                       | < 1.60                 |
| `sap/ui/Device`             | `Device.system.phone/tablet/desktop`                                                                                                   | < 1.60                 |
| `sap/base/Log`              | `Log.warning()`                                                                                                                        | < 1.60                 |
| `sap/ui/base/DataType`      | `DataType.registerEnum()`                                                                                                              | < 1.60                 |
| `sap/m/library`             | Side-effect import (dependency resolution)                                                                                             | < 1.60                 |
| `sap/ui/core/RenderManager` | `openStart`, `openEnd`, `close`, `class`, `attr`, `text`, `accessibilityState`, `icon`                                                 | < 1.94 (apiVersion 2+) |

#### Renderer `apiVersion: 4`

The renderer declares `apiVersion: 4`. This was introduced after apiVersion 2 (semantic rendering). The exact introduction version is undocumented in the public API reference, but it is present in the 1.118 type definitions. If verification shows it's unavailable at 1.118, falling back to `apiVersion: 2` is a safe, low-risk change (same DOM patching, slightly less optimized re-render skipping).

#### Test file APIs (do not ship)

Test files additionally use `Localization.getLanguage()`, `Localization.setLanguage()`, `XMLView.create()`, `nextUIUpdate()`, various `sap.m` controls. These are test-only and do not affect the library's minimum version.

### Version floor options

| Target    | Code changes                        | Trade-offs                                                           |
| --------- | ----------------------------------- | -------------------------------------------------------------------- |
| **1.120** | None                                | All APIs available; just lower the declared version                  |
| **1.118** | Replace 3 API groups (6 call sites) | Achieves library registration baseline; clean replacements available |

## Proposal: Target 1.118

### 1. Replace `Localization.getLanguageTag()` (1 call site)

**Current** (`KioskKeyboard.ts:485-488`):

```ts
import Localization from "sap/base/i18n/Localization";

static getLocaleLayout(): string {
  const tag = Localization.getLanguageTag();
  const lang = tag.language;
  const region = tag.region;
  // ...
}
```

**Replacement**: parse BCP-47 tag from `navigator.language`:

```ts
static getLocaleLayout(): string {
  // Parse locale from browser (same source UI5 Localization uses internally).
  // Avoids dependency on sap/base/i18n/Localization (since 1.120).
  const bcp47 = navigator.language || "en";
  const parts = bcp47.split("-");
  const lang = parts[0].toLowerCase();
  const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;

  const map = KioskKeyboard._LOCALE_LAYOUT_MAP;

  if (region && region.length === 2) {
    const exact = map[`${lang}-${region.toLowerCase()}`];
    if (exact) return exact;
  }

  const prefix = map[lang];
  if (prefix) return prefix;

  return DEFAULT_LAYOUT;
}
```

**Why `navigator.language` instead of a UI5 API:**

- `getLocaleLayout()` is a static method called before/during control construction, so no UI5 core dependency needed.
- `navigator.language` reflects the same browser locale that UI5 auto-detects from when no explicit `sap-language` is configured.
- For explicit `sap-language` URL parameter scenarios, apps should set the layout explicitly via the `layout` property anyway (the locale-detection is a sensible default, not a contract).
- Eliminates the `sap/base/i18n/Localization` import entirely from the library source.

**Alternative**: import from `sap/ui/core/Configuration` (deprecated at 1.120, available at 1.118):

```ts
import Configuration from "sap/ui/core/Configuration";
const sLanguage = Configuration.getLanguage(); // "en-US", "de", etc.
```

This works but introduces a deprecated API that the linter will flag. The `navigator.language` approach is cleaner.

### 2. Replace `Element.getElementById()` (4 call sites)

**Current**:

```ts
import Element from "sap/ui/core/Element";
const el = Element.getElementById(id);
```

**Replacement**: use `Element.registry.get()`:

```ts
import Element from "sap/ui/core/Element";
const el = Element.registry.get(id);
```

`Element.registry` is a `Map`-like object exposed since ~1.67 and is the underlying store that `getElementById()` wraps. It's not deprecated. `getElementById()` was added as a convenience wrapper in 1.119.

**Call sites to update:**

| Line | Context                                      | Current                                           | Replacement                                     |
| ---- | -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| 646  | `setTargetInput` - resolve new target        | `Element.getElementById(newId)`                   | `Element.registry.get(newId)`                   |
| 839  | `_resolveTarget` - global registry fallback  | `Element.getElementById(targetId)`                | `Element.registry.get(targetId)`                |
| 1315 | `_getTargetElement` - get associated element | `Element.getElementById(id)`                      | `Element.registry.get(id)`                      |
| 1420 | `_removeHighlightDelegation` - cleanup       | `Element.getElementById(this._highlightTargetId)` | `Element.registry.get(this._highlightTargetId)` |

### 3. Replace `Element.getActiveElement()` (1 call site)

**Current** (`KioskKeyboard.ts:532`):

```ts
const delegateTarget = Element.getActiveElement();
if (delegateTarget instanceof Control) {
  this.setTargetInput(delegateTarget);
}
```

**Replacement**: DOM-based lookup via `Element.closestTo()` (since 1.106):

```ts
const activeDom = document.activeElement;
const delegateTarget = activeDom ? Element.closestTo(activeDom) : undefined;
if (delegateTarget instanceof Control) {
  this.setTargetInput(delegateTarget);
}
```

This is functionally equivalent: `getActiveElement()` internally does the same DOM → UI5 Element resolution.

### 4. Verify renderer `apiVersion: 4`

Check whether `apiVersion: 4` exists in `@openui5/types@1.118.0`. If the type definition doesn't include it:

- **Option A**: Fall back to `apiVersion: 2` (safe; same semantic rendering, slightly less optimized).
- **Option B**: Keep `apiVersion: 4` and suppress the type error with a comment (if runtime verification confirms it works at 1.118).

Recommend Option A for a clean compile against 1.118 types.

### 5. Update version declarations

```diff
# packages/kiosk-keyboard/src/manifest.json
- "minUI5Version": "1.144.0"
+ "minUI5Version": "1.118.0"
```

```diff
# packages/kiosk-keyboard/src/.library
- <version>1.144.0</version>
+ <version>1.118.0</version>
```

### 6. Pin `@openui5/types` to 1.118

```diff
# root package.json (or per-package)
- "@openui5/types": "1.144.0"
+ "@openui5/types": "1.118.0"
```

This provides compile-time enforcement: any API not present at 1.118 produces a TypeScript error.

### 7. Testing strategy

| Layer            | Version     | Purpose                                           |
| ---------------- | ----------- | ------------------------------------------------- |
| TypeScript types | **1.118.0** | Compile-time: prevents >1.118 API usage in source |
| Dev server       | **1.144.0** | Convenient for local development                  |
| CI (primary)     | **1.144.0** | Main test run, forward compatibility              |
| CI (compat)      | **1.118.0** | Backward compat, catches runtime issues           |

Test source files (`test/`) use `Localization.getLanguage()` (1.120+), `XMLView.create()`, and other newer APIs. These don't ship and only need to work against the runtime they execute on. For the CI compat run against 1.118:

- QUnit unit tests: Should work since they mostly exercise the control API directly. Any test using `Localization.setLanguage()` would need a guard or skip on 1.118.
- E2e tests: Run against latest only (they test browser behavior, not API compat).

## Scope

### In scope

- Replace `Localization.getLanguageTag()` with `navigator.language` parsing (1 call site)
- Replace `Element.getElementById()` with `Element.registry.get()` (4 call sites)
- Replace `Element.getActiveElement()` with `document.activeElement` + `Element.closestTo()` (1 call site)
- Verify and potentially downgrade renderer `apiVersion` (1 declaration)
- Lower `minUI5Version` to 1.118 in `manifest.json` and `.library`
- Pin `@openui5/types` to 1.118 for compile-time enforcement
- Add CI compat test job against OpenUI5 1.118

### Out of scope

- Changing test files for 1.118 compat (tests don't ship)
- Supporting versions below 1.118 (would require replacing `Lib.init()` and `Lib.getResourceBundleFor()`)
- Changing the demo app's minimum version (it's a demo, not a published artifact)

## Considerations

- **`navigator.language` vs UI5 Localization**: When an app explicitly sets `sap-language=XX` in the URL, `navigator.language` won't reflect it but `Localization.getLanguageTag()` would. This is acceptable because `getLocaleLayout()` is a sensible default, and apps with explicit language requirements should set the `layout` property directly. Document this in the JSDoc.
- **`Element.registry` availability**: `Element.registry` has been public API since at least 1.80 and is used extensively in UI5's own codebase. It's not deprecated and won't be removed (it's the underlying store for all element registrations).
- **Shared types in monorepo**: If both libraries target 1.118, a single `@openui5/types@1.118.0` at the root works. If they diverge, move types to per-package `devDependencies`.
- **Renderer apiVersion fallback**: Going from 4 to 2 has no visual or functional impact. The difference is that apiVersion 4 can skip re-rendering when only the parent context changes. For a keyboard control that rarely has parent-context-only changes, this optimization is negligible.

## Migration

Non-breaking for consumers. The public API surface is unchanged; only internal implementation details change. The lower `minUI5Version` strictly expands compatibility.
