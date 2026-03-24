# Patches

Local patches applied via [patch-package](https://github.com/ds300/patch-package) to fix upstream issues in dependencies. These are applied automatically on `npm install` via the `postinstall` script.

## @ui5/webcomponents-tools+2.20.0

Fixes four bugs in the Custom Elements Manifest (CEM) generation tooling.

### Bug 1: `alphabetical-sort-plugin` sorts method parameters

**File:** `lib/cem/custom-elements-manifest.config.mjs`

The `alphabetical-sort-plugin` recursively sorts every array in the CEM by `name`, including `parameters` arrays. Method parameters are positional; their array order must match the function signature's declaration order. The sort destroys this, producing incorrect method signatures in VS Code custom data, JetBrains web-types, and any documentation generated from the CEM.

**Example:** `registerLayout(sName, oDefinition)` becomes `registerLayout(oDefinition, sName)` in the CEM because `o` sorts before `s`.

This also affects the upstream UI5 Web Components themselves (e.g., `UI5Element.fireEvent` parameters are reversed in their own CEM).

In theory, parameter order in the CEM should not matter: each parameter object carries its own `name`, `type`, and other identifying properties, so consumers could identify parameters by these properties rather than by position. However, without the `rest: true` fix ([Bug 2](#bug-2-rest-parameters-not-emitted-in-cem)), a rest parameter that gets sorted out of its trailing position would be indistinguishable from a regular parameter, since the `rest` property that marks it as variadic was never emitted. The combination of both bugs means a sorted rest parameter silently loses its variadic semantics.

**Fix:** Skip sorting for `parameters` and `mixins` arrays (both are order-dependent per the CEM spec).

```diff
 for (const key in obj) {
     if (Array.isArray(obj[key])) {
-        sortByName(obj[key]);
+        // Skip sorting for order-dependent arrays (parameter position,
+        // mixin application order) per CEM spec constraints.
+        if (key !== "parameters" && key !== "mixins") {
+            sortByName(obj[key]);
+        }
         obj[key].forEach(item => sortArraysInObject(item));
```

### Bug 2: Rest parameters not emitted in CEM

**File:** `lib/cem/patch/@custom-elements-manifest/analyzer/src/features/analyse-phase/creators/createFunctionLike.js`

The `handleParametersAndReturnType` function builds parameter objects from the TypeScript AST but never checks `param.dotDotDotToken` (the AST node for `...` rest syntax). The CEM schema defines a `rest: boolean` property on `Parameter` for this purpose, but it is never populated. This compounds with [Bug 1](#bug-1-alphabetical-sort-plugin-sorts-method-parameters): if parameters are sorted alphabetically and the `rest` flag is missing, a variadic trailing parameter can be moved to any position with no remaining signal that it was variadic.

**Fix:** Check `param.dotDotDotToken` and emit `rest: true` when present.

```diff
     if(param?.questionToken) {
       parameter.optional = true;
     }

+    if(param?.dotDotDotToken) {
+      parameter.rest = true;
+    }
+
     if(param?.type) {
       parameter.type = {text: param.type.getText() }
     }
```

### Bug 3: Same-name static and instance methods share a single AST lookup

**File:** `lib/cem/custom-elements-manifest.config.mjs`

The `processClass` function looks up TypeScript AST nodes by `name` only. When a class has both a `static` and a non-static method with the same name, `find()` always returns the first match. The instance method's AST node is never found, so its parameters, return type, and JSDoc enrichment are skipped entirely.

We originally exposed layout registry methods as both static and instance methods with the same name. This mirroring pattern triggered the bug. We have since removed the instance delegates to align with the UI5 Web Components convention, where registry operations are always static-only (see `DynamicDateRange.register()`, `TabContainer.registerTabStyles()`).

While the flawed API design on our side surfaced this bug, the underlying issue in the CEM plugin is still a real defect: any component that legitimately has both a static and instance method with the same name (which TypeScript and JavaScript allow) will produce incorrect CEM output. The patch remains in place for correctness.

**Fix:** Add a `static` modifier check to the `find()` predicate.

```diff
-const classNodeMember = classNode.members?.find(nodeMember => nodeMember.name?.text === member?.name && nodeMember.jsDoc?.[0]);
+const classNodeMember = classNode.members?.find(nodeMember => nodeMember.name?.text === member?.name && nodeMember.jsDoc?.[0] && (!!member.static === !!(nodeMember.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword))));
```

### Bug 4: Getter/setter properties resolve to `any` in attribute types

**File:** `lib/cem/custom-elements-manifest.config.mjs`

When a component property is implemented as a getter/setter pair (instead of a direct field declaration), the attribute type resolver fails to find the AST node and falls back to `"any"`. `ts.isPropertyDeclaration()` only matches field declarations, not `GetAccessorDeclaration` or `SetAccessorDeclaration` nodes.

This also affects the upstream UI5 Web Components (e.g., `Dialog.open` shows `"any"` in their CEM).

**Fix:** Extend the predicate to also match accessor declarations.

```diff
-const tsProgramMember = tsProgramClassNode.members.find(m => ts.isPropertyDeclaration(m) && m.name?.text === member.name);
+const tsProgramMember = tsProgramClassNode.members.find(m => (ts.isPropertyDeclaration(m) || ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) && m.name?.text === member.name);
```

### Upstream

Repository: https://github.com/SAP/ui5-webcomponents

To draft a GitHub issue based on these patches, run:

```
npx patch-package @ui5/webcomponents-tools --create-issue
```

These patches should be removed once the upstream issues are resolved.
