# Kiosk Keyboard Architecture

This document describes the internal architecture, design decisions, and edge case handling of the `ui5.kiosk` library.

## Module Overview

```
KioskKeyboard.ts          UI5 Control: state, event delegation, target input integration,
                          locale detection, auto-type, mobile keyboard suppression
KioskKeyboardRenderer.ts  Renderer object: flat DOM output, apiVersion 4
library.ts                UI5 Lib.init(), enum registration
                          (KeyboardLayout, KeyboardType, MobileKeyboard, FKeyMode),
                          plus key-name constants (`KeyName`)
types.ts                  KeyDefinition, KeyRow, LayoutDefinition interfaces,
                          KioskI18nConfig, KioskI18nEnhancement, KioskI18nOverrideHook,
                          KioskI18nOverrideContext types
internal/layout-registry.ts  Layout registration/reset + locale-based layout resolution
internal/dom.ts           Key element IDs, input guards, input/textarea resolver
internal/i18n-registry.ts i18n resolution chain: base bundle + enhancement bundles
                          + override hook, async loading with generation counter
internal/detect-keyboard-type.ts  Auto-type detection helpers
internal/input-operations.ts      Target input text operations
internal/target-input-session.ts  Per-target dirty/value/change handling
internal/focus-claim-service.ts   Auto-show input claim logic
i18n/
  messagebundle.properties    Default (English) key/ARIA labels
  messagebundle_de.properties German translations
layouts/
  index.ts                Layout registry (Record<string, LayoutDefinition>)
  qwerty.ts               Standard QWERTY with number row and shift symbols
  qwertz-de.ts            German QWERTZ with Umlaute (ä, ö, ü, ß)
  numeric.ts              Number pad with basic operators
  special.ts              Special characters and symbols
  numpad.ts               Compact calculator-style keypad
  fkeys.ts                Standalone function key layout (F1-F12)
  nav.ts                  Standalone navigation layout (arrows + Home/End/Page)
  fkey-row.ts             Shared F1-F12 row used by *-fk variants
  nav-row.ts              Shared navigation row used by *-nav variants
  qwerty-fk.ts            QWERTY with F1-F12 row on top
  qwertz-de-fk.ts         QWERTZ-DE with F1-F12 row on top
  qwerty-nav.ts           QWERTY with navigation row on top
  qwertz-de-nav.ts        QWERTZ-DE with navigation row on top
themes/
  base/
    KioskKeyboard.less    Base styles using SAP LESS parameters
    library.source.less   Base library entry point
  sap_horizon/
    library.source.less   Horizon theme (imports base + theme globals)
```

## UI5 Integration

### Library Initialization

The library uses `Lib.init()` with `apiVersion: 2` and declares dependencies on both `sap.ui.core` and `sap.m`. Unlike the hotkeys library, this library **requires CSS** (`noLibraryCSS: false`), which is the hard blocker that forced it into a separate library from `ui5.hotkeys`.

The `sap.m` dependency is required because the control uses `sap.ui.core.Element.closestTo()` for resolving DOM elements to UI5 controls, and the target inputs are typically `sap.m.Input` or `sap.m.TextArea`.

### Class Hierarchy

`KioskKeyboard` extends `sap/ui/core/Control`, making it a full UI5 control with:

- ManagedObject metadata (properties, associations, events)
- Renderer integration
- Lifecycle hooks (`init`, `onAfterRendering`, `exit`)
- UI5 event delegation (`ontouchstart`, `ontouchend`, `onkeydown`)

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

> **Note:** The UI5 linter does not recognize `apiVersion: 4`. This is a known gap, but the renderer works correctly at runtime.

## Control Architecture

### Flat DOM, No Child Controls

The keyboard renders as a flat DOM structure: a root `<div>` containing row `<div>`s containing key `<div>`s. There are no child UI5 controls; every key is a plain DOM element with `role="button"`.

This design was chosen for:

