# HotkeyManager Instance Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HotkeyManager singleton with a Component-owned instance, remove manager-level router methods, harden the scope stack, and document the new lifecycle pattern.

**Architecture:** The singleton (`_instance` / `getInstance()`) is removed. `HotkeyManager` becomes a regular class with a public constructor. The Component creates it in `init()` and destroys it in `exit()`. Controllers access it via `getOwnerComponent().getHotkeyManager()`. Router integration stays on `RegistrationGroup` only. Scope stack gains guards against pushing `GLOBAL_SCOPE` or duplicating the top scope.

**Tech Stack:** TypeScript, SAPUI5, QUnit (unit tests), WebDriverIO (E2E tests)

**Supersedes:** `docs/plans/2026-04-07-readme-review-flp-cleanup.md` (obsolete)

---

### Task 1: Update Test Helpers

**Files:**

- Modify: `packages/hotkeys/test/qunit/test-helpers.ts`

The test helpers currently depend on the singleton. We update them to manage a module-level tracked instance instead. This is the foundation for all test file migrations.

- [ ] **Step 1: Rewrite test-helpers.ts**

Replace the `destroyHotkeyManager` and `resetHotkeyManager` functions:

```typescript
// Before:
export function destroyHotkeyManager(): void {
  try {
    HotkeyManager.getInstance().destroy();
  } catch {
    // Not initialized yet or already destroyed
  }
}

export function resetHotkeyManager(): HotkeyManager {
  destroyHotkeyManager();
  return HotkeyManager.getInstance();
}
```

```typescript
// After:
let _testManager: HotkeyManager | null = null;

/**
 * Destroy the currently tracked test HotkeyManager instance.
 * Safe to call when no instance exists or when already destroyed.
 */
export function destroyHotkeyManager(): void {
  if (!_testManager) return;
  try {
    _testManager.destroy();
  } catch {
    // Already destroyed
  }
  _testManager = null;
}

/**
 * Create a fresh HotkeyManager for testing.
 * Destroys the previous tracked instance first.
 */
export function createHotkeyManager(): HotkeyManager {
  destroyHotkeyManager();
  _testManager = new HotkeyManager();
  return _testManager;
}
```

Also remove the `HotkeyManager` import's dependency on `getInstance` -- the import stays but is now used for construction only.

Note: `resetHotkeyManager` is renamed to `createHotkeyManager` to reflect the new semantics (creating, not resetting a singleton).

- [ ] **Step 2: Verify the file compiles**

This will have type errors until `HotkeyManager` constructor is made public (Task 2). Expected at this stage. Proceed to Task 2.

---

### Task 2: HotkeyManager Core Changes

**Files:**

- Modify: `packages/hotkeys/src/HotkeyManager.ts`

This task removes the singleton pattern, removes manager-level router methods, and adds scope stack guards. All in one file.

- [ ] **Step 1: Remove the singleton pattern**

In `packages/hotkeys/src/HotkeyManager.ts`:

**Delete** the static field (line 155):

```typescript
// DELETE THIS:
private static _instance: HotkeyManager | null = null;
```

**Delete** the `getInstance()` method (lines 197-210):

```typescript
// DELETE THIS ENTIRE METHOD:
static getInstance(): HotkeyManager {
  if (!HotkeyManager._instance || HotkeyManager._instance._destroyed) {
    HotkeyManager._instance = new HotkeyManager();
  }
  return HotkeyManager._instance;
}
```

**Update** the constructor JSDoc (line 179-181). Remove "Not intended to be called directly":

```typescript
// Before:
/**
 * Not intended to be called directly. Use `HotkeyManager.getInstance()`.
 */
constructor() {

// After:
/**
 * Create a new HotkeyManager instance.
 *
 * Typically created once in `Component.init()` and destroyed in
 * `Component.exit()`. Controllers access it via
 * `getOwnerComponent().getHotkeyManager()`.
 */
constructor() {
```

**Update** the `destroy()` method: remove the line that nulls the static reference (line 825):

```typescript
// DELETE THIS LINE from destroy():
HotkeyManager._instance = null;
```

**Update** the `destroy()` JSDoc (lines 782-792):

