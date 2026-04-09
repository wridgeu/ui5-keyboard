# Unified `controls` Attribute - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping targeting APIs (`inputIds`, `targetInput`, `for`) with a single `controls` attribute on both the UI5 control and web component.

**Architecture:** The `controls` property (string array on UI5, comma-separated string on webc) replaces all three old APIs. Active target tracking becomes a private internal concern (`_activeTarget` association on UI5, `_targetElement` field on webc). Public read-only getters expose the active target. The `targetInputChange` / `target-input-change` events become `activeControlChange` / `active-control-change`. Auto-target convenience: when `controls` has one entry and `show()` is called with no active target, auto-focus that input.

**Tech Stack:** TypeScript, UI5 ManagedObject metadata, UI5 Web Components `@property` decorator, QUnit, WDIO

**Spec:** `docs/specs/2026-04-08-unified-controls-attribute.md`

---

### Task 1: Rename FocusClaimService callbacks

**Files:**

- Modify: `packages/kiosk-keyboard/src/internal/focus-claim-service.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/focus-claim-service.qunit.ts`

This is a pure rename with no logic changes. Good first commit to establish the new vocabulary.

- [ ] **Step 1: Rename constructor parameters and methods in FocusClaimService**

In `packages/kiosk-keyboard/src/internal/focus-claim-service.ts`, rename:

- Constructor parameter `getInputIds` -> `getControls` (line 22)
- Constructor parameter `getResolvedInputControlIds` -> `getResolvedControlIds` (line 23)
- Method `isInInputIds` -> `isInControls` (line 45)
- Method `resolveInputIdsAncestor` -> `resolveControlsAncestor` (line 49)
- Internal reference `this.getInputIds()` -> `this.getControls()` (line 40)
- Internal reference `this.getResolvedInputControlIds()` -> `this.getResolvedControlIds()` (line 50)
- Internal reference `this.isInInputIds` -> `this.isInControls` (line 41, 46)

The full file after renaming:

```typescript
import Control from "sap/ui/core/Control";
import ManagedObject from "sap/ui/base/ManagedObject";
import Element from "sap/ui/core/Element";
import { isInputOrTextarea } from "./dom";

/**
 * Encapsulates focus-based input claim decisions for docked auto-show mode.
 */
export default class FocusClaimService {
  /** Text-entry input types eligible for auto-claim. */
  private static readonly TEXTUAL_INPUT_TYPES: ReadonlySet<string> = new Set([
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
  ]);

  constructor(
    private readonly getControls: () => string[],
    private readonly getResolvedControlIds: () => ReadonlySet<string>,
    private readonly shouldDeferToNative: () => boolean,
    private readonly isTargetOfOther: (inputId: string) => boolean,
  ) {}

  wouldClaimInput(target: EventTarget | null): boolean {
    return this.resolveClaimableControl(target) !== null;
  }

  resolveClaimableControl(target: EventTarget | null): Control | null {
    if (!FocusClaimService.isTextualInput(target)) return null;
    if (this.shouldDeferToNative()) return null;

    const ui5Control = Element.closestTo(target);
    if (!(ui5Control instanceof Control)) return null;
    if (this.isTargetOfOther(ui5Control.getId())) return null;

    const ids = this.getControls();
    if (ids.length > 0 && !this.isInControls(ui5Control)) return null;
    return ui5Control;
  }

  isInControls(control: Control): boolean {
    return this.resolveControlsAncestor(control) !== null;
  }

  resolveControlsAncestor(candidate: Control): Control | null {
    const resolvedIds = this.getResolvedControlIds();
    if (resolvedIds.size === 0) return null;

    for (let parent: ManagedObject | null = candidate; parent; parent = parent.getParent()) {
      if (parent instanceof Control && resolvedIds.has(parent.getId())) return parent;
    }

    return null;
  }

  private static isTextualInput(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
    if (!isInputOrTextarea(el)) return false;
    if (el.disabled) return false;
    if (el.readOnly) return false;
    return el instanceof HTMLTextAreaElement || FocusClaimService.TEXTUAL_INPUT_TYPES.has(el.type);
  }
}
```

