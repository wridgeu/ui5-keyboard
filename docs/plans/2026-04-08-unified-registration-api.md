# Unified Registration API - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge sequence registration into `register()` using space-separated hotkey strings, remove the separate sequence API surface.

**Architecture:** Detect sequences by splitting the hotkey string on whitespace. Route multi-step strings to the internal SequenceManager. Wrap the returned SequenceRegistrationHandle in a unified HotkeyRegistrationHandle. Merge sequence introspection into existing getRegistrations/findRegistrations methods.

**Tech Stack:** TypeScript, QUnit, WDIO, sinon (fake timers for sequence tests)

**Spec:** `docs/specs/2026-04-08-unified-registration-api.md`

---

### Task 1: Add `timeout` and `onPending` to HotkeyOptions and extend info/handle types

**Files:**

- Modify: `packages/hotkeys/src/types.ts`

- [ ] **Step 1: Add `timeout` and `onPending` to `HotkeyOptions`**

In `packages/hotkeys/src/types.ts`, add two fields to the `HotkeyOptions` interface (after line 227, before the closing brace):

```ts
  /**
   * Timeout in ms between sequence steps before the sequence resets.
   * Only applies to multi-key sequences (space-separated hotkey strings).
   * Ignored for single-key hotkeys.
   * @default 1000
   */
  timeout?: number;

  /**
   * Progress callback for intermediate sequence steps.
   * Fires after each intermediate key with progress info.
   * Only applies to multi-key sequences. Ignored for single-key hotkeys.
   */
  onPending?: SequencePendingCallback;
```

Note: `SequencePendingCallback` is already defined at the bottom of this file (line 488). The reference will resolve.

- [ ] **Step 2: Add `sequence` to `HotkeyRegistrationHandle`**

Add after the `description` field (line 275):

```ts
  /** The sequence steps if this is a sequence registration, or `null` for single-key hotkeys. */
  readonly sequence: readonly string[] | null;
```

- [ ] **Step 3: Add `sequence` and `timeout` to `HotkeyRegistrationInfo`**

Add after the `hasTarget` field (line 307):

```ts
  /** The sequence steps if this is a sequence registration, or `null` for single-key hotkeys. */
  readonly sequence: readonly string[] | null;
  /** The sequence step timeout in ms, or `null` for single-key hotkeys. */
  readonly timeout: number | null;
```

- [ ] **Step 4: Add `timeout` and `onPending` to `UpdatableHotkeyOptions`**

No code change needed -- `UpdatableHotkeyOptions` is defined as `Omit<HotkeyOptions, "scope" | "conflictBehavior">`, so `timeout` and `onPending` are automatically included.

- [ ] **Step 5: Move sequence-only types to internal**

The internal `SequenceManager` class still uses `SequenceOptions`, `SequenceRegistrationHandle`, `SequenceRegistrationInfo`, and `UpdatableSequenceOptions`. These must remain available internally but not be part of the public API.

Move them from `packages/hotkeys/src/types.ts` to `packages/hotkeys/src/internal/types.ts`:

- Cut the entire "Sequence types" section (lines 396-493) from `types.ts`
- Paste `SequenceOptions`, `UpdatableSequenceOptions`, `SequenceRegistrationHandle`, `SequenceRegistrationInfo` into `internal/types.ts`
- Keep `SequencePendingCallback` in `types.ts` (it's used by the public `HotkeyOptions.onPending`)
- Add `import type { SequencePendingCallback } from "../types";` to `internal/types.ts` since `SequenceOptions.onPending` references it
- Update `SequenceManager.ts` imports to pull these types from `"./types"` instead of `"../types"`:

```ts
// In SequenceManager.ts, change:
import type {
  HotkeyCallback,
  Platform,
  SequenceOptions,
  SequencePendingCallback,
  SequenceRegistrationHandle,
  SequenceRegistrationInfo,
  UpdatableSequenceOptions,
} from "../types";

// To:
import type { HotkeyCallback, Platform, SequencePendingCallback } from "../types";
import type {
  SequenceOptions,
  SequenceRegistrationHandle,
  SequenceRegistrationInfo,
  UpdatableSequenceOptions,
} from "./types";
```

- Update `HotkeyManager.ts` to import these from `"./internal/types"` where still needed (for `_registerSequence()`).

- [ ] **Step 6: Verify typecheck fails as expected**

Run: `npx tsc --noEmit -p packages/hotkeys/tsconfig.json 2>&1 | head -30`

Expected: Compilation errors in HotkeyManager.ts, RegistrationGroup.ts, and test files referencing the removed types. This confirms the types are properly wired.

- [ ] **Step 7: Commit**

```bash
git add packages/hotkeys/src/types.ts
git commit -m "refactor(hotkeys)!: unify hotkey and sequence types in HotkeyOptions"
```

---

### Task 2: Update HotkeyManager to detect sequences and route through `register()`

**Files:**

- Modify: `packages/hotkeys/src/HotkeyManager.ts`

- [ ] **Step 1: Add a sequence detection helper**

Add before the `HotkeyManager` class definition (after line 106):

```ts
/**
 * Split a hotkey string into sequence steps.
 * Returns null if the string is a single-key hotkey.
 * Whitespace between key descriptors separates steps (matching tinykeys/@github/hotkey convention).
 */
function parseSequenceSteps(hotkey: string): string[] | null {
  const steps = hotkey.trim().split(/\s+/);
  return steps.length > 1 ? steps : null;
}
```

- [ ] **Step 2: Update `register()` to detect and route sequences**

Replace the current `register()` method (lines 198-291) with sequence-aware logic. The method must:

1. Call `parseSequenceSteps(hotkey)` first
2. If non-null (sequence), delegate to `_registerSequence()` and return a unified handle
3. If null (single key), proceed with existing logic

Add at the start of `register()`, after `this._assertAlive("register")`:

```ts
const sequenceSteps = parseSequenceSteps(hotkey);
if (sequenceSteps) {
  return this._registerSequence(hotkey, sequenceSteps, callback, options);
}
```

- [ ] **Step 3: Add `_registerSequence()` private method**

Add a new private method that maps `HotkeyOptions` to the internal `SequenceManager.registerSequence()` call and wraps the returned handle:

```ts
  private _registerSequence(
    hotkey: string,
    steps: string[],
    callback: HotkeyCallback,
    options?: HotkeyOptions,
  ): HotkeyRegistrationHandle {
    const seqOptions = {
      description: options?.description,
      timeout: options?.timeout,
      scope: options?.scope,
      enabled: options?.enabled,
      ignoreInputs: options?.ignoreInputs,
      preventDefault: options?.preventDefault,
      stopPropagation: options?.stopPropagation,
      onPending: options?.onPending,
    };

    const innerHandle = this._getSequenceManager().registerSequence(steps, callback, seqOptions);

    const handle: HotkeyRegistrationHandle = {
      get id() {
        return innerHandle.id;
      },
      get isActive() {
        return innerHandle.isActive;
      },
      get hotkey() {
        return hotkey;
      },
      get sequence() {
        return innerHandle.sequence;
      },
      get scope() {
        return innerHandle.scope;
      },
      get description() {
        return innerHandle.description;
      },
      unregister: () => {
        innerHandle.unregister();
      },
      setOptions: (newOptions: Partial<UpdatableHotkeyOptions>) => {
        if ("scope" in newOptions) {
          throw new Error("Cannot change scope via setOptions - unregister and re-register instead");
        }
        if ("conflictBehavior" in newOptions) {
          throw new Error("Cannot change conflictBehavior via setOptions - unregister and re-register instead");
        }
        // Map to SequenceManager's setOptions, passing only fields it understands
        innerHandle.setOptions({
          description: newOptions.description,
          timeout: newOptions.timeout,
          enabled: newOptions.enabled,
          ignoreInputs: newOptions.ignoreInputs,
          preventDefault: newOptions.preventDefault,
          stopPropagation: newOptions.stopPropagation,
          onPending: newOptions.onPending,
        });
      },
    };

    return handle;
  }
```

- [ ] **Step 4: Add `sequence` property to the existing single-hotkey handle**

In the existing `register()` method's handle literal (around line 229), add:

```ts
      get sequence() {
        return null;
      },
```

- [ ] **Step 5: Update `_toRegistrationInfo()` to include `sequence` and `timeout`**

In the return object of `_toRegistrationInfo()` (around line 538), add:

```ts
      sequence: null,
      timeout: null,
```

- [ ] **Step 6: Remove the public sequence facade methods**

Delete these methods from HotkeyManager:

- `registerSequence()` (lines 572-579)
- `setSequencePendingHandler()` (lines 590-593)
- `getSequenceRegistrations()` (lines 598-601)
- `getSequenceRegistrationsForScope()` (lines 606-610)

Keep `_getSequenceManager()` (private, still needed).

- [ ] **Step 7: Update `getRegistrations()` to include sequences**

Replace the current implementation (line 462-464):

```ts
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    const hotkeys = Array.from(this._registrations.values()).map((r) => this._toRegistrationInfo(r));
    if (!this._sequenceManager) return hotkeys;
    const sequences = this._sequenceManager.getRegistrations().map((s) => this._sequenceRegToInfo(s));
    return [...hotkeys, ...sequences];
  }
```

- [ ] **Step 8: Update `getRegistrationsForScope()` to include sequences**

After the existing return statement (around line 491), merge in filtered sequence registrations:

```ts
  getRegistrationsForScope(scopeId: string): ReadonlyArray<HotkeyRegistrationInfo> {
    const normalizedScope = resolveScopeOrGlobal(scopeId);
    const bucket = this._registrationsByScope.get(normalizedScope);

    const result: HotkeyRegistrationInfo[] = [];
    if (bucket) {
      const seen = new Set<string>();
      const addFromIds = (ids: Iterable<string>) => {
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          const reg = this._registrations.get(id);
          if (reg) result.push(this._toRegistrationInfo(reg));
        }
      };

      addFromIds(bucket.untargetedIds);
      for (const ids of bucket.targets.values()) {
        addFromIds(ids);
      }
      addFromIds(bucket.callbackTargetIds);
    }

    // Merge in sequence registrations for this scope
    if (this._sequenceManager) {
      const seqRegs = this._sequenceManager.getRegistrations().filter((r) => r.scope === normalizedScope);
      for (const s of seqRegs) {
        result.push(this._sequenceRegToInfo(s));
      }
    }

    return result;
  }
```

- [ ] **Step 9: Update `findRegistrations()` to include sequences**

Replace the current implementation (lines 509-513):

```ts
  findRegistrations(predicate: (info: HotkeyRegistrationInfo) => boolean): ReadonlyArray<HotkeyRegistrationInfo> {
    const all = this.getRegistrations();
    return all.filter(predicate);
  }
```

- [ ] **Step 10: Add `_sequenceRegToInfo()` helper**

Add a private method to map SequenceManager's internal info to the unified HotkeyRegistrationInfo shape:

```ts
  private _sequenceRegToInfo(s: {
    id: string;
    sequence: readonly string[];
    scope: string;
    description: string;
    enabled: boolean;
    timeout: number;
    ignoreInputs: boolean | "auto";
    preventDefault: boolean;
    stopPropagation: boolean;
  }): HotkeyRegistrationInfo {
    return {
      id: s.id,
      hotkey: s.sequence.join(" "),
      normalizedHotkey: s.sequence.join(" "),
      scope: s.scope,
      description: s.description,
      enabled: s.enabled,
      preventDefault: s.preventDefault,
      stopPropagation: s.stopPropagation,
      ignoreInputs: s.ignoreInputs,
      ignoreRepeat: true,
      suppressInPopups: false,
      conflictBehavior: "warn" as ConflictBehavior,
      hasTarget: false,
      sequence: s.sequence,
      timeout: s.timeout,
    };
  }
```

- [ ] **Step 11: Remove `_getSequenceRegistrationInfoByIds()`**

Delete the method at lines 1054-1057. It was only used by RegistrationGroup.

- [ ] **Step 12: Update imports**

Remove `SequenceOptions`, `SequenceRegistrationHandle`, `SequenceRegistrationInfo` from the imports at the top of HotkeyManager.ts. Keep `SequencePendingCallback` if it's referenced (it won't be directly -- it flows through `HotkeyOptions`).

