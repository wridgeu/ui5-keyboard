# Known Limitation: `sap.m.Popover` Layout-Switch Close

## Affects

KioskKeyboard (Full type) inside `sap.m.Popover` on scrollable pages (OpenUI5 1.144.0+).

## Symptom

Switching between layouts (e.g. ABC / 123) inside a Popover causes it to close immediately.

## Root Cause

A coordinate-system mismatch in `sap.m.Popover._applyPosition`. When the keyboard's content height changes during a layout switch, the Popover's `ResizeHandler` fires and `_applyPosition` compares the trigger element's **document-absolute** coordinates against the **viewport height**. On a scrolled page the trigger's absolute `top` exceeds the viewport height, so the Popover considers it "off-screen" and closes, even though it is perfectly visible.

## Recommended Workaround

Set a fixed `contentHeight` on the Popover so that layout switches do not change the Popover's outer dimensions. The keyboard's responsive height breakpoints (`cqShort`, `cqTiny`) adapt the internal layout automatically:

```xml
<Popover contentWidth="24rem" contentHeight="18rem">
  <kiosk:KioskKeyboard controls="myInput" />
</Popover>
```

Alternatively, set a CSS `height` on the keyboard element itself or on a wrapper `<div>` inside the Popover. Any approach that prevents the Popover content area from resizing during layout switches avoids the bug.

## Additional Sizing Options

The keyboard exposes CSS custom properties for fine-grained control:

- `--ui5KioskKeyboard-keyHeight`: individual key touch-target height
- `--ui5KioskKeyboard-cqShortThreshold` / `--ui5KioskKeyboard-cqTinyThreshold`: breakpoint thresholds (rem)

These allow consumers to tune the keyboard to fit a specific container size without relying solely on the automatic breakpoints.
