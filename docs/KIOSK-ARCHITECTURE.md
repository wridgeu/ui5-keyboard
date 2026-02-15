# Kiosk Keyboard Architecture

This document describes the internal architecture, design decisions, and edge case handling of the `ui5.kiosk` library.

## Module Overview

```
KioskKeyboard.ts          UI5 Control — state, event delegation, target input integration
KioskKeyboardRenderer.ts  Renderer object — flat DOM output, apiVersion 4
library.ts                UI5 Lib.init(), enum registration (KeyboardLayout, KeyboardType)
types.ts                  KeyDefinition, KeyRow, LayoutDefinition interfaces
layouts/
  index.ts                Layout registry (Record<string, LayoutDefinition>)
  qwerty.ts               Standard QWERTY with number row and shift symbols
  numeric.ts              Number pad with basic operators
  special.ts              Special characters and symbols
  numpad.ts               Compact calculator-style keypad
themes/
  base/
    KioskKeyboard.less    Base styles using SAP LESS parameters
    library.source.less   Base library entry point
  sap_horizon/
    library.source.less   Horizon theme (imports base + theme globals)
```

## UI5 Integration

### Library Initialization

The library uses `Lib.init()` with `apiVersion: 2` and declares dependencies on both `sap.ui.core` and `sap.m`. Unlike the hotkeys library, this library **requires CSS** (`noLibraryCSS: false`) — this is the hard blocker that forced it into a separate library from `ui5.hotkeys`.

The `sap.m` dependency is required because the control uses `sap.ui.core.Element.closestTo()` for resolving DOM elements to UI5 controls, and the target inputs are typically `sap.m.Input` or `sap.m.TextArea`.

### Class Hierarchy

`KioskKeyboard` extends `sap/ui/core/Control`, making it a full UI5 control with:

- ManagedObject metadata (properties, associations, events)
- Renderer integration
- Lifecycle hooks (`init`, `onAfterRendering`, `exit`)
- UI5 event delegation (`ontap`, `onkeydown`)

Because `Control` extends `ManagedObject`, the class field initializer trap applies. All private fields use `declare` and are initialized in `init()`:

```ts
declare private _shiftActive: boolean;
// ... initialized in init()
init(): void {
  this._shiftActive = false;
}
```

### Renderer

`KioskKeyboardRenderer` is a plain object (not a class) with `apiVersion: 4` (semantic rendering). This tells the framework the control's output depends only on its own properties, so re-rendering can be skipped when only the parent changes.

> **Note:** The UI5 linter does not recognize `apiVersion: 4`. This is a known gap — the renderer works correctly at runtime.

## Control Architecture

### Flat DOM, No Child Controls

The keyboard renders as a flat DOM structure: a root `<div>` containing row `<div>`s containing key `<div>`s. There are no child UI5 controls — every key is a plain DOM element with `role="button"`.

This design was chosen for:

- **Performance**: No control overhead for 30-50 individual keys
- **Simplicity**: One renderer, one invalidation cycle
- **Event delegation**: Single `ontap`/`onkeydown` handler on the control root

### Event Delegation

UI5's built-in event delegation dispatches browser events to the nearest UI5 control in the DOM hierarchy. The `ontap` and `onkeydown` methods on `KioskKeyboard` receive all events from child elements.

The handler flow:

```
ontap / onkeydown
  |
  +-- Guard: enabled check
  +-- Resolve: find closest .ui5KioskKey element
  +-- Read: data-key attribute for the key value
  |
  +-- Route by key value:
  |     {shift}         -> toggle shift state, invalidate
  |     {backspace}     -> fire keyPress, handle backspace on target
  |     {enter}         -> fire keyPress, insert newline (TextArea only)
  |     {layout:name}   -> switch layout (Full mode only), fire layoutChange
  |     (character)     -> resolve shift value, fire keyPress, insert text
  |
  +-- Auto-release shift (if shift active and not caps lock)
```

### Pointer Prevention

A `pointerdown` listener (attached via `attachBrowserEvent`) calls `preventDefault()` on key elements. This prevents the browser from moving focus away from the target input when the user taps a virtual key — critical for maintaining the cursor position in the input field.

## Target Input Integration

### Association Pattern

The target input is a UI5 association (`targetInput`), not an aggregation. This means:

- The keyboard doesn't own the input control
- The input can exist anywhere in the control tree
- The association stores just the control ID