```typescript
// Before:
/**
 * Destroy the manager: remove all listeners, clear registrations,
 * and null the singleton reference.
 *
 * Follows UI5 `BaseObject.destroy()` pattern. Call from
 * `Component.exit()` to ensure proper FLP cross-app cleanup.
 *
 * After destruction, all existing references become permanently
 * invalid (methods throw via `_assertAlive`). A subsequent
 * `getInstance()` creates a fresh manager with no registrations.
 */

// After:
/**
 * Destroy the manager: remove all DOM listeners, finalize all groups,
 * clear all registrations, and reset internal state.
 *
 * Call from `Component.exit()` to ensure proper cleanup.
 * After destruction, all methods throw via `_assertAlive`.
 */
```

- [ ] **Step 2: Remove manager-level router methods**

In the same file, **delete** these three methods and their JSDoc:

1. `enableRouterIntegration(router)` (lines ~478-533) -- the entire method and its JSDoc
2. `disableRouterIntegration()` (lines ~535-550) -- the entire method and its JSDoc
3. `hasRouterIntegration()` (lines ~552-558) -- the entire method and its JSDoc

Also **delete** the private field (line 165):

```typescript
// DELETE:
private _routerCleanup: (() => void) | null = null;
```

And **remove** the router cleanup from `destroy()` (lines 796-799):

```typescript
// DELETE these lines from destroy():
if (this._routerCleanup) {
  this._routerCleanup();
  this._routerCleanup = null;
}
```

Also remove the `RouterLike` type re-export if it's exported from this file for the manager methods. Check the import -- `RouterLike` is used by `RegistrationGroup` too, so keep the type definition but verify it's still exported correctly.

- [ ] **Step 3: Add scope stack guards**

In `pushScope()` (line 404), add two guards after normalization:

```typescript
pushScope(scopeId: string): void {
  this._assertAlive("pushScope");
  const normalized = resolveRequiredScope(scopeId);

  // Guard: GLOBAL_SCOPE must never be pushed manually
  if (normalized === GLOBAL_SCOPE) {
    throw new Error("Cannot push the global scope -- it is always at the bottom of the stack");
  }

  // Guard: reject duplicate top scope (likely a bug -- double push or router misfiring)
  const top = this._scopeStack.at(-1);
  if (top === normalized) {
    throw new Error(`Cannot push scope "${normalized}": it is already the active scope`);
  }

  this._scopeStack.push(normalized);
  Log.debug(`Pushed scope "${normalized}" (stack depth: ${this._scopeStack.length})`, undefined, LOG_COMPONENT);
}
```

This requires importing `GLOBAL_SCOPE` -- check if it's already imported (it is, from `"./internal/constants"`).

- [ ] **Step 4: Remove the class-level JSDoc example that references getInstance**

The class JSDoc (around line 100-147) has example code using `getInstance()`. Update it:

```typescript
// Before (in class JSDoc):
// const manager = HotkeyManager.getInstance();

// After:
// const manager = new HotkeyManager();
```

Scan the entire class JSDoc for other `getInstance()` references and update them.

- [ ] **Step 5: Type-check the hotkeys package**

```bash
cd packages/hotkeys && npx tsc --noEmit
```

Expected: errors in test files (they still reference `getInstance`). The source itself should compile clean. If there are source errors, fix them before proceeding.

- [ ] **Step 6: Commit core changes**

```bash
git add packages/hotkeys/src/HotkeyManager.ts
git commit -m "refactor(hotkeys): replace singleton with instance-based lifecycle

Remove getInstance() and static _instance. HotkeyManager is now
created via 'new HotkeyManager()' and owned by the Component.

Remove manager-level enableRouterIntegration/disableRouterIntegration/
hasRouterIntegration -- group-level methods remain.

Add scope stack guards: pushScope rejects GLOBAL_SCOPE and
duplicate top scope."
```

---

### Task 3: Migrate All QUnit Tests

**Files:**

- Modify: `packages/hotkeys/test/qunit/test-helpers.ts` (already updated in Task 1)
- Modify: All 11 test files listed below

The migration follows a mechanical pattern. In every test file:

1. Replace `import { ..., resetHotkeyManager }` with `import { ..., createHotkeyManager }`
2. Replace every `HotkeyManager.getInstance()` with `createHotkeyManager()`
3. Keep `destroyHotkeyManager()` in beforeEach/afterEach (it still works)
4. Remove `import HotkeyManager from "ui5/hotkeys/HotkeyManager"` if the only use was `getInstance()`. Keep it if the file uses `HotkeyManager` as a type.

**The 11 test files:**

