<p align="center">
  <a href="https://www.npmjs.com/package/ui5-lib-hotkeys"><img src="https://img.shields.io/npm/v/ui5-lib-hotkeys.svg" alt="npm"></a>
  <a href="https://npmx.dev/package/ui5-lib-hotkeys"><img src="https://img.shields.io/npm/v/ui5-lib-hotkeys?label=npmx.dev&color=0a0a0a" alt="npmx"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://openui5.org/"><img src="https://img.shields.io/badge/OpenUI5-1.136%20LTS-green.svg" alt="UI5"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript"></a>
</p>

<h1 align="center">ui5-lib-hotkeys</h1>

> Part of the [ui5-keyboard](../../README.md) monorepo. See also: [ui5-lib-kiosk-keyboard](../kiosk-keyboard/README.md) and [kiosk-keyboard-webc](../kiosk-keyboard-webc/README.md).

Declarative keyboard shortcut management for SAPUI5/OpenUI5 applications.

> [!IMPORTANT]
> **UI5 compatibility**
> Declared floor: UI5 1.136, a long-term-maintenance (LTS) release and the lowest version SAP's UI5 tooling accepts in `manifest.json`. The package is built, type-checked, and tested against 1.136.
> True implementation floor: UI5 1.120. The library only uses APIs available since 1.120 (`DataType.registerEnum()`, `Lib.init({ apiVersion: 2 })`), so apps pinned to an older LTS down to 1.120 work too.
> `Lib.init()` is available from 1.118, so it does not raise the floor.

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
    - [Groups and Lifecycle](#groups-and-lifecycle)
    - [Scope Stacking](#scope-stacking)
    - [Popup Overlay Pattern](#popup-overlay-pattern)
    - [Router Integration (Group-Level)](#router-integration-group-level)
    - [FLP Component Pattern](#flp-component-pattern)
  - [Scope Management](#scope-management)
  - [Router Integration](#router-integration)
  - [Unhandled Key Callback](#unhandled-key-callback)
  - [Target Elements](#target-elements)
  - [Suspend Guard](#suspend-guard)
- [Sequences](#sequences)
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

Install from npm:

```bash
npm install ui5-lib-hotkeys
```

In this monorepo, dependencies are managed via npm workspaces (`npm install` at the root).

The package ships:

- the UI5 source project (`src/`, `ui5.yaml`) for source-first development
- the prebuilt distributable under `dist/resources/ui5/hotkeys/`
- build metadata under `dist/.ui5/build-manifest.json`

That gives you 3 supported consumption modes. No project shim is required.

Before choosing a mode, declare the library in your app `manifest.json`:

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

Ensure your app's `minUI5Version` (under `sap.ui5.dependencies`) is at least **1.136**, the libraries' declared LTS floor. The code only needs 1.120, so an app pinned to an older LTS down to 1.120 also works.

### 1. Installed package + UI5 Tooling (default)

Recommended for published/runtime usage.

Install the package, keep the library in `manifest.json`, and let UI5 Tooling resolve it from `node_modules`.

```bash
npm install ui5-lib-hotkeys
```

If your app build should copy the library resources into the app `dist/`, add the UI5 project name to `builder.settings.includeDependency`:

```yaml
builder:
  settings:
    includeDependency:
      - ui5.hotkeys
```

> [!NOTE]
>
> - Use the UI5 project name `ui5.hotkeys` here, not the npm package name `ui5-lib-hotkeys`.
> - `includeDependency` is a build concern. `ui5 serve` can resolve the installed UI5 dependency without it.
> - The packaged build manifest exists so the distributable can be reused as a build result in dist-based setups instead of always rebuilding from source.

If you deploy the built app to a plain static server while bootstrapping UI5 from CDN, also map the library namespace to the copied `resources/` folder:

```html
<script
  id="sap-ui-bootstrap"
  src="https://sdk.openui5.org/resources/sap-ui-core.js"
  data-sap-ui-resource-roots='{
    "my.app": "./",
    "ui5.hotkeys": "./resources/ui5/hotkeys/"
  }'
  data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
  data-sap-ui-async="true"
></script>
```

### 2. Source package + UI5 Tooling transpilation

Recommended for monorepos and local development when you want to work against the library source instead of the prebuilt distributable.

Enable dependency transpilation in both the build task and dev server middleware:

```yaml
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        transpileDependencies: true # source-mode only: transpiles the library's shipped src/*.ts (dist needs none)
        transformTypeScript:
          allowDeclareFields: true # match the library build; keeps the TS controls' typed class fields
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
```

> [!NOTE]
>
> - No `framework.libraries` entry is required for `ui5.hotkeys`; this is a custom UI5 dependency, not a framework library.
> - Keep using the `manifest.json` dependency shown above.
> - If your app build should include the library resources in its own `dist/`, keep `builder.settings.includeDependency: [ui5.hotkeys]` in addition to the transpile setup.

### 3. Static middleware escape hatch

Use this when you want explicit runtime serving from the dependency's distributable and do not want the dependency to participate in your app's UI5 dependency resolution.

```bash
npm install -D ui5-middleware-servestatic
```

```yaml
server:
  customMiddleware:
    - name: ui5-middleware-servestatic
      afterMiddleware: compression
      mountPath: /resources/ui5/hotkeys/
      configuration:
        npmPackagePath: ui5-lib-hotkeys/dist/resources/ui5/hotkeys
```

Notes:

- This is mainly a dev-server/runtime option.
- If you need the library resources inside the app build output as well, prefer mode 1 with `includeDependency`, or copy the resources explicitly as part of your deployment process.

Lazy loading via `"lazy": true` and `Lib.load()` is supported but typically unnecessary; the library is lightweight (no CSS, no heavy dependencies) and best loaded eagerly at app startup.

## Quick Start

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

// In your Component.init():
const manager = new HotkeyManager();

// Create a group and wire up router integration
const hotkeys: RegistrationGroup = manager.createGroup();
hotkeys.enableRouterIntegration(this.getRouter());

// Register a global shortcut
hotkeys.register(
  "Mod+S",
  (event) => {
    // Save logic - Cmd+S on Mac, Ctrl+S on Windows/Linux
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

// Clean up everything in one call (e.g., in Component.exit)
manager.destroy();
```

## API Stability

Recommended stable consumer imports:

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type Router from "sap/ui/core/routing/Router";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type KeyStateTracker from "ui5/hotkeys/KeyStateTracker";
import type HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";
import { formatForDisplay } from "ui5/hotkeys/format";
import { ConflictBehavior, GLOBAL_SCOPE, UnhandledReason } from "ui5/hotkeys/library";
import type { Hotkey, KeyboardDispatchGuard } from "ui5/hotkeys/types";
```

`HotkeyRecorder` is exported as a type and returned by `manager.createRecorder()`; its constructor is internal. `manager.getKeyStateTracker()` returns a `KeyStateTrackerApi` (the read-only tracker interface in `ui5/hotkeys/types`); the backing `KeyStateTracker` class is constructed internally.

Advanced modules are available but may change without a semver-stable guarantee: anything under `ui5/hotkeys/internal/*` is internal-only, and the re-export entry points (`ui5/hotkeys/parse`, `ui5/hotkeys/match`, `ui5/hotkeys/platform`, `ui5/hotkeys/validate`, `ui5/hotkeys/constants`) are non-stable, with `ui5/hotkeys/format` the supported exception.

## HotkeyManager

The central manager that owns all keyboard shortcut registrations, DOM listeners, and scope state.

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = new HotkeyManager();
```

| Method                                 | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `register(hotkey, callback, options?)` | Register a shortcut or sequence (space-separated keys), returns a handle     |
| `createGroup()`                        | Create a registration group for collective cleanup                           |
| `pushScope(scopeId)`                   | Push a scope onto the stack                                                  |
| `popScope(scopeId)`                    | Pop the top scope (ID must match current top)                                |
| `getActiveScope()`                     | Get the current top-of-stack scope                                           |
| `getScopeStack()`                      | Get a snapshot of the full scope stack (bottom-to-top)                       |
| `resetToGlobalScope()`                 | Pop all non-global scopes in one call                                        |
| `getRegistrations()`                   | Get all active registrations (hotkeys and sequences)                         |
| `getRegistrationsForScope(scopeId)`    | Filter registrations by scope (hotkeys and sequences)                        |
| `findRegistrations(predicate)`         | Find registrations matching a predicate function                             |
| `getPlatform()`                        | Get the detected platform                                                    |
| `suspendDispatch(reason?)`             | Suspend dispatch, returns a guard handle                                     |
| `isDispatchSuspended()`                | Whether dispatch is currently suspended                                      |
| `createRecorder(options)`              | Create a HotkeyRecorder instance                                             |
| `getKeyStateTracker()`                 | Access the held-key state tracker                                            |
| `setUnhandledHandler(callback)`        | Set callback for unhandled key events                                        |
| `addGenericRootId(id)`                 | Register an element ID as a generic focus root                               |
| `removeGenericRootId(id)`              | Remove a previously registered generic root ID                               |
| `destroy()`                            | Full teardown: removes DOM listeners, finalizes all groups, clears all state |

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
  },
);
```

### Registration Options

| Option             | Type                                         | Default        | Description                                                                                      |
| ------------------ | -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `enabled`          | `boolean \| () => boolean`                   | `true`         | Whether the registration is active. Functions are evaluated on every keypress.                   |
| `preventDefault`   | `boolean`                                    | `true`         | Call `event.preventDefault()` on match                                                           |
| `stopPropagation`  | `boolean`                                    | `true`         | Call `event.stopPropagation()` on match                                                          |
| `ignoreInputs`     | `boolean \| "auto"`                          | `"auto"`       | Suppress in text fields. `"auto"` suppresses single keys but allows Ctrl/Meta combos and Escape. |
| `scope`            | `string`                                     | `"__global__"` | Scope this hotkey belongs to. Use `GLOBAL_SCOPE` constant. Must be non-empty if provided.        |
| `description`      | `string`                                     | `""`           | Human-readable description for cheatsheets                                                       |
| `ignoreRepeat`     | `boolean`                                    | `true`         | Ignore held-key repeat events                                                                    |
| `suppressInPopups` | `boolean`                                    | `true`         | Suppress when a UI5 popup (dialog or popover) is open                                            |
| `conflictBehavior` | `ConflictBehavior`                           | `"warn"`       | How to handle duplicate registrations                                                            |
| `target`           | `Element \| (() => Element \| null) \| null` | `null`         | Bind to a specific element instead of the document                                               |
| `timeout`          | `number`                                     | `1000`         | Sequences only: timeout in ms between keys before the sequence resets                            |
| `onPending`        | `SequencePendingCallback`                    | -              | Sequences only: callback fired after each intermediate key match with progress info              |

### Registration Handle

`register()` returns a handle with lifecycle control and live updates:

```ts
const handle = manager.register("Mod+S", saveHandler, { description: "Save" });

handle.id; // "hk_1" - unique registration ID
handle.isActive; // true - not yet unregistered

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
  this._hotkeys.register("G I", handler, { scope: "main" });
}

onExit(): void {
  this._hotkeys.destroyAll(); // Unregisters all tracked handles
}
```

| Property / Method            | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `register()`                 | Delegates to `manager.register()`, tracks handle              |
| `enableRouterIntegration(r)` | Attach router-based scope management to this group            |
| `getRegistrations()`         | Get this group's active registrations (hotkeys and sequences) |
| `destroyAll()`               | Unregister all tracked handles and detach router (idempotent) |
| `size`                       | Number of currently active registrations                      |
| `isDestroyed`                | Whether `destroyAll()` has been called                        |

Handles returned by the group are normal `HotkeyRegistrationHandle`. `setOptions()`, `unregister()`, and all properties work as usual. Individually unregistering a handle decrements the group's `size`.

Group-level introspection can drive scoped shortcut UIs:

```ts
const registrationsForThisController = this._hotkeys.getRegistrations();

// Example: render a quick hint list (includes both hotkeys and sequences)
registrationsForThisController.forEach((entry) => {
  console.log(entry.normalizedHotkey, entry.description);
});
```

Each entry returned by `getRegistrations()`, `getRegistrationsForScope()`, and `findRegistrations()` is a readonly `HotkeyRegistrationInfo`:

| Field                                                                   | Notes                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`, `hotkey`, `normalizedHotkey`, `scope`, `description`              | Identity and registration metadata                                 |
| `enabled`                                                               | Resolved to the current value (the `enabled` closure is evaluated) |
| `preventDefault`, `stopPropagation`, `ignoreRepeat`, `suppressInPopups` | Resolved dispatch flags                                            |
| `ignoreInputs`                                                          | `boolean \| "auto"`                                                |
| `conflictBehavior`                                                      | `ConflictBehavior`                                                 |
| `hasTarget`                                                             | Whether a target is bound (flag only, not the DOM reference)       |
| `sequence`                                                              | The sequence steps (`string[]`), or `null` for single-key hotkeys  |
| `timeout`                                                               | Sequence step timeout in ms, or `null` for single-key hotkeys      |

Use `sequence !== null` (or `timeout !== null`) to tell sequence registrations apart from single-key hotkeys.

#### Groups and Lifecycle

Each lifecycle owner should create exactly one group and destroy it in its corresponding teardown hook. Do not reuse groups across instances.

| Lifecycle owner  | Create group in | Destroy group in                   |
| ---------------- | --------------- | ---------------------------------- |
| Controller       | `onInit()`      | `onExit()`                         |
| Component        | `init()`        | `exit()` (via `manager.destroy()`) |
| Dialog / Popover | `afterOpen`     | `afterClose`                       |

- **Controller (`onInit`/`onExit`)**: create one group in `onInit()`, register through it, call `destroyAll()` in `onExit()`.
  This only unregisters entries that were created through that specific group; other groups stay active.
- **View lifecycle**: if a view/controller is recreated by routing, do not reuse old groups/handles across instances.
- **Component lifecycle**: call `manager.destroy()` in `Component.exit()`. This finalizes all groups, removes all DOM listeners, and clears all state.

#### Reducing Boilerplate with a Controller Extension

If multiple controllers repeat the same `createGroup` / `destroyAll` pattern, wrap the registration in a UI5 `ControllerExtension` that creates the group in `onInit()` and calls `destroyAll()` in `onExit()`, so each controller reuses it without its own teardown code. This is an app-level pattern, not shipped by the library, so it adds no bundle cost to consumers who don't need it.

#### Scope Stacking

The scope stack controls which hotkeys are active. The global scope is always at the bottom and cannot be pushed or removed. Each `pushScope()` adds a layer on top; `popScope()` removes it.

```
                  ┌─────────────────┐
  top of stack -> │ confirmDialog   │  <- active scope
                  ├─────────────────┤
                  │ detail          │
                  ├─────────────────┤
  always present  │ __global__      │  <- fallthrough target
                  └─────────────────┘
```

Matching order: the dispatcher checks the topmost scope first. If no scoped handler matches the key, global-scope handlers fire as a fallback. In the diagram above, a hotkey registered with `scope: "confirmDialog"` fires first; if no match is found there, global handlers are checked. Handlers in `"detail"` do not fire while `"confirmDialog"` is on top.

Scope stack guards:

- `pushScope("__global__")` throws. The global scope is always present and must not be pushed manually.
- `pushScope(x)` where `x` is already the top of the stack throws. This catches duplicate pushes from router integration firing twice for the same route.

#### Popup Overlay Pattern

Dialogs and popovers typically push a dedicated scope so their hotkeys shadow the parent view. When the popup closes, removing the scope restores the parent's hotkeys automatically.

```ts
// In a controller that opens a confirmation dialog:
onOpenConfirmDialog(): void {
  this._confirmGroup = this.getHotkeyManager().createGroup();

  this.getHotkeyManager().pushScope("confirmDialog");

  this._confirmGroup.register("Escape", () => this.onCloseConfirmDialog(), {
    scope: "confirmDialog",
    description: "Close confirmation dialog",
  });
  this._confirmGroup.register("Enter", () => this.onConfirm(), {
    scope: "confirmDialog",
    description: "Confirm action",
  });
}

onCloseConfirmDialog(): void {
  this._confirmGroup.destroyAll();
  this.getHotkeyManager().popScope("confirmDialog");
  // Parent view's hotkeys are now active again
}
```

#### Router Integration (Group-Level)

Router integration is configured on a `RegistrationGroup`, not on the manager. The group's `destroyAll()` automatically detaches the router listener, so cleanup is guaranteed.

```ts
// Component.init()
const manager = new HotkeyManager();
this._hotkeys = manager.createGroup();
this._hotkeys.enableRouterIntegration(this.getRouter());
this.getRouter().initialize();
```

When the user navigates between routes, the router handler automatically resets to global scope and pushes the matched route name. Dialog scopes still require manual `pushScope`/`popScope` since they are not route-based.

Calling `enableRouterIntegration()` again (e.g., on Component re-entry in FLP) silently replaces the previous router.

#### FLP Component Pattern

In the Fiori Launchpad, Components are destroyed and recreated on each app navigation. The `HotkeyManager` should be created in `init()` and destroyed in `exit()`, giving each app session a fresh instance with clean state.

```ts
import UIComponent from "sap/ui/core/UIComponent";
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

export default class Component extends UIComponent {
  private _hotkeyManager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;

  init(): void {
    super.init();

    this._hotkeyManager = new HotkeyManager();
    this._hotkeys = this._hotkeyManager.createGroup();
    this._hotkeys.enableRouterIntegration(this.getRouter());

    this._hotkeys.register("Mod+S", () => this.save(), {
      description: "Save",
    });

    this.getRouter().initialize();
  }

  getHotkeyManager(): HotkeyManager {
    return this._hotkeyManager;
  }

  exit(): void {
    this._hotkeyManager.destroy();
  }
}
```

> [!WARNING]
> Never hold onto stale manager references across Component sessions. Each `init()` / `exit()` cycle creates and destroys a fresh `HotkeyManager`. Controllers should always access the manager via `this.getOwnerComponent().getHotkeyManager()` rather than caching it in module-level state.

### Scope Management

The scope stack determines which hotkeys are active. Global hotkeys always fire as a fallback.

```ts
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";

// Register same key in different scopes
manager.register("Escape", () => closeApp(), { scope: GLOBAL_SCOPE });
manager.register("Escape", () => closeDialog(), { scope: "confirmDialog" });
manager.register("Escape", () => exitEditMode(), { scope: "editor" });

// Push a scope - it becomes the active scope
manager.pushScope("editor");
// Now pressing Escape calls exitEditMode()
// Global Escape is suppressed (scoped match takes priority)

// Open a dialog on top
manager.pushScope("confirmDialog");
// Now pressing Escape calls closeDialog()

// Close the dialog
manager.popScope("confirmDialog");
// Back to editor - Escape calls exitEditMode() again

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
> // Mod+S still fires - no editor-scoped Mod+S shadows it
> ```

### Router Integration

Router integration is configured on a `RegistrationGroup`, not on the manager. See [Router Integration (Group-Level)](#router-integration-group-level) for setup and examples.

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
// Scopes still apply - both target and scope must match.
```

> **Focus fallback (Escape only):**
>
> Some browsers and UI5 rendering transitions
> move focus to a generic root node (body, UIArea container) before dispatching
> the `keydown` event. For `Escape`, the manager reconstructs the composed path
> from the most recently focused element so that target-scoped registrations
> still fire. This fallback is one-shot (consumed after a single dispatch) and
> expires after 1200 ms. Other keys are not affected by this behavior.

### Suspend Guard

Temporarily suspend all hotkey and sequence dispatch (e.g., during onboarding overlays or guided tours):

```ts
// Acquire a guard - dispatch is suspended while any guard is active
const guard = manager.suspendDispatch("onboarding-overlay");

// Key state tracking continues normally.
// Browser defaults are NOT suppressed (no preventDefault).
// Unhandled callback fires with reason "suspended".

// Inspect or release the guard
guard.isActive; // true while held, false once released
guard.release(); // idempotent - safe to call multiple times

// Nested guards: all must be released before dispatch resumes
const g1 = manager.suspendDispatch("outer");
const g2 = manager.suspendDispatch("inner");
g1.release(); // still suspended - g2 active
g2.release(); // dispatch resumes
```

## Sequences

Multi-key sequences like Vim-style `G` then `E` for "go to editor". Sequences use the same `register()` API as single hotkeys: pass a space-separated string instead of a single key:

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = new HotkeyManager();

// Register a 2-key sequence (space-separated)
manager.register(
  "G E",
  (event) => {
    router.navTo("editor");
  },
  { description: "Go to editor", timeout: 1000 },
);

// Modifier sequences work too
manager.register(
  "Ctrl+K Ctrl+S",
  (event) => {
    saveAll();
  },
  { description: "Save all (VS Code style)" },
);

// Per-registration progress callback - dies with the registration
manager.register(
  "G I",
  (event) => {
    router.navTo("inbox");
  },
  {
    description: "Go to inbox",
    onPending: (info) => {
      statusBar.setText(`Sequence: ${info.completedSteps}/${info.totalSteps}  - next: ${info.nextKey}`);
    },
  },
);
```

**Options**: `description`, `timeout` (default 1000ms), `scope`, `enabled`, `ignoreInputs` (default `"auto"`, suppresses single-key steps in text fields, but allows Ctrl/Meta combos and Escape), `suppressInPopups` (suppress when a UI5 dialog/popover is open), `onPending` (per-registration progress callback).

> [!NOTE]
> `scope` must be a non-empty string when provided.
> Uses HotkeyManager's scope stack: sequences respect the active scope.

## KeyStateTracker

Track which keys are currently held down (useful for "hold Shift to multi-select" patterns):

```ts
import type { KeyStateTrackerApi } from "ui5/hotkeys/types";

const tracker: KeyStateTrackerApi = manager.getKeyStateTracker();

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

// Clean up (remove callback - tracker lifecycle is owned by the manager)
tracker.setChangeCallback(null);
```

The tracker is owned by `HotkeyManager` and shares its lifecycle: it is created and destroyed automatically. Access it via `manager.getKeyStateTracker()`. The `KeyStateTracker` class is exported for type declarations but its constructor is internal.

> [!NOTE]
> Includes a **macOS stuck-key fix**: when a modifier is released, all non-modifier keys are cleared. This prevents ghost keys when macOS swallows keyup events (e.g., Cmd+Tab).

## HotkeyRecorder

Capture a keyboard shortcut from user input, for "press a key to set shortcut" settings UIs:

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
> Not a singleton: create one per settings row via `manager.createRecorder()`. The `HotkeyRecorder` class is exported for type declarations but its constructor is internal.

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

**Browser blocklist** (24 entries): Ctrl+L, Ctrl+N, Ctrl+T, Ctrl+W, F5, F11, F12, Tab, etc.

**SAP blocklist** (15 entries): Ctrl+S (Save), Ctrl+E (Edit), Ctrl+D (Delete), F6, etc.

> [!TIP]
> Validation warnings are also automatically logged when calling `manager.register()`.

**Common validation messages for invalid hotkey strings** (the strings returned in `validateHotkey().errors`):

| Input          | `validateHotkey().errors`                                         |
| -------------- | ----------------------------------------------------------------- |
| `""`           | `Hotkey string must not be empty`                                 |
| `"Ctrl"`       | `Invalid hotkey "Ctrl": no non-modifier key found`                |
| `"Ctrl+Shift"` | `Invalid hotkey "Ctrl+Shift": no non-modifier key found`          |
| `"Ctrl+S+X"`   | `Invalid hotkey "Ctrl+S+X": unexpected segment "X" after key "S"` |

`assertValidHotkey` throws `Invalid hotkey "<input>": <errors joined by "; ">`; e.g. `assertValidHotkey("")` throws `Invalid hotkey "": Hotkey string must not be empty`.

Unknown key names (e.g. `"Ctrl+Foo"`) produce a validation warning but do not throw; they are allowed for forward compatibility.

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
formatForDisplay("Meta+K", Platform.Windows); // "Win+K" (Meta renders as "Win" on Windows/Linux)
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

// ConflictBehavior - strategy for duplicate registrations
ConflictBehavior.Warn; // "warn" - log warning, allow both (default)
ConflictBehavior.Error; // "error" - throw, prevent new registration
ConflictBehavior.Replace; // "replace" - unregister existing, register new
ConflictBehavior.Allow; // "allow" - allow silently, no feedback

// UnhandledReason - why a key event was not handled
UnhandledReason.NoMatch; // "no_match"
UnhandledReason.TargetMismatch; // "target_mismatch" - key matched but target element was not in composedPath
UnhandledReason.Disabled; // "disabled"
UnhandledReason.InputSuppressed; // "input_suppressed"
UnhandledReason.PopupSuppressed; // "popup_suppressed"
UnhandledReason.RepeatIgnored; // "repeat_ignored"
UnhandledReason.Suspended; // "suspended" - dispatch was suspended via suspendDispatch()

// Platform - detected platform
Platform.Mac; // "mac"
Platform.Windows; // "windows"
Platform.Linux; // "linux"

// GLOBAL_SCOPE - the default scope constant (instead of hardcoding "__global__")
GLOBAL_SCOPE; // "__global__"
```

The enums are TypeScript string enums registered with UI5 via `DataType.registerEnum`, so their members compare as plain string literals at runtime.

### ConflictBehavior Examples

```ts
// Default: warn but keep both registered. Only the first (in registration
// order) fires; the duplicate is shadowed unless the first is removed or disabled.
manager.register("Mod+S", saveHandler);
manager.register("Mod+S", otherHandler); // logs warning, saveHandler keeps priority

// Strict: throw on conflict (prevents accidental duplicates)
manager.register("Mod+S", saveHandler, { conflictBehavior: ConflictBehavior.Error });
manager.register("Mod+S", otherHandler, { conflictBehavior: ConflictBehavior.Error });
// → throws Error('Hotkey "Control+S" is already registered in scope "__global__" (id: hk_N).')

// Replace: new registration replaces existing (useful for overriding defaults)
manager.register("Mod+S", saveHandler);
manager.register("Mod+S", betterSaveHandler, { conflictBehavior: ConflictBehavior.Replace });
// saveHandler is unregistered, only betterSaveHandler remains

// Allow: silently allow duplicates (no warning logged)
manager.register("Mod+S", handlerA, { conflictBehavior: ConflictBehavior.Allow });
manager.register("Mod+S", handlerB, { conflictBehavior: ConflictBehavior.Allow });
// Both stay registered, no console output; only handlerA fires (first wins)
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

- [Architecture & Internals](../../docs/hotkeys/ARCHITECTURE.md): two-pass matching, scope stack, listener design
- [Multi-key Sequence Design](../../docs/hotkeys/SEQUENCES.md): how the sequence system works
- [Alternatives Research](../../docs/hotkeys/ALTERNATIVES-RESEARCH.md): comparison with other keyboard shortcut approaches
- [UI5 Event Handling Deep Dive](../../docs/shared/UI5-EVENT-HANDLING-DEEP-DIVE.md): how UI5 processes keyboard events

## Troubleshooting

**Hotkey doesn't fire:**

1. Check if the correct scope is active: use `manager.getActiveScope()`
2. Use `setUnhandledHandler()` to see why keys are not matching (disabled, input suppressed, popup suppressed, etc.)
3. If focus is in a text field, single-key hotkeys are suppressed by default (`ignoreInputs: "auto"`). Use `Ctrl`/`Mod` combos or set `ignoreInputs: false`
4. Check if the registration is disabled: `handle.setOptions({ enabled: true })`
5. Check for popup suppression: `suppressInPopups` defaults to `true`, blocking hotkeys when a dialog is open. Set `suppressInPopups: false` to allow a hotkey through popups

**Hotkey fires the wrong handler:**

- The active scope's handler always wins over global. Use `getRegistrations()` to inspect all active registrations and their scopes
- With router integration, the scope matches the route name. Check that your route names match your scope strings

**Hotkeys stopped firing unexpectedly:**

- Check if dispatch is suspended: `manager.isDispatchSuspended()`. A suspend guard may not have been released
- Check if a recorder is active: while recording, all hotkey dispatch is blocked

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