- [ ] **Step 2: Update test file references**

In `packages/kiosk-keyboard/test/qunit/focus-claim-service.qunit.ts`, rename all occurrences:

- `isInInputIds` -> `isInControls`
- `resolveInputIdsAncestor` -> `resolveControlsAncestor`
- Any test description strings referencing "inputIds" -> "controls"
- Constructor callback parameter names `getInputIds` -> `getControls`, `getResolvedInputControlIds` -> `getResolvedControlIds`

Use find-and-replace across the file. The constructor calls in tests look like:

```typescript
new FocusClaimService(
  () => controls, // was: () => inputIds
  () => resolvedIds, // unchanged (local var name)
  () => false,
  () => false,
);
```

- [ ] **Step 3: Run tests**

Run: `npx turbo run test:qunit --filter=@anthropic/kiosk-keyboard`
Expected: All focus-claim-service tests pass with the renames.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/focus-claim-service.ts packages/kiosk-keyboard/test/qunit/focus-claim-service.qunit.ts
git commit -m "refactor(kiosk): rename FocusClaimService from inputIds to controls vocabulary"
```

---

### Task 2: Rename UI5 control property, association, event, and private fields

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`

This task does the bulk rename in the UI5 control source. No logic changes, pure vocabulary swap.

- [ ] **Step 1: Rename the property definition**

In the metadata `properties` block (around line 290-314), replace the `inputIds` property with `controls`:

```typescript
      /**
       * List of input control IDs to target. When set, attaches focus
       * delegation to each resolved control so the keyboard auto-targets
       * whichever input last received focus.
       *
       * IDs are resolved against the parent View first (view-local IDs),
       * then globally. This makes the property safe to use in XML views
       * where control IDs are prefixed by the view ID.
       *
       * @example <caption>XML view - target multiple inputs</caption>
       * <m:Input id="name" />
       * <m:Input id="email" />
       * <kiosk:KioskKeyboard controls="name,email" />
       *
       * @example <caption>TypeScript</caption>
       * new KioskKeyboard({ controls: ["name", "email"] });
       */
      controls: {
        type: "string[]",
        defaultValue: [],
        group: "Behavior",
      },
```

- [ ] **Step 2: Replace the `targetInput` association with private `_activeTarget`**

In the metadata `associations` block (around line 316-336), replace:

```typescript
    associations: {
      /**
       * Internal association tracking the currently active input control.
       * Not part of the public API -- use `getActiveControl()` to read.
       * @private
       */
      _activeTarget: { type: "sap.ui.core.Control", multiple: false },
      ariaLabelledBy: {
        type: "sap.ui.core.Control",
        multiple: true,
        singularName: "ariaLabelledBy",
      },
      ariaDescribedBy: {
        type: "sap.ui.core.Control",
        multiple: true,
        singularName: "ariaDescribedBy",
      },
    },
```

- [ ] **Step 3: Rename the event**

In the metadata `events` block (around line 397-406), replace `targetInputChange` with `activeControlChange`:

```typescript
      /**
       * Fired when the active target control changes (focus switches to a
       * different input within `controls`, or the active target is cleared).
       */
      activeControlChange: {
        parameters: {
          /** The control ID of the new active target, or empty string if cleared. */
          controlId: { type: "string" },
        },
      },
```

- [ ] **Step 4: Rename private field declarations**

In the field declarations (around lines 117-131), rename:

- `_inputFocusDelegation` -> `_controlsFocusDelegation` (line 117)
- `_registeredInputControlById` -> `_registeredControlById` (line 118)
- `_resolvedInputControlIds` -> `_resolvedControlIds` (line 119)

```typescript
  declare private _controlsFocusDelegation: InputFocusDelegation;
  declare private _registeredControlById: Map<string, string>;
  declare private _resolvedControlIds: Set<string>;
```

- [ ] **Step 5: Update init() method**

