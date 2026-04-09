# Architecture Simplification: Flatten Class, Reduce Layouts, Remove Bridge

**Goal:** Simplify the `kiosk-keyboard-webc` package by eliminating the re-export chain that breaks the CEM/tooling-native path, reducing shipped layouts to primary ones, and removing the manual bridge demo in favor of documentation.

**Architecture:** The class body moves from `KioskKeyboardCore.ts` into `KioskKeyboard.ts` directly, eliminating the re-export that the CEM analyzer can't follow. Combined layouts (`qwerty-fk`, `qwertz-de-nav`, etc.) move to demo scenarios showing consumers how to compose layouts. The manual bridge demo page is removed; the bridge pattern is documented as a reference in the README.

**Tech Stack:** UI5 Web Components (`UI5Element`), `@ui5/webcomponents-tools` CEM analyzer, `ui5-tooling-modules`, TypeScript, Vitest

---

## File Map

### Files to DELETE

- `packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts` (class moves to KioskKeyboard.ts)
- `packages/kiosk-keyboard-webc/src/layouts/qwerty-fk.ts` (demoted to demo)
- `packages/kiosk-keyboard-webc/src/layouts/qwertz-de-fk.ts` (demoted to demo)
- `packages/kiosk-keyboard-webc/src/layouts/qwerty-nav.ts` (demoted to demo)
- `packages/kiosk-keyboard-webc/src/layouts/qwertz-de-nav.ts` (demoted to demo)
- `packages/kiosk-keyboard-webc/fix-cem.mjs` (no longer needed)
- `packages/kiosk-keyboard-webc/test/unit/core-entry.test.ts` (no core entry)
- `packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts` (no lean path)
- `packages/kiosk-keyboard-webc/test/pages/consume-core.html` (no core entry)
- `packages/demo-app/webapp/control/KioskKeyboardWebc.ts` (bridge removed)
- `packages/demo-app/webapp/controller/KioskWebComponent.controller.ts` (bridge removed)
- `packages/demo-app/webapp/view/KioskWebComponent.view.xml` (bridge removed)
- `packages/demo-app/.gitignore` (webapp/lib/ no longer needed)
- `tools/copy-webc-bundle.mjs` (bridge prestart no longer needed)

### Files to CREATE

- `packages/demo-app/webapp/controller/KioskCustomLayouts.controller.ts`: may need modification to show combined layout composition (check existing)

### Files to MODIFY

- `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`: absorb class body from KioskKeyboardCore.ts
- `packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx`: update import path
- `packages/kiosk-keyboard-webc/src/bundle.esm.ts`: update re-export path
- `packages/kiosk-keyboard-webc/package.json`: remove `./core` export
- `packages/kiosk-keyboard-webc/package-scripts.mjs`: remove fixCEM step
- `packages/kiosk-keyboard-webc/test/unit/middleware-integration.test.ts`: update import
- `packages/kiosk-keyboard-webc/test/unit/entry-points.test.ts`: remove core entry test
- `packages/demo-app/package.json`: remove prestart hook
- `packages/demo-app/webapp/manifest.json`: remove bridge route/target
- `packages/demo-app/webapp/constants.ts`: remove bridge scope
- `packages/demo-app/webapp/model/fixtures/state.json`: remove bridge entry, update tooling entry
- `packages/demo-app/webapp/view/KioskWebComponentTooling.view.xml`: rename (sole web component page)
- `packages/demo-app/webapp/controller/KioskWebComponentTooling.controller.ts`: rename
- `packages/demo-app/README.md`: remove bridge section, add bridge-as-reference docs
- `packages/kiosk-keyboard-webc/test/pages/README.md`: remove consume-core reference
- `packages/kiosk-keyboard-webc/README.md`: remove core entry docs
- `docs/web-component-consumption.md`: update for single entry, keep historical notes
- `patches/README.md`: note path-normalization patch may no longer be needed
- `tools/check-demo-webc-bundle.mjs`: remove bridge-specific checks

---

## Tasks

### Task 1: Flatten the class (eliminate re-export)

Move the full class body from `KioskKeyboardCore.ts` into `KioskKeyboard.ts`, keeping layout imports at the top and the class below them.

**Files:**

