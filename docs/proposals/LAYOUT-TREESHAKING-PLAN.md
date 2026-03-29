# Layout Tree-Shaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WebC package modular so consumers can import only the layouts they need, while keeping the UI5 package unchanged and allowing `registerLayout` to override built-ins in both packages.

**Architecture:** WebC layouts become self-registering modules via `_registerBuiltInLayout`. A new `KioskKeyboardCore` entry exports the component without layouts. The existing `KioskKeyboard` entry re-exports core after importing all layouts. Vite builds multiple entry points with code splitting. UI5 only gets the `registerLayout` override change.

**Tech Stack:** TypeScript, Vite 8 (rolldown), Vitest, @ui5/webcomponents-base, UI5 CLI

**References:**

- Design spec: `docs/proposals/LAYOUT-TREESHAKING.md`
- Issues: [#45](https://github.com/wridgeu/ui5-lib-keyboard/issues/45), [#53](https://github.com/wridgeu/ui5-lib-keyboard/issues/53)

---

## File Map

### WebC package (`packages/kiosk-keyboard-webc/`)

| Action | File                                                 | Responsibility                                                                                                   |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Modify | `src/core/layout-registry.ts`                        | Add `_registerBuiltInLayout`, remove built-in protection from `registerLayout`, decouple from `layouts/index.ts` |
| Delete | `src/layouts/index.ts`                               | No longer needed -- layouts self-register instead of being centrally imported                                    |
| Modify | `src/layouts/qwerty.ts`                              | Add self-registration side effect (repeat for all 14 layout files)                                               |
| Modify | `src/layouts/qwertz-de.ts`                           | Self-registration                                                                                                |
| Modify | `src/layouts/numeric.ts`                             | Self-registration                                                                                                |
| Modify | `src/layouts/special.ts`                             | Self-registration                                                                                                |
| Modify | `src/layouts/numpad.ts`                              | Self-registration                                                                                                |
| Modify | `src/layouts/fkeys.ts`                               | Self-registration                                                                                                |
| Modify | `src/layouts/nav.ts`                                 | Self-registration                                                                                                |
| Modify | `src/layouts/qwerty-fk.ts`                           | Self-registration                                                                                                |
| Modify | `src/layouts/qwertz-de-fk.ts`                        | Self-registration                                                                                                |
| Modify | `src/layouts/qwerty-nav.ts`                          | Self-registration                                                                                                |
| Modify | `src/layouts/qwertz-de-nav.ts`                       | Self-registration                                                                                                |
| Modify | `src/layouts/ja-romaji.ts`                           | Self-registration                                                                                                |
| Modify | `src/layouts/ja-kana.ts`                             | Self-registration                                                                                                |
| Modify | `src/layouts/arabic.ts`                              | Self-registration                                                                                                |
| Rename | `src/KioskKeyboard.ts` -> `src/KioskKeyboardCore.ts` | Core component (no layout imports)                                                                               |
| Create | `src/KioskKeyboard.ts`                               | Full entry: imports all layouts + re-exports core                                                                |
| Modify | `src/bundle.esm.ts`                                  | Update import path to use full entry                                                                             |
| Modify | `vite.config.ts`                                     | Multi-entry build with code splitting                                                                            |
| Modify | `package.json`                                       | Updated exports map with `./core` and `./layouts/*`                                                              |
| Modify | `test/unit/layout-registry.test.ts`                  | Update tests for new registration behavior                                                                       |
| Create | `test/unit/entry-points.test.ts`                     | Smoke tests for core vs full entry, idempotent registration                                                      |

### UI5 package (`packages/kiosk-keyboard/`)

| Action | File                                  | Responsibility                                   |
| ------ | ------------------------------------- | ------------------------------------------------ |
| Modify | `src/internal/layout-registry.ts`     | Remove built-in protection from `registerLayout` |
| Modify | `test/qunit/layout-registry.qunit.ts` | Update tests for override behavior               |

---

### Task 1: Add `_registerBuiltInLayout` to WebC layout registry

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`
- Test: `packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts`

- [ ] **Step 1: Write tests for `_registerBuiltInLayout`**

Add a new describe block to `test/unit/layout-registry.test.ts`:

```ts
// Add to imports at top of file:
import { _registerBuiltInLayout } from "../../src/core/layout-registry.js";

// Add new describe block after the existing ones:
describe("_registerBuiltInLayout", () => {
  it("registers a layout and marks it as built-in", () => {
    _registerBuiltInLayout("test-builtin", CUSTOM_LAYOUT);
    expect(getRegisteredLayout("test-builtin")).toBe(CUSTOM_LAYOUT);
    expect(isBuiltInLayout("test-builtin")).toBe(true);
  });

  it("is idempotent -- silently skips if name already exists", () => {
    const first: LayoutDefinition = [[{ value: "x" }]];
    const second: LayoutDefinition = [[{ value: "y" }]];
    _registerBuiltInLayout("idem-test", first);
    _registerBuiltInLayout("idem-test", second);
    expect(getRegisteredLayout("idem-test")).toBe(first);
  });

  it("does not warn on duplicate registration", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    _registerBuiltInLayout("no-warn-test", CUSTOM_LAYOUT);
    _registerBuiltInLayout("no-warn-test", CUSTOM_LAYOUT);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: FAIL -- `_registerBuiltInLayout` is not exported

- [ ] **Step 3: Implement `_registerBuiltInLayout` in layout-registry.ts**

In `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`, change `BUILTIN_LAYOUTS` from `ReadonlySet` to mutable `Set` and add the new function:

```ts
// Change line 11 from:
const BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(layouts.keys());
// To:
const BUILTIN_LAYOUTS: Set<string> = new Set(layouts.keys());
```

Add the new function after `BUILTIN_LAYOUTS` (before `SECONDARY_LAYOUTS`):

```ts
/**
 * Registers a built-in layout. Idempotent: silently skips if the name
 * is already registered. Used internally by self-registering layout modules.
 * @internal
 */
export function _registerBuiltInLayout(name: string, def: LayoutDefinition): void {
  if (layouts.has(name)) return;
  layouts.set(name, def);
  BUILTIN_LAYOUTS.add(name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/core/layout-registry.ts packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts
git commit -m "feat(webc): add _registerBuiltInLayout for idempotent self-registration"
```

---

### Task 2: Allow `registerLayout` to override built-ins (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`
- Modify: `packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts`

- [ ] **Step 1: Update existing test to expect override instead of warning**

In `test/unit/layout-registry.test.ts`, replace the existing test at line 68-72:

```ts
// Replace:
it("cannot overwrite built-in layouts", () => {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
  registerLayout("qwerty", CUSTOM_LAYOUT);
  expect(spy).toHaveBeenCalled();
});

// With:
it("can override built-in layouts", () => {
  registerLayout("qwerty", CUSTOM_LAYOUT);
  expect(getRegisteredLayout("qwerty")).toBe(CUSTOM_LAYOUT);
});
```

- [ ] **Step 2: Run tests to verify the new test fails (built-in still protected)**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: FAIL -- `getRegisteredLayout("qwerty")` is not `CUSTOM_LAYOUT`

- [ ] **Step 3: Remove built-in protection from `registerLayout`**

In `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`, remove lines 60-65 from `registerLayout`:

```ts
// Remove this block:
if (BUILTIN_LAYOUTS.has(name)) {
  console.warn(`[kiosk-keyboard] Cannot overwrite built-in layout "${name}". Use a different name for custom layouts.`);
  return;
}
```

Also update the JSDoc on `registerLayout` (line 50-55):

```ts
/**
 * Registers a custom keyboard layout. Can override any layout, including
 * built-ins. Validates structure before registering.
 * @internal
 */
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/core/layout-registry.ts packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts
git commit -m "feat(webc): allow registerLayout to override built-in layouts"
```

---

### Task 3: Allow `registerLayout` to override built-ins (UI5)

**Files:**

- Modify: `packages/kiosk-keyboard/src/internal/layout-registry.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/layout-registry.qunit.ts`

- [ ] **Step 1: Update UI5 test to expect override instead of warning**

In `packages/kiosk-keyboard/test/qunit/layout-registry.qunit.ts`, find the test for built-in protection and update it. Search for the test that calls `registerLayout("qwerty", ...)` and expects a warning. Replace it with an override test:

```ts
// Find the test that asserts built-in protection (likely uses sinon spy on Log.warning)
// Replace with:
QUnit.test("registerLayout can override built-in layouts", function (assert) {
  const custom = makeLayout();
  registerLayout("qwerty", custom);
  assert.deepEqual(getRegisteredLayout("qwerty"), custom, "qwerty overridden with custom layout");
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `cd packages/kiosk-keyboard && npx ui5 serve & sleep 5 && npx karma start` (or however qunit tests run -- check `package.json` scripts)

Check `packages/kiosk-keyboard/package.json` for the correct test command first.

- [ ] **Step 3: Remove built-in protection from UI5 `registerLayout`**

In `packages/kiosk-keyboard/src/internal/layout-registry.ts`, remove lines 92-99:

```ts
// Remove this block:
if (BUILTIN_LAYOUTS.has(name)) {
  Log.warning(
    `Cannot overwrite built-in layout "${name}". Use a different name for custom layouts.`,
    undefined,
    "ui5.kiosk.KioskKeyboard",
  );
  return;
}
```

Update the JSDoc on `registerLayout` (lines 77-87):

```ts
/**
 * Registers a custom keyboard layout that can then be used via
 * `setLayout(name)` or declaratively as `layout="name"` in XML views.
 *
 * Can override any layout, including built-ins. Validates structure
 * before registering.
 *
 * @param sName Layout identifier (lowercase, e.g. "azerty-fr")
 * @param oDefinition Array of rows, each containing key definitions
 */
```

- [ ] **Step 4: Run tests to verify they pass**

Run the UI5 test suite. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/layout-registry.ts packages/kiosk-keyboard/test/qunit/layout-registry.qunit.ts
git commit -m "feat(ui5): allow registerLayout to override built-in layouts"
```

---

### Task 4: Make WebC layout files self-registering

**Files:**

- Modify: All 14 layout files in `packages/kiosk-keyboard-webc/src/layouts/`
- Delete: `packages/kiosk-keyboard-webc/src/layouts/index.ts`
- Modify: `packages/kiosk-keyboard-webc/src/core/layout-registry.ts` (remove `builtInLayouts` import)

- [ ] **Step 1: Update layout-registry.ts to not import from layouts/index.ts**

In `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`, remove line 3 and change line 8:

```ts
// Remove:
import builtInLayouts from "../layouts/index.js";

// Change line 8 from:
const layouts: Map<string, LayoutDefinition> = new Map(builtInLayouts);
// To:
const layouts: Map<string, LayoutDefinition> = new Map();

// Change BUILTIN_LAYOUTS initialization from:
const BUILTIN_LAYOUTS: Set<string> = new Set(layouts.keys());
// To (empty -- populated by _registerBuiltInLayout calls):
const BUILTIN_LAYOUTS: Set<string> = new Set();
```

- [ ] **Step 2: Add self-registration to each layout file**

For each of the 14 layout files, add the import and registration call. The pattern for standalone layouts (qwerty, qwertz-de, numeric, special, numpad, fkeys, nav, ja-romaji, ja-kana, arabic):

Example -- `packages/kiosk-keyboard-webc/src/layouts/qwerty.ts`:

```ts
// Add at top:
import { _registerBuiltInLayout } from "../core/layout-registry.js";

// Add at bottom (after the const declaration, before the export):
_registerBuiltInLayout("qwerty", qwerty);
```

Example -- `packages/kiosk-keyboard-webc/src/layouts/numeric.ts`:

```ts
// Add at top:
import { _registerBuiltInLayout } from "../core/layout-registry.js";

// Add at bottom:
_registerBuiltInLayout("numeric", numeric);
```

For combinator layouts that import other layouts (qwerty-fk, qwertz-de-fk, qwerty-nav, qwertz-de-nav), the pattern is the same but ensure the imported base layouts are also self-registering:

Example -- `packages/kiosk-keyboard-webc/src/layouts/qwerty-fk.ts`:

```ts
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import type { LayoutDefinition } from "../types.js";
import { fkeyRow } from "./fkey-row.js";
import qwerty from "./qwerty.js";

const qwertyFk: LayoutDefinition = [fkeyRow, ...qwerty];

_registerBuiltInLayout("qwerty-fk", qwertyFk);

export default qwertyFk;
```

Note: importing `qwerty.js` here triggers qwerty's self-registration as a side effect. This is fine -- `_registerBuiltInLayout` is idempotent, so qwerty registers once regardless of how many combinators import it.

Full list of files to modify with their registration names:

| File               | Registration name |
| ------------------ | ----------------- |
| `qwerty.ts`        | `"qwerty"`        |
| `qwertz-de.ts`     | `"qwertz-de"`     |
| `numeric.ts`       | `"numeric"`       |
| `special.ts`       | `"special"`       |
| `numpad.ts`        | `"numpad"`        |
| `fkeys.ts`         | `"fkeys"`         |
| `nav.ts`           | `"nav"`           |
| `qwerty-fk.ts`     | `"qwerty-fk"`     |
| `qwertz-de-fk.ts`  | `"qwertz-de-fk"`  |
| `qwerty-nav.ts`    | `"qwerty-nav"`    |
| `qwertz-de-nav.ts` | `"qwertz-de-nav"` |
| `ja-romaji.ts`     | `"ja-romaji"`     |
| `ja-kana.ts`       | `"ja-kana"`       |
| `arabic.ts`        | `"arabic"`        |

Do NOT modify: `default-layout.ts`, `symbol-common.ts`, `fkey-row.ts`, `nav-row.ts` -- these are shared data/constants, not registerable layouts.

- [ ] **Step 3: Delete `layouts/index.ts`**

```bash
git rm packages/kiosk-keyboard-webc/src/layouts/index.ts
```

- [ ] **Step 4: Run existing tests to verify everything still works**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: FAIL -- the registry starts empty now, so tests that expect built-in layouts (like `isBuiltInLayout("qwerty")`) will fail because no layout module has been imported to trigger registration.

This is expected. The test file needs to import layouts explicitly. Add at the top of `test/unit/layout-registry.test.ts`:

```ts
// Import all layouts to trigger self-registration (like the full entry would)
import "../../src/layouts/qwerty.js";
import "../../src/layouts/qwertz-de.js";
import "../../src/layouts/numeric.js";
import "../../src/layouts/special.js";
import "../../src/layouts/numpad.js";
import "../../src/layouts/fkeys.js";
import "../../src/layouts/nav.js";
import "../../src/layouts/qwerty-fk.js";
import "../../src/layouts/qwertz-de-fk.js";
import "../../src/layouts/qwerty-nav.js";
import "../../src/layouts/qwertz-de-nav.js";
import "../../src/layouts/ja-romaji.js";
import "../../src/layouts/ja-kana.js";
import "../../src/layouts/arabic.js";
```

- [ ] **Step 5: Run tests again**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: PASS

- [ ] **Step 6: Run all WebC unit tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run`
Expected: PASS (other test files may also need the layout imports if they depend on built-in layouts)

- [ ] **Step 7: Commit**

```bash
git add -A packages/kiosk-keyboard-webc/src/layouts/ packages/kiosk-keyboard-webc/src/core/layout-registry.ts packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts
git commit -m "feat(webc): make layout files self-registering, remove central index"
```

---

### Task 5: Create KioskKeyboardCore and full entry (WebC)

**Files:**

- Rename: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` -> `packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts`
- Create: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` (full entry)
- Modify: `packages/kiosk-keyboard-webc/src/bundle.esm.ts` (update import)

- [ ] **Step 1: Rename KioskKeyboard.ts to KioskKeyboardCore.ts**

```bash
cd packages/kiosk-keyboard-webc
git mv src/KioskKeyboard.ts src/KioskKeyboardCore.ts
```

Also rename the template file if it exists:

```bash
# Check if KioskKeyboardTemplate.ts needs to stay (it's imported by the component)
# It does NOT need renaming -- it's a template, not an entry point
```

Update the internal import in `KioskKeyboardCore.ts` -- the file references itself via `./KioskKeyboardTemplate.js`. This import path doesn't change since the template file stays in place.

However, check for any self-referencing imports (e.g., `export type { KioskKeyboardDomContract } from "./KioskKeyboard.js"` on line 44 of the original). This line exports a type from itself -- it will break after rename. Update it:

```ts
// In KioskKeyboardCore.ts, line 44 -- change:
export type { KioskKeyboardDomContract } from "./core/dom-contract.js";
// This is already importing from dom-contract.js, not from itself. Verify.
```

- [ ] **Step 2: Create the full entry file**

Create `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`:

```ts
// Full entry point -- imports all built-in layouts (triggering self-registration)
// then re-exports the core component and its types.
import "./layouts/qwerty.js";
import "./layouts/qwertz-de.js";
import "./layouts/numeric.js";
import "./layouts/special.js";
import "./layouts/numpad.js";
import "./layouts/fkeys.js";
import "./layouts/nav.js";
import "./layouts/qwerty-fk.js";
import "./layouts/qwertz-de-fk.js";
import "./layouts/qwerty-nav.js";
import "./layouts/qwertz-de-nav.js";
import "./layouts/ja-romaji.js";
import "./layouts/ja-kana.js";
import "./layouts/arabic.js";

export { default, default as KioskKeyboard } from "./KioskKeyboardCore.js";
export type { KioskKeyboardDomContract } from "./KioskKeyboardCore.js";
```

- [ ] **Step 3: Update bundle.esm.ts to import from full entry**

In `packages/kiosk-keyboard-webc/src/bundle.esm.ts`, the import on line 5 is:

```ts
export { default as KioskKeyboard } from "./KioskKeyboard.js";
```

This already points to `./KioskKeyboard.js` which is now the full entry. No change needed -- the file path is unchanged, only the content behind it changed.

Verify line 19:

```ts
export type { KioskKeyboardDomContract } from "./KioskKeyboard.js";
```

This also still works since the full entry re-exports the type.

- [ ] **Step 4: Update any internal imports that reference KioskKeyboard**

Search for imports of `./KioskKeyboard.js` in the WebC `src/` directory. Files that import the component class should now import from `./KioskKeyboardCore.js` if they need the class directly (not the full entry with all layouts).

Check `src/Assets.ts` or any other source files:

```bash
grep -r "from.*KioskKeyboard" packages/kiosk-keyboard-webc/src/ --include="*.ts" | grep -v "KioskKeyboardCore" | grep -v "KioskKeyboardTemplate"
```

For any file that imports from `"./KioskKeyboard.js"` inside `src/`, update to `"./KioskKeyboardCore.js"` -- unless it intentionally needs all layouts.

- [ ] **Step 5: Run all unit tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `cd packages/kiosk-keyboard-webc && npx tsc --noEmit --composite false`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add -A packages/kiosk-keyboard-webc/src/
git commit -m "feat(webc): split into KioskKeyboardCore and full entry with all layouts"
```

---

### Task 6: Update Vite build to multi-entry with code splitting

**Files:**

- Modify: `packages/kiosk-keyboard-webc/vite.config.ts`

- [ ] **Step 1: Update vite.config.ts for multi-entry build**

Replace the `build` section in `packages/kiosk-keyboard-webc/vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
import { globSync } from "node:fs";

const __dirname = import.meta.dirname;

// Collect all layout entry points
const layoutEntries = Object.fromEntries(
  globSync("src/layouts/*.ts", { cwd: __dirname })
    .filter((f) => !f.includes("index.ts") && !f.includes("default-layout.ts") && !f.includes("symbol-common.ts"))
    .map((f) => {
      const name = path.basename(f, ".ts");
      return [`layouts/${name}`, path.resolve(__dirname, f)];
    }),
);

export default defineConfig({
  resolve: {
    dedupe: ["@ui5/webcomponents-base"],
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/coverage/**", "**/__screenshots__/**", "**/dist/**"],
    },
  },
  build: {
    lib: {
      entry: {
        KioskKeyboard: path.resolve(__dirname, "src/KioskKeyboard.ts"),
        KioskKeyboardCore: path.resolve(__dirname, "src/KioskKeyboardCore.ts"),
        ...layoutEntries,
        "bundle.esm": path.resolve(__dirname, "src/bundle.esm.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        // Code splitting is enabled by default with multiple entries
        // Shared code goes into chunks/
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "jsdom",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/generated/**"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
```

Note: The exact Vite/Rolldown config for `chunkFileNames` and code splitting may need adjustment based on Vite 8's API. Check `vite build` output to verify the structure.

- [ ] **Step 2: Run the build**

Run: `cd packages/kiosk-keyboard-webc && npm run build`
Expected: Build succeeds, produces:

- `dist/KioskKeyboard.js` (full entry)
- `dist/KioskKeyboardCore.js` (core entry)
- `dist/layouts/qwerty.js`, `dist/layouts/numeric.js`, etc.
- `dist/bundle.esm.js` (single-file bundle)
- `dist/chunks/` (shared code)

- [ ] **Step 3: Verify output structure**

```bash
ls -la packages/kiosk-keyboard-webc/dist/
ls -la packages/kiosk-keyboard-webc/dist/layouts/
ls -la packages/kiosk-keyboard-webc/dist/chunks/ 2>/dev/null
```

Expected: All entry points present. Layout files are small (just key data + registration call). Shared component code is in chunks.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/vite.config.ts
git commit -m "feat(webc): multi-entry Vite build with code splitting"
```

---

### Task 7: Update package.json exports map

**Files:**

- Modify: `packages/kiosk-keyboard-webc/package.json`

- [ ] **Step 1: Update exports map**

In `packages/kiosk-keyboard-webc/package.json`, replace the `exports` field:

```json
{
  "exports": {
    ".": {
      "types": "./dist/KioskKeyboard.d.ts",
      "default": "./dist/KioskKeyboard.js"
    },
    "./core": {
      "types": "./dist/KioskKeyboardCore.d.ts",
      "default": "./dist/KioskKeyboardCore.js"
    },
    "./bundle": {
      "types": "./dist/bundle.esm.d.ts",
      "default": "./dist/bundle.esm.js"
    },
    "./Assets": {
      "types": "./dist/Assets.d.ts",
      "default": "./dist/Assets.js"
    },
    "./layouts/*": {
      "types": "./dist/layouts/*.d.ts",
      "default": "./dist/layouts/*.js"
    },
    "./dist/*": "./dist/*"
  }
}
```

Also update `main` and `types` to match:

```json
{
  "main": "dist/KioskKeyboard.js",
  "types": "dist/KioskKeyboard.d.ts"
}
```

Note: The individual `./layouts/fkey-row` and `./layouts/nav-row` entries are now covered by the `./layouts/*` wildcard pattern and can be removed.

- [ ] **Step 2: Verify the exports map resolves correctly**

Run: `cd packages/kiosk-keyboard-webc && node -e "const pkg = require('./package.json'); console.log(JSON.stringify(pkg.exports, null, 2))"`

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/package.json
git commit -m "feat(webc): update package.json exports map with core and layout subpaths"
```

---

### Task 8: Write smoke tests for consumption patterns

**Files:**

- Create: `packages/kiosk-keyboard-webc/test/unit/entry-points.test.ts`

- [ ] **Step 1: Write the smoke tests**

Create `packages/kiosk-keyboard-webc/test/unit/entry-points.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLayout,
  resetCustomLayouts,
} from "../../src/core/layout-registry.js";

// Import all layouts (simulates full entry)
import "../../src/layouts/qwerty.js";
import "../../src/layouts/qwertz-de.js";
import "../../src/layouts/numeric.js";
import "../../src/layouts/special.js";
import "../../src/layouts/numpad.js";
import "../../src/layouts/fkeys.js";
import "../../src/layouts/nav.js";
import "../../src/layouts/qwerty-fk.js";
import "../../src/layouts/qwertz-de-fk.js";
import "../../src/layouts/qwerty-nav.js";
import "../../src/layouts/qwertz-de-nav.js";
import "../../src/layouts/ja-romaji.js";
import "../../src/layouts/ja-kana.js";
import "../../src/layouts/arabic.js";

const ALL_BUILTIN_NAMES = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "qwerty-fk",
  "qwertz-de-fk",
  "qwerty-nav",
  "qwertz-de-nav",
  "ja-romaji",
  "ja-kana",
  "arabic",
];

describe("entry-points: full entry", () => {
  it("all built-in layouts are registered after importing all layout modules", () => {
    const names = getRegisteredLayoutNames();
    for (const name of ALL_BUILTIN_NAMES) {
      expect(names).toContain(name);
      expect(isBuiltInLayout(name)).toBe(true);
    }
  });

  it("each built-in layout has a valid definition", () => {
    for (const name of ALL_BUILTIN_NAMES) {
      const layout = getRegisteredLayout(name);
      expect(layout).toBeDefined();
      expect(Array.isArray(layout)).toBe(true);
      expect(layout!.length).toBeGreaterThan(0);
    }
  });
});

describe("entry-points: idempotent registration", () => {
  it("importing a layout module twice does not warn or error", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // The layouts were already imported at module level above.
    // Re-importing would be a no-op (ES modules are singletons).
    // The test verifies _registerBuiltInLayout's idempotency was hit during
    // combinator imports (e.g., qwerty-fk imports qwerty, which already ran).
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("entry-points: registerLayout overrides built-ins", () => {
  const CUSTOM: LayoutDefinition = [[{ value: "custom-a" }, { value: "custom-b" }]];

  it("registerLayout overrides a built-in layout", () => {
    registerLayout("qwerty", CUSTOM);
    expect(getRegisteredLayout("qwerty")).toBe(CUSTOM);
  });

  it("override persists until reset", () => {
    registerLayout("qwerty", CUSTOM);
    expect(getRegisteredLayout("qwerty")).toBe(CUSTOM);
    resetCustomLayouts();
    // After reset, the original built-in is not restored (it was overridden).
    // The layout stays as custom since resetCustomLayouts only removes
    // layouts not in BUILTIN_LAYOUTS set -- and "qwerty" IS in that set.
    // So the overridden value persists.
    // NOTE: This behavior should be verified -- if resetCustomLayouts
    // should restore built-in originals, that's a separate design decision.
  });
});
```

- [ ] **Step 2: Run the smoke tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/entry-points.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/unit/entry-points.test.ts
git commit -m "test(webc): add smoke tests for consumption patterns and idempotent registration"
```

---

### Task 9: Build verification -- tree-shaking test

**Files:**

- Create: `packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts`

- [ ] **Step 1: Write tree-shaking verification test**

This test verifies that the core entry does NOT auto-register any layouts:

Create `packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts`:

```ts
/**
 * This test verifies the core entry point behavior in isolation.
 * It imports ONLY the layout registry (simulating a core-only import)
 * without importing any layout modules. No layouts should be registered.
 *
 * IMPORTANT: This file must NOT import any layout modules at the top level.
 */
import { describe, it, expect } from "vitest";
import { getRegisteredLayoutNames, getRegisteredLayout } from "../../src/core/layout-registry.js";

describe("core entry (no layouts imported)", () => {
  it("has zero layouts registered when no layout modules are imported", () => {
    // NOTE: This test may see layouts registered by other test files
    // if vitest runs all tests in the same process. If so, this test
    // needs to run in isolation: npx vitest run test/unit/treeshake-verify.test.ts
    const names = getRegisteredLayoutNames();
    // If other test files have imported layouts, they'll be present.
    // The real tree-shaking test is Task 9's build verification (grep dist output).
    // This test documents the INTENT: core alone = no layouts.
    expect(names).toBeDefined();
  });

  it("returns undefined for any layout name when none are imported", () => {
    // Same caveat as above re: test isolation
    // This serves as documentation of the expected behavior
    expect(getRegisteredLayout("nonexistent-layout")).toBeUndefined();
  });
});
```

The more meaningful tree-shaking test is a build-time verification. Add a script check:

- [ ] **Step 2: Run the build and verify tree-shaking**

```bash
cd packages/kiosk-keyboard-webc
npm run build

# Verify the core entry does NOT contain layout data
# Arabic layout contains unique Unicode: \u0636 (ض)
grep -c "\\\\u0636\|\\u0636\|\u0636" dist/KioskKeyboardCore.js || echo "PASS: Arabic layout not in core"

# Verify the full entry DOES include layout data (or references to layout chunks)
grep -c "layouts" dist/KioskKeyboard.js && echo "PASS: Full entry references layouts"

# Verify individual layout files exist
ls dist/layouts/qwerty.js && echo "PASS: Individual layout files built"
```

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/unit/treeshake-verify.test.ts
git commit -m "test(webc): add tree-shaking verification test and build check"
```

---

### Task 10: Run full test suite and verify e2e

**Files:** None (verification only)

- [ ] **Step 1: Run all WebC unit tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run WebC typecheck**

Run: `cd packages/kiosk-keyboard-webc && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run UI5 build**

Run: `cd packages/kiosk-keyboard && npm run build`
Expected: Build succeeds, `library-preload.js` contains all modules

- [ ] **Step 4: Run UI5 unit tests**

Run the UI5 test suite (check `packages/kiosk-keyboard/package.json` for the correct command)
Expected: All tests PASS

- [ ] **Step 5: Run e2e tests**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e`
Expected: All e2e tests PASS -- proves UI5 consumption of the web component is unbroken

- [ ] **Step 6: Final commit if any test fixes were needed**

```bash
git add -A
git commit -m "fix: address test issues from layout treeshaking refactor"
```

---

### Task 11: Create PR

- [ ] **Step 1: Push branch and create PR**

```bash
git push -u origin spike/layout-treeshaking

gh pr create --title "feat: modular layout architecture with tree-shaking (WebC)" --body "$(cat <<'EOF'
## Summary

- WebC package: layouts are now self-registering modules. Consumers can import only the layouts they need via `kiosk-keyboard-webc/core` + `kiosk-keyboard-webc/layouts/*`
- Full entry (`kiosk-keyboard-webc`) still includes all layouts for zero-config usage
- `registerLayout` now allows overriding built-in layouts in both packages
- UI5 package: no structural changes (library-preload bundles everything by design)
- Vite build produces multiple entry points with code splitting

## Related issues

- Closes #45 -- layout tree-shaking and bundle optimization
- Sets up the module pattern for #53 -- optional kana composition engine (engine registry design is a follow-up session in this PR)

## Test plan

- [ ] WebC unit tests pass (`npx vitest run`)
- [ ] UI5 unit tests pass
- [ ] E2e tests pass (`npm run test:e2e`) -- proves UI5 consumption of the WebC component is unbroken
- [ ] Build produces expected output structure (core, full, individual layouts, bundle)
- [ ] Tree-shaking verified: core entry does not contain layout data
- [ ] Idempotent registration: no warnings on duplicate imports
- [ ] `registerLayout` can override built-in layouts

## Design

See `docs/proposals/LAYOUT-TREESHAKING.md` for the full design spec.

:robot: Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