In `init()` (around lines 706-742), rename all field initializations and callback references:

```typescript
this._registeredControlById = new Map();
this._resolvedControlIds = new Set();
this._delegatedInstances = new Map();
this._controlsFocusDelegation = {
  onfocusin: () => {
    if (!this.getEnabled()) return;
    const active = Element.getActiveElement();
    if (!(active instanceof Control)) return;
    // For composite controls (e.g. StepInput), the active element is the
    // inner Input, but controls references the outer wrapper. Resolve the
    // registered ancestor so _setActiveTarget gets the right control.
    const ancestor = this._resolveControlsAncestor(active);
    this._setActiveTarget(ancestor ?? active);
    // When docked with autoShow, show the keyboard for controls targets
    if (this.getDocked() && this.getAutoShow() && !this._open) {
      this.show();
    }
  },
};
```

Update FocusClaimService initialization:

```typescript
this._focusClaimService = new FocusClaimService(
  () => this.getControls(),
  () => this._resolvedControlIds,
  () => this._shouldDeferToNative(),
  (id) => this._isTargetOfOther(id),
);
```

- [ ] **Step 6: Rename `setTargetInput()` to `_setActiveTarget()` and update internals**

The method at lines 1027-1116 becomes `_setActiveTarget()`. Replace all internal references:

- `this.getTargetInput()` -> `this.getAssociation("_activeTarget") as string` (or create a private `_getActiveTargetId()` helper)
- `this.setAssociation("targetInput", ...)` -> `this.setAssociation("_activeTarget", ...)`
- Log messages: `"targetInput"` -> `"_activeTarget"` in warning strings
- `this.fireEvent("targetInputChange", { targetInput: newTarget })` -> `this.fireEvent("activeControlChange", { controlId: newTarget })`
- `dom.setAttribute("aria-controls", resolvedId)` stays as-is (aria-controls is the HTML attribute, not our property name)

Create a private helper for reading the association ID:

```typescript
  private _getActiveTargetId(): string {
    return (this.getAssociation("_activeTarget") as string) ?? "";
  }
```

- [ ] **Step 7: Rename `setInputIds()` to `setControls()`**

Replace the custom setter (around lines 1126-1130):

```typescript
  /**
   * Custom setter for controls.
   *
   * Reconciles focus delegates against currently resolved control instances
   * without forcing a re-render, because controls does not affect renderer
   * output directly.
   */
  setControls(controls: string[]): this {
    this.setProperty("controls", controls, true);
    this._setupControls();
    return this;
  }
```

- [ ] **Step 8: Rename `getTargetControl()` to `getActiveControl()`**

Replace the method (around lines 1595-1601):

```typescript
  /**
   * Returns the currently active target input control, or null if none.
   * Read-only -- the active target is managed internally via focus delegation.
   */
  getActiveControl<T extends Control = Control>(): T | null {
    const target = this._getTargetElement();
    return target instanceof Control ? (target as T) : null;
  }
```

- [ ] **Step 9: Rename `_setupInputIds` / `_teardownInputIds` / `_resolveInputIdsAncestor`**

Rename the private methods (around lines 1383-1463, 1841-1843):

- `_setupInputIds()` -> `_setupControls()`
- `_teardownInputIds()` -> `_teardownControls()`
- `_resolveInputIdsAncestor()` -> `_resolveControlsAncestor()`

Inside `_setupControls()`, update:

- `this.getInputIds()` -> `this.getControls()`
- `this._registeredInputControlById` -> `this._registeredControlById`
- `this._resolvedInputControlIds` -> `this._resolvedControlIds`
- `this._inputFocusDelegation` -> `this._controlsFocusDelegation`

Inside `_teardownControls()`, update:

- `this._inputFocusDelegation` -> `this._controlsFocusDelegation`
- `this._registeredInputControlById` -> `this._registeredControlById`
- `this._resolvedInputControlIds` -> `this._resolvedControlIds`

Inside `_resolveControlsAncestor()`, update:

- `this._focusClaimService.resolveInputIdsAncestor` -> `this._focusClaimService.resolveControlsAncestor`

