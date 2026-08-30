# Kiosk Keyboard Architecture

This document describes the internal architecture, design decisions, and edge case handling of the `ui5.kiosk` library.

## UI5 Integration

### Library Initialization

The library uses `Lib.init()` with `apiVersion: 2` and declares dependencies on both `sap.ui.core` and `sap.m`. Unlike the hotkeys library, this library **requires CSS** (`noLibraryCSS: false`), which is the hard blocker that forced it into a separate library from `ui5.hotkeys`.

The `sap.m` dependency is required because the control uses `sap.ui.core.Element.closestTo()` for resolving DOM elements to UI5 controls, and the target inputs are typically `sap.m.Input` or `sap.m.TextArea`.

### Class Hierarchy

`KioskKeyboard` extends `sap/ui/core/Control`, making it a full UI5 control with:

- ManagedObject metadata (properties, associations, events)
- Renderer integration
- Lifecycle hooks (`init`, `onAfterRendering`, `exit`)
- UI5 event delegation (`ontouchstart`, `ontouchend`, `ontouchcancel`, `onsapselect`, `onsapselectmodifiers`, `onkeyup`, `onfocusout`)

Because `Control` extends `ManagedObject`, the class field initializer trap applies. Private fields are declared with definite assignment (`!`) and initialized in `init()`:

```ts
private _shiftState!: ShiftState;
// ... initialized in init(); the callback announces the transition, then repaints
init(): void {
  this._shiftState = new ShiftState(() => this._syncShiftState());
}
```

### Renderer

`KioskKeyboardRenderer` is a plain object (not a class) with `apiVersion: 4` (semantic rendering). This tells the framework the control's output depends only on its own properties, so re-rendering can be skipped when only the parent changes.

> [!NOTE]
> The UI5 linter does not recognize `apiVersion: 4`. This is a known gap, but the renderer works correctly at runtime.

## Control Architecture

### Flat DOM, No Child Controls

The keyboard renders as a flat DOM structure: a root `<div>` containing row `<div>`s containing key `<div>`s. There are no child UI5 controls; every key is a plain DOM element with `role="button"`.

This avoids per-key control overhead for the 30-50 keys, keeps the control on one renderer and one invalidation cycle, and routes every key through a single set of `ontouchstart`/`ontouchend`/`onsapselect`/`onsapselectmodifiers` handlers on the control root.

### Event Delegation

UI5's built-in event delegation dispatches browser events to the nearest UI5 control in the DOM hierarchy. The `ontouchstart`/`ontouchend` (pointer) and `onsapselect` / `onsapselectmodifiers` (keyboard Enter/Space on a focused key) methods on `KioskKeyboard` receive all events from child elements. Both keyboard handlers share one body, `_activateFocusedKey`.

`sapselect` is a keydown pseudo-event (`aTypes: ["keydown"]`), so a keycap held down from the physical keyboard would activate at the OS key-repeat rate. The shared body drops the repeats, after the `preventDefault()` that keeps the page from scrolling while Space is held. `{backspace}` is the only key that repeats, and only from pointer input, on `BackspaceRepeatBehavior`'s tuned curve. The web component guards its Enter branch the same way and activates Space on keyup, so neither twin repeats.

`sapselectmodifiers` is the framework's counterpart for the same keys with a modifier held. Only Shift alone is handled, and it activates the key shifted; Ctrl, Alt and Meta stay browser and OS shortcuts. The Shift is transient - one shifted glyph, no latch on the `{shift}` state and so no relabelled keycaps - because `PhysicalKeyHighlight` binds its modifier sync to the target input, which never has focus while a keycap does. Without it a roving-tabindex user cannot reach a capital except by activating `{shift}` first.

A key activated from the keyboard carries the `keyPressed` class for as long as the activating key is held, released on `onkeyup` or on `onfocusout` when Alt-Tab takes focus away before the keyup lands. The pointer gesture's own `_pressedKeyEl` is tracked separately: it also drives backspace repeat and the variant popup, where a keyboard activation is only the visual half.

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
  |     {layout:name}   -> switch layout (any keyboardType), fire layoutChange
  |     (character)     -> resolve shift value, fire keyPress, insert text
  |
  +-- Auto-release shift (if shift active and not caps lock)
```

### Focus Steal Prevention

`ontouchstart` calls `preventDefault()` on the underlying mouse/touch event when a key element is pressed. This prevents the browser from transferring focus away from the target input, which is critical for maintaining the cursor position in the input field. UI5's `EventSimulation` fires `ontouchstart` for both mouse and touch interactions.

## Target Input Integration

### Association Pattern

The active target is tracked via a private UI5 association (`_activeTarget`), not an aggregation. This means:

- The keyboard doesn't own the input control
- The input can exist anywhere in the control tree
- The association stores just the control ID

For controller code that needs the control instance (not the ID), use `getActiveControl()` as a typed convenience wrapper over the private association.

`_setActiveTarget()` is overridden to pass `true` (suppressInvalidate) to `setAssociation()`, since changing the target doesn't affect the keyboard's visual output and shouldn't trigger a re-render.

### \_setActiveTarget Execution Order

`_setActiveTarget()` performs a full state transition from the old target to the new one. The order of operations matters because of a re-entrancy scenario.

**Normal flow** (no re-entrancy):

```
_setActiveTarget(newInput)
  1. captureAndClearDirty()        - snapshot old target's change data, clear dirty flag
  2. _physicalKeyHighlight.detach() - remove key highlight from old target
  3. _nativeKbSuppression.restore()  - restore old target's inputmode (if keyboard is open)
  4. resetForTargetSwitch()         - reset cursor state
  5. setAssociation(newInput)       - update the association
  6. _physicalKeyHighlight.attach() - attach to new target
  7. _nativeKbSuppression.suppress() - suppress new target's inputmode (if keyboard is open)
  8. fireDeferredChange()          - fire "change" on the OLD target (captured in step 1)
