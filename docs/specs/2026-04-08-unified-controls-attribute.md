# Unified `controls` Attribute

**Issue:** [#78](https://github.com/wridgeu/ui5-keyboard/issues/78)
**Date:** 2026-04-08
**Status:** Approved
**Breaking:** Yes (no consumers yet)

## Problem

The kiosk keyboard packages have overlapping attributes for input targeting:

- **UI5 control:** `targetInput` (association, single) + `inputIds` (property, multi)
- **Web component:** `for` (single) + `inputIds` (multi)

Two attributes for "which inputs does this keyboard target" is unintuitive. Additionally, `for` shadows native HTML `<label for>` semantics, and `targetInput` exposes internal active-target state as a public configuration API.

## Decision

Unify into a single `controls` attribute on both packages. The name follows the `aria-controls` precedent: singular form, accepts multiple IDs, semantically accurate (the keyboard _controls_ those inputs), and has no native HTML attribute collision.

Hard removal of old APIs. No deprecation bridge needed (no consumers yet).

## Public API

### `controls` attribute

Both packages expose a single `controls` attribute for declaring which inputs the keyboard can target.

```html
<!-- Web component -->
<kiosk-keyboard controls="myInput"></kiosk-keyboard>
<kiosk-keyboard controls="name, email, phone"></kiosk-keyboard>

<!-- UI5 XML view -->
<kiosk:KioskKeyboard controls="myInput" />
<kiosk:KioskKeyboard controls="name, email" />
```

```typescript
// UI5 programmatic
new KioskKeyboard({ controls: ["name", "email"] });
keyboard.setControls(["name", "email"]);

// Dynamic addition
keyboard.setControls([...keyboard.getControls(), "newDynamicInput"]);

// Web component programmatic
keyboard.controls = "name, email";
keyboard.controls += ", newDynamicInput";
```

**UI5 property definition:**

```typescript
controls: {
  type: "string[]",
  defaultValue: [],
  group: "Behavior",
}
```

**Web component property:**

```typescript
@property()
controls = "";
```

### Active target getter (read-only)

| Package       | Method                                                                      | Return type                                       |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| UI5 control   | `getActiveControl(): Control \| null`                                       | `sap.ui.core.Control`                             |
| Web component | `getActiveTargetElement(): HTMLInputElement \| HTMLTextAreaElement \| null` | `HTMLInputElement \| HTMLTextAreaElement \| null` |

The naming reflects each package's abstraction level: "control" for UI5, "element" for the framework-agnostic web component.

### `activeControlChange` event

Replaces `targetInputChange`. Fires when the active target changes (focus switches to a different input within `controls`, or the active target is cleared).

**UI5:**

```typescript
activeControlChange: {
  parameters: {
    controlId: { type: "string" },
  },
}
```

**Web component:** Custom event `active-control-change` with `detail: { activeElement: HTMLInputElement | HTMLTextAreaElement | null }`.

### Auto-target convenience

When `controls` has exactly one entry and `show()` is called with no active target, the keyboard auto-focuses that input. This triggers the normal focus delegation chain, not a separate code path.

```typescript
// In show():
const ids = this.getControls(); // or _controlsList for webc
if (ids.length === 1 && !this.getActiveControl()) {
  const control = this._findControlById(ids[0]);
  control?.focus();
}
```

### Removed APIs

| Removed                     | Package       | Replacement                                          |
| --------------------------- | ------------- | ---------------------------------------------------- |
| `for` property              | Web component | `controls`                                           |
| `inputIds` property         | Both          | `controls`                                           |
| `targetInput` association   | UI5           | `controls` (config) + `getActiveControl()` (read)    |
| `getTargetControl<T>()`     | UI5           | `getActiveControl()`                                 |
| `setTargetInput()` public   | UI5           | Focus the desired input; delegation handles the rest |
| `targetInputChange` event   | UI5           | `activeControlChange`                                |
| `target-input-change` event | Web component | `active-control-change`                              |

## Internal Architecture

### UI5 Control

The active target is tracked via a **private** association:

```typescript
associations: {
  _activeTarget: { type: "sap.ui.core.Control", multiple: false },
  ariaLabelledBy: { ... },
  ariaDescribedBy: { ... },
}
```

The current `setTargetInput()` logic (highlight delegation, native keyboard suppression, shift reset, aria-controls sync, target session management, change event) becomes `_setActiveTarget()` operating on `_activeTarget`.

`setControls()` replaces `setInputIds()` with the same reconciliation logic (resolve IDs against parent View first, then globally; reconcile focus delegates; handle composite controls).

### Web Component

`controls` replaces both `for` and `inputIds`. The existing `_inputIdsList` comma-split getter becomes `_controlsList`. The `for` resolution logic folds into the `controls` path.

### FocusClaimService

Constructor callback renames only (no logic changes):

- `getInputIds` becomes `getControls`
- `getResolvedInputControlIds` becomes `getResolvedControlIds`

### Type contracts

| Package       | `controls` resolves via                                           | Active target type    |
| ------------- | ----------------------------------------------------------------- | --------------------- |
| UI5 control   | `View.byId()` then `Element.getElementById()` (UI5 element chain) | `sap.ui.core.Control` |
| Web component | `document.getElementById()` (DOM)                                 | `HTMLElement`         |

When the web component is used inside UI5, DOM-based resolution still works correctly because UI5 controls render to the DOM with their ID. The web component does not need to know it's inside UI5.

### Internal rename map

| Old                           | New                                     |
| ----------------------------- | --------------------------------------- |
| `inputIds` property           | `controls` property                     |
| `targetInput` association     | `_activeTarget` private association     |
| `setTargetInput()` public     | `_setActiveTarget()` private            |
| `getTargetInput()` public     | `_getActiveTarget()` private            |
| `getTargetControl()` public   | `getActiveControl()` public (read-only) |
| `targetInputChange` event     | `activeControlChange` event             |
| `_setupInputIds()`            | `_setupControls()`                      |
| `_teardownInputIds()`         | `_teardownControls()`                   |
| `_resolveInputIdsAncestor()`  | `_resolveControlsAncestor()`            |
| `_inputIdsList` (webc)        | `_controlsList` (webc)                  |
| `_registeredInputControlById` | `_registeredControlById`                |
| `_resolvedInputControlIds`    | `_resolvedControlIds`                   |
| `_inputFocusDelegation`       | `_controlsFocusDelegation`              |
| `for` (webc)                  | removed, folded into `controls`         |

## Test Impact

### Renamed test suites (logic unchanged)

- `KioskKeyboard-focus.qunit.ts`: all 11 `inputIds` test cases rename to `controls`; `targetInput` assertions use `getActiveControl()`
- `KioskKeyboard-autoshow.qunit.ts`: `inputIds` rebind test renames
- `focus-claim-service.qunit.ts`: `inputIds` references rename to `controls`
- `interop.test.ts` (e2e): `inputIds` attribute usage renames
- `kiosk-keyboard.test.ts` (webc): `for` and `inputIds` tests unify into `controls`

### New test cases

- Single-ID `controls` auto-targets on `show()` when no active target exists
- `activeControlChange` event fires with `controlId` parameter
- `getActiveControl()` / `activeElement` returns the currently focused control/element (read-only)
- Dynamic addition via spread + `setControls()` reconciles focus delegates correctly
- Web component inside UI5: `controls` resolves UI5-rendered DOM elements correctly