- [ ] **Step 10: Update `_getTargetElement()`**

Replace (around line 2080-2084):

```typescript
  private _getTargetElement(): Element | null {
    const id = this._getActiveTargetId();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
  }
```

- [ ] **Step 11: Update `onAfterRendering()` and `exit()`**

In `onAfterRendering()` (around line 786):

- `this._setupInputIds()` -> `this._setupControls()`

In `exit()` (around line 905):

- `this._teardownInputIds()` -> `this._teardownControls()`

- [ ] **Step 12: Update `_onDocumentFocusIn()`**

In `_onDocumentFocusIn()` (around lines 1845-1890), rename:

- `this.getInputIds()` -> `this.getControls()` (line 1848)
- `this._setupInputIds()` -> `this._setupControls()` (line 1849)
- `this.setTargetInput(ui5Control)` -> `this._setActiveTarget(ui5Control)` (line 1866)
- `this.getTargetInput()` -> `this._getActiveTargetId()` (line 1870)

- [ ] **Step 13: Update `_isTargetOfOther()`**

In `_isTargetOfOther()` (around line 1800-1807):

- `other.getTargetInput()` -> `other._getActiveTargetId()` (line 1804)

Note: Since `_getActiveTargetId()` is private and we're accessing it on `other` (another instance of the same class), this works in TypeScript.

- [ ] **Step 14: Update remaining `getTargetInput()` / `setTargetInput()` references**

Search the entire file for any remaining references to the old names:

- `this.getTargetInput()` -> `this._getActiveTargetId()` (in `_suppressNativeKeyboard` around line 2256, and any others)
- Any JSDoc references to `targetInput` or `inputIds`
- Property table comments referencing `inputIds` property (around line 149, 170, 182, 194, 299)

Update all JSDoc `@example` blocks that reference `targetInput` to use `controls`:

```xml
<kiosk:KioskKeyboard controls="myInput" />
```

- [ ] **Step 15: Verify the file compiles**

Run: `npx turbo run build --filter=@anthropic/kiosk-keyboard`
Expected: Build succeeds (gen.d.ts will need updating in Task 3, so type errors from the generated file are expected at this point).

- [ ] **Step 16: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "refactor(kiosk): rename inputIds/targetInput to controls/_activeTarget in UI5 control"
```

---

### Task 3: Regenerate UI5 type definitions

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts`

The generated type file must be updated to reflect the new property, association, and event names.

- [ ] **Step 1: Regenerate the type file**

Run: `npx turbo run generate-types --filter=@anthropic/kiosk-keyboard`

If no generate command exists, manually update the gen.d.ts file:

- Replace `inputIds` property types with `controls`
- Remove public `getTargetInput()` / `setTargetInput()` association methods
- Replace `targetInputChange` event types with `activeControlChange`
- Update the `$KioskKeyboardSettings` interface:
  - `inputIds?:` -> `controls?:`
  - Remove `targetInput?:` entry
  - `targetInputChange?:` -> `activeControlChange?:` with updated parameter type `{ controlId: string }`
- Add `getActiveControl<T>(): T | null` method signature
- Add `_getActiveTargetId(): string` (private, but still needs to be in the declaration for cross-instance access)

- [ ] **Step 2: Verify types compile**

Run: `npx turbo run build --filter=@anthropic/kiosk-keyboard`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts
git commit -m "refactor(kiosk): update generated types for controls/_activeTarget rename"
```

---

### Task 4: Add auto-target convenience in UI5 `show()`

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-focus.qunit.ts`

- [ ] **Step 1: Write the failing test**

In `packages/kiosk-keyboard/test/qunit/KioskKeyboard-focus.qunit.ts`, add a new test:

```typescript
QUnit.test("show() auto-targets single controls entry", async (assert) => {
  const input = new Input({ id: "autoTargetInput" });
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  keyboard.setControls(["autoTargetInput"]);
  keyboard.show();

  assert.strictEqual(keyboard.getActiveControl(), input, "Single controls entry is auto-targeted on show()");

  keyboard.close();
  input.destroy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx turbo run test:qunit --filter=@anthropic/kiosk-keyboard`
