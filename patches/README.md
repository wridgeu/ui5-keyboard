# Patches

Local patches applied via [patch-package](https://github.com/ds300/patch-package) to fix upstream issues in dependencies. These are applied automatically on `npm install` via the `postinstall` script.

## @ui5/webcomponents-tools+2.20.0

Fixes five bugs in the Custom Elements Manifest (CEM) generation tooling.

**Note on upstream ownership:** `@ui5/webcomponents-tools` ships a bundled, patched copy of the community `@custom-elements-manifest/analyzer` under `lib/cem/patch/`. Bugs 1, 3, and 4 are in SAP's own `lib/cem/custom-elements-manifest.config.mjs` and can be filed directly against [SAP/ui5-webcomponents](https://github.com/SAP/ui5-webcomponents). Bugs 2 and 5 are in the bundled analyzer copy (`lib/cem/patch/@custom-elements-manifest/analyzer/`) which originates from [open-wc/custom-elements-manifest](https://github.com/open-wc/custom-elements-manifest). SAP can apply these to their bundled copy, but the root fix belongs in the community repo.

### Bug 1: `alphabetical-sort-plugin` sorts method parameters

**File:** `lib/cem/custom-elements-manifest.config.mjs`

The `alphabetical-sort-plugin` recursively sorts every array in the CEM by `name`, including `parameters` arrays. Method parameters are positional; their array order must match the function signature's declaration order. The sort destroys this, producing incorrect method signatures in VS Code custom data, JetBrains web-types, and any documentation generated from the CEM.

**Example:** `registerLayout(sName, oDefinition)` becomes `registerLayout(oDefinition, sName)` in the CEM because `o` sorts before `s`.

This also affects the upstream UI5 Web Components themselves (e.g., `UI5Element.fireEvent` parameters are reversed in their own CEM).

In theory, parameter order in the CEM should not matter: each parameter object carries its own `name`, `type`, and other identifying properties, so consumers could identify parameters by these properties rather than by position. However, without the `rest: true` fix ([Bug 2](#bug-2-rest-parameters-not-emitted-in-cem)), a rest parameter that gets sorted out of its trailing position would be indistinguishable from a regular parameter, since the `rest` property that marks it as variadic was never emitted. The combination of both bugs means a sorted rest parameter silently loses its variadic semantics.

**Fix:** Skip sorting for `parameters` and `mixins` arrays. Mixin order is mandated by the CEM schema; parameter order is consumed positionally by IDE completions and documentation generators.

```diff
 for (const key in obj) {
     if (Array.isArray(obj[key])) {
-        sortByName(obj[key]);
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

### Bug 5: `{@link}` inline tags concatenate target and display text

**Files:**

- `lib/cem/patch/@custom-elements-manifest/analyzer/src/features/analyse-phase/creators/handlers.js`
- `lib/cem/patch/@custom-elements-manifest/analyzer/src/features/analyse-phase/class-jsdoc.js`

When a JSDoc description contains `{@link Target display}`, TypeScript's AST represents the inline tag as a node with `name` (the target reference) and `text` (the display text). The analyzer concatenates both without a separator, producing `Targetdisplay` in the CEM description.

**Example:** `{@link KioskKeyboard.registerLocaleLayout registerLocaleLayout}` becomes `KioskKeyboard.registerLocaleLayoutregisterLocaleLayout` in the CEM output.

The same bug exists in both `handlers.js` (member descriptions) and `class-jsdoc.js` (class descriptions). Both files use the identical pattern.

**Fix:** For inline link tags, use the display text when present, otherwise fall back to the target name.

```diff
-doc.description = jsDocComment.comment.map(com => `${safe(() => com?.name?.getText()) ?? ''}${com.text}`).join('');
+doc.description = jsDocComment.comment.map(com => {
+  const name = safe(() => com?.name?.getText());
+  return name ? (com.text?.trim() || name) : (com.text ?? '');
+}).join('');
```

### Upstream

Repository: https://github.com/SAP/ui5-webcomponents

These patches should be removed once the upstream issues are resolved.

## less-openui5+0.11.6

Adds `@container` and `@layer` at-rule support to the vendored LESS 1.6.3 parser.

**Files:**

- `lib/thirdparty/less/parser.js`
- `lib/thirdparty/less/tree/directive.js`

The vendored LESS 1.6.3 parser has a switch statement of recognized CSS at-rules (`@media`, `@supports`, `@keyframes`, etc.) that it passes through as block directives. `@container` and `@layer` are not in the list, so using them in LESS causes a parse error.

The patch adds both directives to the recognized list and handles all `@layer` syntax forms:

- `@layer name { ... }` (named block)
- `@layer { ... }` (anonymous block)
- `@layer name1, name2;` (ordering statement)
- `@layer framework.layout { ... }` (dotted namespace)

The approach follows the modern LESS 4.x parser (PRs #4337, #4340, #4349, #4351) adapted to the 1.6.3 architecture. The identifier regex is widened from `/^[^{]+/` to `/^[^{;]+/` so it stops at semicolons (for ordering statements). A fallback after failed block parsing handles the semicolon-terminated ordering form. The `genCSS` method in `directive.js` is adjusted to skip the leading space for empty-value directives.

**Regression test:** `node patches/less-openui5-test.mjs` compiles a fixture with all directive types and verifies correct output.

**Note:** `patch-package` only patches the hoisted `node_modules/less-openui5/`. The UI5 builder resolves a second nested copy at `node_modules/@ui5/cli/node_modules/less-openui5/` that `patch-package` cannot reach. The `postinstall` script runs `patches/apply-nested.mjs` to sync the patched files to the nested copy. `npm dedupe` does not eliminate the duplication.

> **Why only `@container` and `@layer`?** The vendored LESS 1.6.3 has other gaps compared to modern CSS (e.g., `&` is not resolved inside `:not()`, making nested selectors like `&--cq-short:not(&--numpad)` output invalid CSS). Patching the parent-selector resolution would require changes throughout the parser's selector compilation pipeline -- significantly more invasive than adding two case labels to a switch statement. `@container` and `@layer` follow the existing directive pattern exactly, making them safe and minimal patches. For `&`-in-`:not()`, the workaround is writing the full class name instead. The full fix belongs in an upstream LESS version update.

### Upstream

Repository: https://github.com/SAP/less-openui5

Upstream PR: https://github.com/SAP/less-openui5/pull/453

This patch should be removed once less-openui5 updates its vendored LESS parser.
