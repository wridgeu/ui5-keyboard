# Remove `stableHeight` Property

> Status: Implemented

## Problem

The `stableHeight` property was an opt-in feature that maintained a consistent `minHeight` across layout switches by tracking the maximum rendered height. It existed to work around a `sap.m.Popover` bug (`_applyPosition` coordinate-system mismatch in OpenUI5 1.144.0+) where content height changes during layout switches caused the Popover to close spuriously on scrolled pages.

The feature introduced complexity: a monotonic `_maxHeight` tracker, a `_syncStableHeight` method called from multiple lifecycle hooks, and a `previousMinHeight` save/restore dance in the responsive sizing code to temporarily clear `minHeight` before measuring constraints. It also conflicted with height breakpoints -- when both were active, the `minHeight` could prevent compact CSS from having a visual effect.

## Decision

Remove `stableHeight` entirely. Consumers should control keyboard sizing themselves via:

1. **Fixed height on the keyboard element** (e.g. `height: 19rem; overflow: hidden`) -- the keyboard's responsive breakpoints (`cq-short`, `cq-tiny`) adapt automatically
2. **CSS custom properties** (`--ui5KioskKeyboard-keyHeight`, `--ui5KioskKeyboard-keyGap`, etc.) to make the keyboard naturally fit a smaller space

This is a breaking change but there are no consumers yet. The Popover bug is a framework issue, not a keyboard issue -- consumers should set a fixed container size to prevent content resizing.

## Changes

- Removed `stableHeight` property, `_maxHeight` field, and `_syncStableHeight()` from both UI5 and WebC packages
- Simplified `_applyResponsiveSizeClasses` / `_applyResponsiveClasses` by removing the `previousMinHeight` save/restore block
- Updated the demo app with three Popover sizing strategies (generous height, compact height, custom CSS vars)
- Rewrote `POPOVER-LAYOUT-SWITCH-BEHAVIOR.md` to recommend CSS-based approach
- Added "Constrained Containers and Popovers" documentation to both READMEs
- Used `:where()` for CSS custom property defaults so consumers can override with a single class

## Additional fixes included

- **Shift key alignment**: UI5 package now uses the same timing-based `ShiftState` class as WebC (single click = temporary shift, double-click within 400ms = caps lock)
- **CSS specificity**: Public custom property defaults wrapped in `:where(.ui5KioskKeyboard)` for zero specificity, making consumer overrides trivial