`setTargetInput()` is overridden to pass `true` (suppressInvalidate) to `setAssociation()`, since changing the target doesn't affect the keyboard's visual output and shouldn't trigger a re-render.

### Value Manipulation

The keyboard operates on the target's inner DOM element (`getFocusDomRef()`) for cursor-aware operations:

1. **Text insertion**: Reads `selectionStart`/`selectionEnd`, splices the new text in, updates cursor position.
2. **Backspace**: Deletes the selection (if any) or the character before the cursor.
3. **Enter**: Inserts `\n` for `<textarea>`, no-op for single-line `<input>`.

After modifying the DOM value, the keyboard calls the UI5 control's `setValue()` and `fireLiveChange()` for proper data binding integration. These are invoked via duck-typing (`Record<string, unknown>`) to avoid a hard dependency on specific control types.

### Focus Guard

When the target input hasn't been focused yet (e.g. set programmatically via `setTargetInput`), `selectionStart` defaults to 0. The `_getTargetDomRef()` method detects this and focuses the input with the cursor at the end of its value, matching the behavior of real virtual keyboards.

## Shift & Caps Lock

The Shift key implements a three-state cycle managed by two boolean flags:

```
State        _shiftActive  _capsLock  isShiftActive()
─────────    ────────────  ─────────  ───────────────
Off          false         false      false
Shift        true          false      true
Caps Lock    true*         true       true
```

\* `_shiftActive` is set to `false` when entering Caps Lock, but `isShiftActive()` returns `true` because it checks `_shiftActive || _capsLock`.

**Auto-release**: After typing a character with Shift active (not Caps Lock), `_shiftActive` is set to `false` and `invalidate()` is called to update the display. Caps Lock is sticky and does not auto-release.

## Layout System

### Layout Definition

A layout is a 2D array of `KeyDefinition` objects:

```ts
type LayoutDefinition = KeyRow[]; // Array of rows
type KeyRow = KeyDefinition[]; // Array of keys in a row
```

Each key defines its value, optional display label, optional shift variant, width class, visual type, and optional icon.

### Layout Resolution

The `getResolvedLayout()` method resolves the active layout based on `keyboardType`:

```
keyboardType    Resolved layout
────────────    ───────────────
"Numpad"        layouts.numpad     (always)
"Numeric"       layouts.numeric    (always)
"Full"          layouts[layout]    (property-driven, default: qwerty)
```

This allows `keyboardType` to act as a quick override without changing the `layout` property.

### Layout Switching

Layout switch keys use a special value format: `{layout:name}`. When tapped:

1. The `name` is extracted from the value string.
2. `setLayout(name)` is called on the control.
3. A `layoutChange` event is fired.
4. The control re-renders with the new layout.

Layout switching is only effective in `Full` mode. In `Numeric` or `Numpad` mode, layout switch keys are silently ignored.

## Docked Mode

When `docked="true"`, the keyboard uses `position: fixed` anchored to the bottom of the viewport.

### CSS-Driven Animation

The open/close state is managed via CSS classes rather than re-rendering:

- `ui5KioskKeyboard--docked`: Applies fixed positioning and viewport-width sizing.
- `ui5KioskKeyboard--closed`: Applies `transform: translateY(100%)` to slide the keyboard off-screen.

`show()` removes the `--closed` class; `close()` adds it. This approach avoids re-rendering during animation, which would cause visual glitches. The `transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)` provides smooth slide-in/out.

### onAfterRendering Sync

The renderer always renders with `--closed` for docked keyboards. `onAfterRendering()` then syncs the CSS class with the actual `_open` state. This handles the case where `show()` was called before or between renders.

## Auto-Show

Auto-show uses document-level `focusin`/`focusout` listeners in the capture phase:

### Focus-In Logic

```
focusin event
  |
  +-- Guard: docked mode check
  +-- Guard: ignore focus on the keyboard itself
  +-- Check: is target an <input> or <textarea>?
  |     No  -> ignore
  |     Yes -> cancel pending close timer
  |            resolve UI5 control via Element.closestTo()
  |            set as target input
  |            show()
```

### Focus-Out Logic

```
focusout event
  |
  +-- Guard: docked and open check
  +-- Start 200ms close timer
  |     After 200ms:
  |       Check: is focus on the keyboard?     -> don't close
  |       Check: is focus on another input?    -> don't close
  |       Otherwise                            -> close()
```

