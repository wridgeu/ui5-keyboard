# CSS-First Responsive Simplification

**Goal:** Remove the JS-driven width responsive path from both packages, keeping CSS `@container` queries as the sole width-responsive mechanism. Add browser compatibility documentation to both package READMEs.

**Architecture:** Width responsiveness moves from a dual CSS+JS system (CSS `@container` for defaults, JS `ResizeObserver` + classes for custom thresholds) to pure CSS `@container`. Height responsiveness stays JS-driven (no CSS alternative exists for `container-type: inline-size`). The consumer-configurable width threshold CSS variables (`cqNarrowThreshold` / `cqCompactThreshold`) are removed as a feature. Consumers who need custom width breakpoints write their own `@container` rules targeting the keyboard's CSS custom properties.

**Tech Stack:** CSS (container queries), TypeScript, LESS, QUnit, Web Test Runner, WDIO visual regression

**Status:** Implemented

---

## Motivation

The current responsive architecture combines four simultaneous mechanisms:

1. CSS `@container` queries (hardcoded 30rem/20rem width breakpoints)
2. JS `ResizeObserver` reading CSS custom property thresholds
3. JS class toggling (`cq-sm`/`cq-xs`/`cq-width-custom`)
4. CSS `@supports not (container-type)` fallback for pre-2023 browsers

This exists because CSS does not allow `var()` inside `@container` query expressions, forcing JS to bridge configurable thresholds to CSS. No other production component library (Shoelace, Material Web, UI5 Web Components, Vaadin) attempts this combination. The complexity creates specificity conflicts and makes the system brittle.

Container queries have been supported in all major browsers since 2023 (Chrome 105, Firefox 110, Safari 16, Edge 105). The `@supports not` fallback is dead code for the target audience (enterprise kiosks, SAP Fiori, modern tablets).

## Known Constraints

### LESS 1.6.3 cannot parse `@container` at-rules

The UI5 package uses `less-openui5` which vendors LESS v1.6.3 (released 2014, last release January 2023, maintenance mode). This version does not recognize `@container` as a valid at-rule. CSS property declarations like `container-type: inline-size` work fine, but `@container keyboard (max-width: 30rem) { ... }` causes a parse error.