- **Performance**: No control overhead for 30-50 individual keys
- **Simplicity**: One renderer, one invalidation cycle
- **Event delegation**: Single `ontap`/`onkeydown` handler on the control root

### Event Delegation

UI5's built-in event delegation dispatches browser events to the nearest UI5 control in the DOM hierarchy. The `ontap` and `onkeydown` methods on `KioskKeyboard` receive all events from child elements.

The handler flow uses a press/release pattern (`ontouchstart` + `ontouchend`) instead of `ontap`, because `preventDefault()` on the underlying touch/mouse event is needed to prevent focus steal (see below).

```
ontouchstart
  |
  +-- Resolve: find closest .ui5KioskKey element
  +-- preventDefault() - prevents focus transfer away from target input
  +-- Track pressed key, add --pressed CSS class

ontouchend
  |
  +-- Guard: enabled check, release target matches press target
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

### Focus Steal Prevention

`ontouchstart` calls `preventDefault()` on the underlying mouse/touch event when a key element is pressed. This prevents the browser from transferring focus away from the target input, which is critical for maintaining the cursor position in the input field. UI5's `EventSimulation` fires `ontouchstart` for both mouse and touch interactions.

## Target Input Integration

### Association Pattern

The target input is a UI5 association (`targetInput`), not an aggregation. This means:

- The keyboard doesn't own the input control
- The input can exist anywhere in the control tree
- The association stores just the control ID

For controller code that needs the control instance (not the ID), use `getTargetControl()` as a typed convenience wrapper over the association.

`setTargetInput()` is overridden to pass `true` (suppressInvalidate) to `setAssociation()`, since changing the target doesn't affect the keyboard's visual output and shouldn't trigger a re-render.

### setTargetInput Execution Order

`setTargetInput()` performs a full state transition from the old target to the new one. The order of operations matters because of a re-entrancy scenario.

**Normal flow** (no re-entrancy):

```
setTargetInput(newInput)
  1. captureAndClearDirty()        - snapshot old target's change data, clear dirty flag
  2. _removeHighlightDelegation()  - remove key highlight from old target
  3. _restoreNativeKeyboard()      - restore old target's inputmode (if keyboard is open)
  4. resetForTargetSwitch()        - reset cursor state
  5. setAssociation(newInput)      - update the association
  6. add highlight delegation      - attach to new target
  7. _suppressNativeKeyboard()     - suppress new target's inputmode (if keyboard is open)
  8. fireDeferredChange()          - fire "change" on the OLD target (captured in step 1)
```

**Re-entrant flow**: when the deferred `change` handler focuses another input:

This happens when autoShow is active and a consumer's `change` handler synchronously focuses a third input (e.g. a validation-then-advance pattern in form-heavy apps).

```
setTargetInput(inputB)          - target was inputA
  1. capture inputA's change data, clear dirty
  2. remove inputA's highlight delegation
  3. restore inputA's inputmode
  4. reset cursor
  5. set association → inputB
  6. add highlight delegation → inputB
  7. suppress inputB's inputmode
  8. fire deferred change on inputA
     └─ handler calls inputC.focus()
        └─ focusin → _onDocumentFocusIn → setTargetInput(inputC)
             1. capture (nothing - not dirty)
             2. remove inputB's highlight delegation
             3. restore inputB's inputmode
             4. reset cursor
             5. set association → inputC
             6. add highlight delegation → inputC
             7. suppress inputC's inputmode
             8. fire deferred change (null - no-op)
             ← returns
        ← handler returns
     ← change event returns
  ← returns