Expected: FAIL. `getActiveControl()` returns null because `show()` doesn't auto-target yet.

- [ ] **Step 3: Implement auto-target in `show()`**

In `packages/kiosk-keyboard/src/KioskKeyboard.ts`, in the `show()` method (around line 1295-1309), add auto-target logic after the early returns but before opening:

```typescript
  show(): this {
    if (!this.getDocked()) return this;
    if (this._open) return this;
    if (this._shouldDeferToNative()) return this;

    // Auto-target when there's exactly one control and nothing is focused yet
    const ids = this.getControls();
    if (ids.length === 1 && !this._getActiveTargetId()) {
      const control = this._findControlById(ids[0]);
      control?.focus();
    }

    this._open = true;
    this._suppressNativeKeyboard();
    document.addEventListener("keydown", this._boundEscapeKeydown, true);
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.remove(KIOSK_KEYBOARD_DOM.classes.rootClosed);
      this._announceLiveRegion(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    }
    this.fireEvent("afterOpen");
    return this;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx turbo run test:qunit --filter=@anthropic/kiosk-keyboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboard.ts packages/kiosk-keyboard/test/qunit/KioskKeyboard-focus.qunit.ts
git commit -m "feat(kiosk): auto-target single controls entry on show()"
```

---

### Task 5: Update remaining UI5 control tests

**Files:**

- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-focus.qunit.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-autoshow.qunit.ts`

All existing tests that reference `inputIds`, `targetInput`, `getTargetInput`, `getTargetControl`, or `targetInputChange` need renaming. This is a bulk find-and-replace with no logic changes.

- [ ] **Step 1: Rename in KioskKeyboard-focus.qunit.ts**

Find-and-replace across the file:

- `inputIds` -> `controls` (in method calls: `setInputIds` -> `setControls`, `getInputIds` -> `getControls`)
- `setTargetInput` -> (remove direct calls; active target is set via focus delegation in tests)
- `getTargetInput()` -> `_getActiveTargetId()` or replace with `getActiveControl()` assertions where the test checks the control instance
- `getTargetControl()` -> `getActiveControl()`
- `"targetInputChange"` -> `"activeControlChange"`
- Test description strings: `"inputIds"` -> `"controls"`
- Event parameter access: `getParameter("targetInput")` -> `getParameter("controlId")`

Update all test names, e.g.:

- `"inputIds resolves controls and registers focus delegation"` -> `"controls resolves controls and registers focus delegation"`
- `"exit() cleans up inputIds delegates"` -> `"exit() cleans up controls delegates"`

- [ ] **Step 2: Rename in KioskKeyboard-autoshow.qunit.ts**

Same find-and-replace:

- `inputIds` -> `controls`
- `setInputIds` -> `setControls`
- `getTargetInput` -> `_getActiveTargetId` or `getActiveControl`
- `targetInputChange` -> `activeControlChange`

- [ ] **Step 3: Run all UI5 QUnit tests**

Run: `npx turbo run test:qunit --filter=@anthropic/kiosk-keyboard`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard/test/qunit/KioskKeyboard-focus.qunit.ts packages/kiosk-keyboard/test/qunit/KioskKeyboard-autoshow.qunit.ts
git commit -m "test(kiosk): rename inputIds/targetInput to controls/activeControl in UI5 tests"
```

---

### Task 6: Update E2E tests for UI5 control

**Files:**

- Modify: `packages/kiosk-keyboard/test/e2e/interop.test.ts`

- [ ] **Step 1: Rename in interop.test.ts**

Find-and-replace:

- `inputIds` -> `controls` (in test descriptions and any attribute/property references)
- `"via inputIds"` -> `"via controls"`

- [ ] **Step 2: Run E2E tests**

