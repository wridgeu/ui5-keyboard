# Deep Dive: `as const` / UI5 Transpile Crash in the Layout Aggregation Module

> [!NOTE]
> Historical post-mortem. The aggregation module that triggered this crash no longer exists in this form: built-in layouts are now aggregated in `internal/layout-registry.ts` as a plain `new Map([...])`, which structurally cannot hit the `Object.assign(Object.create(null))` export-collapse path described below, and there is no longer a `layouts/index.ts`. The analysis is retained for the underlying `babel-plugin-transform-modules-ui5` edge case, which still applies to any module combining a default export and a named export whose default value is built from `Object.assign(Object.create(null), { ... })`.

## Executive Summary

The crash was **not** caused by TypeScript `as const` semantics themselves.

The root cause is a bug/edge case in `babel-plugin-transform-modules-ui5` (used by `ui5-tooling-transpile`) in the export-collapsing path.

It is triggered when all of the following are true:

1. The module has a default export **and** at least one named export.
2. The default export resolves to a value built from `Object.assign(Object.create(null), { ... })`.
3. Export collapsing is active (default behavior unless `noExportCollapse` is enabled).

`as const` was present in the original file, but removing `as const` still reproduces the same crash.

## Symptom

Build failed at transpile time with:

`Cannot read properties of undefined (reading 'key')`

Stack trace points to:

- `node_modules/babel-plugin-transform-modules-ui5/dist/modules/helpers/exports.js:77`

## What Actually Broke

### The relevant plugin code path

In `exports.js`, function `filterOutExportsWhichAlreadyMatchPropsOnDefault` loops over properties discovered on the default export and assumes each item is an object with `.key`:

- `node_modules/babel-plugin-transform-modules-ui5/dist/modules/helpers/exports.js:77`

It does:

```js
if (!defaultExportProperty.key) {
  continue;
}
```

If `defaultExportProperty` is `undefined`, it crashes before the guard can help.

### Why `undefined` gets into that array

Property discovery comes from:

- `node_modules/babel-plugin-transform-modules-ui5/dist/utils/ast.js`

For `Object.assign(...)`, helper `getPropertiesOfObjectAssignOrExtendHelper` maps each argument:

- object literal args -> returns properties
- identifier args -> recursively resolves
- anything else -> returns `undefined`

Concrete locations in the built plugin (`dist`):

- `node_modules/babel-plugin-transform-modules-ui5/dist/utils/ast.js:127` starts `node.arguments.map(...)`
- `node_modules/babel-plugin-transform-modules-ui5/dist/utils/ast.js:128-133` only returns for `ObjectExpression` and `Identifier`
- no `else` return means call expressions like `Object.create(null)` become `undefined`
- that `undefined` is flattened and returned to the caller

With `Object.assign(Object.create(null), { ... })`, first arg is `Object.create(null)` (a call expression), so it contributes `undefined` to the collected list. Later, the export-collapsing loop touches `.key` on that `undefined` entry and crashes.

## Why Other `as const` Usages Do Not Crash

The crash depends on module/export shape, not on const assertions themselves.

`as const` in these places is fine because they do not hit this plugin path:

- plain object enum-style constants in `library.ts`
- constants in files without a conflicting default+named export merge shape
- modules where the default export is not derived from `Object.assign(Object.create(null), ...)`

## Why It Happened Only Here

It only happened in this module because it matched the problematic shape:

- Default export based on `Object.assign(Object.create(null), {...})`
- Plus named export (`DEFAULT_LAYOUT`)

Modules that have only default export (no named export) do not trigger this merge path the same way.

Modules that use `Object.assign({}, {...})` do not produce this specific `undefined` property entry.

## Why It Started Happening In This Repo

In this repo, the trigger came from a security hardening change.

Before hardening, `layouts/index.ts` used:

```ts
const layouts: Record<string, LayoutDefinition> = {
  qwerty,
  // ...
};
```

After hardening, it used:

```ts
const layouts: Record<string, LayoutDefinition> = Object.assign(Object.create(null), {
  qwerty,
  // ...
});
```

