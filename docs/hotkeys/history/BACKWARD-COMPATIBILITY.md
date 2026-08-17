# Feature: Backward Compatibility: Hotkeys Library

> Status: Rejected (2026-03-31). Declaring a floor above the API baseline is intentional; dropping to 1.118 is not a priority. The analysis below is written against the 1.144 floor of the time; the manifest declares 1.136.0 today, still above the 1.118 proposed here.

## Problem

The hotkeys library declares `minUI5Version: "1.144.0"` but its actual API surface only requires OpenUI5 **1.118**. This unnecessarily excludes consumers on older UI5 versions.

## Analysis

### Complete UI5 API inventory (source only)

| Module                       | APIs used                                                                                    | Since     |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| `sap/ui/core/Lib`            | `Lib.init({ apiVersion: 2, ... })`                                                           | **1.118** |
| `sap/ui/base/DataType`       | `DataType.registerEnum()`                                                                    | < 1.60    |
| `sap/ui/base/Object`         | `extends BaseObject`, `super()`, `super.destroy()`, `static metadata`                        | < 1.60    |
| `sap/base/Log`               | `Log.info()`, `.debug()`, `.warning()`, `.error()`                                           | < 1.60    |
| `sap/ui/core/routing/Router` | **Type-only** import; duck-typed `attachBeforeRouteMatched()` / `detachBeforeRouteMatched()` | < 1.30    |
| `sap/m/InstanceManager`      | **Lazy** via `sap.ui.require()` sync probe; `hasOpenDialog()`, `hasOpenPopover()`            | < 1.60    |

Global APIs:

| API                                   | File               | Purpose                                           |
| ------------------------------------- | ------------------ | ------------------------------------------------- |
| `sap.ui.require(module)` (sync probe) | `HotkeyManager.ts` | Lazy-loads `validate` and `sap/m/InstanceManager` |

### Version floor

**`sap/ui/core/Lib` (since 1.118)** is the only version-constraining API. Everything else predates 1.60.

### Source files with zero direct UI5 dependency

`constants.ts`, `idgen.ts`, `types.ts`, `match.ts`, `validate.ts`, `HotkeyRecorder.ts`, `RegistrationGroup.ts`, these files import no UI5 modules at all (some import the `Platform` enum from `library.ts`, which triggers `Lib.init()` as a side effect but calls no UI5 APIs themselves).

### Conclusion

**No source code changes required.** The hotkeys library is already fully compatible with OpenUI5 1.118.

## Proposal

### 1. Lower `minUI5Version` in manifest

```diff
# packages/hotkeys/src/manifest.json
- "minUI5Version": "1.144.0"
+ "minUI5Version": "1.118.0"
```

### 2. Pin `@openui5/types` to 1.118 for compile-time enforcement

Use the 1.118 type definitions so TypeScript catches any accidental use of >1.118 APIs:

```diff
# root package.json (or packages/hotkeys/package.json devDependencies)
- "@openui5/types": "1.144.0"
+ "@openui5/types": "1.118.0"
```

This is the enforcement mechanism: if a developer imports `Element.getElementById()` (1.119+), TypeScript will error because the type definition doesn't exist at 1.118.

### 3. Keep `ui5.yaml` framework version at latest for development

```yaml
# packages/hotkeys/ui5.yaml - no change
framework:
  name: OpenUI5
  version: "1.144.0" # dev server uses latest
```

The UI5 CLI framework version controls which runtime the dev server serves. We keep latest for comfortable development. The types pin (step 2) prevents using APIs that don't exist at 1.118.

### 4. Update `.library` minimum version

```diff
# packages/hotkeys/src/.library
- <version>1.144.0</version>
+ <version>1.118.0</version>
```

Ensure both `manifest.json` and `.library` declare the same minimum.

### 5. Testing strategy

| Layer            | Version     | Purpose                                          |
| ---------------- | ----------- | ------------------------------------------------ |
| TypeScript types | **1.118.0** | Compile-time: prevents >1.118 API usage          |
| Dev server       | **1.144.0** | Convenient for local development                 |
| CI (primary)     | **1.144.0** | Main test run, ensures forward compatibility     |
| CI (compat)      | **1.118.0** | Backward compat run, catches runtime-only issues |

The CI compat run can override the framework version:

```bash
# In CI workflow
npx ui5 serve --framework-version 1.118.0 &
# then run wdio tests against it
```

Or use a separate `ui5-compat.yaml` that pins `version: "1.118.0"`.

Test source files (in `test/`) do **not** need to be 1.118-compatible since they don't ship to consumers. They only need to work with whatever runtime they execute against. For the 1.118 CI run, the tests use the same basic QUnit/DOM APIs that haven't changed.

## Scope

### In scope

- Lower `minUI5Version` from 1.144 to 1.118 in `manifest.json` and `.library`
- Pin `@openui5/types` to 1.118.0 for compile-time enforcement
- Add CI compat test job against OpenUI5 1.118
- Update published package metadata if version is declared elsewhere

### Out of scope

- Changing any source code (not needed)
- Supporting versions below 1.118 (would require replacing `Lib.init()` with the deprecated `sap.ui.getCore().initLibrary()` pattern)
- Backporting the library to non-TypeScript (transpiled output is ES module, works everywhere)

## Considerations

- **Types version vs runtime version**: Pinning types to 1.118 means IDE autocompletion won't show newer APIs. This is intentional. It is a feature, not a bug. Developers get immediate feedback when they accidentally use a too-new API.
- **Type definitions availability**: Verify that `@openui5/types@1.118.0` exists on npm and includes the `sap/ui/core/Lib` typings. If that exact patch version doesn't exist, use the closest available 1.118.x version.
- **Shared types in monorepo**: If `@openui5/types` is shared at the root level, pinning to 1.118 would also constrain the kiosk-keyboard library. Consider moving it to per-package `devDependencies` if the two libraries need different minimum versions.

## Migration

Non-breaking. This only lowers the declared minimum version. Existing consumers on 1.144 are unaffected.
