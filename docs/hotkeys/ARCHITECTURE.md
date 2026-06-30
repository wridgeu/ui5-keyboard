# Architecture

This document describes the internal architecture, design decisions, and edge case handling of the `ui5.hotkeys` library.

## Module Overview

The library is split into focused, single-responsibility modules. The full source tree, with a one-line description per module, is under [Project Layout](#project-layout).

`HotkeyManager` is the primary entry point. The package also exposes additional public APIs (`RegistrationGroup`, `KeyStateTracker`, `HotkeyRecorder`, and selected utility modules). `KeyStateTracker` and `HotkeyRecorder` are accessed via factory methods (`manager.getKeyStateTracker()`, `manager.createRecorder()`). Their constructors are internal. Anything under `ui5/hotkeys/internal/*` remains internal-only.

Some top-level entry points are importable but not part of the semver-stable consumer contract. This currently includes utility/helper modules (`parse.ts`, `match.ts`, `platform.ts`, `validate.ts`, `constants.ts`). `format.ts` is the supported exception and remains part of the stable consumer surface. Higher-level implementation modules (for example `SequenceManager.ts`) are consumed via `HotkeyManager` and are not a supported direct import surface.

## UI5 Integration

### Library Initialization

The library uses the modern `Lib.init()` API with `apiVersion: 2`, not the deprecated `sap.ui.core.library.initLibrary()`. It declares a dependency on `sap.ui.core` only. There is no CSS, no i18n, and no controls. This is a pure logic library.

### Class Hierarchy

`HotkeyManager` extends `sap/ui/base/Object` (also known as `BaseObject`), not `ManagedObject`. This is deliberate:

- `BaseObject` provides `destroy()` lifecycle and `getMetadata()` without the overhead of ManagedObject's property/aggregation system.
- BaseObject does not call `init()` during construction, so class field initializers work safely.
- The library has no need for data binding, properties, or aggregations.

### Instance Lifecycle

`HotkeyManager` is a regular class with a public constructor. There is no singleton. The Component creates it in `init()` and destroys it in `exit()`. Controllers access it via `getOwnerComponent().getHotkeyManager()`. `destroy()` tears down all DOM listeners, finalizes all groups, and clears all internal state.

## Event Handling

### Listener Setup

All DOM listeners are owned by a centralized `EventDispatcher` (internal class, created by `HotkeyManager`). Three listeners are attached to `window`:

```ts
window.addEventListener("keydown", handler, true); // capture phase
window.addEventListener("keyup", handler, true); // capture phase
window.addEventListener("blur", handler); // bubble phase
```

Using `window` capture ensures the library sees events before any `document` or element-level listeners. This is critical for `preventDefault()`, `stopPropagation()`, and the interceptor mechanism (used by `HotkeyRecorder`).

> **Focus listeners live on the HotkeyManager side, not EventDispatcher.** The `focusin`/`focusout` listeners are attached to `document` in the capture phase and owned by `FocusFallbackTracker`, a helper that `HotkeyManager` instantiates and holds. This is intentional: focus state is consumed exclusively by HotkeyManager's target-scoped matching logic (the focus-path fallback), so it stays co-located with the consumer rather than being routed through the dispatch pipeline.

### Dispatch Pipeline

The EventDispatcher runs a deterministic 7-step pipeline on each `keydown`:

```
keydown event (window capture)
  │
  ├─ Step 1: Key state tracking (KeyStateTracker.processKeyDown)
  │           Always runs, even for modifiers, IME, suspended state
  │
  ├─ Step 2: Interceptor check (e.g., HotkeyRecorder)
  │           If interceptor returns true → event consumed, pipeline stops
  │
  ├─ Step 3: Pre-filter
  │           Skip if: IME composition, modifier-only, AltGr on Windows
  │
  ├─ Step 4: Suspend guard check
  │           If any guard active → emit unhandled(Suspended), stop
  │
  ├─ Step 5: Hotkey dispatch (HotkeyManager._processHotkeys → HotkeyMatcher)
  │           Pass 1: matcher.matchTargeted() via composedPath() (active scope → global)
  │           Pass 2: matcher.matchUntargeted() (active scope → global)
  │
  ├─ Step 6: Sequence dispatch (SequenceManager.processKeyEvent)
  │           Returns true if full match OR partial advance
  │
  └─ Step 7: Unhandled emission
             If neither step 5 nor 6 consumed → emit unhandled callback
```

### Suspend Guard

`manager.suspendDispatch(reason?)` returns an RAII-style `KeyboardDispatchGuard`. While any guard is active, steps 5-7 are skipped and unhandled fires with `Suspended` reason. Guards are reference-counted; all must be released before dispatch resumes. `release()` is idempotent. Guards are invalidated on `destroy()`.

Each registration is checked against the following guards before the callback fires:

1. **matchesKeyboardEvent**: the actual key/modifier comparison (checked first for efficiency)
2. **enabled**: must be `true` (or the guard function must return `true`)
3. **ignoreRepeat**: skip if `event.repeat` is true and ignoreRepeat is on
4. **ignoreInputs**: skip if the target is an input and the option says to suppress
5. **suppressInPopups**: skip if a popup (dialog or popover) is open and the option is on

### Two-Pass Matching

The matching algorithm lives in `HotkeyMatcher` (`internal/hotkey-matcher.ts`); `HotkeyManager._processHotkeys` only orchestrates, calling `matchTargeted()` then `matchUntargeted()`. The two-pass approach is the core of the scope system. Target-scoped registrations are checked first:

1. All target-scoped registrations whose target appears in the event's `composedPath()` are checked, innermost first (active scope → global scope).
2. If no target match stopped propagation, all untargeted registrations are checked (active scope → global scope).

A target-scoped match with `stopPropagation: true` (the default) prevents untargeted registrations from firing.

### Target-Scoped Matching via composedPath()

Target-scoped registrations use `event.composedPath()` for membership checks instead of per-element DOM listeners. The matching follows scope-first, innermost-first semantics:

1. **Active scope pass**: iterate `composedPath()` from index 0 (innermost) outward. For each node, check if it has target-scoped registrations in the active scope's bucket. The first (innermost) match wins.
2. **Global scope pass**: only if no active-scope target matched and active scope is not `GLOBAL_SCOPE`.
3. **Skip-reason pass**: for unhandled tracking, iterate off-path targets whose key combo matches the event and record `TargetMismatch`.

For nested targets with the same key, only the **innermost** matching target fires.

Registrations within each scope are matched in FIFO order (first registered, first matched).

### Element-Id Fallback for Rerendered Targets

Target-scoped registrations are indexed twice (see `internal/registration-index.ts`): by element object identity and, when the element has an `id`, by that id. UI5 rerenders replace DOM nodes instead of mutating them, so a registration bound to the old node would otherwise go dead after the first rerender. During matching, both indexes are consulted for each `composedPath()` node and their hits are merged: when a node in the path carries the same `id` as a registered (possibly stale, detached) target, the registrations indexed under that id still fire.

Limitations:

- The index key is the element's `id` at registration time. If the `id` attribute is mutated afterwards, the entry under the old id is orphaned and persists until `unregister()` removes the registration.
- Elements without an `id` are matched by object identity only and do not survive node replacement.

## Scope Stack

A **scope** is an arbitrary string identifier that groups related hotkeys by context. In practice, scopes map to UI5 application concepts:

- **Route names**: view-level scopes like `"main"` or `"detail"` (managed automatically by router integration)
- **Dialog IDs**: dialog-level scopes like `"confirmDialog"` or `"settingsDialog"` (managed manually via `pushScope`/`popScope`)
- **Fragment or component IDs**: any string that meaningfully groups a set of shortcuts

Scopes are not a UI5 framework concept; they are a library-level abstraction. The global scope (`"__global__"`) is always present at the bottom of the stack.

The scope stack is a simple array used as a LIFO stack:

```
Initial state:          [__global__]
pushScope("main"):      [__global__, main]
pushScope("dialog"):    [__global__, main, dialog]     <- active: dialog
popScope("dialog"):     [__global__, main]              <- active: main
resetToGlobalScope():   [__global__]                    <- active: global
```

The global scope is always at the bottom and cannot be popped.

`popScope(scopeId)` requires a scope ID that must match the current top of the stack. If the provided ID does not match, an error is thrown. This catches scope management bugs early by failing fast rather than silently producing incorrect behavior.

`resetToGlobalScope()` removes all non-global scopes in one call, which is useful when navigating between views where the entire scope context changes.

### Router Integration

Router integration is **purely additive**. The `HotkeyManager` works without any router: the scope stack, `pushScope()`/`popScope()`, two-pass matching, and the entire dispatch pipeline function independently. Router integration is a convenience that automates scope transitions for route changes.

`group.enableRouterIntegration(router)` (on `RegistrationGroup`) attaches a handler to the router's `beforeRouteMatched` event. On each route change:

1. The scope stack is reset to global via `resetToGlobalScope()`.
2. The new route's name is pushed as the active scope.

This removes the need for manual `pushScope`/`popScope` calls in route-based applications. Each route name becomes a scope ID, and controllers register their hotkeys with `scope: "routeName"`.

Applications that do not use routing (reuse components, embedded components, non-routed UIs) use `pushScope()`/`popScope()` directly, or register everything on the global scope.

Router integration lives on `RegistrationGroup`, not on `HotkeyManager`. This ties the router listener to the group's lifecycle: `destroyAll()` automatically detaches it. Since `HotkeyManager.destroy()` finalizes all groups, router cleanup is guaranteed on either path. Calling `enableRouterIntegration()` again on the same group silently replaces the previous router listener.

## Hotkey Parsing

### Input Format

Hotkey strings use `+` as the separator between modifiers and key:

```
"Mod+S"           -> platform-aware save
"Ctrl+Shift+K"    -> explicit modifiers
"F5"              -> single key, no modifiers
"Ctrl++"          -> Ctrl and the literal "+" key
"Escape"          -> single key
```

### Modifier Normalization

All modifier names are normalized to their canonical form:

| Input                    | Canonical                                 |
| ------------------------ | ----------------------------------------- |
| `Ctrl`, `Control`        | `Control`                                 |
| `Cmd`, `Command`, `Meta` | `Meta`                                    |
| `Option`, `option`       | `Alt`                                     |
| `Mod`                    | `Meta` on mac, `Control` on windows/linux |

### Key Normalization

Keys are normalized via an alias map:

| Input                         | Normalized                                        |
| ----------------------------- | ------------------------------------------------- |
| `Esc`                         | `Escape`                                          |
| `Return`                      | `Enter`                                           |
| `Del`                         | `Delete`                                          |
| `Up`, `Down`, `Left`, `Right` | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` |
| `f5`                          | `F5` (function keys are uppercased)               |
| `a`                           | `A` (single letters are uppercased)               |

The canonical output format places modifiers in a fixed order (Control, Alt, Shift, Meta) followed by the key.

## KeyboardEvent Matching

`matchesKeyboardEvent(event, parsed)` performs the actual comparison between a browser `KeyboardEvent` and a `ParsedHotkey` structure.

### Exact Modifier Match

All four modifier flags must match exactly. If the parsed hotkey specifies Ctrl+S, the event must have `ctrlKey: true` and all other modifier keys (`shiftKey`, `altKey`, `metaKey`) must be `false`. This prevents Ctrl+Shift+S from accidentally matching a Ctrl+S registration.

### Key Matching with Fallback

The primary match uses `event.key`:

- Single characters: case-insensitive comparison
- Special keys (Escape, Enter, F1-F12, etc.): exact match

When `event.key` does not match, the matcher falls back to `event.code`. This handles two specific cross-platform issues:

**macOS Option+letter:**

Pressing Option+D on macOS produces `event.key = "∂"` (partial derivative symbol), but `event.code = "KeyD"`. The code fallback allows Alt+D to match correctly.

**Shift+digit:**

Pressing Shift+4 produces `event.key = "$"`, but `event.code = "Digit4"`. The code fallback allows Shift+4 to match correctly regardless of keyboard layout.

## Input Element Detection

`isInputElement(target)` determines whether an event target is an editable text field. It returns `true` for:

- `<input>` elements with text-like types: text, password, email, number, search, tel, url, date, datetime-local, month, time, week
- `<textarea>` elements
- `<select>` elements
- Any element with `contentEditable` set (checked via `element.isContentEditable`, which correctly handles inherited values)

It returns `false` for button-like input types (button, submit, reset, checkbox, radio, etc.), since these do not accept text input.

### Smart Auto Mode

When `ignoreInputs` is set to `"auto"` (the default), the library resolves the effective value per registration:

- **Ctrl/Meta combos and Escape:** `ignoreInputs` resolves to `false` (shortcut fires even in inputs). Rationale: Ctrl+S for save should work everywhere, and Escape is universally expected to dismiss/cancel.
- **Single keys and Alt/Shift-only combos:** `ignoreInputs` resolves to `true` (shortcut is suppressed in inputs). Rationale: pressing "G" in a text field should type "G", not trigger a shortcut.

## Popup Suppression

When `suppressInPopups: true` is set on a registration, the library checks whether a UI5 popup (dialog or popover) is currently open before firing the callback.

The check uses `sap.m.InstanceManager.hasOpenDialog()` and `sap.m.InstanceManager.hasOpenPopover()`, but `sap.m` may not be loaded in all applications. The library probes the module lazily:

1. On each keypress that needs the popup check, resolve `sap/m/InstanceManager` via the synchronous `sap.ui.require(name)` lookup (returns the already-loaded module, or `undefined`; never triggers a fetch).
2. If the module is available, return whether any dialog or popover is open.
3. If it is not available (`sap.m` not loaded), return `false` (no popup open).

The probe runs on every call rather than being cached, so a `sap.m` that loads later (as the application bootstraps additional libraries) is picked up immediately. This avoids a hard dependency on `sap.m` while still supporting popup detection when the module is available.

## Dialog Escape Interop

Registering an Escape handler requires care when UI5 dialogs are involved. By default, `sap.m.Dialog` closes on Escape via its own internal handler. If the library's Escape handler calls `stopPropagation()`, the dialog never sees the event and cannot close.

The recommended pattern:

```ts
// 1. Set escapeHandler on the dialog so UI5 knows Escape is handled
const dialog = new Dialog({
  escapeHandler: (promise) => promise.resolve(),
});

// 2. Register with stopPropagation: false so UI5 still processes the event
manager.register(
  "Escape",
  () => {
    closeDialog();
  },
  {
    scope: "dialog",
    preventDefault: false,
    stopPropagation: false,
  },
);
```

This lets both the library's callback and UI5's native dialog close behavior execute.

## Display Formatting

`formatForDisplay(hotkey, platform?)` produces platform-native display strings:

**macOS:** Uses modifier symbols without separators, matching native macOS conventions.

- Control -> special symbol, Option -> special symbol, Shift -> special symbol, Command -> special symbol
- Example: `"Mod+Shift+S"` on mac becomes the modifier symbols followed by `S`, all concatenated

**Windows/Linux:** Uses text labels with `+` separators, matching standard Windows conventions.

- Control -> `Ctrl`, Alt -> `Alt`, Shift -> `Shift`, Meta -> `Win`
- Example: `"Mod+Shift+S"` on windows becomes `Ctrl+Shift+S`

Special keys are also replaced with their display forms (arrow symbols, return symbol, etc.) on every platform, including Windows and Linux.

## Edge Cases

| Edge Case                                      | How It Is Handled                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| macOS Option+letter produces special character | Fallback to `event.code` for letter keys                                  |
| Shift+digit produces symbol                    | Fallback to `event.code` for digit keys                                   |
| IME composition (CJK input methods)            | Guard on `event.isComposing` and `keyCode === 229`                        |
| Key repeat from holding a key                  | `ignoreRepeat: true` checks `event.repeat`                                |
| Extra modifiers beyond what is registered      | Exact modifier match prevents false positives                             |
| Shadow DOM event target retargeting            | `event.composedPath()[0]` for true target                                 |
| contentEditable inheritance from parent        | `element.isContentEditable` property, not attribute                       |
| Scope priority                                 | Two-pass matching: active scope first, then global                        |
| Dialog Escape interop                          | `stopPropagation: false` with dialog `escapeHandler`                      |
| sap.m not loaded                               | Probe `InstanceManager` via `sap.ui.require` each call; `false` if absent |
| Router detach requires listener context        | Group passes `this` as oListener to `detachBeforeRouteMatched`            |
| Nested target-scoped same key                  | Innermost target in composedPath() wins                                   |
| Target not in composedPath()                   | UnhandledReason.TargetMismatch reported                                   |
| Dispatch suspended via guard                   | Steps 5-7 skipped, UnhandledReason.Suspended reported                     |
| Closed shadow root targets                     | composedPath() stops at boundary, no match                                |
| Detached targets                               | No identity match; a same-id node in the path matches (id index)          |
| Empty composedPath()                           | Fallback to `[event.target, document, window]`                            |
| stopPropagation on window capture              | Blocks untargeted listeners (UI5, third-party)                            |

## Project Layout

```
packages/hotkeys/
  src/
    library.ts           UI5 Lib.init() entry point, apiVersion 2
    HotkeyManager.ts     Central manager, scope stack, dispatch routing
    RegistrationGroup.ts Scoped batch registration with auto-cleanup
    KeyStateTracker.ts   Held-key state tracking
    HotkeyRecorder.ts    Keyboard shortcut recorder
    validate.ts          Validation + browser/SAP blocklists
    types.ts             All interfaces and type definitions
    constants.ts         Alias maps, display symbols, normalization
    parse.ts             Hotkey string parsing
    match.ts             KeyboardEvent matching
    internal/dom.ts      Input element detection
    platform.ts          Platform detection and Mod resolution
    format.ts            Display formatting helper (stable consumer import)
    internal/
      SequenceManager.ts   Multi-key sequence matching
      event-dispatcher.ts  Centralized DOM listener + 7-step pipeline
      dispatch-core.ts     Internal dispatch helpers
      format.ts            Display formatting implementation
      internal-token.ts    Runtime instantiation guard symbol
      scope.ts             Scope string resolution and validation
      skip-reason.ts       Internal skip-reason models
      idgen.ts             Internal ID generator
      registration-index.ts Scope/target registration index
      hotkey-matcher.ts    Two-pass targeted/untargeted matching
      conflict-resolver.ts Duplicate-registration conflict detection/resolution
      resolve-enabled.ts   Resolves the enabled option (boolean or predicate)
      runtime.ts           Lazy popup-open check
      FocusFallbackTracker.ts Document focus listeners + focus-path fallback
    manifest.json       Library manifest (descriptor schema v2.0.0)
  test/qunit/
    testsuite.qunit.ts  Test suite runner (UI5 Test Starter)
    *.qunit.ts          One test file per module
```

For the consuming demo application's structure, see [`packages/demo-app/README.md`](../../packages/demo-app/README.md).

## Additional Modules

### SequenceManager

Multi-key sequence matching (e.g., `G` then `E`). Receives pre-filtered key events from the EventDispatcher pipeline (step 6). Reads the active scope from HotkeyManager for scope-based filtering. Includes the same input-guard logic as HotkeyManager (`ignoreInputs` defaults to `"auto"`). See [SEQUENCES.md](./SEQUENCES.md).

### KeyStateTracker

Tracks which keys are currently held down. Owned by the EventDispatcher, created and destroyed as part of its lifecycle. Accessed via `manager.getKeyStateTracker()`. Receives events from the EventDispatcher pipeline (step 1), always runs, even during recording or suspension. Includes a macOS fix for stuck keys when a modifier is released (Cmd+Tab swallows the Tab keyup).

### HotkeyRecorder

Records a single keyboard shortcut from user input for "press a key" settings UIs. Created via `manager.createRecorder()`. Implements the `KeyEventInterceptor` interface. When recording, it is set as the EventDispatcher's interceptor (step 2) and blocks all subsequent pipeline steps. Multiple recorders can coexist but only one can be active at a time (starting a second recorder detaches the first).

### validate.ts

Validation utilities (`validateHotkey`, `assertValidHotkey`, `checkHotkey`) and blocklists for browser and SAP Fiori shortcuts. Validation warnings are automatically logged during `register()`.