That change itself is valid. The crash appeared because the file still had a named export in the same module (`DEFAULT_LAYOUT`), which activated export collapse in the plugin.

## `noExportCollapse`: Behavior And Impact

`babel-plugin-transform-modules-ui5` has export collapsing enabled by default.

- internal behavior: `opts.collapse = !opts.noExportCollapse`
- code location: `dist/modules/helpers/wrapper.js`

When collapse is enabled and a file has both default + named exports, the plugin tries to merge named exports into the default export object for easier non-interop consumption.

### How to disable it

In `ui5.yaml` (`ui5-tooling-transpile`), pass plugin options via `transformModulesToUI5`:

```yaml
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      configuration:
        transformTypeScript:
          allowDeclareFields: true
        transformModulesToUI5:
          noExportCollapse: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      configuration:
        transformTypeScript:
          allowDeclareFields: true
        transformModulesToUI5:
          noExportCollapse: true
```

### Trade-offs

- **Collapse enabled (default):** named exports may be attached to default export value; convenient for some UI5/non-interop consumption patterns.
- **Collapse disabled:** returns an exports object (`__exports.default`, `__exports.named`) and avoids this collapse-specific crash path.

In this specific incident, setting `noExportCollapse: true` avoids the crash.

### Import/consumer impact (important)

For a module with mixed exports:

```ts
export const A = 1;
export default obj;
```

collapse **enabled** can return `obj` directly (with `A` attached):

```js
obj.A = A;
return obj;
```

collapse **disabled** returns an exports wrapper:

```js
var __exports = { __esModule: true };
__exports.A = A;
__exports.default = obj;
return __exports;
```

Implication:

- ES/TS imports that are also transpiled by the plugin generally keep working (interop unwraps default).
- Plain UI5 `sap.ui.define([...], function (mod) {})` consumers see a different runtime shape when collapse is off (`mod.default` for default export).

This is the main downside of turning collapse off globally.

### Quick mental model

- collapse **on**: plugin often returns the default value itself and mutates it with named exports
- collapse **off**: plugin returns an exports wrapper object with `default` + named exports
- native ESM: uses a module namespace object; default is at `.default`, named exports are separate live bindings

### Is this native ESM behavior?

Not exactly.

- `__esModule` is a Babel/CommonJS interop convention, not native ESM syntax or runtime semantics.
- native ESM does **not** mutate the default export value to attach named exports.
- collapse disabled (`noExportCollapse: true`) is generally closer to ESM-like shape for runtime objects (`.default` + named), but it is still transpiled interop, not the native ESM runtime.

## Is `as const` The Cause?

No. Reproduction proves this.

Both of these fail equally:

- `export const DEFAULT_LAYOUT = "qwerty" as const;`
- `export const DEFAULT_LAYOUT = "qwerty";`

The crash condition is the export/default-object shape, not the const assertion.

## Minimal Reproduction (local)

### Readable version

Create `tmp-repro-ui5-export-crash.js` with:

```js
const babel = require("@babel/core");
const plugin = require("babel-plugin-transform-modules-ui5");

const cases = [
  [
    "withAsConst",
    "const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;",
  ],
  [
    "withoutAsConst",
    "const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT='qwerty'; export default layouts;",
  ],
  [
    "typeLiteralAnnotation",
    "const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT:'qwerty'='qwerty'; export default layouts;",
  ],
  ["noNamedExport", "const layouts=Object.assign(Object.create(null),{a:1}); export default layouts;"],
  [
    "safeObjectAssign",
    "const layouts=Object.assign({}, {a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;",
  ],
  [
    "twoStepCreateAssign",
    "const layouts=Object.create(null); Object.assign(layouts,{a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;",
  ],
];

for (const [name, code] of cases) {
  try {
    babel.transformSync(code, {
      filename: `${name}.ts`,
      plugins: [plugin],
      parserOpts: { plugins: ["typescript"] },
    });
    console.log(`${name}: OK`);
  } catch (error) {
    console.log(`${name}: FAIL -> ${String(error.message).split("\n")[0]}`);
  }
}
```

Run:

```bash
node tmp-repro-ui5-export-crash.js
```

### Copy/paste one-liner

