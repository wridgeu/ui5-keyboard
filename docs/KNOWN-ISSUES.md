# Known Issues

## KioskKeyboard layout switch closes `sap.m.Popover`

**Affects**: KioskKeyboard (Full type) inside `sap.m.Popover` on scrollable pages

**Symptom**: Switching between layouts (e.g. ABC ↔ 123) inside a Popover causes the Popover to close immediately.

**Root cause**: A coordinate-system mismatch in `sap.m.Popover._applyPosition` (OpenUI5 1.144.0). When the keyboard's content height changes during a layout switch, the Popover's `ResizeHandler` fires and `_applyPosition` runs an off-screen check:

```javascript
var oRect = jQuery(oPosition.of).rect(); // document-absolute coordinates
if (bFromResize
    && $popoverWithinArea.height() == that._initialWindowDimensions.height
    && (oRect.top + oRect.height <= 0
        || oRect.top >= $popoverWithinArea.height() // compares absolute Y against viewport height
        || ...)) {
    that.close();
}
```

`jQuery.rect()` returns **document-absolute** coordinates (includes scroll offset), but the check compares them against the **viewport height**. On a scrolled page, the trigger element's absolute `top` (e.g. 3374px) exceeds the viewport height (e.g. 893px), so the Popover considers the trigger "off-screen" and closes — even though it is perfectly visible in the viewport.

**Sequence of events**:

1. User clicks a layout-switch key (e.g. "123" or "ABC")
2. `setLayout()` → `setProperty()` → `invalidate()` → UI5 re-renders the keyboard
3. The new layout has a different number of rows (QWERTY=5, numeric/special=4), changing the keyboard's DOM height
4. `ResizeHandler.checkSizes` detects the height change
5. `Popover._onOrientationChange` → `oPopup._applyPosition(pos, true)`
6. The buggy off-screen check fires with `bFromResize=true`
7. `jQuery(trigger).rect().top` returns document-absolute Y (e.g. 3374)
8. `3374 >= 893` → Popover closes

**Conditions for the bug to manifest**:

- The page must be scrollable (trigger button far down the page in document coordinates)
- The keyboard content must change height (different row counts between layouts)
- The window must not have been resized (otherwise the virtual-keyboard guard skips the check)

**Current mitigation**: Use `stableHeight="true"` for non-docked `Full` keyboards embedded in `sap.m.Popover`. With `stableHeight` enabled, the keyboard tracks the maximum rendered height and applies it as `min-height`, preventing the content resize that triggers the Popover reposition bug. The behavior is opt-in (default `false`) so inline/non-popover integrations keep natural resizing.