```

**Re-entrant flow**: when the deferred `change` handler focuses another input:

This happens when autoShow is active and a consumer's `change` handler synchronously focuses a third input (e.g. a validation-then-advance pattern in form-heavy apps).

```
_setActiveTarget(inputB)        - target was inputA
  1. capture inputA's change data, clear dirty
  2. remove inputA's highlight delegation
  3. restore inputA's inputmode
  4. reset cursor
  5. set association → inputB
  6. add highlight delegation → inputB
  7. suppress inputB's inputmode
  8. fire deferred change on inputA
     └─ handler calls inputC.focus()
        └─ focusin → AutoShowBehavior._onDocumentFocusIn → _setActiveTarget(inputC)
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

**Why the change event must be deferred**: if it fired eagerly at step 1, the inner call would set up inputC, then the outer call would resume at step 2 and tear down inputC's delegation, restore inputC's suppression, and overwrite the association to inputB.

### Value Manipulation

The keyboard operates on the target's inner DOM element (`getFocusDomRef()`) for cursor-aware operations:

1. **Text insertion**: Resolves the cursor range, then inserts over it.
2. **Backspace**: Deletes the selection (if any) or the grapheme cluster before the cursor.
3. **Enter**: Inserts `\n` for `<textarea>`. For single-line `<input>`, fires a `change` event on the target control (matching physical Enter key behavior).

Insertion and backspace run as a **platform edit** when the target is focused: the range is selected and `document.execCommand("insertText" | "delete")` performs it, so the browser applies `maxlength` and records the edit on its own undo stack. The cluster to delete is still resolved in JS beforehand, because the engines disagree on what one is. When the target is not focused, or the command is unavailable or declines, the value is assigned instead and `maxlength` is applied in JS. A platform edit dispatches a real `input` event on the target and an assignment dispatches none, so a host-page `input` listener sees the keyboard's edits only while the target holds focus. Rationale and measurements: `docs/specs/2026-08-11-native-text-insertion-design.md`.

`setTargetValue()` (`internal/input-operations.ts`) writes the value back through the UI5 element for data binding integration. It prefers a typed `setValue()` method (`InputBase.setValue`), falls back to `setProperty("value")` when the control declares a `value` property, and finally to the inner DOM value for custom controls that declare neither. A `liveChange` event is raised afterwards, gated on `metadata.hasEvent("liveChange")`.

After a platform edit the same write runs from the resulting DOM value, which costs no second DOM write because `InputBase.updateDomValue` returns early when the DOM already matches - leaving the undo stack intact. `liveChange` is then raised only if the control did not already raise its own in response to the real `input` event, which is observed rather than inferred: controls reach that event by different routes (`sap.m.Input` via `oninput`, `sap.m.SearchField` via a listener it binds itself). The element is typed as `TargetElement` (`internal/types.ts`), not a specific control class, so no control type is a hard dependency.

### Backspace Press-and-Hold Auto-Repeat