```bash
node -e "const babel=require('@babel/core'); const plugin=require('babel-plugin-transform-modules-ui5'); const cases=[['withAsConst',\"const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;\"],['withoutAsConst',\"const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT='qwerty'; export default layouts;\"],['typeLiteralAnnotation',\"const layouts=Object.assign(Object.create(null),{a:1}); export const DEFAULT_LAYOUT:'qwerty'='qwerty'; export default layouts;\"],['noNamedExport',\"const layouts=Object.assign(Object.create(null),{a:1}); export default layouts;\"],['safeObjectAssign',\"const layouts=Object.assign({}, {a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;\"],['twoStepCreateAssign',\"const layouts=Object.create(null); Object.assign(layouts,{a:1}); export const DEFAULT_LAYOUT='qwerty' as const; export default layouts;\"]]; for (const [name, code] of cases){ try{ babel.transformSync(code,{filename:name+'.ts',plugins:[plugin],parserOpts:{plugins:['typescript']}}); console.log(name+': OK'); } catch(e){ console.log(name+': FAIL -> '+String(e.message).split('\\n')[0]); } }"
```

Expected result:

- `withAsConst`: fail
- `withoutAsConst`: fail
- `typeLiteralAnnotation`: fail
- `noNamedExport`: pass
- `safeObjectAssign`: pass
- `twoStepCreateAssign`: pass

## Chosen Fix

At the time, the fix kept the aggregation module default-export-only and moved the named constant to its own module:

- `packages/kiosk-keyboard/src/layouts/default-layout.ts`

Consumers import the constant from that file. (The layout aggregation has since moved into `internal/layout-registry.ts` and is built with `new Map([...])`, so the null-prototype map and the `layouts/index.ts` module no longer exist.)

## Other Valid Fix Options

1. **Remove named export from that module entirely** and inline string literal at call sites.
   - Pros: simplest, avoids plugin path.
   - Cons: duplicates magic string.

2. **Keep same module but change default initializer** from `Object.assign(Object.create(null), {...})` to `Object.assign({}, {...})`.
   - Pros: avoids crash.
   - Cons: changes runtime object prototype (may weaken hardening against prototype key collisions).

3. **Keep same runtime shape but avoid problematic expression form**:

   ```ts
   const layouts = Object.create(null) as Record<string, LayoutDefinition>;
   Object.assign(layouts, {
     qwerty,
     "qwertz-de": qwertzDe,
   });

   export const DEFAULT_LAYOUT = "qwerty";
   export default layouts;
   ```

   - Pros: preserves null-prototype map and can avoid the crash.
   - Cons: less compact; relies on current plugin behavior details.

4. **Patch or pin plugin/tooling** (upstream fix in `babel-plugin-transform-modules-ui5`).
   - Pros: addresses root in toolchain.
   - Cons: maintenance overhead; depends on external release cadence.

5. **Split exports by file** (current approach).
   - Pros: minimal runtime behavior change, robust, explicit.
   - Cons: one extra file/import.

## Upstream Fix Proposal

To fix this for everyone in `babel-plugin-transform-modules-ui5`, patching upstream should harden both places below:

1. **Defensive guard in collapse loop** (`exports.js`):

```js
if (!defaultExportProperty || !defaultExportProperty.key) {
  continue;
}
```

2. **Filter non-property values at source** (`ast.js`), e.g. in `getPropertiesOfObjectAssignOrExtendHelper`:

```js
return flatten(mappedArgs).filter(Boolean);
```

The first change prevents the crash; the second prevents malformed arrays from propagating.

## TypeScript Guidance Context

Current TS guidance still treats `as const` as valid for literal narrowing and readonly intent. TS 5.x adds `const` type parameters to reduce call-site `as const` in generic APIs, but it does not deprecate `as const`.

So in this incident, TypeScript best practice did not conflict by itself; the failing interaction was with the UI5 Babel export-collapsing logic.

## Practical Rule For This Repo

Avoid this exact pattern in one module:

- default export based on `Object.assign(Object.create(null), ...)`
- plus named exports in same file

If both are needed, split the named exports into a separate module.
