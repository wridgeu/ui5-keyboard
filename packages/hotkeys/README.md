# ui5-lib-hotkeys

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-kiosk-keyboard](../kiosk-keyboard/README.md).

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
  - [Registration Group](#registration-group)
  - [Scope Management](#scope-management)
  - [Router Integration](#router-integration)
  - [Debug Mode](#debug-mode)
  - [Unhandled Key Callback](#unhandled-key-callback)
  - [Target Elements](#target-elements)
  - [Suspend Guard](#suspend-guard)
- [SequenceManager](#sequencemanager)
- [KeyStateTracker](#keystatetracker)
- [HotkeyRecorder](#hotkeyrecorder)
- [Validation](#validation)
- [Utility Functions](#utility-functions)
- [Library Enums & Constants](#library-enums--constants)
  - [ConflictBehavior Examples](#conflictbehavior-examples)
- [Type-safe Hotkey Strings](#type-safe-hotkey-strings)
- [Troubleshooting](#troubleshooting)
- [When NOT to Use This Library](#when-not-to-use-this-library)

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

## Installation

> This package is currently workspace-only (`private: true`) and not published to npm.

In this monorepo, dependencies are managed via npm workspaces:

```bash
npm install
```

If/when this package is published, you can install it directly from npm (`ui5-lib-hotkeys`).

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

Lazy loading via `"lazy": true` and `Lib.load()` is supported but typically unnecessary — the library is lightweight (no CSS, no heavy dependencies) and best loaded eagerly at app startup.

## Quick Start

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

// In your Component.init():
const manager = HotkeyManager.getInstance();
manager.enableRouterIntegration(this.getRouter());

// Create a group for collective lifecycle management
const hotkeys: RegistrationGroup = manager.createGroup();

// Register a global shortcut
hotkeys.register(
  "Mod+S",
  (event) => {
    // Save logic -- Cmd+S on Mac, Ctrl+S on Windows/Linux
    MessageToast.show("Saved!");
  },
  { description: "Save" },
);

// Register a view-scoped shortcut (scope = route name)
hotkeys.register(
  "F5",
  () => {
    this.onRefresh();
  },
  { scope: "detail", description: "Refresh detail" },
);

// Handles returned by the group are normal handles
const handle = hotkeys.register("Mod+D", () => nav(), { description: "Nav" });
handle.setOptions({ enabled: () => model.getProperty("/isDirty") });

// Clean up all registrations in one call (e.g., in onExit or destroy)
hotkeys.destroyAll();

// In your Component.destroy():
manager.destroy();
```

## API Stability

Recommended stable consumer imports:

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type KeyStateTracker from "ui5/hotkeys/KeyStateTracker";
import type HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";
import { ConflictBehavior, GLOBAL_SCOPE, UnhandledReason } from "ui5/hotkeys/library";
import type { Hotkey, KeyboardDispatchGuard } from "ui5/hotkeys/types";
```

`HotkeyRecorder` and `KeyStateTracker` classes are exported for type declarations (e.g., `const tracker: KeyStateTracker = manager.getKeyStateTracker()`), but their constructors are internal — use `manager.createRecorder()` and `manager.getKeyStateTracker()` respectively.

Advanced utility modules are available but treated as implementation-oriented and may change without a semver-stable compatibility guarantee. In particular, anything under `ui5/hotkeys/internal/*` is internal-only. This also includes modules such as `ui5/hotkeys/parse`, `ui5/hotkeys/match`, `ui5/hotkeys/dom`, `ui5/hotkeys/platform`, and `ui5/hotkeys/validate`.

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
| `createGroup()`                        | Create a registration group for collective cleanup    |
| `pushScope(scopeId)`                   | Push a scope onto the stack                           |
| `popScope(scopeId)`                    | Pop the top scope (ID must match current top)         |
| `getActiveScope()`                     | Get the current top-of-stack scope                    |
| `resetToGlobalScope()`                 | Pop all non-global scopes in one call                 |
| `enableRouterIntegration(router)`      | Auto-manage view scopes via router events             |
| `disableRouterIntegration()`           | Detach router handler without destroying the manager  |
| `hasRouterIntegration()`               | Check whether router integration is currently active  |
| `getRegistrations()`                   | Get all active registrations                          |
| `getRegistrationsForScope(scopeId)`    | Filter registrations by scope                         |
| `getPlatform()`                        | Get the detected platform                             |
| `suspendDispatch(reason?)`             | Suspend dispatch, returns a guard handle              |
| `isDispatchSuspended()`                | Whether dispatch is currently suspended               |
| `createRecorder(options)`              | Create a HotkeyRecorder instance                      |
| `getKeyStateTracker()`                 | Access the held-key state tracker                     |
| `setUnhandledHandler(callback)`        | Set callback for unhandled key events                 |
| `setDebugMode(enabled)`                | Enable/disable detailed keypress logging              |
| `isDebugMode()`                        | Check if debug mode is on                             |
| `registerSequence(seq, cb, opts?)`     | Register a multi-key sequence, returns a handle       |
| `getSequenceRegistrations()`           | Get all active sequence registrations                 |
| `getSequenceRegistrationsForScope(id)` | Filter sequence registrations by scope                |
| `setSequencePendingHandler(callback)`  | Set global callback for mid-sequence progress         |
| `addGenericRootId(id)`                 | Register an element ID as a generic focus root        |
| `removeGenericRootId(id)`              | Remove a previously registered generic root ID        |
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
    suppressInPopups: true,
  },
);
```

### Registration Options

| Option             | Type                       | Default        | Description                                                                                      |
| ------------------ | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `enabled`          | `boolean \| () => boolean` | `true`         | Whether the registration is active. Functions are evaluated on every keypress.                   |
| `preventDefault`   | `boolean`                  | `true`         | Call `event.preventDefault()` on match                                                           |
| `stopPropagation`  | `boolean`                  | `true`         | Call `event.stopPropagation()` on match                                                          |
| `ignoreInputs`     | `boolean \| "auto"`        | `"auto"`       | Suppress in text fields. `"auto"` suppresses single keys but allows Ctrl/Meta combos and Escape. |
| `scope`            | `string`                   | `"__global__"` | Scope this hotkey belongs to. Use `GLOBAL_SCOPE` constant. Must be non-empty if provided.        |
| `description`      | `string`                   | `""`           | Human-readable description for cheatsheets                                                       |
| `ignoreRepeat`     | `boolean`                  | `true`         | Ignore held-key repeat events                                                                    |
| `suppressInPopups` | `boolean`                  | `false`        | Suppress when a UI5 popup (dialog or popover) is open                                            |
| `conflictBehavior` | `ConflictBehavior`         | `"warn"`       | How to handle duplicate registrations                                                            |
| `target`           | `HTMLElement`              | `null`         | Bind to a specific element instead of the document                                               |

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

**Updatable options via `setOptions()`:**

All [Registration Options](#registration-options) except `scope` and `conflictBehavior` can be updated at any time:

```ts
handle.setOptions({
  enabled: () => model.getProperty("/isDirty"),
  description: "Save (modified)",
  preventDefault: false,
  stopPropagation: false,
  ignoreInputs: true,
  ignoreRepeat: false,
  suppressInPopups: true,
  target: document.getElementById("myPanel"),
});
```

> [!WARNING]
> Changing `scope` or `conflictBehavior` via `setOptions()` throws an error. Unregister and re-register instead.

### Registration Group

`createGroup()` returns a `RegistrationGroup` that tracks all registrations made through it, enabling single-call cleanup:

```ts
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

// Create a group (in onInit)
private _hotkeys!: RegistrationGroup;

onInit(): void {
  this._hotkeys = manager.createGroup();
  this._hotkeys.register("F5", handler, { scope: "main" });
  this._hotkeys.registerSequence(["G", "I"], handler, { scope: "main" });
}

onExit(): void {
  this._hotkeys.destroyAll(); // Unregisters all tracked handles
}
```

| Property / Method            | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `register()`                 | Delegates to `manager.register()`, tracks handle         |
| `registerSequence()`         | Delegates to `manager.registerSequence()`, tracks handle |
| `getRegistrations()`         | Get this group's active hotkey registrations             |
| `getSequenceRegistrations()` | Get this group's active sequence registrations           |
| `destroyAll()`               | Unregister all tracked handles (idempotent)              |
| `size`                       | Number of currently active registrations                 |
| `isDestroyed`                | Whether `destroyAll()` has been called                   |

Handles returned by the group are normal `HotkeyRegistrationHandle` / `SequenceRegistrationHandle` — `setOptions()`, `unregister()`, and all properties work as usual. Individually unregistering a handle decrements the group's `size`.

Group-level introspection can drive scoped shortcut UIs:

```ts
const hotkeysForThisController = this._hotkeys.getRegistrations();
const sequencesForThisController = this._hotkeys.getSequenceRegistrations();

// Example: render a quick hint list
hotkeysForThisController.forEach((entry) => {
  console.log(entry.normalizedHotkey, entry.description);
});
```

Lifecycle guidance (UI5):

- **Controller (`onInit`/`onExit`)**: create one group in `onInit()`, register through it, call `destroyAll()` in `onExit()`.
  This only unregisters entries that were created through that specific group; other groups stay active.
- **View lifecycle**: if a view/controller is recreated by routing, do not reuse old groups/handles across instances.
- **Component lifecycle**: call `HotkeyManager.getInstance().destroy()` in `Component.destroy()` to release listeners and invalidate all existing handles/groups.
- **After manager destroy**: old handles/groups are intentionally inactive; create fresh registrations from the new manager instance.

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

`hasRouterIntegration()` is useful for guarded setup and teardown:

```ts
if (!manager.hasRouterIntegration()) {
  manager.enableRouterIntegration(this.getRouter());
}

// later (e.g. integration toggle / test cleanup)
if (manager.hasRouterIntegration()) {
  manager.disableRouterIntegration();
}
```

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
    console.log("Skipped:", ctx.skippedRegistration?.description);
  }
  if (ctx.reason === UnhandledReason.InputSuppressed) {
    // Suppressed because focus was in a text field
  }
});

// Remove the callback
manager.setUnhandledHandler(null);
```

Reasons: `NoMatch`, `Disabled`, `InputSuppressed`, `PopupSuppressed`, `RepeatIgnored`, `TargetMismatch`, `Suspended`.

### Target Elements

Bind a hotkey to a specific DOM element instead of the entire document:

```ts
const panel = this.byId("editorPanel").getDomRef();

manager.register("Mod+S", () => savePanel(), {
  target: panel,
  scope: "editor",
  description: "Save panel content",
});

// This hotkey only fires when the event's composedPath() includes the panel element.
// For nested targets with the same key, the innermost match fires.
// A target-scoped match with stopPropagation: true (the default) prevents
// document-level handlers for the same key from firing.
// Scopes still apply — both target and scope must match.
```

> **Focus fallback (Escape only):** Some browsers and UI5 rendering transitions
> move focus to a generic root node (body, UIArea container) before dispatching
> the `keydown` event. For `Escape`, the manager reconstructs the composed path
> from the most recently focused element so that target-scoped registrations
> still fire. This fallback is one-shot (consumed after a single dispatch) and
> expires after 1200 ms. Other keys are not affected by this behavior.

### Suspend Guard

Temporarily suspend all hotkey and sequence dispatch (e.g., during onboarding overlays or guided tours):

```ts
// Acquire a guard — dispatch is suspended while any guard is active
const guard = manager.suspendDispatch("onboarding-overlay");

// Key state tracking continues normally.
// Browser defaults are NOT suppressed (no preventDefault).
// Unhandled callback fires with reason "suspended".

// Release the guard to resume dispatch
guard.release(); // idempotent — safe to call multiple times

// Nested guards: all must be released before dispatch resumes
const g1 = manager.suspendDispatch("outer");
const g2 = manager.suspendDispatch("inner");
g1.release(); // still suspended — g2 active
g2.release(); // dispatch resumes
```

## SequenceManager

Multi-key sequences like Vim-style `G` then `E` for "go to editor":

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = HotkeyManager.getInstance();

// Register a 2-key sequence
manager.registerSequence(
  ["G", "E"],
  (event) => {
    router.navTo("editor");
  },
  { description: "Go to editor", timeout: 1000 },
);

// Modifier sequences work too
manager.registerSequence(
  ["Ctrl+K", "Ctrl+S"],
  (event) => {
    saveAll();
  },
  { description: "Save all (VS Code style)" },
);

// Per-registration progress callback — dies with the registration
manager.registerSequence(
  ["G", "I"],
  (event) => {
    router.navTo("inbox");
  },
  {
    description: "Go to inbox",
    onPending: (info) => {
      statusBar.setText(`Sequence: ${info.completedSteps}/${info.totalSteps} — next: ${info.nextKey}`);
    },
  },
);

// Global fallback for sequences without onPending
manager.setSequencePendingHandler((info) => {
  statusBar.setText(`Sequence: ${info.completedSteps}/${info.totalSteps} — next: ${info.nextKey}`);
});
```

**Options**: `description`, `timeout` (default 1000ms), `scope`, `enabled`, `ignoreInputs` (default `"auto"` — suppresses single-key steps in text fields, but allows Ctrl/Meta combos and Escape), `onPending` (per-registration progress callback, takes precedence over the global handler).

> [!NOTE]
> `scope` must be a non-empty string when provided.
> Uses HotkeyManager's scope stack — sequences respect the active scope.

## KeyStateTracker

Track which keys are currently held down (useful for "hold Shift to multi-select" patterns):

```ts
import type KeyStateTracker from "ui5/hotkeys/KeyStateTracker";

const tracker = manager.getKeyStateTracker();

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

// Clean up (remove callback — tracker lifecycle is owned by the manager)
tracker.setChangeCallback(null);
```

The tracker is owned by `HotkeyManager` and shares its lifecycle — it is created and destroyed automatically. Access it via `manager.getKeyStateTracker()`. The `KeyStateTracker` class is exported for type declarations but its constructor is internal.

> [!NOTE]
> Includes a **macOS stuck-key fix**: when a modifier is released, all non-modifier keys are cleared. This prevents ghost keys when macOS swallows keyup events (e.g., Cmd+Tab).

## HotkeyRecorder

Capture a keyboard shortcut from user input — for "press a key to set shortcut" settings UIs:

```ts
import type HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";

const recorder = manager.createRecorder({
  onRecord: (hotkey) => {
    // hotkey = "Control+Shift+S" or "" (cleared via Backspace)
    model.setProperty("/shortcut", hotkey);
  },
  onCancel: () => {
    // User pressed Escape
  },
});

// Start listening (sets the recorder as the manager's interceptor)
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

// Clean up when done
recorder.destroy();
```

> [!IMPORTANT]
> While recording, **all keyboard input is blocked** (`preventDefault` + `stopImmediatePropagation`). Keep the recording window short.

> [!TIP]
> Not a singleton — create one per settings row via `manager.createRecorder()`. The `HotkeyRecorder` class is exported for type declarations but its constructor is internal.

## Validation

Validate hotkey strings for correctness and check for conflicts with browser or SAP shortcuts:

```ts
import { validateHotkey, assertValidHotkey, checkHotkey } from "ui5/hotkeys/validate";
import { Platform } from "ui5/hotkeys/library";

// Full validation with warnings
const result = validateHotkey("Ctrl+S", Platform.Windows);
// result.valid === true
// result.normalizedHotkey === "Control+S"
// result.warnings === ["Conflicts with SAP shortcut: Save (Fiori) (Control+S)"]
// result.errors === []

const result2 = validateHotkey("F5", Platform.Windows);
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

**Common errors from invalid hotkey strings:**

| Input          | Error                                                             |
| -------------- | ----------------------------------------------------------------- |
| `""`           | `Hotkey string must not be empty`                                 |
| `"Ctrl"`       | `Invalid hotkey "Ctrl": no non-modifier key found`                |
| `"Ctrl+Shift"` | `Invalid hotkey "Ctrl+Shift": no non-modifier key found`          |
| `"Ctrl+S+X"`   | `Invalid hotkey "Ctrl+S+X": unexpected segment "X" after key "S"` |

Unknown key names (e.g. `"Ctrl+Foo"`) produce a validation warning but do not throw — they are allowed for forward compatibility.

## Utility Functions

### Parsing & Normalization

```ts
import { parseHotkey, normalizeHotkey, keyboardEventToHotkey, convertToModFormat } from "ui5/hotkeys/parse";
import { Platform } from "ui5/hotkeys/library";

// Parse a hotkey string into components
const parsed = parseHotkey("Mod+Shift+S", Platform.Mac);
// { key: "S", ctrl: false, shift: true, alt: false, meta: true, modifiers: ["Shift", "Meta"] }

// Normalize to canonical form
normalizeHotkey("cmd+shift+s", Platform.Mac); // "Shift+Meta+S"
normalizeHotkey("Mod+S", Platform.Windows); // "Control+S"

// Convert a KeyboardEvent to a hotkey string
document.addEventListener("keydown", (event) => {
  const hotkey = keyboardEventToHotkey(event); // "Control+Shift+S" or null for modifier-only
});

// Convert platform-specific to cross-platform "Mod" format
convertToModFormat("Control+S", Platform.Windows); // "Mod+S"
convertToModFormat("Meta+S", Platform.Mac); // "Mod+S"
```

### Display Formatting

```ts
import { formatForDisplay } from "ui5/hotkeys/format";
import { Platform } from "ui5/hotkeys/library";

// macOS: uses symbols without separators
formatForDisplay("Mod+Shift+S", Platform.Mac); // "⇧⌘S"

// Windows/Linux: uses text labels with "+"
formatForDisplay("Mod+Shift+S", Platform.Windows); // "Ctrl+Shift+S"
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
import { Platform } from "ui5/hotkeys/library";

detectPlatform(); // Platform.Mac, Platform.Windows, or Platform.Linux

resolveModifier("Mod", Platform.Mac); // "Meta"
resolveModifier("Mod", Platform.Windows); // "Control"
resolveModifier("Shift"); // "Shift" (non-Mod modifiers pass through)
```

## Library Enums & Constants

The library registers proper UI5 enums via `DataType.registerEnum()`:

```ts
import { ConflictBehavior, UnhandledReason, Platform, GLOBAL_SCOPE } from "ui5/hotkeys/library";

// ConflictBehavior — strategy for duplicate registrations
ConflictBehavior.Warn; // "warn" — log warning, allow both (default)
ConflictBehavior.Error; // "error" — throw, prevent new registration
ConflictBehavior.Replace; // "replace" — unregister existing, register new
ConflictBehavior.Allow; // "allow" — allow silently, no feedback

// UnhandledReason — why a key event was not handled
UnhandledReason.NoMatch; // "no_match"
UnhandledReason.TargetMismatch; // "target_mismatch" — key matched but target element was not in composedPath
UnhandledReason.Disabled; // "disabled"
UnhandledReason.InputSuppressed; // "input_suppressed"
UnhandledReason.PopupSuppressed; // "popup_suppressed"
UnhandledReason.RepeatIgnored; // "repeat_ignored"
UnhandledReason.Suspended; // "suspended" — dispatch was suspended via suspendDispatch()

// Platform — detected platform
Platform.Mac; // "mac"
Platform.Windows; // "windows"
Platform.Linux; // "linux"

// GLOBAL_SCOPE — the default scope constant (instead of hardcoding "__global__")
GLOBAL_SCOPE; // "__global__"
```

All enum objects are frozen with `Object.freeze()`.

### ConflictBehavior Examples

```ts
// Default: warn and allow both (duplicate hotkeys fire in registration order)
manager.register("Mod+S", saveHandler);
manager.register("Mod+S", otherHandler); // logs warning, both remain active

// Strict: throw on conflict (prevents accidental duplicates)
manager.register("Mod+S", saveHandler, { conflictBehavior: ConflictBehavior.Error });
manager.register("Mod+S", otherHandler, { conflictBehavior: ConflictBehavior.Error });
// → throws Error("Hotkey "Control+S" conflicts with ...")

// Replace: new registration replaces existing (useful for overriding defaults)
manager.register("Mod+S", saveHandler);
manager.register("Mod+S", betterSaveHandler, { conflictBehavior: ConflictBehavior.Replace });
// saveHandler is unregistered, only betterSaveHandler remains

// Allow: silently allow duplicates (no warning logged)
manager.register("Mod+S", handlerA, { conflictBehavior: ConflictBehavior.Allow });
manager.register("Mod+S", handlerB, { conflictBehavior: ConflictBehavior.Allow });
// Both active, no console output
```

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

## Further Reading

- [Architecture & Internals](../../docs/hotkeys/ARCHITECTURE.md) — two-pass matching, scope stack, listener design
- [Multi-key Sequence Design](../../docs/hotkeys/SEQUENCES.md) — how the sequence system works
- [Alternatives Research](../../docs/hotkeys/ALTERNATIVES-RESEARCH.md) — comparison with other keyboard shortcut approaches
- [UI5 Event Handling Deep Dive](../../docs/shared/UI5-EVENT-HANDLING-DEEP-DIVE.md) — how UI5 processes keyboard events

## Troubleshooting

**Hotkey doesn't fire:**

1. Check if the correct scope is active — use `manager.getActiveScope()` or enable debug mode
2. If focus is in a text field, single-key hotkeys are suppressed by default (`ignoreInputs: "auto"`). Use `Ctrl`/`Mod` combos or set `ignoreInputs: false`
3. Check if the registration is disabled — `handle.setOptions({ enabled: true })`
4. Check for popup suppression — `suppressInPopups: true` blocks hotkeys when a dialog is open
5. Enable debug mode (`manager.setDebugMode(true)`) and check the browser console for detailed per-keypress logs

**Hotkey fires the wrong handler:**

- The active scope's handler always wins over global. Use `getRegistrations()` to inspect all active registrations and their scopes
- With router integration, the scope matches the route name — check that your route names match your scope strings

**Hotkeys stopped firing unexpectedly:**

- Check if dispatch is suspended: `manager.isDispatchSuspended()`. A suspend guard may not have been released
- Check if a recorder is active — while recording, all hotkey dispatch is blocked

**AltGr characters trigger hotkeys on Windows:**

- The AltGr guard is automatic on Windows. If it's not working, ensure the library detected `Platform.Windows` (check `manager.getPlatform()`)

**`enabled()` guard function seems broken:**

- If `enabled()` throws an error, the registration is silently treated as disabled. Check the browser console for `Log.warning` messages from `ui5.hotkeys.HotkeyManager`.

## When NOT to Use This Library

Use UI5's built-in keyboard handling instead when:

| Scenario                                 | Use                                                             |
| ---------------------------------------- | --------------------------------------------------------------- |
| Single-control keyboard handling         | Pseudo events (`onsapenter`, `onsapescape`, `addEventDelegate`) |
| Fiori Elements standard actions          | Built-in shortcuts (Ctrl+S, Ctrl+E, etc.)                       |
| List/table arrow key navigation          | `sap.ui.core.delegate.ItemNavigation`                           |
| F6 group navigation                      | `data-sap-ui-fastnavgroup` attribute                            |
| Simple view-scoped with guaranteed focus | `sap.ui.core.CommandExecution` in manifest.json                 |

## License

[MIT](../../LICENSE)