- Delete: `packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts`
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx` (line 1: `import type KioskKeyboard from "./KioskKeyboardCore.js"` -> `"./KioskKeyboard.js"`)
- Modify: `packages/kiosk-keyboard-webc/src/bundle.esm.ts` (line 20: re-export `KioskKeyboardDomContract` from `"./KioskKeyboard.js"`, already correct)

- [ ] **Step 1: Create the merged `KioskKeyboard.ts`**

Open `KioskKeyboardCore.ts` and `KioskKeyboard.ts`. Create the new `KioskKeyboard.ts` that has:

1. All imports from `KioskKeyboardCore.ts` (lines 5-44)
2. The layout side-effect imports (from current `KioskKeyboard.ts` lines 7-22), minus the 4 combined layouts being demoted
3. The entire class body from `KioskKeyboardCore.ts` (lines 46-1755)
4. The type exports that were on `KioskKeyboard.ts` (the `CompositionMiddleware` and `KioskKeyboardDomContract` types)

The combined layouts to REMOVE from the import list:

```typescript
// DELETE these four:
import "./layouts/qwerty-fk.js";
import "./layouts/qwertz-de-fk.js";
import "./layouts/qwerty-nav.js";
import "./layouts/qwertz-de-nav.js";
```

- [ ] **Step 2: Update template import**

In `KioskKeyboardTemplate.tsx` line 1, change:

```typescript
import type KioskKeyboard from "./KioskKeyboardCore.js";
```

to:

```typescript
import type KioskKeyboard from "./KioskKeyboard.js";
```

- [ ] **Step 3: Delete `KioskKeyboardCore.ts`**

```bash
git rm packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts
```

- [ ] **Step 4: Run typecheck to verify**

```bash
npm run typecheck:kiosk-webc
```

Expected: PASS (no errors)

- [ ] **Step 5: Commit**

```bash
git add -A packages/kiosk-keyboard-webc/src/
git commit -m "refactor(kiosk-keyboard-webc): flatten class into KioskKeyboard.ts

Move the full class body from KioskKeyboardCore.ts into KioskKeyboard.ts,
eliminating the re-export chain that the CEM analyzer cannot follow.
The CEM now places the custom-element-definition on the main entry natively."
```

---

### Task 2: Remove `./core` export and CEM fix tooling

**Files:**

- Modify: `packages/kiosk-keyboard-webc/package.json`: remove `"./core"` export block
- Delete: `packages/kiosk-keyboard-webc/fix-cem.mjs`
- Modify: `packages/kiosk-keyboard-webc/package-scripts.mjs`: remove `fixCEM` step from `generateAPI`

- [ ] **Step 1: Remove `./core` export from package.json**

In `packages/kiosk-keyboard-webc/package.json`, delete this block from the `exports` field:

```json
"./core": {
  "types": "./dist/KioskKeyboardCore.d.ts",
  "default": "./dist/KioskKeyboardCore.js"
},
```

- [ ] **Step 2: Delete fix-cem.mjs**

```bash
git rm packages/kiosk-keyboard-webc/fix-cem.mjs
```

- [ ] **Step 3: Remove fixCEM from package-scripts.mjs**

In `packages/kiosk-keyboard-webc/package-scripts.mjs`, change:

```javascript
default: "ui5nps generateAPI.generateCEM generateAPI.validateCEM generateAPI.fixCEM",
```

to:

```javascript
default: "ui5nps generateAPI.generateCEM generateAPI.validateCEM",
```

And remove the `fixCEM` property entirely.

- [ ] **Step 4: Rebuild and verify CEM is correct natively**

```bash
npm run build:kiosk-webc
node -e "const d=JSON.parse(require('fs').readFileSync('packages/kiosk-keyboard-webc/dist/custom-elements.json','utf8')); const m=d.modules.find(m=>m.path==='dist/KioskKeyboard.js'); console.log(m.exports.map(e=>e.kind+' '+e.name))"
```

Expected: The output includes both `js default` AND `custom-element-definition kiosk-keyboard` on `dist/KioskKeyboard.js`. No post-processing needed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(kiosk-keyboard-webc): remove core export and CEM fix tooling

The class flattening makes the CEM analyzer produce correct output natively.
The ./core export path and fix-cem.mjs post-processing are no longer needed."
```

---

### Task 3: Delete combined layout source files

**Files:**

- Delete: `packages/kiosk-keyboard-webc/src/layouts/qwerty-fk.ts`
- Delete: `packages/kiosk-keyboard-webc/src/layouts/qwertz-de-fk.ts`
- Delete: `packages/kiosk-keyboard-webc/src/layouts/qwerty-nav.ts`
- Delete: `packages/kiosk-keyboard-webc/src/layouts/qwertz-de-nav.ts`