Final state: target = inputC, delegation on inputC, suppression on inputC ✓
```

The key insight: all state transitions (steps 2-7) complete **before** the change event fires (step 8). So when the inner call starts, it sees fully settled state and can cleanly transition from inputB to inputC. The outer call has no more state work after step 8.

**Why the change event must be deferred**: if it fired eagerly at step 1 (the original design), the inner call would set up inputC, then the outer call would resume at step 2 and tear down inputC's delegation, restore inputC's suppression, and overwrite the association to inputB.

### Value Manipulation

The keyboard operates on the target's inner DOM element (`getFocusDomRef()`) for cursor-aware operations:

1. **Text insertion**: Reads `selectionStart`/`selectionEnd`, splices the new text in, updates cursor position.
2. **Backspace**: Deletes the selection (if any) or the character before the cursor.
3. **Enter**: Inserts `\n` for `<textarea>`. For single-line `<input>`, fires a `change` event on the target control (matching physical Enter key behavior).

After modifying the DOM value, the keyboard calls the UI5 control's `setValue()` and `fireLiveChange()` for proper data binding integration. These are invoked via duck-typing (`Record<string, unknown>`) to avoid a hard dependency on specific control types.

### Cursor Initialization

When the target input hasn't been focused yet (e.g. set programmatically via `setTargetInput`), `selectionStart` defaults to 0. On first access per target, `_getTargetDomRef()` calls `setSelectionRange()` to position the cursor at the end of the value, but only when the input is **not** already the active element, so a user-placed cursor is never overwritten.

Critically, this does **not** call `dom.focus()`. This avoids stealing focus from surrounding containers (e.g. a `sap.m.Popover` that contains the keyboard while the target input is outside). Selection state persists on unfocused inputs in all modern browsers per the HTML Living Standard. A `_cursorInitialized` flag (reset on `setTargetInput()`) ensures this runs once per target.

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

## Locale-Based Default Layout

When no explicit `layout` is provided in the constructor settings, the keyboard auto-detects the appropriate layout from the UI5 locale.

### applySettings Override

The UI5 ManagedObject constructor flow is: `init()` → `applySettings(mSettings)`. The control overrides `applySettings` to inject the locale layout when no explicit `layout` key is present:

```ts
applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
  if (mSettings && !("layout" in mSettings)) {
    mSettings.layout = KioskKeyboard.getLocaleLayout();
  }
  return super.applySettings(mSettings, oScope);
}
```

This is transparent: `<kiosk:KioskKeyboard />` gets the locale layout injected as if the developer had written `layout="qwertz-de"`. An explicit `layout="qwerty"` takes priority because the key is already present in `mSettings`.

### Locale Resolution

`getLocaleLayout()` uses `Localization.getLanguageTag()` from `sap/base/i18n/Localization`. This API resolves from all UI5 language sources: URL `sap-ui-language` param, `sap-language` param, bootstrap config, and browser settings. No manual URL parsing is needed.

The returned `LanguageTag` has `.language` (lowercase ISO639, e.g. `"de"`) and `.region` (uppercase ISO3166 or `null`, e.g. `"AT"`).

Resolution checks exact match first (e.g. `"de-at"`), then language prefix (`"de"`), then falls back to `DEFAULT_LAYOUT` (`"qwerty"`).

The locale → layout map is extensible via `KioskKeyboard.registerLocaleLayout(locale, layout)`.
Cleanup is technically optional for most apps because repeated initialization usually reapplies the same mapping without errors or leaks.
For deterministic app-specific state, mappings can be cleaned up with `KioskKeyboard.unregisterLocaleLayout(locale)` or reset to defaults with `KioskKeyboard.resetLocaleLayouts()`.

### Impact on \_baseLayout

Works correctly: `setLayout("qwertz-de")` sets `_baseLayout = "qwertz-de"` (not in `SECONDARY_LAYOUTS`), so `{layout:base}` roundtrips back to it.

## Auto-Type Detection

When `autoType="true"` and the keyboard auto-shows for a focused input, it inspects the input's type metadata and automatically switches between Full and Numpad keyboard types.

### Detection Logic

`_detectKeyboardType(control)` checks in order:

1. **UI5 `getType()`** on the control → `"Number"` or `"Tel"` → `"Numpad"`
2. **Control name** → `"sap.m.StepInput"` → `"Numpad"`
3. **DOM `inputmode` attribute** → `"numeric"` / `"decimal"` / `"tel"` → `"Numpad"`
4. **HTML `type` attribute** → `"number"` / `"tel"` → `"Numpad"`
5. **Fallback** → `"Full"`

Detection uses static `ReadonlySet` constants for each check, avoiding repeated string comparisons.

### Explicit vs Auto-Detected Type

A private `_keyboardTypeExplicit` flag tracks whether the developer explicitly set `keyboardType`. The custom `setKeyboardType()` setter sets this flag to `true`. Auto-detection uses `setProperty("keyboardType", ...)` directly to bypass the flag.

Because UI5's `applySettings()` calls custom setters, `{ keyboardType: "Numpad" }` in the constructor will call `setKeyboardType("Numpad")` which sets the flag, so auto-detection is disabled.

### Integration Point

In `_onDocumentFocusIn`, after resolving the UI5 control and before `show()`:

```ts
if (this.getAutoType() && !this._keyboardTypeExplicit) {
  const detected = this._detectKeyboardType(ui5Control);
  this.setProperty("keyboardType", detected); // bypasses custom setter
}
```

When the user tabs from a Number input to a Text input, `_onDocumentFocusIn` fires again, detects `"Full"`, and switches back.

## Mobile Keyboard Detection

The `mobileKeyboard` property (enum `ui5.kiosk.MobileKeyboard`) controls whether to suppress the native virtual keyboard or defer to it on mobile/touch devices.

### \_shouldDeferToNative()

```ts
private _shouldDeferToNative(): boolean {
  const mode = this.getMobileKeyboard();
  if (mode === "Custom") return false;
  if (mode === "Native") return true;
  // "Auto": kiosk keyboard on desktop, native on mobile
  return Device.system.phone || (Device.system.tablet && !Device.system.desktop);
}
```

- `"Custom"`: always returns `false` (use the kiosk keyboard).
- `"Native"`: always returns `true` (defer on every device, disabling auto-show entirely).
- `"Auto"`: uses `sap/ui/Device` for device detection. The `tablet && !desktop` check handles combi devices (laptops with touchscreens). These report both `tablet: true` and `desktop: true`, and should use the custom keyboard.

### Native Keyboard Suppression

When the KioskKeyboard shows and `_shouldDeferToNative()` returns `false`, it sets `inputmode="none"` on the target input's DOM element. This is the standard web API for preventing the native virtual keyboard.

- `_suppressNativeKeyboard()`: saves original `inputmode`, sets `"none"`. Called by `show()`.
- `_restoreNativeKeyboard()`: restores saved `inputmode` (or removes the attribute if it was absent). Called by `close()` and `exit()`.

State is tracked via:

- Per instance: `_suppressedInputId` (which target this keyboard currently claims)
- Shared across instances: static `_inputModeSuppressions` map keyed by target input ID with `{ originalInputMode, refCount }`

This makes suppression safe for multi-keyboard setups targeting the same input: each show/claim increments a ref-count, each close/destroy decrements it, and the original `inputmode` is restored only when the last claimant releases the input. When the target changes, the previous target is released before suppressing the new one.

### Integration Points

1. **`_onDocumentFocusIn`**: Checks `_shouldDeferToNative()` first. If `true`, returns early. The native keyboard handles input.
2. **`show()`**: Calls `_suppressNativeKeyboard()`.
3. **`close()`**: Calls `_restoreNativeKeyboard()`.
4. **`exit()`**: Calls `_restoreNativeKeyboard()` for cleanup.
5. **Focus-out cleanup**: If the keyboard is already open, close/restore still runs when focus leaves even if the control became non-participating (`visible=false` / `enabled=false`) after opening.

## Docked Mode

When `docked="true"`, the keyboard uses `position: fixed` anchored to the bottom of the viewport.

### CSS-Driven Animation

The open/close state is managed via CSS classes rather than re-rendering:

- `ui5KioskKeyboard--docked`: Applies fixed positioning and viewport-width sizing.
- `ui5KioskKeyboard--closed`: Applies `transform: translateY(100%)` to slide the keyboard off-screen.

`show()` removes the `--closed` class; `close()` adds it. This approach avoids re-rendering during animation, which would cause visual glitches. The `transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)` provides smooth slide-in/out.

### Event Timing

`afterOpen` and `afterClose` events fire synchronously when `show()` and `close()` are called. They signal the state change, not the animation completion. The CSS transition plays independently. This avoids fragile `transitionend` listener logic and ensures deterministic event timing regardless of animation state, `prefers-reduced-motion`, or test environments.

### onAfterRendering Sync

The renderer always renders with `--closed` for docked keyboards. `onAfterRendering()` then syncs the CSS class with the actual `_open` state. This handles the case where `show()` was called before or between renders.

## Auto-Show

Auto-show uses document-level `focusin`/`focusout` listeners in the capture phase:

### Instance Isolation

A static `_instances` set tracks all living `KioskKeyboard` instances. Before auto-show opens for a focused input, `_isTargetOfOther()` checks whether any **other** KioskKeyboard instance already has that input as its `targetInput`. If so, auto-show bails out because the input belongs to that keyboard.

This prevents a docked auto-show keyboard from stealing inputs that are explicitly assigned to an inline keyboard (e.g. a numpad paired with a numeric field).

The registry is maintained in `init()` (add) and `exit()` (delete).

### Focus-In Logic

```
focusin event
  |
  +-- Guard: docked mode and enabled check
  +-- Guard: ignore focus on the keyboard itself
  +-- Check: _resolveClaimableControl(target)?
  |     - Is it a textual <input>/<textarea>?
  |     - Should we defer to native keyboard?
  |     - Resolve UI5 control via Element.closestTo()
  |     - Is this input owned by another KioskKeyboard instance?
  |     - Is inputIds set and the control NOT in the list?
  |     No to any  -> ignore (null)
  |     Yes to all -> set as target input
  |                   auto-detect keyboard type (if autoType enabled)
  |                   show()
