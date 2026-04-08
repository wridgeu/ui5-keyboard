# ui5-lib-hotkeys: Review & Comparison

## Executive Summary

Compared with a production hand-rolled ShortcutHandler and UI5's built-in `CommandExecution`, this library provides a broader feature set: LIFO scope stack with two-pass matching, smart `ignoreInputs: "auto"`, lazy dialog detection, and router integration. TanStack Hotkeys also aligns with several design choices used here (conflict behaviors, cross-platform Mod).

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
| Focus requirement    | Required (won't fix)       | Not needed (document capture)          |
| Key repeat guard     | None                       | `ignoreRepeat: true` (default)         |
| Scope management     | DOM focus traversal        | LIFO scope stack + two-pass matching   |
| Dynamic registration | Impossible (manifest only) | Runtime `register()`                   |
| Dialog awareness     | None                       | Lazy `InstanceManager.hasOpenDialog()` |
| Router integration   | None                       | `enableRouterIntegration()`            |
| Input suppression    | None                       | Smart `ignoreInputs: "auto"`           |

## 2. Comparison: TanStack Hotkeys

### Key Differences

| Aspect             | TanStack                          | ui5-lib-hotkeys                            |
| ------------------ | --------------------------------- | ------------------------------------------ |
| Scoping            | DOM-based (`target` option)       | Named scope stack (LIFO) + target elements |
| `enabled`          | Static boolean only               | `boolean \| (() => boolean)`               |
| Handle mutation    | `.callback = fn`, `.setOptions()` | `handle.setOptions()`                      |
| Sequences          | `SequenceManager` with timeout    | `SequenceManager` with timeout             |
| Key state tracking | `KeyStateTracker`                 | `KeyStateTracker`                          |
| Hotkey recording   | `HotkeyRecorder`                  | `HotkeyRecorder`                           |
| Type safety        | Template literal union type       | Template literal union type (`Hotkey`)     |

## 3. Implementation Status

### Completed Features

| #   | Feature                                              | Status                                                                        |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Debug mode with console logging                      | Done. `setDebugMode()` with per-keypress logging                              |
| 2   | External conflict detection (browser/SAP blocklists) | Done. `validate.ts` with `BROWSER_SHORTCUTS` and `SAP_SHORTCUTS`              |
| 3   | Hotkey validation API (`validateHotkey()`)           | Done. `validate.ts` with `validateHotkey`, `assertValidHotkey`, `checkHotkey` |
| 4   | Handle mutation (`setOptions()`)                     | Done. all fields except `scope` updatable                                     |
| 5   | Type-safe hotkey strings                             | Done. `Hotkey` template literal union type                                    |
| 6   | Multi-key sequences                                  | Done. separate `SequenceManager` class                                        |
| 7   | Hotkey recording                                     | Done. `HotkeyRecorder` class                                                  |
| 8   | Key state tracking                                   | Done. `KeyStateTracker` class                                                 |
| 9   | Disallowed shortcut warnings at registration time    | Done. logged via `_logValidationWarnings()` on register                       |
| 10  | AltGr guard (Windows)                                | Done. tracks `event.location` for right-Alt                                   |
| 11  | Target element binding                               | Done. `target` option with `composedPath()`-based matching (innermost wins)   |
| 12  | Unhandled key callback                               | Done. `setUnhandledHandler()` with reason enum                                |
| 13  | Router integration                                   | Done. `enableRouterIntegration()` with `beforeRouteMatched`                   |
| 14  | Dialog scope lifecycle                               | Done. manual `pushScope`/`popScope` for non-route scopes                      |

### Remaining Ideas (Nice to Have)

| #   | Feature                                                     | Effort | Impact |
| --- | ----------------------------------------------------------- | ------ | ------ |
| 1   | Visual devtools overlay (separate module)                   | High   | Medium |
| 2   | `keyup` event support                                       | Low    | Low    |
| 3   | `ShortcutHintsMixin` integration for UI5 controls           | Medium | Low    |
| 4   | `requireReset` option (fire once, require full key release) | Low    | Low    |

## 4. FLP & Standalone Compatibility

The library works in both standalone and FLP because:

- Document-level capture phase listener, independent of UI5's focus system
- No manifest.json coupling for shortcuts
- Lazy `sap.m` loading, no hard dependency
- Scope stack is manual, not tied to FLP shell

FLP-reserved shortcuts (F6, Shift+F6, Alt+0) are included in `BROWSER_SHORTCUTS` and `SAP_SHORTCUTS` blocklists. Registration warnings are logged when these are used.

## References

- [UI5 CommandExecution focus issue #2788](https://github.com/SAP/openui5/issues/2788)
- [Fiori Elements keyboard shortcuts](https://ui5.sap.com/sdk/docs/topics/0cd318c83ec5473d9a091c1782d03c21.html)
- [FLP keyboard shortcuts](https://help.sap.com/docs/btp/sap-fiori-launchpad-for-sap-btp/keyboard-shortcuts-5823b11296014b819d98fb108b4bc1c4)
- [TanStack Hotkeys](https://github.com/TanStack/hotkeys)