- [ ] **Step 1: Delete the four combined layout files**

```bash
git rm packages/kiosk-keyboard-webc/src/layouts/qwerty-fk.ts
git rm packages/kiosk-keyboard-webc/src/layouts/qwertz-de-fk.ts
git rm packages/kiosk-keyboard-webc/src/layouts/qwerty-nav.ts
git rm packages/kiosk-keyboard-webc/src/layouts/qwertz-de-nav.ts
```

- [ ] **Step 2: Verify no dangling imports**

```bash
cd packages/kiosk-keyboard-webc && grep -rn "qwerty-fk\|qwertz-de-fk\|qwerty-nav\|qwertz-de-nav" src/ test/ --include="*.ts" --include="*.tsx"
```

Expected: No results (the imports were already removed from KioskKeyboard.ts in Task 1). If any remain, remove them.

- [ ] **Step 3: Run typecheck and tests**

```bash
npm run typecheck:kiosk-webc && npm run test:kiosk-webc
```

Expected: PASS. Some layout-registry tests may reference these layouts; check and update if needed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(kiosk-keyboard-webc): demote combined layouts to demo scenarios

Remove qwerty-fk, qwertz-de-fk, qwerty-nav, qwertz-de-nav from the
shipped package. These are composition examples, not primary layouts.
Consumers compose them via: [fkeyRow, ...qwerty]

Primary layouts remain: qwerty, qwertz-de, qwerty-es, numeric, special,
numpad, fkeys, nav, ja-romaji, ja-kana, arabic, ko-hangul.
Building blocks remain: fkey-row, nav-row."
```

---

### Task 4: Remove bridge demo scenario

**Files:**

- Delete: `packages/demo-app/webapp/control/KioskKeyboardWebc.ts`
- Delete: `packages/demo-app/webapp/controller/KioskWebComponent.controller.ts`
- Delete: `packages/demo-app/webapp/view/KioskWebComponent.view.xml`
- Delete: `packages/demo-app/.gitignore`
- Delete: `tools/copy-webc-bundle.mjs`
- Modify: `packages/demo-app/package.json`: remove `prestart` script
- Modify: `packages/demo-app/webapp/manifest.json`: remove bridge route and target
- Modify: `packages/demo-app/webapp/constants.ts`: remove `KioskWebComponent` scope
- Modify: `packages/demo-app/webapp/model/fixtures/state.json`: remove bridge entry

- [ ] **Step 1: Delete bridge files**

```bash
git rm packages/demo-app/webapp/control/KioskKeyboardWebc.ts
git rm packages/demo-app/webapp/controller/KioskWebComponent.controller.ts
git rm packages/demo-app/webapp/view/KioskWebComponent.view.xml
git rm packages/demo-app/.gitignore
git rm tools/copy-webc-bundle.mjs
```

- [ ] **Step 2: Remove prestart script from demo-app package.json**

In `packages/demo-app/package.json`, delete the `"prestart"` line entirely.

- [ ] **Step 3: Remove bridge route and target from manifest.json**

In `packages/demo-app/webapp/manifest.json`:

- Delete the route `"kioskWebComponent"` (pattern: `"kiosk/web-component"`)
- Delete the target `"kioskWebComponent"` (name: `"KioskWebComponent"`)

- [ ] **Step 4: Remove bridge scope from constants.ts**

In `packages/demo-app/webapp/constants.ts`, delete:

```typescript
KioskWebComponent: "kioskWebComponent",
```

- [ ] **Step 5: Remove bridge entry from state.json**

In `packages/demo-app/webapp/model/fixtures/state.json`, delete the Web Component (Bridge) entry:

```json
{
  "title": "Web Component (Bridge)",
  "description": "Manual WebComponent.extend() bridge with explicit bundle import and full property/event mapping.",
  "route": "kioskWebComponent"
},
```

And rename the remaining tooling entry from `"Web Component (Tooling)"` to `"Web Component"` since it's now the only one.

- [ ] **Step 6: Rename the tooling page to be the sole web component page**

The tooling page is now the only web component demo. Update its view title from `"Kiosk Keyboard - Tooling Native"` to `"Kiosk Keyboard - Web Component"` in `KioskWebComponentTooling.view.xml`.

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck:demo
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(demo): remove manual bridge scenario

The manual bridge (WebComponent.extend) is documented as a reference in
the README but no longer has a dedicated demo page. The tooling-native
path is the sole web component consumption demo.

The bridge required loading the standalone bundle outside ui5-tooling-modules
to avoid scoping conflicts. This workaround is documented in the consumption
architecture doc for consumers who need it."
```