1. `HotkeyManager.qunit.ts`
2. `HotkeyManager-blackbox.qunit.ts`
3. `HotkeyRecorder.qunit.ts`
4. `KeyStateTracker.qunit.ts`
5. `RegistrationGroup.qunit.ts`
6. `SequenceManager.qunit.ts`
7. `SequenceManager-blackbox.qunit.ts`
8. `dialog-scope.qunit.ts`
9. `event-dispatcher.qunit.ts`
10. `negative-edge-cases.qunit.ts`
11. `router-integration.qunit.ts`

- [ ] **Step 1: Finalize test-helpers.ts**

Apply the changes from Task 1 Step 1. Also rename the export:

```typescript
// The import in test files changes from:
import { destroyHotkeyManager, resetHotkeyManager, fireKey } from "./test-helpers";
// To:
import { destroyHotkeyManager, createHotkeyManager, fireKey } from "./test-helpers";
```

The `HotkeyManager` import in test-helpers.ts stays (used for construction).

- [ ] **Step 2: Bulk-migrate 10 standard test files**

For each of the 11 test files EXCEPT `router-integration.qunit.ts` (handled separately):

1. Replace `HotkeyManager.getInstance()` with `createHotkeyManager()` globally
2. Update imports: add `createHotkeyManager` to the test-helpers import, remove `resetHotkeyManager` if present
3. If the file imports `HotkeyManager` only for `getInstance()`, change to a type-only import or remove

Example transformation in `RegistrationGroup.qunit.ts`:

```typescript
// Before:
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { destroyHotkeyManager, fireKey } from "./test-helpers";
// ...
const manager = HotkeyManager.getInstance();

// After:
import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";
// ...
const manager = createHotkeyManager();
```

- [ ] **Step 3: Handle special cases in HotkeyManager.qunit.ts**

Three tests need individual attention:

**a)** Remove the singleton identity test (line 28-32):

```typescript
// DELETE THIS TEST:
QUnit.test("getInstance returns singleton", (assert) => {
  const a = HotkeyManager.getInstance();
  const b = HotkeyManager.getInstance();
  assert.strictEqual(a, b, "Same instance returned");
});
```

**b)** Update the duplicate pushScope test (line 325-354). The new guard rejects `pushScope("editor")` when "editor" is already the top. Replace the test:

```typescript
QUnit.test("pushScope rejects duplicate top scope", (assert) => {
  const manager = createHotkeyManager();

  manager.pushScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor");

  assert.throws(() => manager.pushScope("editor"), /already the active scope/, "Duplicate top scope is rejected");

  // Different scope on top is fine
  manager.pushScope("dialog");
  assert.strictEqual(manager.getActiveScope(), "dialog");
});
```

**c)** Add a new test for the GLOBAL_SCOPE guard:

```typescript
QUnit.test("pushScope rejects GLOBAL_SCOPE", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(
    () => manager.pushScope("__global__"),
    /Cannot push the global scope/,
    "Pushing GLOBAL_SCOPE is rejected",
  );
});
```

- [ ] **Step 4: Migrate router-integration.qunit.ts**

This file has the most significant changes because manager-level router methods are removed. All tests must switch to group-level `enableRouterIntegration()`.

Replace the entire file content. The key changes:

- Every test creates a group and calls `group.enableRouterIntegration(router)` instead of `manager.enableRouterIntegration(router)`
- Tests for `hasRouterIntegration()` are removed (no group-level equivalent)
- Tests for `disableRouterIntegration()` are rewritten: disabling = `group.destroyAll()` + create new group
- The "Detach cleanup on destroy" test creates two managers sequentially (no singleton re-fetch)

Example transformation for a typical test:

```typescript
// Before:
QUnit.test("Route change pushes scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router);
  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");
});

// After:
QUnit.test("Route change pushes scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router);
  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");
});
```

For "Detach cleanup on destroy":

```typescript
// After:
QUnit.test("Detach cleanup on destroy", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  manager.destroy();

  // Create a completely fresh manager -- old router should have no effect
  const newManager = createHotkeyManager();
  router.fireRouteMatched("detail");
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "New manager unaffected by old router");
});
```

For `hasRouterIntegration` and `disableRouterIntegration` tests: **delete them entirely**. These methods no longer exist. Group-level cleanup is tested via `destroyAll()` in the RegistrationGroup test file.

The "disableRouterIntegration: disable stops scope updates" test can be rewritten as a group-level test:

```typescript
QUnit.test("destroyAll detaches router integration", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  group.destroyAll();
  router.fireRouteMatched("detail");
  // Scope should NOT change -- router listener was detached by destroyAll
  assert.strictEqual(manager.getActiveScope(), "main", "Scope unchanged after group destroyed");
});
```

- [ ] **Step 5: Run the full QUnit test suite**

```bash
cd packages/hotkeys && npm test
```

Expected: all tests pass. If any fail, fix before proceeding. Common issues:

- Missed `getInstance()` call (grep for it: `grep -r "getInstance" packages/hotkeys/test/`)
- Import path issues after removing `HotkeyManager` direct import
- Test ordering issues (tests that depended on singleton state from a previous test)

- [ ] **Step 6: Commit test migration**

```bash
git add packages/hotkeys/test/qunit/
git commit -m "test(hotkeys): migrate all QUnit tests from singleton to instance pattern

Replace getInstance() with createHotkeyManager() across 11 test files.
Remove singleton identity test. Rewrite router integration tests
to use group-level API. Add scope guard tests."
```

---

### Task 4: Update Demo App

**Files:**

- Modify: `packages/demo-app/webapp/Component.ts`

The controllers already use `getTypedComponent().getHotkeyManager()` -- no controller changes needed. Only the Component needs updating.

- [ ] **Step 1: Update Component.ts**

Two changes:

**a)** Replace `getInstance()` with `new HotkeyManager()` (line 26):

```typescript
// Before:
this._hotkeyManager = HotkeyManager.getInstance();

// After:
this._hotkeyManager = new HotkeyManager();
```

**b)** Add `manager.destroy()` to `exit()` (lines 117-124):

```typescript
// Before:
exit(): void {
  this._hotkeys.destroyAll();
  document.removeEventListener("keydown", this._keyDownHandler, true);
}

// After:
exit(): void {
  // destroy() finalizes all groups, removes all DOM listeners, and
  // clears all internal state. No need to call destroyAll() separately.
  this._hotkeyManager.destroy();
  document.removeEventListener("keydown", this._keyDownHandler, true);
}
```

Note: `this._hotkeys.destroyAll()` is no longer needed because `manager.destroy()` finalizes all groups (via `group._onManagerDestroy()`). The group's handles become inactive and its router listener is detached. Calling `destroyAll()` before `destroy()` is harmless but redundant.

Also remove the comment block about the singleton surviving FLP cycles -- it no longer applies:

```typescript
// DELETE these comments (lines 118-121):
// Clean up only what this Component instance owns.
// The HotkeyManager singleton must not be destroyed here -- in FLP,
// modules survive Component destroy/recreate cycles.
// Router integration is cleaned up automatically on re-entry.
```

- [ ] **Step 2: Type-check the demo app**

```bash
cd packages/demo-app && npx tsc --noEmit
```

Expected: clean. The controllers don't reference `getInstance()` -- they go through the Component.

- [ ] **Step 3: Commit demo app changes**

```bash
git add packages/demo-app/webapp/Component.ts
git commit -m "refactor(demo-app): use instance-based HotkeyManager lifecycle

Component.init() creates the manager with 'new HotkeyManager()'.
Component.exit() calls manager.destroy() for clean teardown."
```

---

### Task 5: README Documentation

**Files:**

- Modify: `packages/hotkeys/README.md`

- [ ] **Step 1: Update Quick Start**

The Quick Start section (lines 216-254) currently shows `HotkeyManager.getInstance()` and `manager.enableRouterIntegration()`. Replace with the new pattern:

````markdown
## Quick Start

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

// In your Component.init():
const manager = new HotkeyManager();

// Create a group for collective lifecycle management
const hotkeys: RegistrationGroup = manager.createGroup();

// Enable automatic scope management via the router on the group
hotkeys.enableRouterIntegration(this.getRouter());

// Register a global shortcut
hotkeys.register(
  "Mod+S",
  (event) => {
    // Save logic -- Cmd+S on Mac, Ctrl+S on Windows/Linux
    MessageToast.show("Saved!");
  },
  { description: "Save" },
);

// Register a view-scoped shortcut (scope = route name)
hotkeys.register(
  "F5",
  () => {
    this.onRefresh();
  },
  { scope: "detail", description: "Refresh detail" },
);

