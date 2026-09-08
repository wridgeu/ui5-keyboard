# Feature: `{tab}` and `{done}` Special Keys

> Status: Proposal

## Problem

### No form navigation from the virtual keyboard

The kiosk keyboard has no Tab key. Pure-touch kiosk users cannot move between form fields using the virtual keyboard alone; they must tap each input directly. This is friction in form-heavy scenarios (registration screens, data entry, POS checkout).

KioskBoard addresses a related need with `keysEnterCanClose`, which at least signals "I'm done with this field". simple-keyboard has no built-in solution either.

### No "Submit" action for TextArea

`TargetInputSession.handleEnter()` (`internal/target-input-session.ts`) correctly matches physical keyboard behavior:

- **`<input>`**: fires `change` event (submit signal)
- **`<textarea>`**: inserts `\n` (newline)

But there's no way for users to signal "I'm done editing this textarea". On physical keyboards, users typically click away or use Tab. On a kiosk touchscreen with a virtual keyboard, neither option is intuitive.

## Proposal

### 1. `{tab}` special key: form field navigation

Add a new special key value `{tab}` that moves focus to the next focusable input in DOM order.

**Behavior:**

```
Tap {tab}
  → Fire keyPress event with key="Tab" (supports preventDefault)
  → If not prevented:
    → Find next focusable <input>/<textarea> in DOM order after current target
    → Focus it (triggers auto-show target switch if autoShow is active)
    → If Shift is active: move to previous input instead (Shift+Tab)
```

**Implementation approach:**

`TargetInputSession` (`internal/target-input-session.ts`) owns the resolved DOM
ref, so the walk lives there:

```ts
moveFocus(backwards: boolean): void {
  const dom = this._getTargetDomRef();
  if (!dom) return;

  // Collect all focusable inputs/textareas in DOM order
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([disabled]):not([readonly]):not([type="hidden"]), textarea:not([disabled]):not([readonly])',
    ),
  );

  const currentIndex = inputs.indexOf(dom);
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + (backwards ? -1 : 1);
  if (nextIndex >= 0 && nextIndex < inputs.length) {
    inputs[nextIndex].focus();
  }
}
```

`KioskKeyboard._handleKeyAction` reads the direction off the shift state and
leaves the latch to the single spend site (`spendsOneShotShift(action.kind)`),
which releases it once for the whole tick:

```ts
case "tab":
  this._targetSession.moveFocus(this._isShiftActive());
  break;
```

**Layout integration:**

```ts
// In built-in layouts (optional - not all layouts need it)
// Bottom row of QWERTY could include:
{ value: "{tab}", label: "Tab", icon: "sap-icon://journey-arrive", width: "1.5", type: "modifier" }
```

Tab is **not** added to built-in layouts by default; it's opt-in via custom layouts. Kiosk scenarios vary widely: some want Tab, many don't. Built-in layouts stay minimal.

**Custom layout example:**

```ts
const formLayout: LayoutDefinition = [
  // ... character rows ...
  [
    { value: "{tab}", label: "Next", icon: "sap-icon://navigation-right-arrow", width: "1.5", type: "modifier" },
    { value: ",", shiftLabel: "<", shiftValue: "<" },
    { value: " ", label: "", width: "space", type: "space" },
    { value: ".", shiftLabel: ">", shiftValue: ">" },
    { value: "{enter}", label: "", icon: "sap-icon://accept", width: "1.5", type: "action" },
  ],
];
```

### 2. `{done}` special key: completion signal

Add a new special key value `{done}` that signals "I'm finished with this input" without inserting text.

**Behavior:**

```
Tap {done}
  → Fire keyPress event with key="Done" (supports preventDefault)
  → If not prevented:
    → Fire `change` event on the target control (same as Enter on <input>)
    → If docked + autoShow: close the keyboard
    → Blur the target input
```

**Key difference from Enter:**

| Key       | `<input>`                       | `<textarea>`                    |
| --------- | ------------------------------- | ------------------------------- |
| `{enter}` | Fires `change`                  | Inserts `\n`                    |
| `{done}`  | Fires `change`, closes keyboard | Fires `change`, closes keyboard |

`{done}` on a `<textarea>` is a deliberate override: `TargetInputSession.fireChangeIfDirty()` skips textarea targets, because a physical keystroke never emits `change` there. The proposal keeps the override - the key exists precisely so a textarea gets a commit signal - so `{done}` must fire the event itself rather than reuse that path.

`{done}` is useful when:

- TextArea users need a "submit" button (not a newline)
- Any input where closing the keyboard is the desired post-entry action
- Mobile-style "Done" button UX

**Implementation approach:**

The change fires from the session, which holds both the element and the dirty
flag. It cannot route through `fireChangeIfDirty()`: that skips textarea
targets, and `{done}` fires on them by design (see the table above).

```ts
// internal/target-input-session.ts
handleDone(): void {
  const dom = this._getTargetDomRef();
  if (!dom) return;

  const element = this._getTargetElement();
  if (element) opsFireTargetChange(element, dom.value);
  this._targetDirty = false;

  // Blur the target to signal completion
  dom.blur();
}
```

```ts
// KioskKeyboard._handleKeyAction
case "done":
  this._targetSession.handleDone();
  // Close docked keyboard if auto-show is active
  if (this.getDocked() && this.getAutoShow()) this.close();
  break;
```

**Layout example:**

```ts
// TextArea-focused layout with Done instead of Enter
{ value: "{done}", label: "Done", icon: "sap-icon://accept", width: "2", type: "action" }
```

## Scope

### In scope

- `parseKeyAction` arms for `{tab}` and `{done}`, and the matching `KeyAction`
  variants (`internal/key-token.ts`)
- `spendsOneShotShift` arms for both, in the same file: the switch is exhaustive
  over `KeyActionKind`, so a new variant does not compile until it answers
- `_handleKeyAction` branches for both, plus the `assertNever` guard staying exhaustive
- Shift+Tab (reverse tab) support
- `keyPress` event fires for both with `preventDefault()` support
- `SpecialKeyValue` type (`types.ts`) updated to include `"{tab}"` and `"{done}"`
- `KeyName` members (`library.ts`) for the `keyPress` payload
- `KEY_TAB` / `KEY_DONE` entries in all four `i18n/messagebundle*.properties`,
  their message keys in `key-action-meta.ts` (`SPECIAL_KEY_I18N_KEYS`, and
  `SPECIAL_KEY_ICON_NAMES` for a default icon), and the token-to-key rows in
  `key-labels.ts`
- Documentation in README
- QUnit tests for both key actions

### Out of scope

- Changing built-in layouts (Tab/Done are opt-in via custom layouts)
- "Tab order" configuration (uses DOM order, same as physical Tab)
- Multi-field form submission logic (handled by the app, not the keyboard)

## Considerations

- **DOM order vs UI5 control order**: Physical Tab follows DOM order, which may differ from visual order in complex layouts. This is consistent with browser Tab behavior.
- **Scope boundary**: Should `{tab}` wrap around (last input → first input)? Proposal: no wrapping, same as browser Tab at form boundaries.
- **`{done}` vs `keyPress` preventDefault on Enter**: Apps that want Enter-as-done on `<input>` can already do this by attaching to `keyPress`. The `{done}` key is for cases where the layout itself should have a distinct "Done" action.

## Migration

Non-breaking. Both are new special key values. Existing layouts and code are unaffected.