Run: `npx turbo run test:e2e --filter=@anthropic/kiosk-keyboard`
Expected: All E2E tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/test/e2e/interop.test.ts
git commit -m "test(kiosk): rename inputIds to controls in E2E tests"
```

---

### Task 7: Refactor web component: unify `for` + `inputIds` into `controls`

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`
- Modify: `packages/kiosk-keyboard-webc/src/types.ts`

- [ ] **Step 1: Replace `for` and `inputIds` properties with `controls`**

In `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`, replace the two property declarations (around lines 491-510):

Remove:

```typescript
  @property()
  for = "";

  @property()
  inputIds = "";
```

Add:

```typescript
  /**
   * Comma-separated list of target input element IDs. The keyboard targets
   * these elements via focus delegation. When a single ID is provided,
   * it acts as the direct target (equivalent to the old `for` attribute).
   *
   * @default ""
   * @public
   * @since 0.2.0
   */
  @property()
  controls = "";
```

- [ ] **Step 2: Rename `_inputIdsList` getter to `_controlsList`**

Replace (around lines 675-682):

```typescript
  private get _controlsList(): string[] {
    return this.controls
      ? this.controls
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }
```

- [ ] **Step 3: Rename event and update types**

In the class decorator area (around line 236), replace:

```typescript
@event("target-input-change", { bubbles: true })
```

with:

```typescript
@event("active-control-change", { bubbles: true })
```

In the `eventDetails` type (around line 253), replace:

```typescript
    "target-input-change": TargetInputChangeEventDetail;
```

with:

```typescript
    "active-control-change": ActiveControlChangeEventDetail;
```

In `packages/kiosk-keyboard-webc/src/types.ts`, replace the `TargetInputChangeEventDetail` interface:

```typescript
export interface ActiveControlChangeEventDetail {
  /** The new active target element, or `null` if cleared. */
  activeElement: HTMLInputElement | HTMLTextAreaElement | null;
}
```

- [ ] **Step 4: Update `_resolveTarget()` to use `controls` instead of `for`**

Replace `_resolveTarget()` (around lines 1362-1378):

```typescript
  private _resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this._targetElement) {
      if (!this._targetElement.isConnected) {
        this._targetElement = null;
        this._targetSource = "explicit";
      } else {
        return this._targetElement;
      }
    }
    const ids = this._controlsList;
    if (ids.length === 1) {
      const el = document.getElementById(ids[0]);
      if (!el) return null;
      return this._resolveInputFrom(el);
    }
    return null;
  }
```

- [ ] **Step 5: Update `_onDocumentFocusIn()` to use `_controlsList`**

In `_onDocumentFocusIn()` (around lines 1408-1457), replace:

- `this._inputIdsList` -> `this._controlsList` (lines 1419, 1474)
- `this._matchesInputIds(target, ids)` -> `this._matchesControls(target, ids)` (line 1421)
- `this.fireDecoratorEvent("target-input-change", { targetElement: inputEl })` -> `this.fireDecoratorEvent("active-control-change", { activeElement: inputEl })` (line 1456)

- [ ] **Step 6: Rename `_matchesInputIds` to `_matchesControls`**

Rename the method (around lines 1528-1542) and update its JSDoc:

```typescript
  /**
   * Checks whether the focused element (or a close ancestor) matches one
   * of the configured controls.
   */
  private _matchesControls(el: HTMLElement, ids: string[]): boolean {
    // ... body unchanged ...
  }
```

- [ ] **Step 7: Update `_isTargetOfOther()`**

In `_isTargetOfOther()` (around lines 1486-1501), remove the `for` property check and replace with `controls` logic:

```typescript
  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const kb of KioskKeyboard._instances) {
      if (kb === this) continue;
      if (!kb._isAutoShowParticipationActive()) continue;
      if (kb._targetElement === inputEl) return true;
      const ids = kb._controlsList;
      if (ids.length === 1) {
        const el = document.getElementById(ids[0]);
        if (!el) continue;
        if (el === inputEl) return true;
        if (el instanceof HTMLElement && kb._resolveInputFrom(el) === inputEl) return true;
      }
    }
    return false;
  }
```

