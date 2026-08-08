# Patches

Local patches applied via [patch-package](https://github.com/ds300/patch-package) to fix upstream issues in dependencies. These are applied automatically on `npm install` via the `postinstall` script.

## @ui5/webcomponents-tools+2.22.0

Fixes five bugs in the Custom Elements Manifest (CEM) generation tooling.

**Pinned at 2.22.0:**

The patch applies cleanly to the pristine `2.22.0` package as published on npm (patch-package warns when the filename version does not match the installed version, so a clean `npm install` confirms it); none of the five bugs were fixed upstream across the `2.20.0` → `2.22.0` bumps. The patch filename tracks the pinned version.

**Note on upstream ownership:**

`@ui5/webcomponents-tools` ships a bundled, patched copy of the community `@custom-elements-manifest/analyzer` under `lib/cem/patch/`. Bugs 1, 3, and 4 are in SAP's own `lib/cem/custom-elements-manifest.config.mjs` and can be filed directly against [UI5/webcomponents](https://github.com/UI5/webcomponents). Bugs 2 and 5 are in the bundled analyzer copy (`lib/cem/patch/@custom-elements-manifest/analyzer/`) which originates from [open-wc/custom-elements-manifest](https://github.com/open-wc/custom-elements-manifest). SAP can apply these to their bundled copy, but the root fix belongs in the community repo.

### Bug 1: `alphabetical-sort-plugin` sorts method parameters

**File:** `lib/cem/custom-elements-manifest.config.mjs`

The `alphabetical-sort-plugin` recursively sorts every array in the CEM by `name`, including `parameters` arrays. Method parameters are positional; their array order must match the function signature's declaration order. The sort destroys this, producing incorrect method signatures in VS Code custom data, JetBrains web-types, and any documentation generated from the CEM.

**Example:** `UI5Element.fireDecoratorEvent(name, data)` becomes `fireDecoratorEvent(data, name)` in the CEM because `d` sorts before `n`.

No public method of this component takes more than one parameter, so the reordering only hits inherited `UI5Element` members.

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

The underlying issue in the CEM plugin is a real defect: any component that legitimately has both a static and instance method with the same name (which TypeScript and JavaScript allow) will produce incorrect CEM output. The patch remains in place for correctness.

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

**Example:** `{@link KioskKeyboard.getLocaleLayout getLocaleLayout}` becomes `KioskKeyboard.getLocaleLayoutgetLocaleLayout` in the CEM output.

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

Repository: https://github.com/UI5/webcomponents.

These patches should be removed once the upstream issues are resolved. As of `@ui5/webcomponents-tools@2.22.0` all five bugs are still present upstream.

## less-openui5+0.11.6

Adds `@container` and `@layer` at-rule support to the vendored LESS 1.6.3 parser, and resolves the parent selector inside conditional group rules.

**Pinned at 0.11.6:** exact, like `@ui5/webcomponents-tools` above. A range would let `npm update` move the installed version in the lockfile alone, leaving the patch filename claiming a version that is no longer installed; patch-package would warn and apply anyway. The pin keeps any move off 0.11.6 a reviewable `package.json` diff. `@ui5/builder`'s own `^0.11.6` edge floats independently, which is what `apply-nested.mjs`'s vendored-fork-version gate exists to catch.

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

`tree.Directive` gives every other at-rule's block a `null` selector list and marks it as a root ruleset, so a style rule nested inside it renders with the parent selector dropped: `.ui5KioskKey { @container (…) { &[data-has-variants]::after { … } } }` compiles to a page-global `[data-has-variants]::after`. Since a UI5 library stylesheet is loaded page-globally, that silently matches arbitrary host-page elements. Conditional group rules (`@supports`, `@container`, `@layer`) instead take the parent reference `tree.Media` already uses (`emptySelectors()`, plus the `mediaEmpty` flag so the selector is not mistaken for a bare `&`) and are no longer marked as root, which makes them resolve `&` exactly like `@media`. Non-grouping at-rules (`@keyframes`, `@font-face`, …) own their block contents and keep the original behavior. The hunk changes the output of nested conditional group rules and nothing else: compiling the kiosk stylesheet with and without it, every other rule is byte-identical, including its top-level `@layer kiosk-keyboard` wrapper, which stays at the top level rather than gaining a parent reference.

**Regression test:** `node patches/less-openui5-test.mjs` compiles a fixture with all directive types and verifies correct output, including that all four conditional group rules keep their enclosing selector and that no nested rule reaches the top level unscoped.

**Note:**

`patch-package` only patches the hoisted `node_modules/less-openui5/`. The UI5 builder resolves additional nested copies under each `@ui5/cli` install (currently one, at `node_modules/@ui5/cli/node_modules/less-openui5/`) that `patch-package` cannot reach. The `postinstall` script runs `patches/apply-nested.mjs` to sync the patched files into every nested copy it finds; it skips (with a warning) any nested copy whose vendored LESS fork version differs from the hoisted one. That gate reads the fork version from `lib/thirdparty/less/index.js` rather than the `less-openui5` package version, which moves independently of the parser the patch rewrites. `npm dedupe` does not eliminate the duplication.

**Why not patch-package's native nested patches (verdict, 2026-06-11):**

patch-package does support nested dependency patches via the `parent/child` syntax (`npx patch-package @ui5/cli/less-openui5`, producing a `@ui5+cli++less-openui5+<version>.patch` file), but that path resolves strictly relative to the directory patch-package runs in: it reaches only `node_modules/@ui5/cli/node_modules/less-openui5` under the invoking root.

That path exists in the current tree, so the native syntax would resolve. It is still the wrong tool: where npm puts `@ui5/cli` is a hoisting decision this repo does not declare, and it has already moved once — an earlier install carried no root-level `@ui5/cli` and a separate nested copy under each of three workspace packages. A patch cut against the root path would have covered nothing there, and one cut against the per-package paths covers nothing here. Covering every location natively means running patch-package once per workspace directory: a bespoke wrapper again, plus hard failures in the workspaces that carry no nested copy.

The dynamic-discovery script stays because it is indifferent to where the copy lands: it searches the root and every package, syncing whatever it finds. `patches/less-openui5-test.mjs` mirrors that search, so a broken sync fails `npm run test:patches` instead of a later theme build.

> **Why not more?**
>
> The vendored LESS 1.6.3 has other gaps compared to modern CSS: `&` is still not resolved inside `:not()`, so a nested selector like `&--cq-short:not(&--numpad)` outputs invalid CSS. That one lives in the selector compilation pipeline rather than in a single tree node, so it stays unpatched; the workaround is writing the full class name instead. The full fix belongs in an upstream LESS version update.

### Upstream

Repository: https://github.com/SAP/less-openui5

Upstream PR: https://github.com/SAP/less-openui5/pull/453

This patch should be removed once less-openui5 updates its vendored LESS parser.
