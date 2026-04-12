# KioskKeyboard Extension Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract NativeKeyboardSuppression and AutoShowBehavior from KioskKeyboard.ts into internal extension classes following the table-extension pattern.

**Architecture:** Each extension extends `sap.ui.base.Object`, receives a host reference in the constructor, and is managed by KioskKeyboard via named fields + a lifecycle array. Public API is unchanged.

**Tech Stack:** TypeScript, UI5 (`sap.ui.base.Object`), QUnit (existing tests), WebDriverIO (existing e2e tests)

**Spec:** `docs/specs/2026-04-12-extension-extraction-design.md`

**Worktree:** `../ui5-lib-keyboard-71` on branch `feature/71-delegate-decomposition`

**Verification commands:**

- Typecheck source: `npm run typecheck -w packages/kiosk-keyboard`
- Typecheck tests: `npm run typecheck:kiosk:test`
- QUnit tests: `npm run test:kiosk:qunit`
- E2e tests: `npm run test:kiosk:e2e`

---

### Task 1: Extract NativeKeyboardSuppression class

**Files:**

- Create: `packages/kiosk-keyboard/src/internal/native-keyboard-suppression.ts`
- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`

- [ ] **Step 1: Create `native-keyboard-suppression.ts`**

The class moves `_suppressNativeKeyboard`, `_restoreNativeKeyboard`, `_shouldDeferToNative`, `_resolveInputDomById`, the static `_inputModeSuppressions` map, and the `InputModeSuppressionState` type out of KioskKeyboard.

```typescript
import BaseObject from "sap/ui/base/Object";
import Element from "sap/ui/core/Element";
import Device from "sap/ui/Device";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";
import { MobileKeyboard } from "../library";

type InputModeSuppressionState = {
  originalInputMode: string | null;
  refCount: number;
};

interface NativeKeyboardSuppressionHost {
  getMobileKeyboard(): string;
  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolverFn | null;
}

export default class NativeKeyboardSuppression extends BaseObject {
  private _host: NativeKeyboardSuppressionHost;
  private _suppressedInputId: string | null = null;
  private static readonly _suppressions = new Map<string, InputModeSuppressionState>();

  constructor(host: NativeKeyboardSuppressionHost) {
    super();
    this._host = host;
  }

  shouldDeferToNative(): boolean {
    const mode = this._host.getMobileKeyboard();
    if (mode === MobileKeyboard.Custom) return false;
    if (mode === MobileKeyboard.Native) return true;
    return Device.system.phone || (Device.system.tablet && !Device.system.desktop);
  }

  suppress(): void {
    if (this.shouldDeferToNative()) return;

    const inputId = this._host._getActiveTargetId();
    if (!inputId) return;

    if (this._suppressedInputId === inputId) {
      this._resolveInputDom(inputId)?.setAttribute("inputmode", "none");
      return;
    }

    this.restore();

    const dom = this._resolveInputDom(inputId);
    if (!dom) return;

    const state = NativeKeyboardSuppression._suppressions.get(inputId);
    if (state) {
      state.refCount += 1;
    } else {
      NativeKeyboardSuppression._suppressions.set(inputId, {
        originalInputMode: dom.getAttribute("inputmode"),
        refCount: 1,
      });
    }

    dom.setAttribute("inputmode", "none");
    this._suppressedInputId = inputId;
  }

  restore(): void {
    const inputId = this._suppressedInputId;
    if (!inputId) return;

    const state = NativeKeyboardSuppression._suppressions.get(inputId);
    if (!state) {
      this._suppressedInputId = null;
      return;
    }

    state.refCount -= 1;

    const dom = this._resolveInputDom(inputId);

    if (state.refCount > 0) {
      dom?.setAttribute("inputmode", "none");
      this._suppressedInputId = null;
      return;
    }

    if (dom) {
      if (state.originalInputMode !== null) {
        dom.setAttribute("inputmode", state.originalInputMode);
      } else {
        dom.removeAttribute("inputmode");
      }
    }

    NativeKeyboardSuppression._suppressions.delete(inputId);
    this._suppressedInputId = null;
  }

  private _resolveInputDom(inputId: string): HTMLInputElement | HTMLTextAreaElement | null {
    const target = Element.getElementById(inputId);
    if (!target) return null;
    return resolveWithCustomResolver(target.getFocusDomRef(), this._host._getEffectiveResolver());
  }