`@container` support was added in LESS v4.2.0, but `less-openui5` has no documented upgrade plan (SAP/openui5#1983). Filing a feature request upstream is recommended but should not block this work.

**Resolution:** Use `@import (inline)` to bypass the LESS parser. A separate `KioskKeyboard.container-queries.css` file contains the `@container` rules as plain CSS. The LESS entry point imports it via `@import (inline) "KioskKeyboard.container-queries.css"` which passes the content through untouched into the compiled `library.css`.

**Constraint:** The `.css` file cannot use LESS variables (`@sapUi...`). This is not a problem because the `@container` rules only reference CSS custom properties (`var(--_ui5KioskKeyboard-...)`), which is already the mechanism used by the responsive system.

**Verified:** `@import (inline)` with `@container` rules compiles successfully and the rules appear in the built `library.css`.

### `:host()` inside `@container` in shadow DOM

The CSS spec allows `:host()` selectors inside `@container` blocks within shadow DOM stylesheets. However, the container must be inside the shadow tree (not the host itself). Since the keyboard's `container-name: keyboard` is set on `.kiosk-keyboard` (the root div inside shadow DOM), `@container keyboard` queries can reference `:host()` from that context. This needs browser verification during implementation.

**Fallback:** If `:host()` inside `@container` does not work in practice, the mixed height+width rule can use a different selector structure. Since the height classes (`.cq-short`/`.cq-tiny`) are set on the host element by JS, they can be referenced from inside the shadow DOM via a data attribute instead of a class on `:host`.

## Scope

Both packages undergo the same simplification: JS-driven width classes are removed entirely, replaced by pure CSS `@container` queries.

**Removed (both packages):**

- JS width measurement + `cq-sm`/`cq-xs`/`cq-width-custom` class toggling
- `differsFromDefaultThreshold()` function (WebC only, UI5 never had it)
- `@supports not (container-type: inline-size)` CSS fallback block (WebC only)
- `.kiosk-keyboard--cq-width-custom` CSS rules (WebC only)
- `.ui5KioskKeyboard--cq-sm/xs` JS-driven CSS rules (UI5 only)
- `--cqNarrowThreshold` / `--cqCompactThreshold` public CSS custom properties
- `rootCqSm` / `rootCqXs` / `rootCqWidthCustom` DOM contract entries
- `DISABLE_CONTAINER_QUERIES` test helper constant and associated visual fallback tests (WebC only)
- Tests asserting JS-driven width class toggling or custom width thresholds

**Kept (both packages):**

- CSS `@container keyboard (max-width: 30rem/20rem)` rules (WebC: already exist; UI5: added via `@import (inline)`)
- `container-type: inline-size; container-name: keyboard` on root element
- JS `ResizeObserver` / `ResizeHandler` for height-only responsiveness
- `resolveRemThreshold()` function (used by height path)
- All height CSS custom properties and classes (`cq-short`/`cq-tiny`)

**Added:**

- `KioskKeyboard.container-queries.css` in UI5 package (plain CSS imported inline by LESS)
- Mixed height+width `@container` rules in both packages
- Browser compatibility section in both package READMEs
- Consumer override documentation showing `@container` examples

## File Map

### Files to modify

| File                                                                   | Changes                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`                    | Remove width section from `_applyResponsiveClasses()`, remove `differsFromDefaultThreshold()` |
| `packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx`           | Remove `rootCqWidthCustom`, `rootCqSm`, `rootCqXs` from DOM contract                          |
| `packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css`            | Remove `@supports not`, `cq-width-custom` block, width threshold vars; convert mixed rule     |
| `packages/kiosk-keyboard/src/KioskKeyboard.ts`                         | Remove width threshold resolution (keep hardcoded class toggling)                             |
| `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less`           | Remove width threshold vars from `:where()` and doc comment                                   |
| `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard.test.ts`   | Remove JS width class tests, remove custom threshold tests (keep height threshold test)       |
| `packages/kiosk-keyboard-webc/test/e2e/test-helpers.ts`                | Remove `DISABLE_CONTAINER_QUERIES` constant                                                   |
| `packages/kiosk-keyboard-webc/test/e2e/visual-enhancements.test.ts`    | Remove/update tests using `DISABLE_CONTAINER_QUERIES`                                         |
| `packages/kiosk-keyboard/test/qunit/KioskKeyboard-responsive.qunit.ts` | Remove custom width threshold tests, keep width class tests (UI5 keeps JS path)               |
| `packages/kiosk-keyboard-webc/README.md`                               | Remove threshold vars, add compatibility section, add consumer override examples              |
| `packages/kiosk-keyboard/README.md`                                    | Same                                                                                          |
| `docs/kiosk-webc/ARCHITECTURE.md`                                      | Update responsive sizing section                                                              |
| `docs/kiosk/ARCHITECTURE.md`                                           | Update responsive sizing section                                                              |

---

## Tasks

### Task 1: Remove JS width path from WebC package

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:119-133,1610-1629`
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx:14-16`

- [ ] **Step 1: Delete `differsFromDefaultThreshold()` function**

  Remove lines 131-133 (`function differsFromDefaultThreshold`). This function is only used by the width path.

- [ ] **Step 2: Remove width section from `_applyResponsiveClasses()`**

  In the method starting around line 1610, remove everything from the `// -- Width --` comment through the `root.classList.toggle(rootCqXs)` line (approximately lines 1613-1629). Keep:
  - `const root = ...` and `if (!root) return`
  - `const remPx = ...` (line 1614, needed by height)
  - The entire height section starting at `// -- Height --`

  Note: the `const cs = getComputedStyle(root)` at line 1617 is used by both width and height. Check if the height section references `cs` (it does not; height uses `getComputedStyle(this)` via `_getHostContentHeight()` and its own `cs` for threshold resolution). If `cs` is only used by width, remove it too.

- [ ] **Step 3: Remove width class constants from DOM contract**

  In `KioskKeyboardTemplate.tsx`, remove `rootCqWidthCustom`, `rootCqSm`, and `rootCqXs` from the `classes` object in `KIOSK_KEYBOARD_DOM`.

- [ ] **Step 4: Run WebC component tests**

  Run: `npm test -w packages/kiosk-keyboard-webc`
  Expected: Some tests will fail (the JS width class tests). Note which tests fail for Task 3.

- [ ] **Step 5: Commit**

  ```
  refactor: remove JS width responsive path from WebC package
  ```

### Task 2: Simplify CSS in WebC package

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css:34-43,112-189,209-217`

- [ ] **Step 1: Remove dead CSS blocks**
  1. Remove `--kiosk-keyboard-cq-narrow-threshold` and `--kiosk-keyboard-cq-compact-threshold` from `:host` (lines 40-41) and the threshold comment block (lines 34-43)
  2. Remove the dual-mechanism comment block (lines 112-125)
  3. Remove the `@supports not (container-type: inline-size) { ... }` block (lines 129-142)
  4. Remove the entire `.kiosk-keyboard--cq-width-custom` section (lines 164-189)

- [ ] **Step 2: Convert mixed height+width rule**

  The current rule uses the JS-set `cq-xs` class:

  ```css
  :host(:where(.cq-short)) .kiosk-keyboard--cq-xs:not(.kiosk-keyboard--numpad) .kiosk-key,
  :host(:where(.cq-tiny)) .kiosk-keyboard--cq-xs:not(.kiosk-keyboard--numpad) .kiosk-key {
    --kiosk-keyboard-key-font-size: min(var(--_kiosk-keyboard-key-font-base), 0.75rem);
  }
  ```

  Replace with `@container` for the width condition + `:host()` for the height condition:

  ```css
  @container keyboard (max-width: 20rem) {
    :host(:where(.cq-short, .cq-tiny)) .kiosk-keyboard:not(.kiosk-keyboard--numpad) .kiosk-key {
      --kiosk-keyboard-key-font-size: min(var(--_kiosk-keyboard-key-font-base), 0.75rem);
    }
  }
  ```

  **Browser verification required:** Test this selector in Chrome, Firefox, and Safari. If `:host()` inside `@container` does not work, use a fallback approach: set a data attribute on the root div from JS (e.g., `data-height-constrained`) and target that instead:

  ```css
  @container keyboard (max-width: 20rem) {
    .kiosk-keyboard[data-cq-short]:not(.kiosk-keyboard--numpad) .kiosk-key,
    .kiosk-keyboard[data-cq-tiny]:not(.kiosk-keyboard--numpad) .kiosk-key { ... }
  }
  ```

- [ ] **Step 3: Run visual regression tests**

  Run: `npm test -w packages/kiosk-keyboard-webc`
  Expected: Visual tests should pass. If narrow baselines differ, verify the `@container` rules produce the same rendering and regenerate.

- [ ] **Step 4: Commit**

  ```
  refactor: remove @supports-not fallback and cq-width-custom CSS from WebC
  ```

### Task 3: Remove JS width path from UI5 package and add @container via inline import

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts:956-970`
- Modify: `packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts:15-16`
- Modify: `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less:88-95,390-426`
- Modify: `packages/kiosk-keyboard/src/themes/base/library.source.less`
- Create: `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.container-queries.css`

- [ ] **Step 1: Remove width section from `_applyResponsiveSizeClasses()`**

  In the method starting around line 956, remove the width measurement and class toggling (lines 962-970: content-box width calculation, threshold resolution, `isCompact`/`isNarrow`, `classList.toggle` for `rootCqXs`/`rootCqSm`). **Keep** lines 957 (`const remPx`) and 958 (`const cs`), both needed by the height section at lines 995-996.

- [ ] **Step 2: Remove width class constants from DOM contract**

  In `KioskKeyboardRenderer.ts`, remove `rootCqSm` and `rootCqXs` from the `classes` object in `KIOSK_KEYBOARD_DOM`.

- [ ] **Step 3: Remove JS-driven width CSS rules from LESS**

  Remove the `.ui5KioskKeyboard--cq-sm .ui5KioskKey` and `.ui5KioskKeyboard--cq-xs .ui5KioskKey` rules (lines 394-404) and the responsive font scaling comment block above them.

- [ ] **Step 4: Create `KioskKeyboard.container-queries.css`**

  Create a plain CSS file with the `@container` rules that replace the removed JS-driven rules:

  ```css
  /* Width-responsive container query rules.
     Imported via @import (inline) in library.source.less to bypass the
     LESS 1.6.3 parser which does not recognize @container at-rules.
     Only CSS custom properties are used: no LESS variables needed. */

  @container keyboard (max-width: 30rem) {
    .ui5KioskKey {
      --ui5KioskKeyboard-keyFontSize: min(var(--_ui5KioskKeyboard-keyFontBase), 1rem);
    }
  }

  @container keyboard (max-width: 20rem) {
    .ui5KioskKeyboard:not(.ui5KioskKeyboard--numpad) .ui5KioskKey {
      --_ui5KioskKeyboard-keyPadding: var(--_ui5KioskKeyboard-keyPaddingXs);
    }

    .ui5KioskKey {
      --ui5KioskKeyboard-keyFontSize: min(var(--_ui5KioskKeyboard-keyFontBase), 0.875rem);
    }
  }
  ```

- [ ] **Step 5: Convert mixed height+width rule**

  Move the mixed `cq-xs + cq-short/tiny` rule (LESS lines 423-425) into the `.container-queries.css` file as:

  ```css
  @container keyboard (max-width: 20rem) {
    .ui5KioskKeyboard--cq-short:not(.ui5KioskKeyboard--numpad) .ui5KioskKey,
    .ui5KioskKeyboard--cq-tiny:not(.ui5KioskKeyboard--numpad) .ui5KioskKey {
      --ui5KioskKeyboard-keyFontSize: min(var(--_ui5KioskKeyboard-keyFontBase), 0.75rem);
    }
  }
  ```

  Remove the old LESS rule.

- [ ] **Step 6: Add inline import to `library.source.less`**

  ```less
  @import "KioskKeyboard.less";
  @import (inline) "KioskKeyboard.container-queries.css";
  ```

- [ ] **Step 7: Remove width threshold vars from LESS**

  Remove `--ui5KioskKeyboard-cqNarrowThreshold` and `--ui5KioskKeyboard-cqCompactThreshold` from the `:where(.ui5KioskKeyboard)` block and the doc comment header.

- [ ] **Step 8: Run tests**

  Run: `npm test`
  Expected: Custom width threshold QUnit tests fail. Width class toggling tests fail. All other tests should pass.

- [ ] **Step 9: Commit**

  ```
  refactor: replace JS width path with @container rules via @import (inline) in UI5 package
  ```

### Task 4: Update WebC tests

**Files:**

- Modify: `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard.test.ts:1746-1782,2084-2166`
- Modify: `packages/kiosk-keyboard-webc/test/e2e/test-helpers.ts` (DISABLE_CONTAINER_QUERIES constant)
- Modify: `packages/kiosk-keyboard-webc/test/e2e/visual-enhancements.test.ts` (tests using DISABLE_CONTAINER_QUERIES)

- [ ] **Step 1: Remove JS width class fallback test**

  Remove the test `"JS fallback applies width classes for non-CQ browsers"` (lines 1746-1782).

- [ ] **Step 2: Remove custom width threshold tests from the describe block**

  In `describe("responsive threshold CSS variables")`, remove only the first two `it()` tests (lines ~2085-2116 for narrow threshold, ~2118-2147 for compact threshold). **Keep** the height threshold test (`it("uses custom height thresholds..."`, lines ~2149-2165) and the enclosing `describe()`/`});` wrapper intact.

- [ ] **Step 3: Remove `DISABLE_CONTAINER_QUERIES` from e2e test helpers**

  In `packages/kiosk-keyboard-webc/test/e2e/test-helpers.ts`, remove the `DISABLE_CONTAINER_QUERIES` exported constant (around lines 251-263).

- [ ] **Step 4: Update visual-enhancements tests**

  In `packages/kiosk-keyboard-webc/test/e2e/visual-enhancements.test.ts`, remove any tests that use `DISABLE_CONTAINER_QUERIES` to simulate non-CQ browsers (lines importing and using the constant). Remove the corresponding visual baselines (`*-no-cq.png`).

- [ ] **Step 5: Run WebC tests**

  Run: `npm test -w packages/kiosk-keyboard-webc`
  Expected: All tests pass.

- [ ] **Step 6: Commit**

  ```
  test: remove JS width class, CQ fallback, and custom threshold tests from WebC
  ```

### Task 5: Update UI5 QUnit tests

**Files:**

- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-responsive.qunit.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/test-helpers.ts:142-192`

- [ ] **Step 1: Remove all JS-driven width class tests**

  Remove these tests (they assert JS-driven `cq-sm`/`cq-xs` class toggling that no longer exists):
  - `"Applies cq-xs class at compact width (<= 20rem)"`
  - `"Applies cq-sm class at narrow width (20rem < width <= 30rem)"`
  - `"No responsive classes at wide width (> 30rem)"`
  - `"Boundary: exactly 20rem applies cq-xs"`
  - `"Boundary: exactly 30rem applies cq-sm"`
  - `"Classes update when width changes across breakpoints"`
  - `"Custom width threshold: cq-sm triggers at overridden narrow threshold"`
  - `"Custom width threshold: cq-xs triggers at overridden compact threshold"`

  Rewrite `"Cleanup on exit() removes resize observer"` to only check height observer cleanup.

- [ ] **Step 2: Remove compound width+height tests that depend on JS width classes**

  The compound tests (`"Compound: narrow width + short height"` and `"Compound: narrow width + tiny height"`) use `applyResponsiveSizeClasses` to stub JS width behavior. Since JS no longer sets width classes, these tests cannot work via the helper. Move compound visual coverage to the e2e visual tests (which already have `narrow-short` baselines).

- [ ] **Step 3: Simplify `applyResponsiveSizeClasses` test helper to height-only**

  Rename to `applyResponsiveHeightClasses`. Remove the `clientWidth` stub and the `width` parameter. The helper now only stubs `scrollHeight` and `getBoundingClientRect().height` for the height path.

- [ ] **Step 4: Update the font-size cap test**

  The test `"Responsive class preserves custom font-size below the cap"` uses `applyResponsiveSizeClasses` with a width argument to trigger font-size capping. Since width is now `@container`-driven and the QUnit test environment may or may not evaluate `@container` rules, convert this to an e2e visual test or remove it (the narrow visual baselines already cover this).

- [ ] **Step 5: Run full test suite**

  Run: `npm test`
  Expected: All tests pass.

- [ ] **Step 6: Commit**

  ```
  test: rewrite responsive tests for CSS @container width, JS-only height
  ```

### Task 6: Add browser compatibility documentation

**Files:**

- Modify: `packages/kiosk-keyboard-webc/README.md`
- Modify: `packages/kiosk-keyboard/README.md`

- [ ] **Step 1: Add compatibility section to WebC README**

  Add a "Browser Compatibility" section near the top (after the installation section):

  ```markdown
  ## Browser Compatibility

  The keyboard requires modern browser features for full functionality:

  | Feature               | Used for                            | Baseline                                       |
  | --------------------- | ----------------------------------- | ---------------------------------------------- |
  | CSS Container Queries | Width-responsive sizing             | Chrome 105, Firefox 110, Safari 16 (2022-2023) |
  | ResizeObserver        | Height-responsive sizing            | Chrome 64, Firefox 69, Safari 13.1 (2018-2020) |
  | CSS `min()` / `max()` | Font-size capping, padding defaults | Chrome 79, Firefox 75, Safari 13.1 (2020)      |
  | CSS Custom Properties | All consumer overrides              | Chrome 49, Firefox 31, Safari 9.1 (2016)       |
  | CSS `color-mix()`     | Theme-adaptive shadows              | Chrome 111, Firefox 113, Safari 16.2 (2023)    |
  | Shadow DOM v1         | Component encapsulation             | Chrome 53, Firefox 63, Safari 10 (2016-2018)   |

  All features are supported in browsers released since mid-2023. In older
  browsers, the keyboard renders at full size without width-responsive font
  scaling. Shadow colors fall back to static `rgba()` values.
  ```

- [ ] **Step 2: Add consumer override examples to WebC README**

  In the CSS custom properties section, add:

  ````markdown
  ### Custom Width Breakpoints

  The keyboard responds to its container width via CSS container queries
  at 30rem (narrow) and 20rem (compact). To define your own breakpoints,
  wrap the keyboard in a container and override CSS custom properties:

  ```css
  .my-panel {
    container-type: inline-size;
  }
  @container (max-width: 40rem) {
    kiosk-keyboard.my-keyboard {
      --kiosk-keyboard-key-font-size: 1rem;
    }
  }
  ```
  ````

  ```

  ```

- [ ] **Step 3: Remove width threshold properties from WebC README**

  Remove `--kiosk-keyboard-cq-narrow-threshold` and `--kiosk-keyboard-cq-compact-threshold` from the CSS custom properties table and any examples.

- [ ] **Step 4: Add compatibility section to UI5 README**

  Same table (without Shadow DOM row). Note that the UI5 package uses JS-driven width classes as a LESS compiler constraint, and consumers can write `@container` rules directly because the keyboard sets `container-name: keyboard` on its root element:

  ```css
  @container keyboard (max-width: 40rem) {
    .myKeyboard .ui5KioskKey {
      --ui5KioskKeyboard-keyFontSize: 1rem;
    }
  }
  ```

- [ ] **Step 5: Remove width threshold properties from UI5 README**

  Remove `--ui5KioskKeyboard-cqNarrowThreshold` and `--ui5KioskKeyboard-cqCompactThreshold` from the table.

- [ ] **Step 6: Commit**

  ```
  docs: add browser compatibility, update responsive override examples
  ```

### Task 7: Update ARCHITECTURE.md files

**Files:**

- Modify: `docs/kiosk-webc/ARCHITECTURE.md`
- Modify: `docs/kiosk/ARCHITECTURE.md`

- [ ] **Step 1: Update WebC ARCHITECTURE.md responsive section**

  Replace the dual CSS+JS mechanism description with:
  - Width: pure CSS `@container` queries (30rem narrow, 20rem compact)
  - Height: JS `ResizeObserver` + host classes (`cq-short`/`cq-tiny`)
  - Consumer overrides: CSS custom properties at `:where()` specificity; custom breakpoints via consumer's own `@container` rules on an outer wrapper

- [ ] **Step 2: Update UI5 ARCHITECTURE.md responsive section**
  - Width: JS `ResizeHandler` + CSS classes with hardcoded 30rem/20rem thresholds (LESS 1.6.3 constraint); consumers can write `@container keyboard` rules directly
  - Height: JS `ResizeHandler` + CSS classes
  - Consumer overrides: CSS custom properties at `:where()` specificity

- [ ] **Step 3: Commit**

  ```
  docs: update ARCHITECTURE.md responsive sections for CSS-first model
  ```

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

  Run: `npm test`
  Expected: All tests pass across all packages.

- [ ] **Step 2: Run lint and format**

  Run: `npm run lint && npm run fmt:check`
  Expected: 0 warnings, 0 errors.

- [ ] **Step 3: Run type check**

  Run: `npm run typecheck`
  Expected: Only pre-existing errors in e2e helpers.

- [ ] **Step 4: Run visual baseline check**

  Run: `npm run check:baselines`
  Expected: Pre-existing missing baselines only. If `*-no-cq.png` baselines were removed in Task 4, they should no longer appear as missing.

- [ ] **Step 5: Visually inspect narrow and compact baselines**

  Read the narrow/compact visual baseline images for both packages to verify no clipping.

- [ ] **Step 6: Commit any remaining fixes and push**

---

## Risk Assessment

| Risk                                                                              | Mitigation                                                                                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@container` at-rules fail to parse in LESS 1.6.3                                 | Bypassed via `@import (inline)` of a plain `.css` file. Verified: builds successfully, rules appear in compiled `library.css`.                       |
| `:host()` inside `@container` may not work in some browsers                       | Browser-test during Task 2 Step 2. Fallback: use `data-*` attributes on the root div instead of `:host()` classes.                                   |
| Removing `DISABLE_CONTAINER_QUERIES` breaks visual fallback tests                 | Task 4 explicitly removes the tests and their baselines. The fallback path no longer exists in production CSS.                                       |
| Removing width threshold CSS vars is a breaking change for consumers              | Document in changelog. Consumers who used the thresholds can migrate to their own `@container` rules (more flexible).                                |
| QUnit tests for width behavior may not work with `@container` in the test harness | Width visual coverage relies on e2e visual baselines (narrow, compact layouts) which run in real browsers. QUnit tests focus on height-only JS path. |
| `KioskKeyboard.container-queries.css` not picked up by `ui5 serve` dev server     | Verify during Task 3. The `@import (inline)` in `library.source.less` should be resolved by the dev server's LESS compilation.                       |

## Future Work

- File a feature request on [SAP/less-openui5](https://github.com/SAP/less-openui5) to add `case "@container":` to the vendored parser's at-rule switch/case (one-line change). If accepted, the separate `.css` file can be merged back into the LESS file.
- Consider the UI5 ShellBar attribute pattern (`breakpoint-size` attribute) as a further simplification for the height path, replacing host classes with host attributes for better DevTools visibility.