- [ ] **Step 13: Commit**

```bash
git add packages/hotkeys/src/HotkeyManager.ts
git commit -m "refactor(hotkeys)!: route sequences through register(), remove sequence facade"
```

---

### Task 3: Update RegistrationGroup to use unified register()

**Files:**

- Modify: `packages/hotkeys/src/RegistrationGroup.ts`

- [ ] **Step 1: Remove `registerSequence()` method**

Delete the `registerSequence()` method (lines 113-147).

- [ ] **Step 2: Remove `_sequenceHandles` field and all references**

- Delete `private _sequenceHandles: Set<SequenceRegistrationHandle> = new Set();` (line 47)
- In `destroyAll()` (lines 197-200), remove the `_sequenceHandles` iteration and `.clear()` call
- In `_onManagerDestroy()` (line 215), remove `this._sequenceHandles.clear();`
- In `get size()` (line 227), change to `return this._handles.size;`

- [ ] **Step 3: Remove `getSequenceRegistrations()` method**

Delete the method at lines 245-252.

- [ ] **Step 4: Update `getRegistrations()` to include sequences**

The group's `getRegistrations()` currently only returns hotkey registrations. Since sequences now go through `register()` and return `HotkeyRegistrationHandle`, they are already tracked in `_handles`. The existing implementation (lines 233-239) uses `_getRegistrationInfoByIds()` which only looks in the hotkey map. Update it to also check sequences:

```ts
  getRegistrations(): ReadonlyArray<HotkeyRegistrationInfo> {
    if (this._handles.size === 0) return [];
    const ids = new Set<string>();
    for (const handle of this._handles) {
      ids.add(handle.id);
    }
    // _getRegistrationInfoByIds returns hotkey-only; merge with full getRegistrations
    // which includes sequences, then filter to only IDs in this group
    return this._manager.getRegistrations().filter((info) => ids.has(info.id));
  }
```

- [ ] **Step 5: Add `sequence` getter to the wrapped handle**

In the `register()` method's `wrappedHandle` literal (around line 72), add:

```ts
      get sequence() {
        return innerHandle.sequence;
      },
```

- [ ] **Step 6: Update imports**

Remove `SequenceOptions`, `SequenceRegistrationHandle`, `SequenceRegistrationInfo` from the import block (lines 6-14).

- [ ] **Step 7: Update class JSDoc**

Update the example in the class-level JSDoc (lines 31-41) to use the unified `register()`:

````ts
 * @example
 * ```ts
 * private _hotkeys = this._manager.createGroup();
 *
 * onInit(): void {
 *   this._hotkeys.register("F5", handler, { scope: "main" });
 *   this._hotkeys.register("g i", handler, { scope: "main" });
 * }
 *
 * onExit(): void {
 *   this._hotkeys.destroyAll();
 * }
 * ```
````

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit -p packages/hotkeys/tsconfig.json`

Expected: Pass (source code compiles). Test files will still fail -- that's Task 4.

- [ ] **Step 9: Commit**

```bash
git add packages/hotkeys/src/RegistrationGroup.ts
git commit -m "refactor(hotkeys)!: remove registerSequence from RegistrationGroup"
```

---

### Task 4: Rewrite sequence tests to use unified register()

**Files:**

- Modify: `packages/hotkeys/test/qunit/SequenceManager.qunit.ts`
- Modify: `packages/hotkeys/test/qunit/SequenceManager-blackbox.qunit.ts`
- Modify: `packages/hotkeys/test/qunit/RegistrationGroup.qunit.ts`
- Modify: `packages/hotkeys/test/qunit/HotkeyManager.qunit.ts`
- Modify: `packages/hotkeys/test/qunit/negative-edge-cases.qunit.ts`
- Modify: `packages/hotkeys/test/qunit/event-dispatcher.qunit.ts`

- [ ] **Step 1: Rewrite SequenceManager.qunit.ts**

Replace all `manager.registerSequence(["G", "E"], cb)` calls with `manager.register("G E", cb)`.
Replace all `manager.registerSequence(["G", "E"], cb, opts)` calls with `manager.register("G E", cb, opts)`.

For `setSequencePendingHandler()` calls, convert to per-registration `onPending` option:

```ts
// Before:
manager.setSequencePendingHandler(pendingCb);
manager.registerSequence(["G", "E"], cb);