Holding the Backspace key deletes continuously, the way phone keyboards do. The gesture lives in a `BackspaceRepeatBehavior` delegate (`internal/backspace-repeat-behavior.ts`, owning an `AutoRepeater`), alongside the other behavior delegates. `ontouchstart` (which fires for both mouse and touch via UI5's `EventSimulation`) arms it via `onPress`; `ontouchend`/`ontouchcancel`/window-blur (all routed through `_clearPressedKeyState`) call `stop`.

The repeater fires the first delete after an initial hold delay, then accelerates the cadence toward a floor. Each tick runs the **same** path as a single tap (`_tryCompositionMiddleware` + `_performBackspaceDelete`, passed in as the behavior's tick callback), so composition middleware, the cancelable `keyPress` event, and grapheme-aware deletion all apply per repeat. It stops on its own once `TargetInputSession.handleBackspace()` reports nothing was removed (empty input / cursor at start / read-only target).

Because the existing single delete fires on release (`ontouchend`), a held key would otherwise delete one extra character on lift-off. The behavior records that a repeat occurred, and `ontouchend` consults `shouldSuppressRelease` to skip its trailing delete. A quick tap (released before the initial delay) never repeats, so it deletes exactly once on release as before.

The timing curve (`BACKSPACE_AUTO_REPEAT`) is intentionally **duplicated** in the `kiosk-keyboard-webc` package rather than shared (the two packages deliberately do not share code), so the two copies must be kept in sync by hand.

### Cursor Initialization

When the target input hasn't been focused yet (e.g. set programmatically via `_setActiveTarget()`), `selectionStart` defaults to 0. `TargetInputSession` owns the cursor state: on first access per target its `_getTargetDomRef()` places the cursor at the end of the value, but only when the input is **not** already the active element, so a user-placed cursor is never overwritten.

Critically, this does **not** call `dom.focus()`. This avoids stealing focus from surrounding containers (e.g. a `sap.m.Popover` that contains the keyboard while the target input is outside). Selection state persists on unfocused inputs in all modern browsers per the HTML Living Standard. `resetForTargetSwitch()` nulls the cached cursor position on every target change, so the end-of-value placement runs once per target.

## Shift & Caps Lock

The Shift key implements a three-state cycle managed by a `ShiftState` class backed by a `const enum Mode { Off, Shift, CapsLock }`:

```
State        Mode         isShifted  isCapsLock
─────────    ───────────  ─────────  ──────────
Off          Mode.Off     false      false
Shift        Mode.Shift   true       false
Caps Lock    Mode.CapsLock true      true
```

**Double-click detection**: A second Shift press within 400ms (`ShiftState.DOUBLE_CLICK_MS`) of the first activates Caps Lock. A single press outside that window toggles one-shot Shift. Pressing Shift while Caps Lock is active turns everything off.

**Auto-release**: After any key that acts on the target - a character, `{backspace}`, `{enter}`, an `{fkey:*}`, an unrecognized `{...}` token, a committed accent variant, or a key the composition middleware consumed - `autoRelease()` sets the mode back to `Off` and fires the `onChange` callback (which the owner wires to `_syncShiftState()`, announcing the transition before repainting) to update the display. `{shift}` and `{layout:*}` do not spend it (`{layout:*}` resets the whole typing context, Caps Lock included), and Caps Lock is sticky and never auto-releases.

**A veto does not change the spending set** (#241). The latch is consumed to _produce_ the payload: `keyPress` already carries `key: "A"` by the time a consumer sees it, so what `preventDefault()` cancels is the insertion, not the spend. The alternative strands a consumer using the documented veto-and-`insertText()` pattern in Shift with no public API to release it. Both twins follow this rule, and both spend the latch on the same set of keys (#240) - the spending set is a pure function of the key.

**One key, one decision.** `_handleKeyAction` reads the spend off the parsed key once (`spendsOneShotShift(action.kind)`) rather than leaving it to whichever branch remembers to call `autoRelease()`, so the click path has a single spend site. `_commitVariant` and `_performBackspaceRepeatTick` are the two paths that do not run through it and carry their own. **Where in the tick the spend happens is immaterial**: nothing downstream of the fire reads the latch - the payload is resolved before the event is dispatched - and what `autoRelease()` triggers, a repaint and a live-region announcement, does not depend on the insertion having run.

**Where announcements land**: `sap.ui.core.InvisibleMessage`, the framework's polite live region in the static area. The control renders no region of its own - one inside its root is hidden along with it when a docked keyboard closes, which is what #247 was. `InvisibleMessage` also empties its node before each write, so a repeat of the text already standing there still reads as a change. The queue that paces those writes (`AnnouncementQueue`) is a static on the control for the same reason the node is page-global: two keyboards on one page share one span, so a per-instance cadence would let them write over each other. It is torn down with the last instance, so no drain timer outlives the control. The singleton is primed from `onBeforeRendering`, so the node is in the page before the first write. That hook needs no `Core.ready` gate of its own - rendering cannot start before the core is ready, since `Control.placeAt` wraps its body in it - and it is where `sap.m` primes the same singleton; see the CLAUDE.md rule.

**Announcements**: `_syncShiftState()` writes one live-region text per transition: `ARIA_CAPS_LOCK_ON`, `ARIA_CAPS_LOCK_OFF`, `ARIA_SHIFT_ON`, `ARIA_SHIFT_OFF`. Caps Lock is settled before Shift because `isShifted` is true in both modes, so a Caps Lock exit would otherwise read as a shift release.

**Physical keyboard sync**: When a physical keyboard is attached, the virtual keyboard automatically syncs its shift and caps-lock state from physical key events. This works through the existing highlight delegation on the target input: `keydown`/`keyup` events for Shift and CapsLock update the `ShiftState`, and the keyboard re-renders to reflect the current modifier state. No additional listeners are required because the delegation already observes all key events on the target element.

## Layout System

### Layout Definition

A layout is a 2D array of `KeyDefinition` objects:

```ts
type LayoutDefinition = KeyRow[]; // Array of rows
type KeyRow = KeyDefinition[]; // Array of keys in a row
```

Each key defines its value, optional display label, optional shift variant, width class, visual type, and optional icon. When both `icon` and `label` resolve for a key, both render together (inline by default). The layout direction, icon size, label size, and gap are customizable via CSS custom properties (`--ui5KioskKeyboard-dualDirection`, `--ui5KioskKeyboard-dualIconSize`, `--ui5KioskKeyboard-dualLabelSize`, `--ui5KioskKeyboard-dualGap`). The `icon` property accepts SAP icon URIs (e.g. `sap-icon://accept`) or Unicode characters/emojis (e.g. `\u21E7`). Built-in icons for Shift, Enter, and Backspace render automatically alongside their i18n labels.

### Layout Resolution

`_getResolvedLayout()` resolves the active surface from `keyboardType` and the layout source:

```
getSource()     keyboardType    Resolved layout
─────────────   ────────────    ───────────────
"user"          (any)           layouts[layout]   (user pick overrides the constraint)
"external"      "Numpad"        layouts.numpad
"external"      "Numeric"       layouts.numeric
"external"      "Full"          layouts[layout]   (property-driven, default: qwerty)
```

The source is held by `LayoutState` (`internal/layout-state.ts`) and read via `getSource()`; `clearUserOverride()` drops a user pick back to `"external"` on a target switch and on every `keyboardType` change.

`keyboardType` acts as a constraint when the source is `"external"`; a user-driven pick overrides it.

While the `Numpad`/`Numeric` constraint is active (regardless of source), the resolved layout reshapes a `{layout:base}` key before rendering. Where the key is useless it is dropped: on the constrained layout itself the key is a no-op (tapping it re-forces the same layout), and on a layout that also carries a `{layout:numpad}`/`{layout:numeric}` key matching the constraint it is a dead duplicate (e.g. "ABC" next to "123" on the numeric symbols layout). Where `{layout:base}` is instead the only route back to the constrained default (the numpad's symbols view, `nav`, `fkeys`), the key is kept but relabeled to a back icon (accessible name "Return to numbers"), since under the constraint it returns to the number surface rather than the alphabetic base.

### Layout Switching

Layout switch keys use a special value format: `{layout:name}`. When tapped:

1. The `name` is extracted (lowercased) from the value string and validated against the registry.
2. `LayoutState.perform(name, source, origin)` (`internal/layout-state.ts`) records the base layout, the switch source (`{layout:base}` → `"external"`, any other pick → `"user"`), resets the typing context (shift/caps-lock), and writes the `layout` property.
3. A `layoutChange` event fires when the layout actually changes.
4. The control re-renders with the resolved layout.

Layout switching works in every `keyboardType`: a user pick overrides the Numpad/Numeric constraint until `{layout:base}`, `setLayout`, a `keyboardType` change, or an input-target switch re-engages it.

### Custom Keys

There is no action registry. A layout key with a custom token (e.g. `{paste}`) is dispatched on the same path as any unrecognized `{...}` token: `_handleKeyAction` fires the cancelable `keyPress` (with the token as `key`, no literal insertion), and the consumer owns the behavior from a `keyPress` listener. The key inserts nothing by default; `preventDefault()` is how a consumer signals it has handled the token (a non-prevented unrecognized token just warns and no-ops).

To edit the target from a handler, the control exposes public methods that route through the same `TargetInputSession` the built-in keys use:

- `insertText(text: string): void` - insert at the caret (cursor-tracked, fires `liveChange`).
- `deleteBackward(): boolean` - delete one grapheme before the caret.
- `getActiveTargetElement(): HTMLInputElement | HTMLTextAreaElement | null` - the resolved native target.

All three are no-ops / return `null` when there is no active target, and none of them fire `keyPress` (they are called _by_ a handler). Layout switching uses the existing `setLayout`.

Visible label and icon come from the key's `KeyDefinition` (`label` / `icon`). The accessible name resolves `KeyDefinition.ariaLabel` -> visible label -> i18n (built-in tokens) -> a dev warning for an icon-only key (`label: ""`) with no source, so a custom key never announces the raw `{...}` token. The one thing ahead of `ariaLabel` is the shift key's Caps Lock state, written by the renderer, which names the key for what it is doing. Built-in keys (`{shift}`, `{backspace}`, `{enter}`, `{layout:*}`, `{fkey:*}`) stay on the hardcoded switch.

## Locale-Based Default Layout

When no explicit `layout` is provided in the constructor settings, the keyboard auto-detects the appropriate layout from the UI5 locale.

### applySettings Override

The UI5 ManagedObject constructor flow is: `init()` → `applySettings(mSettings)`. The control overrides `applySettings` in two phases: `customLayouts` is applied in a pass of its own, then everything else, with the locale layout injected when no explicit `layout` key is present:

```ts
override applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
  // Destructure rather than `delete`: the caller's settings object is never mutated.
  const { customLayouts, ...rest } = mSettings ?? {};
  if (customLayouts !== undefined) {
    const first: Record<string, unknown> = { customLayouts };
    super.applySettings(first, oScope);
  }
  const fold = this._foldCache.get();
  // `layout` first so the locale default is the first setting applied; the spread
  // overwrites its value, not its position, when the caller named a layout.
  const second: Record<string, unknown> = {
    layout: registryGetLocaleLayout(fold.localeLayouts, fold.layouts),
    ...rest,
  };
  return super.applySettings(second, oScope);
}
```

The first phase goes through `super.applySettings` rather than reading `mSettings` directly: that is what makes an object literal and a `CustomLayout` instance the same input, since a literal is constructed through the aggregation's `defaultClass` and each value passes `validateProperty` exactly once. By the time `layout` is applied in the second phase, `setLayout`'s registry validation and the locale default both resolve through the complete set of custom layouts - which also matters for `clone()`, where `ManagedObject` emits properties before aggregations. A `customLayouts` bound to a model populates asynchronously and therefore does not contribute to the layout chosen here.

The locale injection is transparent: `<kiosk:KioskKeyboard />` gets the locale layout injected as if the developer had written `layout="qwertz-de"`. An explicit `layout="qwerty"` takes priority because the spread overwrites the default.

### Locale Resolution

`getLocaleLayout()` uses `Localization.getLanguageTag()` from `sap/base/i18n/Localization`. This API resolves from all UI5 language sources: URL `sap-ui-language` param, `sap-language` param, bootstrap config, and browser settings. No manual URL parsing is needed.

The returned `LanguageTag` has `.language` (lowercase ISO639, e.g. `"de"`) and `.region` (uppercase ISO3166 or `null`, e.g. `"AT"`).

Resolution checks exact match first (e.g. `"de-at"`), then language prefix (`"de"`), then falls back to `DEFAULT_LAYOUT` (`"qwerty"`). Default mappings: `{ de → qwertz-de, ja → ja-romaji, ar → arabic, ko → ko-hangul, es → qwerty-es }`.

The locale → layout map is extensible per control via the `locales` property of the `customLayouts` entries. Resolution checks the folded instance map first, then the built-in map. No cleanup is needed: the custom layouts are owned by the control and destroyed with it.

### Impact on the base layout

Works correctly: `setLayout("qwertz-de")` makes `"qwertz-de"` the base layout `LayoutState` tracks (it is not marked `secondary` in `internal/layout-meta.ts`), so `{layout:base}` roundtrips back to it. A layout declared by a `CustomLayout` can mark itself `layoutRole="Secondary"` and is then tracked the same way.

## Auto-Type Detection

When `autoType="true"` and the keyboard auto-shows for a focused input, it inspects the input's type metadata and automatically switches between Full and Numpad keyboard types.

### Detection Logic

`detectKeyboardType(control)` (in `internal/detect-keyboard-type.ts`) checks in order:

1. **UI5 `getType()`** on the control → `"Number"` or `"Tel"` → `"Numpad"`
2. **Control name** → `"sap.m.StepInput"` → `"Numpad"`
3. **DOM `inputmode` attribute** → `"numeric"` / `"decimal"` / `"tel"` → `"Numpad"` (matched case-insensitively, per the HTML enumerated-attribute rules)
4. **HTML `type` attribute** → `"number"` / `"tel"` → `"Numpad"`
5. **Fallback** → `"Full"`

Detection uses static `ReadonlySet` constants for each check, avoiding repeated string comparisons.

### Explicit vs Auto-Detected Type

A private `_keyboardTypeSource` tag (typed `"unset" | "explicit" | "auto:VALUE"`) tracks who last set `keyboardType`. The custom `setKeyboardType()` setter sets this to `"explicit"`. Auto-detection sets it to `"auto:Numpad"` (or the detected value) before calling `setProperty("keyboardType", ...)` directly.

Because UI5's `applySettings()` calls custom setters, `{ keyboardType: "Numpad" }` in the constructor will call `setKeyboardType("Numpad")` which sets the tag to `"explicit"`, so auto-detection is disabled.

### Integration Point

In `AutoShowBehavior._onDocumentFocusIn`, after resolving the UI5 control and before `show()`:

```ts
const detectable = this._host._getActiveTargetId() !== ui5Control.getId() || !this._host.isOpen();
const detected = detectable ? detectKbType(ui5Control, this._host._getEffectiveResolver()) : null;

this._host._setActiveTarget(ui5Control);

if (
  detected !== null &&
  this._host.getAutoType() &&
  this._host._getKeyboardTypeSource() !== "explicit" &&
  this._host._getActiveTargetId() === ui5Control.getId()
) {
  const previous = this._host.getKeyboardType();
  if (detected !== previous) {
    this._host._setKeyboardTypeSource(`auto:${detected}`);
    this._host.setProperty("keyboardType", detected); // bypasses custom setter
    this._host.fireKeyboardTypeChange({ ... });
  }
}
```

The behavior reaches the control through host accessors, never its private fields. Detection reads the target's authored metadata, so it runs before `_setActiveTarget()` - while the keyboard is open that call writes `inputmode="none"` on the new target and masks an authored `numeric`/`decimal`/`tel`. Three guards matter: the `detectable` check skips a refocus of the already-active input, which carries that mask from its previous focus, and admits every target while the keyboard is closed and nothing is masked; the active-target check drops a detection that a re-entrant deferred change handler has already superseded; and the `detected !== previous` check keeps a focus move between two inputs of the same kind from re-running the setter. `_setKeyboardTypeSource()` does more than tag the origin - it also clears the user layout override, ends any composition, and reapplies the `autoCompact` tier - so re-running it would revert a layout the user explicitly picked.

When the user tabs from a Number input to a Text input, `AutoShowBehavior._onDocumentFocusIn` fires again, detects `"Full"`, and switches back.

## Mobile Keyboard Detection

The `mobileKeyboard` property (enum `ui5.kiosk.MobileKeyboard`) controls whether to suppress the native virtual keyboard or defer to it on mobile/touch devices.

### \_nativeKbSuppression.shouldDeferToNative()

```ts
shouldDeferToNative(): boolean {
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

When the KioskKeyboard shows and `_nativeKbSuppression.shouldDeferToNative()` returns `false`, it sets `inputmode="none"` on the target input's DOM element. This is the standard web API for preventing the native virtual keyboard.

- `_nativeKbSuppression.suppress()`: saves original `inputmode`, sets `"none"`. Called by `show()`.
- `_nativeKbSuppression.restore()`: restores saved `inputmode` (or removes the attribute if it was absent). Called by `close()` and `exit()`.

State is tracked via:

- Per instance: `_suppressedInputId` (which target this keyboard currently claims)
- Shared across instances: static `_suppressions` map keyed by target input ID with `{ originalInputMode, refCount }`

This makes suppression safe for multi-keyboard setups targeting the same input: each show/claim increments a ref-count, each close/destroy decrements it, and the original `inputmode` is restored only when the last claimant releases the input. When the target changes, the previous target is released before suppressing the new one.

### Integration Points

1. **`AutoShowBehavior._onDocumentFocusIn`**: Checks `_nativeKbSuppression.shouldDeferToNative()` first. If `true`, returns early. The native keyboard handles input.
2. **`show()`**: Calls `_nativeKbSuppression.suppress()`.
3. **`close()`**: Calls `_nativeKbSuppression.restore()`.
4. **`exit()`**: Calls `_nativeKbSuppression.restore()` for cleanup.
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

A static `_instances` set tracks all living `KioskKeyboard` instances. Before auto-show opens for a focused input, `_isTargetOfOther()` checks whether any **other** KioskKeyboard instance already has that input as its active target (`_activeTarget`). If so, auto-show bails out because the input belongs to that keyboard.

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
  |     - Is controls set and the control NOT in the list?
  |     No to any  -> ignore (null)
  |     Yes to all -> detect keyboard type from the input's authored metadata
  |                   set as target input
  |                   apply the detected type (if autoType enabled)
  |                   show()
```

The instance isolation and `controls` filter checks run inside `_resolveClaimableControl()`. When `controls` is set, only inputs in that list pass the filter, and focusing any other input is ignored. When focus moves from an unclaimed input to a claimed input, `_resolveClaimableControl()` returns null and the keyboard closes normally. During each auto-show `focusin`, `_syncControls()` reconciles delegates by resolved control IDs so aggregation-bound input recreation (destroy/create churn) is picked up immediately.

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

`_autoShowBehavior.disable()` removes both listeners. The `exit()` lifecycle hook removes the instance from the static registry, calls `_autoShowBehavior.disable()`, and restores the native keyboard inputmode, preventing leaks after the control is destroyed.

## Keyboard Navigation

The control implements roving tabindex for arrow key navigation:

- Exactly one key carries `tabindex="0"`, all others `tabindex="-1"`. `KioskKeyboardRenderer.resolveFocusTarget()` restores it to the last focused key's `{row}-{col}` when that coordinate still exists in the layout, falling back to `{0,0}` (and to no target at all for an empty layout); `internal/key-grid-navigation.ts` moves it as focus travels.
- Arrow keys move focus by the grid coordinate each key publishes in `data-row-index` / `data-key-index`. The element ID pattern `{controlId}-key-{row}-{col}` is what the renderer's patcher matches nodes by across a re-render.
- `_lastFocusedKey` tracks the last focused key's grid position for `getFocusDomRef()` and `applyFocusInfo()`.

## Theming

### LESS Architecture

```
themes/
  base/
    KioskKeyboard.less                  All styles including @container rules
    library.source.less                 Imports KioskKeyboard.less
  sap_horizon/
    library.source.less                 Imports base + SAP Horizon theme globals
  sap_horizon_dark/
    library.source.less                 Imports base + Horizon Dark theme globals
  sap_horizon_hcb/
    library.source.less                 Imports base + Horizon HCB theme globals
  sap_horizon_hcw/
    library.source.less                 Imports base + Horizon HCW theme globals
```

`@container` at-rules are written directly in the LESS file. The vendored LESS 1.6.3 parser in `less-openui5` does not recognize `@container` natively, so a local `patch-package` patch adds it to the parser's recognized directive list (see `patches/less-openui5+0.11.6.patch`).

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

Keys use `flex: <grow> 1 0` for proportional sizing within rows. The `data-key-span` attribute (`[data-key-span="1.5"]`, `[data-key-span="2"]`, `[data-key-span="space"]`) sets the flex-grow factor. This makes the keyboard naturally responsive, and keys scale proportionally to the container width.

Responsiveness is split into two axes: width (CSS styling, plus an opt-in JS layout tier) and height (JS-assisted).

**Width styling** is handled by CSS `@container` queries. The root `.ui5KioskKeyboard` element sets `container-name: keyboard; container-type: inline-size`. Three thresholds exist, each capping a custom property with `min()` so a smaller consumer value is preserved and only larger ones clamp:

- **30rem (narrow):** Caps `--ui5KioskKeyboard-keyFontSize` at `1rem`.
- **22rem:** Caps the row gap `--ui5KioskKeyboard-keyGap` at `0.25rem`.
- **20rem (compact):** Tightens the gap cap to `0.125rem`, reduces key inline padding for non-numpad keys, and caps the font size at `0.875rem`.

Rows are never wrapped or reordered at a breakpoint. Arrow-key grid navigation moves on the resolved layout's coordinates, so a reflow would leave focus moving between keys the user does not see as adjacent; a narrow-width arrangement is a second layout instead (`layouts/fkey-row-compact`, `layouts/nav-row-compact`).

One width behavior is not CSS: the opt-in `autoCompact` tier. `AutoCompactBehavior` (`internal/auto-compact-behavior.ts`) observes the root's border-box inline size and swaps to a layout's compact counterpart through `LayoutState.applyTier`. A container query can restyle a row but cannot re-seat its keys, and grid navigation runs on the resolved layout, so the narrow arrangement has to be a real layout swap. No observer is allocated while `autoCompact` is off.

**Height responsiveness** uses JS (a native `ResizeObserver`) to detect when the root element is externally height-constrained (i.e., `scrollHeight` exceeds `clientHeight`; both are untransformed layout pixels, so an ancestor `transform: scale()` does not shift the breakpoints and the root border is excluded). The root element sets `max-height: 100%; min-height: 0; overflow: hidden` so that flex/grid parents with a resolved height automatically constrain the keyboard without consumer CSS. These are inert when the parent is unconstrained. Consumers can override all three with any class selector. When constrained, the component applies classes on the root element:

- `ui5KioskKeyboard--cqShort` (height <= 16rem): Reduces key height to `2.25rem`, gap to `0.25rem`, padding to `0.5rem`.
- `ui5KioskKeyboard--cqTiny` (height <= 12rem): Further reduces key height to `1.75rem`, gap to `0.125rem`, padding to `0.25rem`.

Height classes use plain selectors (e.g., `.ui5KioskKeyboard--cqShort:not(.ui5KioskKeyboard--numpad)`). All component styles live inside `@layer kiosk-keyboard`, so any unlayered consumer CSS (e.g., `.myKeyboard { --ui5KioskKeyboard-keyHeight: 4rem; }`) wins regardless of specificity per [CSS Cascade Level 5 §6.4 Layers](https://www.w3.org/TR/css-cascade-5/#layering).

A combined rule in the container queries CSS applies when both narrow width and constrained height are active, using the most aggressive font-size cap of `0.75rem`.

Height thresholds are configurable via CSS custom properties: `--ui5KioskKeyboard-cqShortThreshold` (default `16rem`) and `--ui5KioskKeyboard-cqTinyThreshold` (default `12rem`).

Docked keyboards and numpad mode skip height class application (docked keyboards are viewport-driven; numpads are already compact).

Height tiering stays in JavaScript because it is a numeric decision: the two thresholds (`cqShort` at 16rem, `cqTiny` at 12rem) require the measured constrained height, and a CSS container query cannot read a length. A `scroll-state(scrollable)` container query reports only whether the root overflows its granted height, the single boolean the detection already derives, not which tier that overflow falls into, so it cannot carry the tiering even where it is supported.

The public sizing variables deliberately separate normal and extra-narrow spacing. `--ui5KioskKeyboard-keyPaddingInline` keeps the default inline inset for regular widths, while `--ui5KioskKeyboard-keyPaddingInlineXs` is applied at the 20rem `@container` breakpoint for non-numpad keys. Its default (`min(var(--ui5KioskKeyboard-keyPaddingInline), 0.125rem)`) trims the stock padding from `0.25rem` to `0.125rem` so wide glyphs like `@`, `%`, and `&` get more horizontal breathing room on phone-sized rows without reducing key height or touch-target size. The `min(...)` form preserves any consumer override that is already smaller.

**Consumer overrides:**

For custom width breakpoints, consumers can write `@container keyboard (max-width: ...)` rules directly since the keyboard's root element sets `container-name: keyboard`.

### Content Density

Compact mode (`.sapUiSizeCompact`) reduces padding, gap, key height, and font size for denser displays.

## Edge Cases

| Edge Case                                 | How It Is Handled                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Focus steal on key tap                    | `ontouchstart` `preventDefault()` keeps focus on input                                                         |
| Target input not yet focused              | `TargetInputSession` seeds its own tracked cursor at the end of the value; the DOM selection is left untouched |
| Auto-show flicker on focus transitions    | Synchronous `relatedTarget` check, plus one-tick deferred fallback when null                                   |
| Focus on keyboard during auto-show        | `relatedTarget` checked against keyboard DOM via `contains()`                                                  |
| Auto-show vs input owned by other kbd     | `_wouldClaimInput()` checks `_isTargetOfOther()`                                                               |
| Focus moves to claimed input while open   | `_wouldClaimInput()` checks `_isTargetOfOther()`, closes normally                                              |
| Layout switch in non-Full mode            | User pick overrides the constraint (`LayoutState.getSource()` is `"user"`); `{layout:base}` re-engages it      |
| Shift auto-release vs Caps Lock           | `ShiftState.autoRelease()` only releases `Mode.Shift`, not `Mode.CapsLock`                                     |
| `sap.ui.core.Element` name collision      | `globalThis.Element` for DOM Element references                                                                |
| `$KioskKeyboardSettings` availability     | Generated into the committed `src/KioskKeyboard.gen.d.ts`; run `npm run generate`, never hand-edit             |
| `_setActiveTarget` re-render              | `setAssociation(name, value, true)` suppresses invalidation                                                    |
| `_setActiveTarget` re-entrancy            | Change event deferred to after state transitions via `captureAndClearDirty()`                                  |
| Docked show/close during render           | `onAfterRendering` syncs CSS with `_open` state                                                                |
| Destroy with auto-show active             | `exit()` removes from instance registry, disables auto-show, restores inputmode                                |
| Target control without a `value` property | `setTargetValue()` falls back `setValue()` -> `setProperty("value")` -> raw DOM value                          |
| `controls` with `autoShow`                | `_resolveClaimableControl()` filters by `controls`; delegation triggers `show()`                               |
| `controls` property churn                 | `_syncControls()` rebinds delegates by control ID on each auto-show `focusin`                                  |
| Locale detection no region                | Falls through to language prefix, then `DEFAULT_LAYOUT`                                                        |
| Explicit `keyboardType` vs auto-type      | `_keyboardTypeSource` tag (`"explicit"`) disables auto-detection                                               |
| Constructor sets `keyboardType`           | `applySettings` calls custom setter, which sets the source tag                                                 |
| `inputmode` restore on target switch      | `_nativeKbSuppression.suppress()` restores previous before suppressing new                                     |
| `inputmode` restore on destroy            | `exit()` calls `_nativeKbSuppression.restore()`                                                                |
| Combi device (tablet + desktop)           | `Device.system.tablet && !Device.system.desktop` → treats as desktop                                           |
| `show()` without target input             | `_nativeKbSuppression.suppress()` is a no-op when no target element exists                                     |
| Resolver throws                           | `getText` catches, logs warning, returns base bundle text                                                      |
| Last `KioskKeyboard` instance destroyed   | `exit()` clears the i18n resolver (FLP safety)                                                                 |

## Project Layout

```
packages/kiosk-keyboard/
  playwright.config.ts        Playwright config: e2e + visual, desktop + device projects
  playwright.flp.config.ts    Playwright config for the FLP lifecycle suite
  playwright.docs.config.ts   Playwright config for README screenshot generation
  src/
    KioskKeyboard.ts          UI5 Control with state, event handling,
                               locale detection, auto-type, mobile suppression
    KioskKeyboardRenderer.ts  Renderer (apiVersion 4, flat DOM)
    CustomLayout.ts           Element carrying one layout's rows, locales, keycap language,
                               role, middleware and variants; the customLayouts aggregation type
    library.ts                Lib.init(), KeyboardLayout/KeyboardType/MobileKeyboard/FKeyMode/
                               LayoutRole/LayoutFacet enums, the ControlID / LayoutRows /
                               VariantOverrideTable property types, plus KeyName constants and
                               the LATIN_DIACRITIC_VARIANTS / VariantTable re-exports
    types.ts                  KeyDefinition, KeyRow, LayoutDefinition, CustomLayoutSpec, I18nResolver
    internal/layout-registry.ts  Layout registration and locale resolution
    internal/
      types.ts                Internal contracts (TargetElement)
      custom-layout-fold.ts   Folds the custom layouts into the per-facet lookup maps the
                               resolution paths read, plus the diagnostics it reports
      layout-fold-cache.ts    LayoutFoldCache: caches that fold against the aggregation's children
                               and dedupes its diagnostics
      layout-state.ts         LayoutState: which layout is active and who asked for it (base,
                               requested, source), the autoCompact tier, the effective name
      layout-meta.ts          Per-layout attributes (secondary / lang / variants) for the built-ins,
                               resolved per attribute against the folded custom layouts
      dom.ts                  DOM/key coordinate + key ID utilities + input resolver
      dom-contract.ts         Zero-dep CSS class / data attribute / selector contract
      i18n-registry.ts        i18n resolution: base bundle + optional I18nResolver callback
      detect-keyboard-type.ts Auto-type detection
      input-operations.ts     Text insertion/backspace/enter ops, run as a platform edit on a focused target
      target-input-session.ts Target state + commit handling
      focus-claim-service.ts  Auto-show claim decisions
      key-grid-navigation.ts  Keyboard grid navigation delegate
      fkey-controller.ts      FKeyController (Virtual/Native F-key dispatch + caret nav)
      native-keyboard-suppression.ts  inputmode suppress/restore with ref-counting
      auto-show-behavior.ts   Auto-show focus-in/out listeners, deferred close
      controls-delegation-controller.ts  ControlsDelegationController (`controls`-property delegate reconciliation)
      responsive-sizing-controller.ts  ResponsiveSizingController (cqShort/cqTiny height classes)
      auto-compact-behavior.ts  AutoCompactBehavior (opt-in width tier: compact layout swap)
      physical-key-highlight.ts  PhysicalKeyHighlight (hardware keyboard mirror)
      backspace-repeat-behavior.ts  BackspaceRepeatBehavior (press-and-hold delete)
      variant-popup-behavior.ts  VariantPopupBehavior (long-press / right-click accent-variant popup)
      auto-repeat.ts          Accelerating press-and-hold repeat scheduler
      announcement-queue.ts   AnnouncementQueue: owns the ARIA live-region text, keeping a fixed
                               gap between writes so a burst is not collapsed
      shift-state.ts          Shift / Caps Lock state machine
      key-token.ts            data-key value classifier (token kind)
      key-action-meta.ts      Canonical special-key metadata (shared icon names)
      layout-constraint.ts    Numpad/Numeric constraint → layout name + {layout:base} reconciliation
      key-labels.ts           Key display label resolver (shift/caps aware)
      key-icons.ts            Default special-key icons + URI validation
      grapheme.ts             Grapheme-aware cursor utilities (Intl.Segmenter)
      composition-utils.ts    Composition preedit start/update/end helpers
      latin-variants.ts       Default Latin-diacritic long-press variant table + helpers (CLDR LDML);
                               resolveVariantTable layers built-in -> defaultVariants -> custom layout per
                               layout, each merged per base letter; null for the non-Latin layouts
      middleware-registry.ts  Built-in composition-middleware factories + instance overrides
      renderer-internal-api.ts  RendererInternalApi bridge type
    middleware/
      hangul-compose.ts       Korean Hangul L/V/T composition middleware
      kana-dakuten.ts         Japanese kana dakuten/handakuten middleware
    layouts/
      qwerty.ts               Standard QWERTY layout
      qwertz-de.ts            German QWERTZ layout
      numeric.ts              Numeric layout
      special.ts              Special characters layout
      numpad.ts               Compact numpad layout
      fkeys.ts                Standalone F-key layout
      nav.ts                  Standalone navigation layout
      fkey-row.ts             Shared F-key row for consumer-composed variants
      fkey-row-compact.ts     Narrow-width F-key row (2x6), used by the built-in fkeys layout
      nav-row.ts              Shared navigation row for consumer-composed variants
      nav-row-compact.ts      Narrow-width navigation row (2x4)
      ja-romaji.ts            Japanese Romaji layout
      ja-kana.ts              Japanese Kana direct-input layout (JIS X 6002)
      ja-kana-compact.ts      Japanese Kana rearranged for narrow keyboards
      arabic.ts               Arabic layout
      ko-hangul.ts            Korean Hangul Dubeolsik layout (KS X 5002)
      qwerty-es.ts            Spanish QWERTY layout
      symbol-common.ts        Shared punctuation/symbol row data (used by numeric, special)
      default-layout.ts       Default layout name constant: "qwerty"
    i18n/
      messagebundle.properties     Default (English) key/ARIA labels
      messagebundle_de.properties  German translations
      messagebundle_ja.properties  Japanese translations
      messagebundle_ar.properties  Arabic translations
    themes/
      base/
        KioskKeyboard.less    Base styles (SAP LESS parameters)
        library.source.less   Base entry point
      sap_horizon/
        library.source.less   Horizon theme entry point
      sap_horizon_dark/
        library.source.less   Horizon Dark theme entry point
      sap_horizon_hcb/
        library.source.less   Horizon High Contrast Black entry point
      sap_horizon_hcw/
        library.source.less   Horizon High Contrast White entry point
    manifest.json             Library manifest (v2.0.0)
    .library                  UI5 library metadata
  test/qunit/
    testsuite.qunit.ts                   Test suite runner
    test-helpers.ts                      Shared test utilities
    *.qunit.ts                           One suite per module / feature
  test/e2e/
    helpers.ts                 Minimal shared Playwright helpers (openPage, keyboardRoot, ...)
    inputmode.spec.ts          E2E tests for inputmode suppression
    focus.spec.ts              Focus/auto-show behavior
    autotype.spec.ts           Auto-type keyboard switching
    interop.spec.ts            StepInput + UI5 Web Components interop
    i18n.spec.ts               i18n extensibility e2e tests
    flp-lifecycle.spec.ts      FLP lifecycle i18n auto-reset tests
    invariants.spec.ts         Structural assertions the device matrix runs on CI
    visual.spec.ts             Core visual regression (toHaveScreenshot)
    visual-container.spec.ts   Container-query layout snapshots
    visual-container-responsive.spec.ts  Responsive container-query snapshots
    visual-enhancements.spec.ts  Progressive-enhancement fallback snapshots
    visual-themes.spec.ts      Per-theme snapshots
    accessibility-media.spec.ts  Accessibility and media-query (forced-colors, reduced-motion) snapshots
    rtl.spec.ts                RTL layout snapshots
    readme-screenshots.spec.ts   Screenshot generation for README
    __baselines__/             Committed snapshot baselines, per Playwright project
```