The 200ms debounce handles the gap between `focusout` on one element and `focusin` on the next. Without it, rapid focus transitions (e.g. tabbing between inputs) would cause flicker.

### Cleanup

`disableAutoShow()` removes both listeners. The `exit()` lifecycle hook calls `disableAutoShow()` and clears any pending close timer, preventing leaks and stale callbacks after the control is destroyed.

## Keyboard Navigation

The control implements roving tabindex for arrow key navigation:

- First key in the grid gets `tabindex="0"`, all others get `tabindex="-1"`.
- Arrow keys move focus by row/column using element ID pattern: `{controlId}-key-{row}-{col}`.
- `_lastFocusedKeyId` tracks the last focused key for `getFocusDomRef()` and `applyFocusInfo()`.

## Theming

### LESS Architecture

```
themes/
  base/
    KioskKeyboard.less      All styles using @sapUi* LESS parameters
    library.source.less     Imports KioskKeyboard.less
  sap_horizon/
    library.source.less     Imports base + SAP Horizon theme globals
```

The base stylesheet references SAP theme parameters exclusively — no hardcoded colors. This ensures automatic theming support for all Horizon variants (light, dark, HCB, HCW).

### Key Styling

Keys use SAP button parameters for visual consistency with the rest of the UI:

| Key type     | SAP parameter prefix     | Visual style                      |
| ------------ | ------------------------ | --------------------------------- |
| Default      | `@sapUiButton`           | Standard button                   |
| Modifier     | `@sapUiButtonLite`       | Subdued (Shift, layouts)          |
| Action       | `@sapUiButtonEmphasized` | Prominent (Enter, Backspace)      |
| Active Shift | `@sapUiButtonEmphasized` | Same as action (toggle indicator) |

### Responsive Sizing

Keys use `flex: <grow> 1 0` for proportional sizing within rows. Width classes (`--w1-5`, `--w2`, `--space`) set the flex-grow factor. This makes the keyboard naturally responsive — keys scale proportionally to the container width.

### Content Density

Compact mode (`.sapUiSizeCompact`) reduces padding, gap, key height, and font size for denser displays.

## Edge Cases

| Edge Case                               | How It Is Handled                                           |
| --------------------------------------- | ----------------------------------------------------------- |
| Focus steal on key tap                  | `pointerdown` `preventDefault()` keeps focus on input       |
| Target input not yet focused            | `_getTargetDomRef()` focuses and places cursor at end       |
| Auto-show flicker on focus transitions  | 200ms debounce on close timer                               |
| Focus on keyboard during auto-show      | Close timer checks `contains(activeElement)`, stays open    |
| Layout switch in non-Full mode          | Silently ignored (no event, no state change)                |
| Shift auto-release vs Caps Lock         | Only `_shiftActive` auto-releases, not `_capsLock`          |
| `sap.ui.core.Element` name collision    | `globalThis.Element` for DOM Element references             |
| No `$KioskKeyboardSettings` type        | Use setters in tests, not constructor settings              |
| `setTargetInput` re-render              | `setAssociation(name, value, true)` suppresses invalidation |
| Docked show/close during render         | `onAfterRendering` syncs CSS with `_open` state             |
| Destroy with auto-show active           | `exit()` calls `disableAutoShow()` + clears timer           |
| `setValue`/`fireLiveChange` duck-typing | `Record<string, unknown>` cast avoids `any`                 |

## Project Layout

```
packages/kiosk-keyboard/
  src/
    KioskKeyboard.ts          UI5 Control with state and event handling
    KioskKeyboardRenderer.ts  Renderer (apiVersion 4, flat DOM)
    library.ts                Lib.init(), KeyboardLayout and KeyboardType enums
    types.ts                  KeyDefinition, KeyRow, LayoutDefinition
    layouts/
      index.ts                Layout registry
      qwerty.ts               Standard QWERTY layout
      numeric.ts              Numeric layout
      special.ts              Special characters layout
      numpad.ts               Compact numpad layout
    themes/
      base/
        KioskKeyboard.less    Base styles (SAP LESS parameters)
        library.source.less   Base entry point
      sap_horizon/
        library.source.less   Horizon theme entry point
    manifest.json             Library manifest (v2.0.0)
    .library                  UI5 library metadata
  test/qunit/
    KioskKeyboard.qunit.ts   Control tests
    testsuite.qunit.ts        Test suite runner
```