```

The instance isolation and `inputIds` filter checks run inside `_resolveClaimableControl()`. When `inputIds` is set, only inputs in that list pass the filter, and focusing any other input is ignored. When focus moves from an unclaimed input to a claimed input, `_resolveClaimableControl()` returns null and the keyboard closes normally. During each auto-show `focusin`, `_setupInputIds()` reconciles delegates by resolved control IDs so aggregation-bound input recreation (destroy/create churn) is picked up immediately.

### Focus-Out Logic

```
focusout event
  |
  +-- Guard: docked, open, and enabled check
  +-- Read relatedTarget (element receiving focus)
  |     Check: is relatedTarget inside the keyboard?   -> don't close
  |     Check: would this keyboard claim relatedTarget? -> don't close
  |     Otherwise                                       -> close()
```

The `relatedTarget` property of the `FocusEvent` identifies the element receiving focus synchronously in the common path. When `relatedTarget` is `null` (seen in some browser/shadow-DOM transitions), the implementation schedules a one-tick deferred check against `document.activeElement` before closing. This preserves flicker-free behavior while handling null-relatedTarget transitions safely.

The "would this keyboard claim" check uses `_wouldClaimInput()`, which consults `_isTargetOfOther()`. If the new target input belongs to a different keyboard, the docked keyboard closes rather than staying open for an input it should not control.

### Cleanup

`disableAutoShow()` removes both listeners. The `exit()` lifecycle hook removes the instance from the static registry, calls `disableAutoShow()`, and restores the native keyboard inputmode, preventing leaks after the control is destroyed.

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

The base stylesheet references SAP theme parameters exclusively, with no hardcoded colors. This ensures automatic theming support for all Horizon variants (light, dark, HCB, HCW).

### Key Styling

Keys use SAP button parameters for visual consistency with the rest of the UI:

| Key type     | SAP parameter prefix     | Visual style                      |
| ------------ | ------------------------ | --------------------------------- |
| Default      | `@sapUiButton`           | Standard button                   |
| Modifier     | `@sapUiButtonLite`       | Subdued (Shift, layouts)          |
| Action       | `@sapUiButtonEmphasized` | Prominent (Enter, Backspace)      |
| Active Shift | `@sapUiButtonEmphasized` | Same as action (toggle indicator) |

### Responsive Sizing

Keys use `flex: <grow> 1 0` for proportional sizing within rows. Width classes (`--w1-5`, `--w2`, `--space`) set the flex-grow factor. This makes the keyboard naturally responsive, and keys scale proportionally to the container width.

Responsiveness is split into two axes: width (pure CSS) and height (JS-assisted).

**Width responsiveness** is handled entirely by CSS `@container` queries. The root `.ui5KioskKeyboard` element sets `container-name: keyboard; container-type: inline-size`. Two breakpoints exist:

- **30rem (narrow):** Caps `--ui5KioskKeyboard-keyFontSize` via `min(base, 1rem)` so consumer-provided smaller values are preserved while larger values get clamped.
- **20rem (compact):** Additionally reduces key inline padding for non-numpad keys and applies a tighter font-size cap of `0.875rem`.

No JavaScript is involved in width responsiveness. Because UI5's vendored LESS 1.6.3 parser does not recognize `@container` at-rules, the container query rules live in a separate plain CSS file (`KioskKeyboard.container-queries.css`) that is pulled in via `@import (inline)` in `library.source.less`. The `(inline)` flag tells the LESS compiler to include the file verbatim without parsing it.

**Height responsiveness** uses JS (`sap/ui/core/ResizeHandler`, UI5's centralized resize handling) to detect when the root element is externally height-constrained (i.e., `scrollHeight` exceeds the rendered `getBoundingClientRect().height`). When constrained, it applies classes on the root element:

- `ui5KioskKeyboard--cq-short` (height <= 16rem): Reduces key height to `2.25rem`, gap to `0.25rem`, padding to `0.5rem`.
- `ui5KioskKeyboard--cq-tiny` (height <= 12rem): Further reduces key height to `1.75rem`, gap to `0.125rem`, padding to `0.25rem`.

Height classes use `:where()` wrapper selectors for zero specificity (e.g., `:where(.ui5KioskKeyboard--cq-short:not(.ui5KioskKeyboard--numpad))`). Any consumer class selector (e.g., `.myKeyboard { --ui5KioskKeyboard-keyHeight: 4rem; }`) wins without needing specificity tricks.

A combined rule in the container queries CSS applies when both narrow width and constrained height are active, using the most aggressive font-size cap of `0.75rem`.

Height thresholds are configurable via CSS custom properties: `--ui5KioskKeyboard-cqShortThreshold` (default `16rem`) and `--ui5KioskKeyboard-cqTinyThreshold` (default `12rem`).

Docked keyboards and numpad mode skip height class application (docked keyboards are viewport-driven; numpads are already compact).

The public sizing variables deliberately separate normal and extra-narrow spacing. `--ui5KioskKeyboard-keyPaddingInline` keeps the default inline inset for regular widths, while `--ui5KioskKeyboard-keyPaddingInlineXs` is applied at the 20rem `@container` breakpoint for non-numpad keys. Its default (`min(var(--ui5KioskKeyboard-keyPaddingInline), 0.125rem)`) trims the stock padding from `0.25rem` to `0.125rem` so wide glyphs like `@`, `%`, and `&` get more horizontal breathing room on phone-sized rows without reducing key height or touch-target size. The `min(...)` form preserves any consumer override that is already smaller.

**Consumer overrides:** All default values use `:where()` for zero specificity. Consumer selectors with at least one class always win. For custom width breakpoints, consumers can write `@container keyboard (max-width: ...)` rules directly since the keyboard's root element sets `container-name: keyboard`.

### Content Density

Compact mode (`.sapUiSizeCompact`) reduces padding, gap, key height, and font size for denser displays.

## Edge Cases

| Edge Case                               | How It Is Handled                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Focus steal on key tap                  | `ontouchstart` `preventDefault()` keeps focus on input                           |
| Target input not yet focused            | `_getTargetDomRef()` places cursor at end via `setSelectionRange()` (no focus)   |
| Auto-show flicker on focus transitions  | Synchronous `relatedTarget` check, plus one-tick deferred fallback when null     |
| Focus on keyboard during auto-show      | `relatedTarget` checked against keyboard DOM via `contains()`                    |
| Auto-show vs input owned by other kbd   | `_wouldClaimInput()` checks `_isTargetOfOther()`                                 |
| Focus moves to claimed input while open | `_wouldClaimInput()` checks `_isTargetOfOther()`, closes normally                |
| Layout switch in non-Full mode          | Silently ignored (no event, no state change)                                     |
| Shift auto-release vs Caps Lock         | Only `_shiftActive` auto-releases, not `_capsLock`                               |
| `sap.ui.core.Element` name collision    | `globalThis.Element` for DOM Element references                                  |
| No `$KioskKeyboardSettings` type        | Use setters in tests, not constructor settings                                   |
| `setTargetInput` re-render              | `setAssociation(name, value, true)` suppresses invalidation                      |
| `setTargetInput` re-entrancy            | Change event deferred to after state transitions via `captureAndClearDirty()`    |
| Docked show/close during render         | `onAfterRendering` syncs CSS with `_open` state                                  |
| Destroy with auto-show active           | `exit()` removes from instance registry, disables auto-show, restores inputmode  |
| `setValue`/`fireLiveChange` duck-typing | `Record<string, unknown>` cast avoids `any`                                      |
| `inputIds` with `autoShow`              | `_resolveClaimableControl()` filters by `inputIds`; delegation triggers `show()` |
| `inputIds` aggregation churn            | `_setupInputIds()` rebinds delegates by control ID on each auto-show `focusin`   |
| Locale detection no region              | Falls through to language prefix, then `DEFAULT_LAYOUT`                          |
| Explicit `keyboardType` vs auto-type    | `_keyboardTypeExplicit` flag disables auto-detection                             |
| Constructor sets `keyboardType`         | `applySettings` calls custom setter, which sets the flag                         |
| `inputmode` restore on target switch    | `_suppressNativeKeyboard()` restores previous before suppressing new             |
| `inputmode` restore on destroy          | `exit()` calls `_restoreNativeKeyboard()`                                        |
| Combi device (tablet + desktop)         | `Device.system.tablet && !Device.system.desktop` → treats as desktop             |
| `show()` without target input           | `_suppressNativeKeyboard()` is a no-op when no target element exists             |
| Enhancement bundle load failure         | `createEnhancementBundle` catches, logs warning, returns `null`; filtered out    |
| Override hook throws                    | `getText` catches, logs warning, keeps pre-hook `resolvedText`                   |
| Locale change with no living instances  | `reloadIfStale()` in `init()` detects stale bundles and reloads on next create   |
| Rapid sequential `configureI18n` calls  | Generation counter discards stale async loads; only latest config is applied     |
| Locale churn during bundle reload       | `reloadBundles` loop retries up to `MAX_RELOAD_CYCLES` (5), then aborts          |
| Last `KioskKeyboard` instance destroyed | `exit()` auto-resets i18n config and clears override hook (FLP safety)           |

## Project Layout

```
packages/kiosk-keyboard/
  src/
    KioskKeyboard.ts          UI5 Control with state, event handling,
                               locale detection, auto-type, mobile suppression
    KioskKeyboardRenderer.ts  Renderer (apiVersion 4, flat DOM)
    library.ts                Lib.init(), KeyboardLayout/KeyboardType/MobileKeyboard/FKeyMode enums,
                               plus KeyName constants
    types.ts                  KeyDefinition, KeyRow, LayoutDefinition,
                              KioskI18nConfig, KioskI18nEnhancement, KioskI18nOverrideHook,
                              KioskI18nOverrideContext
    internal/layout-registry.ts  Layout registration and locale resolution
    internal/
      dom.ts                  DOM/key ID utilities + input resolver
      i18n-registry.ts        i18n resolution chain, config, hook, async loading
      detect-keyboard-type.ts Auto-type detection
      input-operations.ts     Text insertion/backspace/enter ops
      target-input-session.ts Target state + commit handling
      focus-claim-service.ts  Auto-show claim decisions
    layouts/
      index.ts                Layout registry
      qwerty.ts               Standard QWERTY layout
      qwertz-de.ts            German QWERTZ layout
      numeric.ts              Numeric layout
      special.ts              Special characters layout
      numpad.ts               Compact numpad layout
      fkeys.ts                Standalone F-key layout
      nav.ts                  Standalone navigation layout
      fkey-row.ts             Shared F-key row
      nav-row.ts              Shared navigation row
      qwerty-fk.ts            QWERTY + F-key row
      qwertz-de-fk.ts         QWERTZ-DE + F-key row
      qwerty-nav.ts           QWERTY + navigation row
      qwertz-de-nav.ts        QWERTZ-DE + navigation row
    themes/
      base/
        KioskKeyboard.less    Base styles (SAP LESS parameters)
        library.source.less   Base entry point
      sap_horizon/
        library.source.less   Horizon theme entry point
    manifest.json             Library manifest (v2.0.0)
    .library                  UI5 library metadata
  test/qunit/
    KioskKeyboard.qunit.ts               Core control tests (init, properties, typing)
    KioskKeyboard-a11y.qunit.ts          Accessibility (ARIA, roving tabindex)
    KioskKeyboard-docked.qunit.ts        Docked mode tests
    KioskKeyboard-events.qunit.ts        Event delegation tests
    KioskKeyboard-focus.qunit.ts         Focus management tests
    KioskKeyboard-i18n.qunit.ts          i18n extension API integration tests
    KioskKeyboard-layout.qunit.ts        Layout switching tests
    KioskKeyboard-autoshow.qunit.ts      Auto-show unit tests
    KioskKeyboard-autoshow-blackbox.qunit.ts  Auto-show black-box tests
    KioskKeyboard-autotype-mobile.qunit.ts    Auto-type / mobile tests
    KioskKeyboard-input-blackbox.qunit.ts     Input operation black-box tests
    KioskKeyboard-renderer-blackbox.qunit.ts  Renderer black-box tests
    i18n-registry.qunit.ts               i18n registry unit tests
    layout-registry.qunit.ts             Layout registry unit tests
    focus-claim-service.qunit.ts         Focus claim service tests
    input-operations.qunit.ts            Input operations tests
    target-input-session.qunit.ts        Target input session tests
    negative-edge-cases.qunit.ts         Negative / edge-case tests
    FKeys.qunit.ts                       Function key tests
    NavKeys.qunit.ts                     Navigation key tests
    Grapheme.qunit.ts                    Grapheme-aware editing tests
    testsuite.qunit.ts                   Test suite runner
    test-helpers.ts                      Shared test utilities
  test/e2e/
    wdio.conf.ts               WebdriverIO configuration
    wdio-flp.conf.ts           WebdriverIO config for FLP tests
    wdio-device.conf.ts        WebdriverIO config for device emulation tests
    visual.test.ts             Visual regression tests
    inputmode.test.ts          E2E tests for inputmode suppression
    focus.test.ts              Focus/auto-show behavior
    autotype.test.ts           Auto-type keyboard switching
    interop.test.ts            StepInput + UI5 Web Components interop
    i18n.test.ts               i18n extensibility e2e tests
    flp-lifecycle.test.ts      FLP lifecycle i18n auto-reset tests
    accessibility-media.test.ts  Accessibility and media-query tests
    rtl.test.ts                RTL layout tests
    readme-screenshots.test.ts   Screenshot generation for README
```