// After:
manager.register("G E", cb, { onPending: pendingCb });
```

Update any `handle.sequence` assertions to use the new unified handle (which already has `sequence`).

- [ ] **Step 2: Rewrite SequenceManager-blackbox.qunit.ts**

Same pattern: replace `registerSequence(["G", "E"], cb)` with `register("G E", cb)`.
Replace `setSequencePendingHandler` with per-registration `onPending`.

- [ ] **Step 3: Rewrite RegistrationGroup.qunit.ts**

Replace `group.registerSequence(["G", "I"], cb)` with `group.register("G I", cb)`.
Replace `group.getSequenceRegistrations()` with `group.getRegistrations()` (sequences are now included).
Update assertions that checked `.sequence` on the old `SequenceRegistrationHandle` to check `.sequence` on the unified handle.

For the `size` property tests, update expected counts since sequences are now in `_handles` instead of `_sequenceHandles`.

- [ ] **Step 4: Update HotkeyManager.qunit.ts**

Replace `manager.registerSequence(["G", "I"], cb, opts)` with `manager.register("G I", cb, opts)`.
Replace `manager.getSequenceRegistrationsForScope()` with `manager.getRegistrationsForScope()` and filter by `sequence !== null` if needed.

- [ ] **Step 5: Update negative-edge-cases.qunit.ts**

Replace any `registerSequence` calls with `register` using space-separated syntax.

- [ ] **Step 6: Update event-dispatcher.qunit.ts**

Replace any `registerSequence` calls with `register` using space-separated syntax.

- [ ] **Step 7: Run full typecheck**

Run: `npm run typecheck 2>&1`

Expected: All typecheck targets pass.

- [ ] **Step 8: Run tests**

Run: `npm run test -w packages/hotkeys 2>&1 | tail -5`

Expected: All spec files pass.

- [ ] **Step 9: Commit**

```bash
git add packages/hotkeys/test/
git commit -m "test(hotkeys): rewrite sequence tests to use unified register() API"
```

---

### Task 5: Update README and documentation

**Files:**

- Modify: `packages/hotkeys/README.md`
- Modify: `docs/hotkeys/ARCHITECTURE.md`
- Modify: `docs/hotkeys/SEQUENCES.md`

- [ ] **Step 1: Update README.md API table**

Remove the four sequence-specific rows from the API table:

- `registerSequence(seq, cb, opts?)`
- `getSequenceRegistrations()`
- `getSequenceRegistrationsForScope(id)`
- `setSequencePendingHandler(callback)`

Update the `register()` row description to mention sequence support:

```
| `register(hotkey, cb, opts?)`          | Register a hotkey or sequence (space-separated keys), returns a handle        |
```

- [ ] **Step 2: Update README.md RegistrationGroup section**

Remove `registerSequence()` and `getSequenceRegistrations()` from the group API table.

- [ ] **Step 3: Update README.md sequence examples**

Replace the sequence code examples (around lines 698-730) with the new syntax:

```ts
manager.register(
  "G I",
  (event) => {
    // Navigate to inbox
  },
  { scope: "main", description: "Go to Inbox" },
);

manager.register(
  "G E",
  (event) => {
    // Navigate to editor
  },
  { scope: "main", description: "Go to Editor", timeout: 2000 },
);

manager.register(
  "Ctrl+K Ctrl+C",
  (event) => {
    // Comment selection
  },
  { description: "Comment line" },
);

// Per-registration pending callback
manager.register("G I", goToInbox, {
  onPending: (info) => {
    statusBar.setText(`${info.completedSteps}/${info.totalSteps} - next: ${info.nextKey}`);
  },
});
```

- [ ] **Step 4: Update SEQUENCES.md**

Replace `registerSequence(["G", "E"], cb)` with `register("G E", cb)` throughout.
Remove any references to `setSequencePendingHandler`, replace with `onPending` option.

- [ ] **Step 5: Update ARCHITECTURE.md**

Update any sequence-related sections to reflect the unified API. Replace references to the separate sequence facade.

- [ ] **Step 6: Update the RegistrationGroup class JSDoc example in README**

Replace:

```ts
this._hotkeys.registerSequence(["G", "I"], handler, { scope: "main" });
```

With:

```ts
this._hotkeys.register("G I", handler, { scope: "main" });
```

- [ ] **Step 7: Commit**

```bash
git add packages/hotkeys/README.md docs/hotkeys/ARCHITECTURE.md docs/hotkeys/SEQUENCES.md
git commit -m "docs(hotkeys): update documentation for unified register() API"
```

---

### Task 6: Final verification and cleanup

**Files:**

- All modified files

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck 2>&1`

Expected: All targets pass with zero errors.

- [ ] **Step 2: Run hotkeys tests**

Run: `npm run test -w packages/hotkeys 2>&1 | tail -5`

Expected: All 20 spec files pass.

- [ ] **Step 3: Run kiosk-keyboard tests**

Run: `npm run test -w packages/kiosk-keyboard 2>&1 | tail -5`

Expected: All 12 spec files pass (no regressions from type changes).

- [ ] **Step 4: Grep for leftover references**

Run:

```bash
grep -r "registerSequence\|getSequenceRegistrations\|setSequencePendingHandler\|findSequenceRegistrations\|SequenceOptions\|SequenceRegistrationHandle\|SequenceRegistrationInfo\|UpdatableSequenceOptions" packages/hotkeys/src/ packages/hotkeys/README.md docs/hotkeys/
```

Expected: Zero matches. All old API references are gone from source and docs. (The internal `SequenceManager.registerSequence()` is fine -- it's an internal class.)

- [ ] **Step 5: Verify the old sequence API is not exported**

Check that `SequenceOptions`, `SequenceRegistrationHandle`, `SequenceRegistrationInfo`, `UpdatableSequenceOptions` are not re-exported from any barrel file. `SequencePendingCallback` should still be exported (used by `HotkeyOptions.onPending`).

- [ ] **Step 6: Commit any cleanup**

If any stragglers were found in steps 4-5, fix and commit.