- [ ] **Step 8: Update `_onDocumentFocusOut()` if it references `_inputIdsList`**

In `_onDocumentFocusOut()` (around line 1460+), replace any `this._inputIdsList` with `this._controlsList`.

- [ ] **Step 9: Update `setTargetElement()` event firing**

In `setTargetElement()` (around line 928-929), replace:

```typescript
this.fireDecoratorEvent("target-input-change", { targetElement: el });
```

with:

```typescript
this.fireDecoratorEvent("active-control-change", { activeElement: el });
```

- [ ] **Step 10: Add `get activeElement()` public getter**

Add a read-only getter for the active target:

```typescript
  /**
   * Returns the currently active target input element, or null if none.
   * @public
   * @since 0.2.0
   */
  get activeElement(): HTMLInputElement | HTMLTextAreaElement | null {
    return this._targetElement;
  }
```

- [ ] **Step 11: Add auto-target convenience in `show()` / `_performOpen()`**

In `_performOpen()` (around lines 875-891), add auto-target logic before the suppress call:

```typescript
  private _performOpen(): void {
    if (!this.docked) {
      console.warn("[kiosk-keyboard] open has no effect when docked=false.");
      this._open = false;
      return;
    }
    if (this._shouldDeferToNative()) {
      this._open = false;
      return;
    }

    // Auto-target when there's exactly one control and nothing is focused yet
    const ids = this._controlsList;
    if (ids.length === 1 && !this._targetElement) {
      const el = document.getElementById(ids[0]);
      if (el) {
        const input = this._resolveInputFrom(el);
        if (input) {
          input.focus();
          this._targetElement = input;
          this._targetSource = "explicit";
        }
      }
    }

    this._suppressInputMode();
    this._pendingAnnouncement = getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened");
    this.fireDecoratorEvent("after-open");
  }
```

- [ ] **Step 12: Update bundle.esm.ts if it re-exports the old type**

Check `packages/kiosk-keyboard-webc/src/bundle.esm.ts` for `TargetInputChangeEventDetail` and replace with `ActiveControlChangeEventDetail`.

- [ ] **Step 13: Verify the web component builds**

Run: `npx turbo run build --filter=@anthropic/kiosk-keyboard-webc`
Expected: Build succeeds.

- [ ] **Step 14: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/
git commit -m "refactor(kiosk-webc): unify for+inputIds into controls attribute"
```

---

### Task 8: Update web component tests

**Files:**

- Modify: `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard.test.ts`
- Modify: `packages/kiosk-keyboard-webc/test/e2e/component.test.ts`

- [ ] **Step 1: Rename in component tests**

In `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard.test.ts`, find-and-replace:

- HTML attribute `for="..."` -> `controls="..."` in all template strings
- HTML attribute `input-ids="..."` -> `controls="..."` in all template strings
- Property access `.for` -> `.controls`
- Property access `.inputIds` -> `.controls`
- Event name `"target-input-change"` -> `"active-control-change"`
- Test descriptions referencing "for" or "inputIds" -> "controls"
- Event detail `targetElement` -> `activeElement`

- [ ] **Step 2: Rename in E2E tests**

In `packages/kiosk-keyboard-webc/test/e2e/component.test.ts`, same find-and-replace for any `for` or `inputIds` references.

- [ ] **Step 3: Run web component tests**

Run: `npx turbo run test --filter=@anthropic/kiosk-keyboard-webc`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/
git commit -m "test(kiosk-webc): rename for/inputIds to controls in web component tests"
```

---

### Task 9: Update demo app

**Files:**

- Modify: All view XML files in `packages/demo-app/webapp/view/` that reference `targetInput` or `inputIds`
- Modify: `packages/demo-app/webapp/controller/KioskInputIds.controller.ts`
- Modify: `packages/demo-app/webapp/controller/KioskMultiKeyboard.controller.ts`
- Modify: `packages/demo-app/webapp/controller/KioskDialog.controller.ts`
- Modify: `packages/demo-app/webapp/model/fixtures/state.json`

