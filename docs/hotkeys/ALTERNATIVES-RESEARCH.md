# ui5-lib-hotkeys: Review & Comparison

> **Status: Research notes.** A point-in-time comparison against the alternatives listed under [References](#references); those projects are not tracked for changes.

## Executive Summary

Compared with UI5's built-in `CommandExecution`, this library provides a broader feature set: LIFO scope stack with two-pass matching, smart `ignoreInputs: "auto"`, lazy dialog detection, and router integration. TanStack Hotkeys also aligns with several design choices used here (conflict behaviors, cross-platform Mod).

## 1. Comparison: UI5 CommandExecution

### Critical Limitations of CommandExecution

1. **Focus requirement** (issue #2788, closed won't fix): If no element is focused, shortcuts don't fire. SAP's response: _"we can not provide a stable non confusing implementation of focus-free shortcuts."_
2. **Key bombing**: No built-in repeat guard.
3. **No scope stack**: Relies entirely on DOM focus traversal.
4. **Manifest coupling**: Commands MUST exist in manifest.json. Dynamic registration impossible.
5. **No dialog awareness**: No built-in handling for open dialogs.

### What We Do Better

| Aspect               | CommandExecution           | ui5-lib-hotkeys                        |
| -------------------- | -------------------------- | -------------------------------------- |
| Focus requirement    | Required (won't fix)       | Not needed (window capture)            |
| Key repeat guard     | None                       | `ignoreRepeat: true` (default)         |
| Scope management     | DOM focus traversal        | LIFO scope stack + two-pass matching   |
| Dynamic registration | Impossible (manifest only) | Runtime `register()`                   |
| Dialog awareness     | None                       | Lazy `InstanceManager.hasOpenDialog()` |
| Router integration   | None                       | `enableRouterIntegration()`            |
| Input suppression    | None                       | Smart `ignoreInputs: "auto"`           |

## 2. Comparison: TanStack Hotkeys

### Key Differences

| Aspect          | TanStack                          | ui5-lib-hotkeys                            |
| --------------- | --------------------------------- | ------------------------------------------ |
| Scoping         | DOM-based (`target` option)       | Named scope stack (LIFO) + target elements |
| `enabled`       | Static boolean only               | `boolean \| (() => boolean)`               |
| Handle mutation | `.callback = fn`, `.setOptions()` | `handle.setOptions()`                      |
| Type safety     | Template literal union type       | Template literal union type (`Hotkey`)     |

## 3. FLP & Standalone Compatibility

The library works in both standalone and FLP because:

- Window-level capture phase listener, independent of UI5's focus system
- No manifest.json coupling for shortcuts
- Lazy `sap.m` loading, no hard dependency
- Scope stack is manual, not tied to FLP shell

FLP-reserved and browser shortcuts are tracked in the `BROWSER_SHORTCUTS` and `SAP_SHORTCUTS` blocklists: `F6` is in both, `Shift+F6` is SAP-only, and `Ctrl+0` is browser-only. Registration warnings are logged when these are used.

## References

- [UI5 CommandExecution focus issue #2788](https://github.com/UI5/openui5/issues/2788)
- [Fiori Elements keyboard shortcuts](https://ui5.sap.com/sdk/docs/topics/0cd318c83ec5473d9a091c1782d03c21.html)
- [FLP keyboard shortcuts](https://help.sap.com/docs/btp/sap-fiori-launchpad-for-sap-btp/keyboard-shortcuts-5823b11296014b819d98fb108b4bc1c4)
- [TanStack Hotkeys](https://github.com/TanStack/hotkeys)