---

### Task 5: Update tests

**Files:**

- Delete: `packages/kiosk-keyboard-webc/test/unit/core-entry.test.ts`
- Delete: `packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts`
- Delete: `packages/kiosk-keyboard-webc/test/pages/consume-core.html`
- Modify: `packages/kiosk-keyboard-webc/test/unit/middleware-integration.test.ts`: update import
- Modify: `packages/kiosk-keyboard-webc/test/unit/entry-points.test.ts`: remove core entry tests

- [ ] **Step 1: Delete core-specific test files**

```bash
git rm packages/kiosk-keyboard-webc/test/unit/core-entry.test.ts
git rm packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts
git rm packages/kiosk-keyboard-webc/test/pages/consume-core.html
```

- [ ] **Step 2: Update middleware-integration.test.ts**

The test imports `../../src/KioskKeyboard.js` (already correct from our earlier fix). Verify no references to `KioskKeyboardCore` remain.

- [ ] **Step 3: Update entry-points.test.ts**

Read `entry-points.test.ts` and remove any test cases that reference the `./core` entry or `KioskKeyboardCore`. Keep tests for the main entry and bundle entry.

- [ ] **Step 4: Check layout-registry tests for combined layout references**

```bash
grep -n "qwerty-fk\|qwertz-de-fk\|qwerty-nav\|qwertz-de-nav" packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts
```

Update or remove any assertions that expect these layouts to be registered as built-in.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass. The test count will decrease (removed core-entry and treeshake-verify test files).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(kiosk-keyboard-webc): remove core entry and combined layout tests

Core entry tests and treeshake verification are no longer relevant after
flattening the class. Combined layout assertions removed since qwerty-fk,
qwertz-de-fk, qwerty-nav, qwertz-de-nav are no longer built-in."
```

---

### Task 6: Update smoke test and consumption HTML pages

**Files:**

- Modify: `tools/check-demo-webc-bundle.mjs`: remove bridge-specific checks
- Modify: `packages/kiosk-keyboard-webc/test/pages/consume-bundle.html`: keep as-is (still valid)
- Modify: `packages/kiosk-keyboard-webc/test/pages/consume-esm.html`: keep as-is (still valid)
- Modify: `packages/kiosk-keyboard-webc/test/pages/README.md`: remove consume-core reference

- [ ] **Step 1: Simplify check-demo-webc-bundle.mjs**

The smoke test no longer needs to check for the bridge control's bundle reference or copy the standalone bundle. Simplify to:

1. Rebuild the webc package (full build including bundle)
2. Verify the standalone bundle exists
3. Build the demo app (validates tooling-native path)

Remove the `controlPath`/`controlSource` check and the `prestart` / `copiedBundle` check.

- [ ] **Step 2: Update test/pages/README.md**

Remove the `consume-core.html` entry from the consumption smoke tests section.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: simplify demo smoke test after bridge removal

Remove bridge-specific checks (standalone bundle copy, control reference).
The smoke test now validates: webc build produces standalone bundle, demo
app builds successfully (tooling-native path)."
```

---

### Task 7: Update documentation

**Files:**

- Modify: `packages/demo-app/README.md`
- Modify: `docs/web-component-consumption.md`
- Modify: `patches/README.md`
- Modify: `packages/kiosk-keyboard-webc/README.md`

- [ ] **Step 1: Update demo-app README**

Major changes:

1. Remove the "Web Component (Manual Bridge)" section from the scenarios list
2. Rename "Web Component (Tooling Native)" to "Web Component"
3. In the "Web Component Consumption" section:
   - Keep "1. Tooling Native" as the primary path (rename to just "UI5 Consumption")
   - Convert "2. Manual Bridge" from a demo scenario to a **reference section** titled "Alternative: Manual Bridge". Include the `WebComponent.extend()` code from the deleted `KioskKeyboardWebc.ts` as a documentation example. Explain when a consumer would use this (no `ui5-tooling-modules`, explicit control over wrapper metadata). Explain the scoping constraint (must load standalone bundle outside middleware).
   - Keep "3. Native npm/Browser Consumption" as-is
4. Update the route map at the bottom (remove `#/kiosk/web-component`)
5. In the key technical details table, remove the "Manual Bridge" column or convert it to a footnote reference

- [ ] **Step 2: Update consumption architecture doc**

In `docs/web-component-consumption.md`:

1. Update the "Three Consumption Paths" section: now two paths (UI5 Tooling + Native npm/Browser) with a reference note about manual bridge
2. Remove the "UI5 Manual Bridge" subsection as a primary path; move it to a "Historical: Manual Bridge" section or fold it into the "Limitations and Workarounds" section as a reference
3. Update "Lean Consumption" section: note that the `./core` export was removed; consumers who want lean import can import layouts individually via `kiosk-keyboard-webc/layouts/*`
4. In "Tag Scoping Prevents Manual Bridge": keep as historical documentation
5. In "CEM Re-Export Handling": update to note the re-export was eliminated
6. Update "Future Considerations": remove items that are resolved

- [ ] **Step 3: Update patches/README.md**

In `patches/README.md`, add a note to Bug 6 (type reference module paths):

> **Status:** This patch may no longer be needed after the class flattening in the April 2026 architecture simplification. The re-export from `KioskKeyboardCore.ts` was the primary source of cross-module type references that triggered this path. Verify by removing the patch and rebuilding on Windows.

- [ ] **Step 4: Update kiosk-keyboard-webc README**

Remove any references to the `./core` import path. Update the consumption section to show only the main entry (`kiosk-keyboard-webc`) and individual layout imports (`kiosk-keyboard-webc/layouts/*`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: update consumption docs for simplified architecture

- Bridge demo removed, bridge pattern documented as reference
- Core entry removed, lean consumption via individual layout imports
- Combined layouts documented as composition examples
- CEM re-export history preserved for future reference
- Patch README updated with flattening status note"
```

---

### Task 8: Verify tooling-native page works end-to-end

This is the critical verification that the whole point of the refactoring worked.

- [ ] **Step 1: Full rebuild**

```bash
npm run build
```

- [ ] **Step 2: Verify CEM is correct**

```bash
node -e "
const d=JSON.parse(require('fs').readFileSync('packages/kiosk-keyboard-webc/dist/custom-elements.json','utf8'));
const m=d.modules.find(m=>m.path==='dist/KioskKeyboard.js');
const ceDef = m.exports.find(e=>e.kind==='custom-element-definition');
const classDecl = m.declarations?.find(d=>d.tagName==='kiosk-keyboard');
console.log('CE def:', ceDef ? 'PRESENT' : 'MISSING');
console.log('Class declaration:', classDecl ? 'PRESENT' : 'MISSING');
"
```

Expected: Both `PRESENT`.

- [ ] **Step 3: Start demo app and verify tooling-native page**

```bash
npm start
```

Navigate to `http://localhost:8080/index.html#/kiosk/web-component-tooling` (or the renamed route).
Use Chrome DevTools to verify:

- Page renders (not blank)
- No `oClass.getMetadata is not a function` error in console
- Status panel shows the **scoped** registered tag (e.g., `<kiosk-keyboard-e24fedd4>`)
- Keyboard appears when clicking an input field

- [ ] **Step 4: Run the full test suite and smoke tests**

```bash
npm run fmt:check && npm run lint && npm run typecheck && npm test && npm run test:tools && npm run test:demo:webc-bundle && npm run test:packages:smoke
```

Expected: All pass.

- [ ] **Step 5: Commit any remaining fixes**

If the verification reveals issues, fix them and commit.

- [ ] **Step 6: Push**

```bash
git push origin ci/release-please-setup
```

---

## Post-Plan Notes

### Layouts shipped (12 primary + 2 building blocks)

- `qwerty`, `qwertz-de`, `qwerty-es` (alphabetic)
- `ja-romaji`, `ja-kana`, `arabic`, `ko-hangul` (script/IME with middleware)
- `numeric`, `special`, `numpad` (utility)
- `fkeys`, `nav` (standalone)
- `fkey-row`, `nav-row` (composable building blocks, not standalone layouts)

### Layouts demoted to demo (4 combined)

- `qwerty-fk`, `qwertz-de-fk`, `qwerty-nav`, `qwertz-de-nav`
- These become live examples in the Custom Layouts demo page showing composition

### CSS documentation needed

The responsive CSS for function key rows is in `src/themes/KioskKeyboard.css`:

- `@container keyboard (max-width: 35rem)` splits the 12-key fkey row into 2x6
- `@container keyboard (max-width: 20rem)` caps font sizes for narrow widths
- Height-responsive classes (`.cq-short`, `.cq-tiny`) driven by ResizeObserver
- Nav row icon+label dual rendering with sr-only responsive hiding

These should be documented in the demo app's custom layouts page or in the package README's CSS customization section.