- [ ] **Step 1: Update XML views**

In every view XML file, find-and-replace:

- `targetInput="..."` -> `controls="..."` (but now as a comma-separated attribute, not an association)
- `inputIds="..."` -> `controls="..."` (straight rename)
- `targetInputChange="..."` event handler -> `activeControlChange="..."`

Files to update (from the grep results):

- `KioskWebComponentTooling.view.xml`
- `KioskScriptInput.view.xml`
- `KioskCustomLayouts.view.xml`
- `KioskProgrammatic.view.xml`
- `KioskDialog.view.xml`
- `KioskDocked.view.xml`
- `KioskFocusScenarios.view.xml`
- `KioskFormWorkflow.view.xml`
- `KioskInputIds.view.xml`
- `KioskMultiKeyboard.view.xml`
- `Integration.view.xml`

- [ ] **Step 2: Update controllers**

In controller files, find-and-replace:

- `getTargetInput()` -> `getActiveControl()` or `_getActiveTargetId()` as appropriate
- `setTargetInput(...)` -> replace with `setControls(...)` or focus-based targeting
- `setInputIds(...)` -> `setControls(...)`
- `getInputIds()` -> `getControls()`
- `getTargetControl()` -> `getActiveControl()`

- [ ] **Step 3: Update state.json if it references old property names**

Check `packages/demo-app/webapp/model/fixtures/state.json` for `inputIds` or `targetInput` keys and rename.

- [ ] **Step 4: Verify demo app builds and runs**

Run: `npx turbo run build --filter=@anthropic/demo-app`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-app/
git commit -m "refactor(demo): update demo app for controls attribute rename"
```

---

### Task 10: Update README documentation

**Files:**

- Modify: `packages/kiosk-keyboard/README.md`
- Modify: `packages/kiosk-keyboard-webc/README.md`

- [ ] **Step 1: Update UI5 control README**

In `packages/kiosk-keyboard/README.md`:

- Property table (around line 351): replace `inputIds` with `controls`
- Association table (around line 357): remove `targetInput` row
- Event table (around line 364): replace `targetInputChange` with `activeControlChange`
- All XML examples: `targetInput="..."` -> `controls="..."`, `inputIds="..."` -> `controls=".."``
- The "inputIds" reference section (around lines 1037-1073): rewrite as "controls" section
  - Merge the `targetInput` vs `inputIds` comparison into a single `controls` explanation
  - Update TypeScript examples to use `setControls()`, `getControls()`, `getActiveControl()`
- Table of Contents: update section name
- Explanatory text throughout: `inputIds` -> `controls`, `targetInput` -> `controls`

- [ ] **Step 2: Update web component README**

In `packages/kiosk-keyboard-webc/README.md`:

- Hero example (line 16): `for="my-input"` -> `controls="my-input"`
- Comparison table (line 235): update both UI5 and webc columns to `controls`
- Property table (lines 291-292): remove `for` and `input-ids` rows, add single `controls` row
- All HTML examples: `for="..."` -> `controls="..."`, `input-ids="..."` -> `controls="..."`

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/README.md packages/kiosk-keyboard-webc/README.md
git commit -m "docs(kiosk): update READMEs for unified controls attribute"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full build**

Run: `npx turbo run build`
Expected: All packages build successfully.

- [ ] **Step 2: Full test suite**

Run: `npx turbo run test`
Expected: All tests pass across all packages.

- [ ] **Step 3: Search for any remaining old references**

Run a grep across the entire repo for any leftover references:

- `inputIds` (excluding node_modules, dist, .git)
- `targetInput` (excluding node_modules, dist, .git)
- `target-input-change` (excluding node_modules, dist, .git)
- Attribute `for=` in webc context (check carefully, `for` is used legitimately in HTML `<label>` elements)

Fix any remaining references found.

- [ ] **Step 4: Final commit if any stragglers**

```bash
git add -A
git commit -m "refactor(kiosk): clean up remaining old attribute references"
```