  destroy(): void {
    this.restore();
    super.destroy();
  }
}
```

Note: uses a `NativeKeyboardSuppressionHost` interface instead of importing KioskKeyboard directly, to avoid a circular dependency (KioskKeyboard imports NativeKeyboardSuppression, NativeKeyboardSuppression imports KioskKeyboard). KioskKeyboard implements this interface structurally.

- [ ] **Step 2: Update KioskKeyboard -- change visibility of host methods**

In `packages/kiosk-keyboard/src/KioskKeyboard.ts`, change the methods that NativeKeyboardSuppression needs from `private` to no access modifier (package-internal by convention):

Line 1119 -- change `private _getActiveTargetId()` to `_getActiveTargetId()`:

```typescript
  // before
  private _getActiveTargetId(): string {
  // after
  _getActiveTargetId(): string {
```

Line 1260 -- change `private _getEffectiveResolver()` to `_getEffectiveResolver()`:

```typescript
  // before
  private _getEffectiveResolver(): TargetResolverFn | null {
  // after
  _getEffectiveResolver(): TargetResolverFn | null {
```

- [ ] **Step 3: Wire NativeKeyboardSuppression into KioskKeyboard**

Add the import at the top of KioskKeyboard.ts (after existing internal imports around line 43):

```typescript
import NativeKeyboardSuppression from "./internal/native-keyboard-suppression";
```

Add the field declaration (around line 129, replacing `_suppressedInputId`):

```typescript
  _nativeKbSuppression!: NativeKeyboardSuppression;
  private _extensions!: { onAfterRendering?(): void; destroy(): void }[];
```

Remove these fields/declarations from KioskKeyboard:

- Line 56-59: `InputModeSuppressionState` type
- Line 129: `private _suppressedInputId!: string | null;`
- Line 430: `private static readonly _inputModeSuppressions` map

In `init()` (after line 723, where `_suppressedInputId` was initialized), add:

```typescript
this._nativeKbSuppression = new NativeKeyboardSuppression(this);
this._extensions = [this._nativeKbSuppression];
```

Remove the `this._suppressedInputId = null;` line from init().

- [ ] **Step 4: Replace call sites in KioskKeyboard**

Replace all calls to the old methods with calls to the extension:

`show()` (line 1299):

```typescript
// before
if (this._shouldDeferToNative()) return this;
// after
if (this._nativeKbSuppression.shouldDeferToNative()) return this;
```

`show()` (line 1302):

```typescript
// before
this._suppressNativeKeyboard();
// after
this._nativeKbSuppression.suppress();
```

`close()` (line 1319):

```typescript
// before
this._restoreNativeKeyboard();
// after
this._nativeKbSuppression.restore();
```

`_setActiveTarget()` (line 1038):

```typescript
// before
this._restoreNativeKeyboard();
// after
this._nativeKbSuppression.restore();
```

`_setActiveTarget()` (line 1099):

```typescript
// before
this._suppressNativeKeyboard();
// after
this._nativeKbSuppression.suppress();
```

`exit()` (line 900):

```typescript
// before
this._restoreNativeKeyboard();
// after
for (const ext of this._extensions) ext.destroy();
```

Also remove `this._restoreNativeKeyboard()` from exit since the extension's `destroy()` handles it.

`FocusClaimService` construction in init() (line 729):

```typescript
  // before
  () => this._shouldDeferToNative(),
  // after
  () => this._nativeKbSuppression.shouldDeferToNative(),
```

- [ ] **Step 5: Remove old methods from KioskKeyboard**

Delete these methods entirely:

- `_suppressNativeKeyboard()` (lines 2200-2230)
- `_restoreNativeKeyboard()` (lines 2236-2267)
- `_shouldDeferToNative()` (lines 2147-2153)
- `_resolveInputDomById()` (lines 2186-2190)

Delete the static field:

- `_inputModeSuppressions` (line 430)

Delete the type:

- `InputModeSuppressionState` (lines 56-59)

Delete the field:

- `_suppressedInputId` (line 129)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w packages/kiosk-keyboard`
Expected: 0 errors

If circular dependency issues arise from the host interface approach, verify the interface is used (not a direct KioskKeyboard import) in native-keyboard-suppression.ts.

- [ ] **Step 7: Run QUnit tests**

Run: `npm run test:kiosk:qunit`
Expected: all tests pass, including `KioskKeyboard-docked`, `KioskKeyboard-autoshow`, and any tests that exercise show/close/suppression behavior.

- [ ] **Step 8: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/native-keyboard-suppression.ts packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "refactor(kiosk): extract NativeKeyboardSuppression extension (#71)

Move inputmode suppress/restore logic, ref-counting, and
defer-to-native check into an internal extension class
following the table-extension pattern."
```

---

### Task 2: Extract AutoShowBehavior class

**Files:**

- Create: `packages/kiosk-keyboard/src/internal/auto-show-behavior.ts`
- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`

- [ ] **Step 1: Expose host methods needed by AutoShowBehavior**

In `packages/kiosk-keyboard/src/KioskKeyboard.ts`, change the following from `private` to no access modifier:

```typescript
  // line ~1024 -- _setActiveTarget
  private _setActiveTarget(target?: string | Control): this {
  // becomes
  _setActiveTarget(target?: string | Control): this {

  // line ~1389 -- _setupControls
  private _setupControls(): void {
  // becomes
  _setupControls(): void {

  // line ~1819 -- _resolveClaimableControl
  private _resolveClaimableControl(target: EventTarget | null): Control | null {
  // becomes
  _resolveClaimableControl(target: EventTarget | null): Control | null {

  // line ~1814 -- _wouldClaimInput
  private _wouldClaimInput(target: EventTarget | null): boolean {
  // becomes
  _wouldClaimInput(target: EventTarget | null): boolean {
```

Add a new getter for `_keyboardTypeSource` (insert near line 1120 after `_getActiveTargetId`):

```typescript
  _getKeyboardTypeSource(): string {
    return this._keyboardTypeSource;
  }

  _setKeyboardTypeSource(source: KeyboardTypeSource): void {
    this._keyboardTypeSource = source;
  }
```

- [ ] **Step 2: Create `auto-show-behavior.ts`**

The class moves `_enableAutoShow`, `_disableAutoShow`, `_onDocumentFocusIn`, `_onDocumentFocusOut`, `_cancelPendingFocusOutClose`, and `_isAutoShowParticipationActive` out of KioskKeyboard.

```typescript
import BaseObject from "sap/ui/base/Object";
import Control from "sap/ui/core/Control";
import { detectKeyboardType as detectKbType } from "./detect-keyboard-type";
import type { TargetResolverFn } from "./dom";

interface AutoShowBehaviorHost {
  getDocked(): boolean;
  getVisible(): boolean;
  getEnabled(): boolean;
  getAutoShow(): boolean;
  getAutoType(): boolean;
  getKeyboardType(): string;
  getControls(): string[];
  getDomRef(): HTMLElement | null;
  show(): unknown;
  close(): unknown;
  setProperty(name: string, value: unknown): unknown;
  fireEvent(name: string, parameters: Record<string, unknown>): boolean;

  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolverFn | null;
  _setActiveTarget(target?: string | Control): unknown;
  _setupControls(): void;
  _resolveClaimableControl(target: EventTarget | null): Control | null;
  _wouldClaimInput(target: EventTarget | null): boolean;
  _getKeyboardTypeSource(): string;
  _setKeyboardTypeSource(source: string): void;
  _nativeKbSuppression: { shouldDeferToNative(): boolean };
  isOpen(): boolean;
}

export default class AutoShowBehavior extends BaseObject {
  private _host: AutoShowBehaviorHost;
  private _active = false;
  private _deferredCloseId: number | null = null;
  private _boundFocusIn: (e: FocusEvent) => void;
  private _boundFocusOut: (e: FocusEvent) => void;

  constructor(host: AutoShowBehaviorHost) {
    super();
    this._host = host;
    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
  }

  enable(): void {
    if (this._active) return;
    this._active = true;
    document.addEventListener("focusin", this._boundFocusIn, true);
    document.addEventListener("focusout", this._boundFocusOut, true);
  }

  disable(): void {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener("focusin", this._boundFocusIn, true);
    document.removeEventListener("focusout", this._boundFocusOut, true);
  }

  isActive(): boolean {
    return this._active;
  }

  cancelPendingClose(): void {
    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }
  }

  onAfterRendering(): void {
    if (this._host.getDocked() && this._host.getAutoShow() && !this._active) {
      this.enable();
    }
  }

  private _isParticipationActive(): boolean {
    if (!this._host.getVisible() || !this._host.getEnabled()) return false;
    const dom = this._host.getDomRef();
    if (!(dom instanceof HTMLElement)) return false;
    if (!document.contains(dom)) return false;
    return dom.getClientRects().length > 0;
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this._host.getDocked() || !this._isParticipationActive()) return;

    if (this._host.getControls().length > 0) {
      this._host._setupControls();
    }

    const target = event.target as HTMLElement;

    const myDom = this._host.getDomRef();
    if (myDom && myDom.contains(target)) return;

    const ui5Control = this._host._resolveClaimableControl(target);
    if (!ui5Control) return;

    this.cancelPendingClose();

    this._host._setActiveTarget(ui5Control);

    if (
      this._host.getAutoType() &&
      this._host._getKeyboardTypeSource() !== "explicit" &&
      this._host._getActiveTargetId() === ui5Control.getId()
    ) {
      const detected = detectKbType(ui5Control, this._host._getEffectiveResolver());
      const previous = this._host.getKeyboardType();
      this._host._setKeyboardTypeSource(`auto:${detected}`);
      this._host.setProperty("keyboardType", detected);
      if (detected !== previous) {
        this._host.fireEvent("keyboardTypeChange", {
          keyboardType: detected,
          previousKeyboardType: previous,
          autoDetected: true,
        });
      }
    }

    this._host.show();
  }

  private _onDocumentFocusOut(event: FocusEvent): void {
    if (!this._host.getDocked() || !this._host.isOpen()) return;

    const related = event.relatedTarget as HTMLElement | null;

    const myDom = this._host.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    if (this._host._wouldClaimInput(related)) return;

    this.cancelPendingClose();
    this._deferredCloseId = requestAnimationFrame(() => {
      this._deferredCloseId = null;
      if (!this._host.getDocked() || !this._host.isOpen()) return;
      const active = document.activeElement as HTMLElement | null;
      const dom = this._host.getDomRef();
      if (dom && active && dom.contains(active)) return;
      if (this._host._wouldClaimInput(active)) return;
      this._host.close();
    });
  }

  destroy(): void {
    this.cancelPendingClose();
    this.disable();
    super.destroy();
  }
}
```

Note: same host-interface pattern as NativeKeyboardSuppression to avoid circular imports.

- [ ] **Step 3: Wire AutoShowBehavior into KioskKeyboard**

Add the import (after NativeKeyboardSuppression import):

```typescript
import AutoShowBehavior from "./internal/auto-show-behavior";
```

Add the field declaration (near the NativeKeyboardSuppression field):

```typescript
  _autoShowBehavior!: AutoShowBehavior;
```

Remove these fields from KioskKeyboard:

- Line 115: `private _boundFocusIn!: (e: FocusEvent) => void;`
- Line 116: `private _boundFocusOut!: (e: FocusEvent) => void;`
- Line 117: `private _autoShowActive!: boolean;`
- Line 133: `private _deferredFocusOutCloseId!: number | null;`

In `init()`, replace the bound listener and state initialization (lines 694-696 and 725):

```typescript
// remove these lines:
this._autoShowActive = false;
this._boundFocusIn = this._onDocumentFocusIn.bind(this);
this._boundFocusOut = this._onDocumentFocusOut.bind(this);
// ...
this._deferredFocusOutCloseId = null;

// add (after _nativeKbSuppression creation):
this._autoShowBehavior = new AutoShowBehavior(this);
this._extensions = [this._nativeKbSuppression, this._autoShowBehavior];
```

Update the `_extensions` array to include both (remove the `_extensions = [this._nativeKbSuppression]` from Task 1 and replace with the line above).

- [ ] **Step 4: Replace call sites in KioskKeyboard**

`onAfterRendering()` (lines 758-763) -- remove the manual auto-show enable block:

```typescript
// remove these lines from onAfterRendering:
if (this.getDocked()) {
  if (this.getAutoShow() && !this._autoShowActive) {
    this._enableAutoShow();
  }
}
```

The lifecycle array's `ext.onAfterRendering?.()` call handles this now. Add after line 755 (`_syncDockedDomState`):

```typescript
for (const ext of this._extensions) ext.onAfterRendering?.();
```

`setAutoShow()` (lines 1140-1148):

```typescript
  // before
  setAutoShow(bAutoShow: boolean): this {
    this.setProperty("autoShow", bAutoShow, true);
    if (bAutoShow) {
      this._enableAutoShow();
    } else {
      this._disableAutoShow();
    }
    return this;
  }

  // after
  setAutoShow(bAutoShow: boolean): this {
    this.setProperty("autoShow", bAutoShow, true);
    if (bAutoShow) {
      this._autoShowBehavior.enable();
    } else {
      this._autoShowBehavior.disable();
    }
    return this;
  }
```

`setDocked()` (lines 1272-1283):

```typescript
// before
if (wasDocked && !bDocked) {
  if (this._open) {
    this.close();
  }
  this._disableAutoShow();
}

if (!wasDocked && bDocked) {
  this._open = false;
  if (this.getAutoShow()) {
    this._enableAutoShow();
  }
}

// after
if (wasDocked && !bDocked) {
  if (this._open) {
    this.close();
  }
  this._autoShowBehavior.disable();
}

if (!wasDocked && bDocked) {
  this._open = false;
  if (this.getAutoShow()) {
    this._autoShowBehavior.enable();
  }
}
```

`exit()` -- remove the individual auto-show cleanup lines:

```typescript
// remove these lines from exit():
this._cancelPendingFocusOutClose();
this._disableAutoShow();
```

The `for (const ext of this._extensions) ext.destroy()` from Task 1 already handles both extensions.

`_controlsFocusDelegation` in init() (line 711) -- the `_open` reference stays since open/close state is still on KioskKeyboard:

```typescript
  // before (line 711)
  if (this.getDocked() && this.getAutoShow() && !this._open) {
  // no change needed -- _open stays on KioskKeyboard
```

- [ ] **Step 5: Remove old methods from KioskKeyboard**

Delete these methods entirely:

- `_enableAutoShow()` (lines 1340-1346)
- `_disableAutoShow()` (lines 1348-1355)
- `_onDocumentFocusIn()` (lines 1834-1878)
- `_onDocumentFocusOut()` (lines 1887-1912)
- `_cancelPendingFocusOutClose()` (lines 1880-1885)
- `_isAutoShowParticipationActive()` (lines 1803-1811)

Delete these fields:

- `_boundFocusIn` (line 115)
- `_boundFocusOut` (line 116)
- `_autoShowActive` (line 117)
- `_deferredFocusOutCloseId` (line 133)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w packages/kiosk-keyboard`
Expected: 0 errors

Run: `npm run typecheck:kiosk:test`
Expected: 0 errors

- [ ] **Step 7: Run QUnit tests**

Run: `npm run test:kiosk:qunit`
Expected: all tests pass. Pay particular attention to:

- `KioskKeyboard-autoshow.qunit.ts`
- `KioskKeyboard-autoshow-blackbox.qunit.ts`
- `KioskKeyboard-docked.qunit.ts`
- `KioskKeyboard-autotype-mobile.qunit.ts`

- [ ] **Step 8: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/auto-show-behavior.ts packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "refactor(kiosk): extract AutoShowBehavior extension (#71)

Move document-level focusin/focusout listeners, deferred close,
and participation check into an internal extension class."
```

---

### Task 3: Regenerate .gen.d.ts and run full verification

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts` (generated)

- [ ] **Step 1: Regenerate the TypeScript interface**

Run: `npm run generate -w packages/kiosk-keyboard`

The `.gen.d.ts` file should reflect any changes to the public property surface (there should be none since we only changed internal methods).

- [ ] **Step 2: Full typecheck**

Run: `npm run typecheck:kiosk && npm run typecheck:kiosk:test && npm run typecheck:kiosk:e2e`
Expected: 0 errors across all three

- [ ] **Step 3: Run full test suite**

Run: `npm run test:kiosk:qunit`
Expected: all QUnit tests pass

Run: `npm run test:kiosk:e2e`
Expected: all e2e tests pass, specifically:

- `inputmode.test.ts` -- validates NativeKeyboardSuppression
- `focus.test.ts` -- validates AutoShowBehavior

- [ ] **Step 4: Commit if .gen.d.ts changed**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts
git commit -m "chore(kiosk): regenerate KioskKeyboard.gen.d.ts"
```

Skip this commit if the file is unchanged.
