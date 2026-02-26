# Feature: Escape Key Handling & Opt-in Stable Height

> Status: **Implemented** (Escape) / **Implemented** (Stable Height)

## Problem 1: No Escape key handling for docked keyboards

The kiosk keyboard has no way to dismiss a docked keyboard via the physical keyboard. When a virtual key has focus (e.g. after arrow-key navigation), pressing Escape does nothing. The only ways to close a docked keyboard are:

- Blur the input (tap outside) — not keyboard-accessible
- Call `close()` programmatically — requires app code

This is a keyboard accessibility gap. WCAG 2.1 SC 2.1.1 (Keyboard) requires that all functionality be operable through a keyboard interface. A docked overlay that can only be dismissed by pointer interaction fails this criterion.

The hotkeys library already has `ignoreInputs: "auto"` which allows Escape to fire in input fields. The kiosk keyboard should follow the same principle.

## Proposal 1: Escape closes docked keyboard

Add Escape key handling in the `onkeydown` handler. When Escape is pressed while a virtual key has focus, close the docked keyboard.

**Implementation:**

```ts
onkeydown(event: KeyboardEvent): void {
  if (!this.getEnabled()) return;
  if (event.altKey || event.metaKey) return;

  const target = event.target as HTMLElement;

  // Escape closes docked keyboard regardless of focus target
  if (event.key === "Escape" && this.getDocked() && this._open) {
    event.preventDefault();
    this.close();
    // Return focus to the target input
    const dom = this._getTargetElement()?.getFocusDomRef() as HTMLElement | null;
    dom?.focus();
    return;
  }

  if (!target.classList.contains("ui5KioskKey")) return;
  // ... existing arrow key / Enter / Space handling ...
}
```

**Behavior details:**

- Escape only acts when the keyboard is docked and open
- After closing, focus returns to the target input (not lost to `<body>`)
- The `afterClose` event fires as usual
- If focus is on the target input (not the keyboard), Escape is not intercepted — it propagates normally. This prevents the keyboard from swallowing Escape when the user is in an input field and wants Escape for other purposes (e.g. closing a value help).

**Why not a `{escape}` layout key?** An Escape key in the layout would be unusual — physical keyboards have Escape in the top-left corner, far from the main key area. Users don't expect it on a virtual keyboard. The physical Escape key (when keyboard has focus) is the correct affordance.

## Problem 2: `_maxHeight` only grows, never shrinks

When a `Full` keyboard type is used in embedded/inline or Popover scenarios, `onAfterRendering` tracks the maximum height and applies it as `minHeight`:

```ts
if (dom && this.getKeyboardType() === "Full" && !this.getDocked()) {
  const h = el.getBoundingClientRect().height;
  if (h > (this._maxHeight || 0)) {
    this._maxHeight = h;
  }
  el.style.minHeight = `${this._maxHeight}px`;
}
```

This prevents:

1. Visual layout shifts when switching from a 5-row layout (QWERTY) to a 4-row layout (numeric)
2. A `sap.m.Popover` bug where content height changes during resize events cause the Popover to close spuriously

However, the height only ratchets upward. If a custom layout with 7 rows is used once, then removed, the keyboard permanently retains that height. There's no reset mechanism.

More fundamentally, this behavior is **always on** for non-docked Full keyboards. Consumers who don't use Popover — for example, keyboards embedded in a page section — pay the cost of a height that never shrinks, for a bug they'll never encounter.

## Proposal 2: Opt-in `stableHeight` property

Convert the implicit height stabilization into an explicit opt-in property.

**Property definition:**

```ts
/**
 * When `true`, the keyboard maintains a consistent minimum height
 * across layout switches. Prevents visual layout shifts and works
 * around a `sap.m.Popover` bug where content height changes can
 * trigger spurious close.
 *
 * Only effective for non-docked Full keyboards. Docked keyboards
 * always minimize their footprint.
 *
 * @example <caption>XML view — keyboard inside a Popover</caption>
 * <Popover>
 *   <kiosk:KioskKeyboard stableHeight="true" targetInput="myInput" />
 * </Popover>
 */
stableHeight: {
  type: "boolean",
  defaultValue: false,
  group: "Behavior",
},
```

**Updated `onAfterRendering`:**

```ts
onAfterRendering(): void {
  // ... docked mode handling ...

  // Stable height: opt-in minimum height across layout switches.
  // Only for non-docked Full keyboards (docked keyboards minimize footprint).
  if (dom && this.getStableHeight() && this.getKeyboardType() === "Full" && !this.getDocked()) {
    const el = dom as HTMLElement;
    const h = el.getBoundingClientRect().height;
    if (h > (this._maxHeight || 0)) {
      this._maxHeight = h;
    }
    el.style.minHeight = `${this._maxHeight}px`;
  } else if (dom) {
    // Clear any previously set minHeight when stableHeight is off
    (dom as HTMLElement).style.minHeight = "";
    this._maxHeight = 0;
  }

  this._setupInputIds();
}
```

**Why default to `false`?**

- Most keyboards are either docked (not affected) or embedded in simple containers (don't need height stabilization)
- The Popover bug is a specific edge case that should be opted into, not imposed globally
- Consumers who need it can set `stableHeight="true"` explicitly
- This matches the UI5 principle that controls should have sensible defaults without surprising side effects

**Migration:**

This is technically a behavior change for non-docked keyboards that previously benefited from implicit height stabilization. To mitigate:

1. Document the change in CHANGELOG
2. Add a note in the Popover section of the README recommending `stableHeight="true"` for Popover usage
3. Consider whether the Popover bug has been fixed in newer UI5 versions (1.144.0+) — if so, the workaround may no longer be needed at all

## Scope

### In scope

**Escape handling:**

- Escape closes docked keyboard when a virtual key has focus
- Focus returns to target input after close
- Does not intercept Escape when focus is on the target input itself
- QUnit test

**Stable height:**

- New `stableHeight` boolean property (default: `false`)
- Only effective for non-docked Full keyboards
- Clears `minHeight` when disabled or when keyboard type changes away from Full
- README update with Popover guidance
- QUnit tests

### Out of scope

- `{escape}` as a layout key (not needed — physical Escape is the right affordance)
- Automatic Popover detection (checking if keyboard is inside a Popover to auto-enable stable height — too magical, explicit opt-in is clearer)

## Migration

**Escape handling:** Non-breaking addition.

**Stable height:** Breaking behavior change for non-docked keyboards that relied on implicit height stabilization. Consumers using the keyboard inside a Popover should add `stableHeight="true"`. The demo app and documentation should be updated to reflect this.
