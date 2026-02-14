# ui5-lib-hotkeys

Declarative keyboard shortcut management for SAPUI5/OpenUI5 applications.

A UI5 TypeScript library (`ui5.hotkeys`) providing document-level keyboard shortcuts with scope-based activation, cross-platform modifier normalization, multi-key sequences, hotkey recording, and proper UI5 lifecycle integration.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [HotkeyManager](#hotkeymanager)
  - [Registration](#registration)
  - [Registration Options](#registration-options)
  - [Registration Handle](#registration-handle)
  - [Scope Management](#scope-management)
  - [Router Integration](#router-integration)
  - [Debug Mode](#debug-mode)
  - [Unhandled Key Callback](#unhandled-key-callback)
  - [Target Elements](#target-elements)
- [SequenceManager](#sequencemanager)
- [KeyStateTracker](#keystatetracker)
- [HotkeyRecorder](#hotkeyrecorder)
- [Validation](#validation)
- [Utility Functions](#utility-functions)
- [Library Enums & Constants](#library-enums--constants)
- [Type-safe Hotkey Strings](#type-safe-hotkey-strings)
- [When NOT to Use This Library](#when-not-to-use-this-library)

---

## Features

**Core**

- Document-level shortcuts with no focus requirement, unlike `sap.ui.core.CommandExecution`
- Scope stack for view-scoped, dialog-scoped, or fragment-scoped shortcuts
- Two-pass matching where scoped handlers always take priority over global ones
- Smart input suppression that auto-suppresses single-key shortcuts in text fields but allows Ctrl/Cmd combos
- Cross-platform `Mod` key that resolves to Cmd on macOS, Ctrl on Windows/Linux
- Conflict detection with configurable behavior: warn, error, replace, or allow
- AltGr guard that prevents false matches on Windows international keyboards

**Integrations**

- Router integration for automatic scope management tied to route changes
- Dialog suppression with lazy-loaded `sap.m.InstanceManager` (no hard sap.m dependency)
- Target element binding for element-scoped hotkeys

**Advanced**

- Multi-key sequences (e.g., `G` then `E`) with configurable timeout
- Hotkey recorder for "press a key" settings UIs
- Held-key state tracking with macOS stuck-key fix
- Hotkey validation with browser and SAP Fiori conflict warnings
- Debug mode with detailed per-keypress logging

**Developer Experience**

- Type-safe `Hotkey` string type with IDE autocomplete for known key combinations
- Live option updates via `handle.setOptions()` without re-registering
- Platform-aware display formatting with native modifier symbols on macOS
- Proper UI5 enum registration via `DataType.registerEnum()`

**Robustness**

- IME composition guard for CJK input method events
- Shadow DOM support via `composedPath()` for accurate event target detection
- Key repeat filtering (on by default)
- Callback error isolation (errors in handlers don't crash the manager)

---

## Installation

```bash
npm install ui5-lib-hotkeys
```

Add the library to your application's `manifest.json`:

```json
{
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "ui5.hotkeys": {}
      }
    }
  }
}
```

---

## Quick Start

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

// In your Component.init():
const manager = HotkeyManager.getInstance();
manager.enableRouterIntegration(this.getRouter());

// Register a global shortcut
const handle = manager.register(
  "Mod+S",
  (event) => {
    // Save logic -- Cmd+S on Mac, Ctrl+S on Windows/Linux
    MessageToast.show("Saved!");
  },
  { description: "Save" },
);

// Register a view-scoped shortcut (scope = route name)
manager.register(
  "F5",
  () => {
    this.onRefresh();
  },
  { scope: "detail", description: "Refresh detail" },
);

// Update options on the fly
handle.setOptions({ enabled: () => model.getProperty("/isDirty") });

// Clean up a single registration
handle.unregister();

// In your Component.destroy():
manager.destroy();
```

---

## HotkeyManager

The central singleton that manages all keyboard shortcut registrations.

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = HotkeyManager.getInstance();
```

| Method                                 | Description                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `getInstance()`                        | Get or create the singleton                           |
| `register(hotkey, callback, options?)` | Register a shortcut, returns a handle                 |
| `pushScope(scopeId)`                   | Push a scope onto the stack                           |
| `popScope(scopeId?)`                   | Pop the top scope (optional ID for validation)        |
| `getActiveScope()`                     | Get the current top-of-stack scope                    |
| `resetToGlobalScope()`                 | Pop all non-global scopes in one call                 |
| `enableRouterIntegration(router)`      | Auto-manage view scopes via router events             |
| `disableRouterIntegration()`           | Detach router handler without destroying the manager  |
| `getRegistrations()`                   | Get all active registrations                          |
| `getRegistrationsForScope(scopeId)`    | Filter registrations by scope                         |
| `getPlatform()`                        | Get the detected platform                             |
| `setUnhandledHandler(callback)`        | Set callback for unhandled key events                 |
| `setDebugMode(enabled)`                | Enable/disable detailed keypress logging              |
| `isDebugMode()`                        | Check if debug mode is on                             |
| `destroy()`                            | Remove all listeners, clear state, null the singleton |

### Registration

```ts
// Simple key
manager.register("Escape", (event) => dialog.close());

// Modifier combo (Mod = Cmd on Mac, Ctrl on Windows/Linux)
manager.register("Mod+S", (event) => save());

// Multiple modifiers
manager.register("Ctrl+Shift+K", (event) => deleteLines());

// With full options
manager.register(
  "F5",
  (event, details) => {
    console.log(`Hotkey "${details.hotkey}" fired in scope "${details.scope}"`);
    refresh();
  },
  {
    scope: "editor",
    description: "Refresh editor",
    enabled: () => !model.getProperty("/isLoading"),
    ignoreRepeat: true,
    suppressInDialogs: true,
  },
);
```

### Registration Options

| Option              | Type                       | Default        | Description                                                                                      |
| ------------------- | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `enabled`           | `boolean \| () => boolean` | `true`         | Whether the registration is active. Functions are evaluated on every keypress.                   |
| `preventDefault`    | `boolean`                  | `true`         | Call `event.preventDefault()` on match                                                           |
| `stopPropagation`   | `boolean`                  | `true`         | Call `event.stopPropagation()` on match                                                          |
| `ignoreInputs`      | `boolean \| "auto"`        | `"auto"`       | Suppress in text fields. `"auto"` suppresses single keys but allows Ctrl/Meta combos and Escape. |
| `scope`             | `string`                   | `"__global__"` | Scope this hotkey belongs to. Use `GLOBAL_SCOPE` constant.                                       |
| `description`       | `string`                   | `""`           | Human-readable description for cheatsheets                                                       |
| `ignoreRepeat`      | `boolean`                  | `true`         | Ignore held-key repeat events                                                                    |
| `suppressInDialogs` | `boolean`                  | `false`        | Suppress when a UI5 dialog is open                                                               |
| `conflictBehavior`  | `ConflictBehavior`         | `"warn"`       | How to handle duplicate registrations                                                            |
| `target`            | `HTMLElement \| Document`  | `null`         | Bind to a specific element instead of the document                                               |

### Registration Handle

`register()` returns a handle with lifecycle control and live updates:

```ts
const handle = manager.register("Mod+S", saveHandler, { description: "Save" });

handle.id; // "hk_1" — unique registration ID
handle.isActive; // true — not yet unregistered

// Update options without re-registering
handle.setOptions({ enabled: false });
handle.setOptions({ description: "Save Document" });
handle.setOptions({ ignoreRepeat: false });
// Remove the registration
handle.unregister();
handle.isActive; // false
```

> [!WARNING]
> Changing `scope` via `setOptions()` throws an error. Unregister and re-register instead.

### Scope Management

The scope stack determines which hotkeys are active. Global hotkeys always fire as a fallback.

```ts
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";

// Register same key in different scopes
manager.register("Escape", () => closeApp(), { scope: GLOBAL_SCOPE });
manager.register("Escape", () => closeDialog(), { scope: "confirmDialog" });
manager.register("Escape", () => exitEditMode(), { scope: "editor" });

// Push a scope — it becomes the active scope
manager.pushScope("editor");
// Now pressing Escape calls exitEditMode()
// Global Escape is suppressed (scoped match takes priority)

// Open a dialog on top
manager.pushScope("confirmDialog");
// Now pressing Escape calls closeDialog()

// Close the dialog
manager.popScope("confirmDialog");
// Back to editor — Escape calls exitEditMode() again

// Reset everything to just the global scope
manager.resetToGlobalScope();
// Now pressing Escape calls closeApp()
```

> [!NOTE]
> **Scope fallthrough**: If the active scope has no handler for a key, the global scope handler fires.
>
> ```ts
> manager.register("Mod+S", () => save()); // global
> manager.pushScope("editor");
> // Mod+S still fires — no editor-scoped Mod+S shadows it
> ```

### Router Integration

Automatically manage view scopes based on route changes. No manual `pushScope`/`popScope` needed in controllers:

```ts
// Component.init()
const manager = HotkeyManager.getInstance();
manager.enableRouterIntegration(this.getRouter());
this.getRouter().initialize();
```

```ts
// Main.controller.ts — route name is "main"
manager.register("F5", () => this.onRefresh(), {
  scope: "main",
  description: "Refresh main list",
});
```

```ts
// Detail.controller.ts — route name is "detail"
manager.register("F5", () => this.onRefreshDetail(), {
  scope: "detail",
  description: "Refresh detail view",
});
```

When the user navigates from `main` to `detail`, the router handler automatically resets to global scope and pushes `"detail"`. The correct F5 handler fires based on which route is active.

> [!IMPORTANT]
> Dialog scopes still require manual `pushScope`/`popScope` since they're not route-based.

### Debug Mode

Enable detailed per-keypress logging to diagnose why a hotkey didn't fire:

```ts
manager.setDebugMode(true);
```

Every keypress is logged (via `Log.debug`) with:

- Key pressed + modifiers, active scope, input/dialog state
- Matched registration (if any) with scope, id, and description
- All skipped registrations with reasons (disabled, input suppressed, etc.)
- External conflicts from browser/SAP blocklists

### Unhandled Key Callback

Get notified when a key event could have been a hotkey but wasn't handled:

```ts
import { UnhandledReason } from "ui5/hotkeys/library";

manager.setUnhandledHandler((ctx) => {
  if (ctx.reason === UnhandledReason.NoMatch) {
    // No registration matched this key combo
  }
  if (ctx.reason === UnhandledReason.Disabled) {
    // A registration matched but was disabled
    console.log("Skipped:", ctx.skippedRegistration?.options.description);
  }
  if (ctx.reason === UnhandledReason.InputSuppressed) {
    // Suppressed because focus was in a text field
  }
});

// Remove the callback
manager.setUnhandledHandler(null);
```

Reasons: `NoMatch`, `Disabled`, `InputSuppressed`, `DialogSuppressed`, `RepeatIgnored`.

### Target Elements

Bind a hotkey to a specific DOM element instead of the entire document:

```ts
const panel = this.byId("editorPanel").getDomRef();

manager.register("Mod+S", () => savePanel(), {
  target: panel,
  scope: "editor",
  description: "Save panel content",
});

// This hotkey only fires for keydown events on the panel element.
// Document-level Mod+S (if registered) still works independently.
// Scopes still apply — both target and scope must match.
```

---

## SequenceManager

Multi-key sequences like Vim-style `G` then `E` for "go to editor":

```ts
import SequenceManager from "ui5/hotkeys/SequenceManager";

const seq = SequenceManager.getInstance();

// Register a 2-key sequence
seq.registerSequence(
  ["G", "E"],
  (event) => {
    router.navTo("editor");
  },
  { description: "Go to editor", timeout: 1000 },
);

// Modifier sequences work too
seq.registerSequence(
  ["Ctrl+K", "Ctrl+S"],
  (event) => {
    saveAll();
  },
  { description: "Save all (VS Code style)" },
);

// Get progress updates mid-sequence
seq.setPendingCallback((info) => {
  statusBar.setText(`Sequence: ${info.completedSteps}/${info.totalSteps} — next: ${info.nextKey}`);
});

// Clean up
seq.destroy();
```

**Options**: `description`, `timeout` (default 1000ms), `scope`, `enabled`, `ignoreInputs` (default `true` — suppresses in text fields).

> [!NOTE]
> Uses HotkeyManager's scope stack — sequences respect the active scope.

---

## KeyStateTracker

Track which keys are currently held down (useful for "hold Shift to multi-select" patterns):

```ts
import KeyStateTracker from "ui5/hotkeys/KeyStateTracker";

const tracker = KeyStateTracker.getInstance();

// Check if a key is held
if (tracker.isKeyHeld("Shift")) {
  // Multi-select mode
}

// Get all held keys
const held = tracker.getHeldKeys(); // ["Shift", "a"]

// React to changes
tracker.setChangeCallback((keys) => {
  console.log("Currently held:", keys);
});

// Clean up
tracker.destroy();
```

> [!NOTE]
> Includes a **macOS stuck-key fix**: when a modifier is released, all non-modifier keys are cleared. This prevents ghost keys when macOS swallows keyup events (e.g., Cmd+Tab).

---

## HotkeyRecorder

Capture a keyboard shortcut from user input — for "press a key to set shortcut" settings UIs:

```ts
import HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";

const recorder = new HotkeyRecorder({
  onRecord: (hotkey) => {
    // hotkey = "Control+Shift+S" or "" (cleared via Backspace)
    model.setProperty("/shortcut", hotkey);
  },
  onCancel: () => {
    // User pressed Escape
  },
});

// Start listening (attaches a capture-phase keydown listener)
recorder.start();
// recorder.isRecording === true

// The recorder auto-stops after capturing one hotkey.
// Special behavior:
//   Escape        → cancel (calls onCancel)
//   Backspace/Del → clear (calls onRecord(""))
//   Modifier-only → waits for an action key
//   Any combo     → records and auto-stops

// Manual stop (no callbacks fired)
recorder.stop();
```

> [!TIP]
> Not a singleton — create one per settings row if needed.

---

## Validation

Validate hotkey strings for correctness and check for conflicts with browser or SAP shortcuts:

```ts
import { validateHotkey, assertValidHotkey, checkHotkey } from "ui5/hotkeys/validate";

// Full validation with warnings
const result = validateHotkey("Ctrl+S", "windows");
// result.valid === true
// result.normalizedHotkey === "Control+S"
// result.warnings === ["Conflicts with SAP shortcut: Save (Fiori) (Control+S)"]
// result.errors === []

const result2 = validateHotkey("F5", "windows");
// result2.warnings includes browser reload conflict

// Quick boolean check
checkHotkey("Ctrl+Shift+K"); // true
checkHotkey(""); // false

// Assert or throw
const normalized = assertValidHotkey("Mod+S"); // returns "Control+S" (on Windows)
assertValidHotkey(""); // throws Error
```

**Browser blocklist** (~20 entries): Ctrl+L, Ctrl+N, Ctrl+T, Ctrl+W, F5, F11, F12, Tab, etc.

**SAP blocklist** (~12 entries): Ctrl+S (Save), Ctrl+E (Edit), Ctrl+D (Delete), F6, etc.

> [!TIP]
> Validation warnings are also automatically logged when calling `manager.register()`.

---

## Utility Functions

### Parsing & Normalization

```ts
import { parseHotkey, normalizeHotkey, keyboardEventToHotkey, convertToModFormat } from "ui5/hotkeys/parse";

// Parse a hotkey string into components
const parsed = parseHotkey("Mod+Shift+S", "mac");
// { key: "S", ctrl: false, shift: true, alt: false, meta: true, modifiers: ["Shift", "Meta"] }

// Normalize to canonical form
normalizeHotkey("cmd+shift+s", "mac"); // "Shift+Meta+S"
normalizeHotkey("Mod+S", "windows"); // "Control+S"

// Convert a KeyboardEvent to a hotkey string
document.addEventListener("keydown", (event) => {
  const hotkey = keyboardEventToHotkey(event); // "Control+Shift+S" or null for modifier-only
});

// Convert platform-specific to cross-platform "Mod" format
convertToModFormat("Control+S", "windows"); // "Mod+S"
convertToModFormat("Meta+S", "mac"); // "Mod+S"
```

### Display Formatting

```ts
import { formatForDisplay } from "ui5/hotkeys/format";

// macOS: uses symbols without separators
formatForDisplay("Mod+Shift+S", "mac"); // "⇧⌘S"

// Windows/Linux: uses text labels with "+"
formatForDisplay("Mod+Shift+S", "windows"); // "Ctrl+Shift+S"
```

### Event Matching

```ts
import { matchesKeyboardEvent } from "ui5/hotkeys/match";

const parsed = parseHotkey("Ctrl+S");
document.addEventListener("keydown", (event) => {
  if (matchesKeyboardEvent(event, parsed)) {
    // This event matches Ctrl+S
  }
});
```

### DOM Utilities

```ts
import { isInputElement, getEventTarget } from "ui5/hotkeys/dom";

// Check if a target is an editable input
isInputElement(document.activeElement); // true for <input type="text">, <textarea>, contentEditable

// Get the real event target (handles Shadow DOM retargeting)
const target = getEventTarget(event);
```

### Platform Detection

```ts
import { detectPlatform, resolveModifier } from "ui5/hotkeys/platform";

detectPlatform(); // "mac", "windows", or "linux"

resolveModifier("Mod", "mac"); // "Meta"
resolveModifier("Mod", "windows"); // "Control"
resolveModifier("Shift"); // "Shift" (non-Mod modifiers pass through)
```

---

## Library Enums & Constants

The library registers proper UI5 enums via `DataType.registerEnum()`:

```ts
import { ConflictBehavior, UnhandledReason, Platform, GLOBAL_SCOPE } from "ui5/hotkeys/library";

// ConflictBehavior — strategy for duplicate registrations
ConflictBehavior.Warn; // "warn"
ConflictBehavior.Error; // "error"
ConflictBehavior.Replace; // "replace"
ConflictBehavior.Allow; // "allow"

// UnhandledReason — why a key event was not handled
UnhandledReason.NoMatch; // "no_match"
UnhandledReason.Disabled; // "disabled"
UnhandledReason.InputSuppressed; // "input_suppressed"
UnhandledReason.DialogSuppressed; // "dialog_suppressed"
UnhandledReason.RepeatIgnored; // "repeat_ignored"

// Platform — detected platform
Platform.Mac; // "mac"
Platform.Windows; // "windows"
Platform.Linux; // "linux"

// GLOBAL_SCOPE — the default scope constant (instead of hardcoding "__global__")
GLOBAL_SCOPE; // "__global__"
```

All enum objects are frozen with `Object.freeze()`.

---

## Type-safe Hotkey Strings

The `Hotkey` type provides IDE autocomplete for known key combinations while still accepting any string:

```ts
import type { Hotkey } from "ui5/hotkeys/types";

// IDE suggests: "Escape", "Enter", "Ctrl+S", "Mod+Shift+K", "F5", etc.
const key: Hotkey = "Mod+S";

// Arbitrary strings still work (escape hatch via `string & {}`)
const custom: Hotkey = "Ctrl+Shift+Alt+F13";
```

Supported key categories: Letters (A-Z), Digits (0-9), Function keys (F1-F24), Special keys (Escape, Enter, Space, Tab, Backspace, Delete, arrows, etc.), Punctuation (+, -, =, etc.).

Supported modifier prefixes: `Ctrl`, `Control`, `Shift`, `Alt`, `Meta`, `Mod`, `Cmd`, `Command`, `Option`.

---

## When NOT to Use This Library

Use UI5's built-in keyboard handling instead when:

| Scenario                                 | Use                                                             |
| ---------------------------------------- | --------------------------------------------------------------- |
| Single-control keyboard handling         | Pseudo events (`onsapenter`, `onsapescape`, `addEventDelegate`) |
| Fiori Elements standard actions          | Built-in shortcuts (Ctrl+S, Ctrl+E, etc.)                       |
| List/table arrow key navigation          | `sap.ui.core.delegate.ItemNavigation`                           |
| F6 group navigation                      | `data-sap-ui-fastnavgroup` attribute                            |
| Simple view-scoped with guaranteed focus | `sap.ui.core.CommandExecution` in manifest.json                 |

---

## License

MIT
