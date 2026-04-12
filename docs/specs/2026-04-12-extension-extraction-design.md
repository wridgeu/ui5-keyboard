# KioskKeyboard Internal Extension Extraction

**Issue:** [#71](https://github.com/wridgeu/ui5-lib-keyboard/issues/71)
**Date:** 2026-04-12

## Context

KioskKeyboard.ts (~2,268 lines) mixes several distinct behavioral concerns inline. Issue #71 decomposes them into internal extensions following the pattern established by `KeyGridNavigation` (commit e2d0ce9). This spec covers the next two extractions.

Four behaviors were evaluated. Two earn their own class (NativeKeyboardSuppression, AutoShowBehavior). Two stay inline (docked open/close state, physical key highlight) because they are too small or tightly coupled to justify the overhead.

## Pattern

Follows `sap.ui.table`'s Extension Object pattern adapted for this codebase:

- Each extension is a plain class extending `sap.ui.base.Object` (provides the `destroy()` contract).
- Constructor receives a `host: KioskKeyboard` reference, stored as `this._host`.
- Extensions access the host's public getters and a small set of internal methods directly via the host reference (option A from the design discussion -- no callback injection).
- KioskKeyboard holds named fields for type safety plus an `_extensions` array for lifecycle broadcasting.
- Public API is unchanged. Consumers see the same properties, events, and methods on KioskKeyboard.

### Lifecycle wiring

```typescript
// init()
this._nativeKbSuppression = new NativeKeyboardSuppression(this);
this._autoShowBehavior = new AutoShowBehavior(this);
this._extensions = [this._nativeKbSuppression, this._autoShowBehavior];

// onAfterRendering() -- optional chaining because not all extensions need this hook
for (const ext of this._extensions) ext.onAfterRendering?.();

// exit()
for (const ext of this._extensions) ext.destroy();
```

### Cross-referencing

Extensions reach each other through the host's named fields when needed (e.g., AutoShowBehavior checking `this._host._nativeKbSuppression.shouldDeferToNative()`). This mirrors the `sap.ui.table` pattern where extensions call `oTable._getKeyboardExtension()`.

## Extraction 1: NativeKeyboardSuppression

**File:** `src/internal/native-keyboard-suppression.ts`

**What it owns:**

- `inputmode` attribute lifecycle on target input elements
- Static ref-counted `Map<string, InputModeSuppressionState>` for cross-instance coordination
- Device/property-based decision whether to defer to native keyboard

**Interface:**

```typescript
class NativeKeyboardSuppression extends BaseObject {
  constructor(host: KioskKeyboard);

  shouldDeferToNative(): boolean; // checks host.getMobileKeyboard() + Device
  suppress(): void; // set inputmode="none", ref-count up
  restore(): void; // ref-count down, restore original inputmode

  destroy(): void; // calls restore()
}
```

**State:**

- `_suppressedInputId: string | null` -- which input this instance is currently suppressing
- `static _suppressions: Map<string, { originalInputMode: string | null; refCount: number }>` -- shared across all instances

**Host dependencies (via `this._host`):**

- `getMobileKeyboard()` -- property value for defer-to-native check
- `getActiveTargetId()` -- which input to suppress (currently `_getActiveTargetId()`, needs to be exposed as internal API)
- `getEffectiveResolver()` -- target resolver for locating native input DOM within composite controls (currently `_getEffectiveResolver()`)

**Call sites (unchanged orchestration on KioskKeyboard):**

- `show()` calls `this._nativeKbSuppression.suppress()`
- `close()` calls `this._nativeKbSuppression.restore()`
- `_setActiveTarget()` calls `restore()` before switch, `suppress()` after (when open)
- `show()` guard calls `this._nativeKbSuppression.shouldDeferToNative()`

**What moves out of KioskKeyboard:**

- `_suppressNativeKeyboard()`, `_restoreNativeKeyboard()`, `_shouldDeferToNative()`, `_resolveInputDomById()`
- Static `_inputModeSuppressions` map
- `_suppressedInputId` field
- `InputModeSuppressionState` type

**Lines moved:** ~90

## Extraction 2: AutoShowBehavior

**File:** `src/internal/auto-show-behavior.ts`

**What it owns:**

- Document-level `focusin`/`focusout` listeners (capture phase)
- Deferred close via `requestAnimationFrame`
- Participation check (visible, enabled, in DOM, has client rects)
- Enable/disable lifecycle

**Interface:**

```typescript
class AutoShowBehavior extends BaseObject {
  constructor(host: KioskKeyboard);

  enable(): void; // attach document focusin/focusout
  disable(): void; // detach both
  isActive(): boolean;
  cancelPendingClose(): void; // cancel rAF deferred close

  onAfterRendering(): void; // enable if autoShow property set before first render
  destroy(): void; // disable + cancel pending
}
```

**State:**

- `_active: boolean` -- whether document listeners are attached
- `_deferredCloseId: number | null` -- rAF handle for deferred close
- `_boundFocusIn`, `_boundFocusOut` -- bound listener references

**Host dependencies (via `this._host`):**

- `getDocked()`, `getVisible()`, `getEnabled()`, `getAutoShow()`, `getAutoType()` -- property getters
- `getDomRef()` -- for participation check and "focus on keyboard" guard
- `getControls()` -- to trigger controls setup on focusin
- `resolveClaimableControl(target)` -- focus claim service (currently `_resolveClaimableControl`, needs to be exposed as internal API)
- `wouldClaimInput(target)` -- fast-path check in focusout (currently `_wouldClaimInput`)
- `setActiveTarget(control)` -- hub method (currently `_setActiveTarget`)
- `show()`, `close()` -- public API
- `getKeyboardType()`, `getKeyboardTypeSource()` -- for auto-type detection
- `getEffectiveResolver()` -- for auto-type detection
- `setupControls()` -- re-resolve controls on focusin

**Call sites (unchanged orchestration on KioskKeyboard):**

- `setAutoShow()` calls `this._autoShowBehavior.enable()` / `.disable()`
- `setDocked()` calls `.enable()` / `.disable()` on docked state transitions
- `_setActiveTarget()` is still the hub -- AutoShowBehavior calls into it, not the other way around

**What moves out of KioskKeyboard:**

- `_enableAutoShow()`, `_disableAutoShow()`, `_onDocumentFocusIn()`, `_onDocumentFocusOut()`, `_cancelPendingFocusOutClose()`, `_isAutoShowParticipationActive()`
- `_boundFocusIn`, `_boundFocusOut` fields
- `_autoShowActive`, `_deferredFocusOutCloseId` fields

**Lines moved:** ~120

## What Stays Inline

### Docked open/close state (~50 lines)

`_open` boolean, `show()`/`close()` orchestration, `_syncDockedDomState()` CSS toggle, `_onDocumentEscapeKeydown()` escape handler. Too small and too tightly coupled to the control's DOM, events, and ARIA to justify a separate class.

### Physical key highlight (~60 lines)

`_keyHighlightDelegation` object, `_highlightKey()`, `_removeHighlightDelegation()`, `_resolveDataKey()`, `_KEY_TO_DATA_KEY` map. Already a clean delegation object pattern. A class wrapper around 3 methods adds overhead without meaningful isolation.

## Internal API Exposure

AutoShowBehavior needs access to several currently-private methods. These become package-internal methods on KioskKeyboard (underscore-prefixed, not part of the public API, not in the `.gen.d.ts`):

| Current name                 | Exposed as                               | Used by                   |
| ---------------------------- | ---------------------------------------- | ------------------------- |
| `_getActiveTargetId()`       | `_getActiveTargetId()` (unchanged)       | NativeKeyboardSuppression |
| `_getEffectiveResolver()`    | `_getEffectiveResolver()` (unchanged)    | NativeKeyboardSuppression |
| `_resolveClaimableControl()` | `_resolveClaimableControl()` (unchanged) | AutoShowBehavior          |
| `_wouldClaimInput()`         | `_wouldClaimInput()` (unchanged)         | AutoShowBehavior          |
| `_setActiveTarget()`         | `_setActiveTarget()` (unchanged)         | AutoShowBehavior          |
| `_setupControls()`           | `_setupControls()` (unchanged)           | AutoShowBehavior          |
| `_keyboardTypeSource`        | `_getKeyboardTypeSource()` (new getter)  | AutoShowBehavior          |

These are already `private` in the TypeScript sense. Since extensions live in the same package and import KioskKeyboard, TypeScript's `private` visibility is the constraint. Options:

1. Change from `private` to no modifier (package-level by convention, underscore signals internal).
2. Keep `private` and use `// @ts-ignore` or cast -- fragile.
3. Use a friend-class pattern with a symbol-keyed accessor.

Option 1 is the simplest and matches UI5 convention where underscore-prefixed methods are internal-by-contract.

## Extraction Order

1. **NativeKeyboardSuppression first** -- most self-contained, fewest host dependencies, lowest risk. Existing `inputmode.test.ts` validates behavior.
2. **AutoShowBehavior second** -- larger surface, more host dependencies, benefits from NativeKeyboardSuppression already being extracted (cleaner `show()` orchestration). Existing `focus.test.ts` validates behavior.

Each extraction is independently committable and testable.

## Testing Strategy

Existing integration tests (`inputmode.test.ts`, `focus.test.ts`) continue to work unchanged since the public API is preserved. No new unit tests are required for the extractions themselves -- the behavior is covered by the existing tests through the control's public surface.

If isolated unit testing of extensions becomes desirable later, the host reference can be stubbed since extensions only call public getters and a known set of internal methods.