// In Component.exit():
manager.destroy(); // Removes all listeners, finalizes all groups
```
````

````

- [ ] **Step 2: Update the HotkeyManager API table**

Remove `getInstance()`, `enableRouterIntegration()`, `disableRouterIntegration()`, `hasRouterIntegration()` from the table (lines 287-303). Add a note about the constructor.

```markdown
## HotkeyManager

The central manager for all keyboard shortcut registrations. Created in `Component.init()`, destroyed in `Component.exit()`.

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = new HotkeyManager();
````

````

Remove the four methods from the table. The remaining methods stay.

- [ ] **Step 3: Expand Registration Group section**

Replace the Registration Group section (lines 400-453) with the expanded version. Add subsections for:
- Groups and Lifecycle (table of lifecycle owners)
- Scope Stacking (visual diagram of the stack)
- Popup Overlay Pattern (dialog push/pop example)
- Router Integration (group-level, with code example)
- FLP Component Pattern (full Component.init/exit example with warning)

Use the content from the design spec at `docs/proposals/HOTKEYS-INSTANCE-LIFECYCLE.md` for the Component pattern, and the README content drafted in the earlier (now obsolete) plan for scope stacking and popup overlay.

- [ ] **Step 4: Update Router Integration section**

The standalone Router Integration section (lines 494-534) currently shows manager-level methods. Replace with a redirect to the group-level section:

```markdown
### Router Integration

See [Router Integration (Group-Level)](#router-integration-group-level) under Registration Group.

Route-based scope management is configured on a `RegistrationGroup` via `enableRouterIntegration(router)`. On each `beforeRouteMatched` event, the manager resets to global scope and pushes the matched route name. The listener is automatically detached when `destroyAll()` is called or when the manager is destroyed.

> [!IMPORTANT]
> Dialog scopes still require manual `pushScope`/`popScope` since they're not route-based.
````

- [ ] **Step 5: Update the Table of Contents**

Add new subsection entries and remove references to removed methods.

- [ ] **Step 6: Update API Stability imports section**

The "API Stability" section (lines 256-275) shows `import type { RouterLike } from "ui5/hotkeys/HotkeyManager"`. Verify this still works -- `RouterLike` is now only used by `RegistrationGroup`, but if it's still exported from `HotkeyManager.ts`, the import path is valid. If it was moved, update the import path.

- [ ] **Step 7: Scan for any remaining getInstance references**

```bash
grep -n "getInstance" packages/hotkeys/README.md
```

Expected: zero matches. Fix any remaining references.

- [ ] **Step 8: Commit README**

```bash
git add packages/hotkeys/README.md
git commit -m "docs(hotkeys): document instance lifecycle, scope stacking, and FLP pattern

Update Quick Start and API table for instance-based HotkeyManager.
Add scope stacking diagram, popup overlay pattern, and FLP
Component pattern with explicit destroy() in exit()."
```

---

### Task 6: Full Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run the full hotkeys test suite**

```bash
cd packages/hotkeys && npm test
```

Expected: all QUnit tests pass.

- [ ] **Step 2: Type-check the entire monorepo**

```bash
npm run typecheck
```

Or if no monorepo-level typecheck script:

```bash
cd packages/hotkeys && npx tsc --noEmit && cd ../demo-app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Grep for any remaining singleton references**

```bash
grep -r "getInstance" packages/hotkeys/src/ packages/demo-app/webapp/
grep -r "_instance" packages/hotkeys/src/
grep -r "enableRouterIntegration\|disableRouterIntegration\|hasRouterIntegration" packages/hotkeys/src/HotkeyManager.ts
```

Expected: zero matches in all three.

- [ ] **Step 4: Run the FLP E2E test**

```bash
cd packages/kiosk-keyboard && npm run test:e2e:flp
```

Expected: 3 passing tests. The FLP test validates the Component re-entry lifecycle. With instance-based management, each re-entry creates a fresh manager via `new HotkeyManager()` in `Component.init()`. The destroy in `Component.exit()` ensures clean teardown between sessions.

- [ ] **Step 5: Run the main kiosk E2E tests**

```bash
cd packages/kiosk-keyboard && npm run test:e2e
```

Expected: all passing. These tests don't directly use HotkeyManager but verify the demo app works end-to-end.

- [ ] **Step 6: Delete the obsolete plan**

```bash
rm docs/plans/2026-04-07-readme-review-flp-cleanup.md
```

- [ ] **Step 7: Final commit**

```bash
git add docs/plans/
git commit -m "chore: remove obsolete plan, superseded by instance lifecycle plan"
```
