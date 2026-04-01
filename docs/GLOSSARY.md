# Glossary

Technical concepts used across the `ui5-lib-keyboard` libraries.

## IME (Input Method Editor)

**IME** stands for **Input Method Editor**. It is system-level software that allows typing characters from languages that have more characters than can fit on a physical keyboard, primarily Chinese, Japanese, and Korean (CJK).

### How it works

When typing with an IME:

1. The user presses multiple keys to compose a character (e.g., typing `ni` to produce 你).
2. A **composition window** appears showing candidate characters.
3. The user selects the final character (via number key, Enter, or arrow navigation).

During this process the browser fires `compositionstart`, `compositionupdate`, and `compositionend` events. Keydown events that occur during IME composition carry one of two signals:

- `event.isComposing === true` (modern browsers)
- `event.key === "Process"` or `event.keyCode === 229` (legacy fallback)

### Relevance for hotkeys

Hotkey matching must **not** interfere with IME composition. If a user is typing Chinese text and presses `S` as part of a pinyin sequence, that keystroke is not a hotkey attempt; it is part of character composition.

The EventDispatcher's pre-filter step (`_preFilterEvent`) checks for `event.isComposing` and `event.keyCode === 229`, silently dropping these events before they reach the hotkey matching pipeline.

### Edge cases

- Some IME implementations fire a `keydown` with `key: "Process"` instead of the actual key value.
- On older browsers, `isComposing` may not be set, so the `keyCode === 229` check provides a fallback.
- IME composition can be active inside any editable element (`<input>`, `<textarea>`, `contenteditable`).

## RAII-style Guard Pattern

**RAII** stands for **Resource Acquisition Is Initialization**, a pattern from C++ where:

- A **resource is acquired** when an object is **created**.
- The **resource is released** when the object is **destroyed** (or goes out of scope).

This pattern is used by `KeyboardDispatchGuard`, the handle returned from `HotkeyManager.suspendDispatch()`.

### The problem it solves

Without RAII guards, suspending and resuming dispatch would use paired start/stop calls:

```ts
// Fragile - easy to forget the resume call
manager.suspendDispatch();
try {
  doSomething();
} finally {
  manager.resumeDispatch(); // What if someone else also suspended?
}
```

This breaks down when multiple callers need to suspend independently (e.g., two nested dialogs). A boolean flag can be toggled by any caller, and the first one to resume accidentally enables dispatch while the second still expects it to be suspended.

### How the guard works

```ts
// Acquire: creates a guard and immediately blocks dispatch
const guard = manager.suspendDispatch("dialog open");
// Dispatch is now suspended...

// Release: resumes dispatch (if no other guards are active)
guard.release();
```

Key properties:

- **Reference-counted**: Multiple guards can be active simultaneously. Dispatch only resumes when **all** guards are released. This prevents one caller from accidentally resuming dispatch while another still needs it suspended.
- **Idempotent release**: Calling `guard.release()` twice is safe. The second call is a no-op.
- **Invalidation on destroy**: When `HotkeyManager.destroy()` is called, all outstanding guards are invalidated (`isActive` set to `false`). No stale guards can interfere with a fresh manager instance.
- **Observable state**: `guard.isActive` indicates whether the guard is still suspending dispatch. `manager.isDispatchSuspended()` indicates whether any guard is active.

### Nested guards example

```ts
// Dialog opens - suspend dispatch
const dialogGuard = manager.suspendDispatch("dialog");

// Confirmation popover opens inside dialog - suspend again
const popoverGuard = manager.suspendDispatch("confirmation");

// User closes popover
popoverGuard.release();
// Still suspended - dialogGuard is active

// User closes dialog
dialogGuard.release();
// Now dispatch resumes - both guards released
```

### What happens during suspension

While suspended, the EventDispatcher pipeline skips hotkey matching, sequence matching, and unhandled emission (steps 5–7). Instead, it emits an unhandled event with reason `Suspended`. Key state tracking (step 1) still runs, so `getHeldKeys()` remains accurate.

## Scope (Hotkey Scope Stack)

A **scope** is a named activation context that determines which hotkey registrations are eligible to fire. Scopes form a LIFO (last-in, first-out) **stack**.

### How it works

- The stack always has `GLOBAL_SCOPE` (`"__global__"`) at the bottom.
- `pushScope("editor")` pushes a new scope onto the stack.
- `popScope("editor")` removes it (the ID must match the current top).
- `getActiveScope()` returns the current top of the stack.
- `getScopeStack()` returns a snapshot of the full stack.

### Two-pass matching

When a key event arrives, the dispatcher uses a **two-pass matching** strategy:

1. **Pass 1 - Scoped match**: Check registrations in the active (top-of-stack) scope first. If a match is found, it fires and matching stops.
2. **Pass 2 - Global fallback**: If no scoped match is found, check `GLOBAL_SCOPE` registrations. If a match is found, it fires.

This means a scoped registration always shadows a global registration for the same key. For example, if both `GLOBAL_SCOPE` and `"editor"` have a handler for `Escape`, and `"editor"` is the active scope, only the editor handler fires.

### Router integration

When `enableRouterIntegration(router)` is active, route changes automatically reset to global scope and push the new route name as the active scope. Dialog scopes still require manual `pushScope`/`popScope`.

## Suppression

**Suppression** refers to conditions that prevent a matched hotkey from firing, even though the key combination and scope both match.

- **Input suppression** (`ignoreInputs`): Single-key hotkeys are suppressed when focus is in a text field. Ctrl/Meta combos and Escape are not suppressed. Controlled by the `ignoreInputs` option (`"auto"` by default).
- **Popup suppression** (`suppressInPopups`): Hotkeys are suppressed when a UI5 popup (dialog or popover) is open. Off by default.
- **Repeat suppression** (`ignoreRepeat`): Held-key repeat events are ignored. On by default.

When a hotkey is suppressed, the unhandled callback fires with the corresponding reason (`InputSuppressed`, `PopupSuppressed`, `RepeatIgnored`).

## AltGr (Alternate Graphic)

**AltGr** is the right-side Alt key on non-US keyboard layouts (German, French, etc.). It is used to type special characters like `@`, `€`, `{`, `}`, `~`, etc.

### The problem

On Windows, pressing AltGr sends **both** `ctrlKey: true` and `altKey: true` simultaneously. This means a user typing `AltGr+Q` to produce `@` on a German keyboard would falsely match a `Ctrl+Alt+Q` hotkey registration.

### How we handle it

The EventDispatcher detects AltGr via two mechanisms:

1. `event.getModifierState("AltGraph")`, the modern, reliable check.
2. Tracking `event.location` on Alt keydowns. If the last Alt press was on the right side (`location === 2`) and both `ctrlKey` and `altKey` are active, treat it as AltGr.

Events identified as AltGr are silently dropped in the pre-filter step, preventing false hotkey matches.

## Composition Middleware

A **composition middleware** is a self-registering module that intercepts key presses for a specific layout and transforms them before they reach the target input. This enables script-specific input processing without modifying the core keyboard component.

### How it works

1. A middleware module calls `_registerMiddleware(["layout-name"], factoryFn)` on import.
2. When the associated layout becomes active, the keyboard lazily instantiates the middleware via the factory function.
3. On each key press, the middleware's `handleKey()` method is called first. It can consume the key (returning `true`), compose multiple keys into a single output character, or pass through to default handling (returning `false`).
4. When the layout is deactivated, `reset()` is called to clear any pending composition state.

### Current implementations

- **Kana dakuten** (`middleware/kana-dakuten.ts`): Composes hiragana base characters with dakuten/handakuten marks for the `ja-kana` layout. Table lookup of ~50 mappings.
- **Hangul compose** (`middleware/hangul-compose.ts`): Composes Korean jamo (consonants and vowels) into Hangul syllable blocks for the `ko-hangul` layout. Implements the Unicode Hangul Syllable Composition Algorithm.

### Consumer API

Consumers can register custom middleware via `KioskKeyboard.registerMiddleware(layouts, factory)`. The `CompositionMiddleware` interface requires three methods: `handleKey()`, `commit()`, and `reset()`.

## Tree-Shaking (WebC)

**Tree-shaking** is the process of eliminating unused code from the final bundle. The `kiosk-keyboard-webc` package supports tree-shaking via split entry points.

### Entry points

| Entry                              | What it includes                                                    |
| ---------------------------------- | ------------------------------------------------------------------- |
| `kiosk-keyboard-webc/bundle`       | Everything: component, Assets, all built-in layouts, all middleware |
| `kiosk-keyboard-webc`              | Component with all built-in layouts (no Assets, no middleware)      |
| `kiosk-keyboard-webc/layouts/*`    | Individual self-registering layout modules                          |
| `kiosk-keyboard-webc/middleware/*` | Individual self-registering middleware modules                      |

### Usage

To include only QWERTY and the kana dakuten middleware:

```ts
import "kiosk-keyboard-webc/Assets";
import KioskKeyboard from "kiosk-keyboard-webc";
import "kiosk-keyboard-webc/layouts/qwerty";
import "kiosk-keyboard-webc/middleware/kana-dakuten";
```

Layouts and middleware self-register on import via internal `_registerBuiltInLayout()` and `_registerMiddleware()` calls.

## composedPath()

`Event.composedPath()` returns the full propagation path of a DOM event as an array of `EventTarget` nodes, from the innermost target to `window`.

### How we use it

Target-scoped hotkey registrations (those with a `target` option) use `composedPath()` to determine whether the event originated from within the target element. Instead of attaching per-element DOM listeners, the EventDispatcher checks whether the registration's target appears in the event's composed path.

### Target matching order

When multiple nested elements have registrations for the same key, matching starts at the **innermost** node and moves outward. Only the innermost match fires.

### Limitations

- **Closed shadow roots**: `composedPath()` does not cross closed shadow DOM boundaries. Registrations on elements inside a closed shadow root will not match.
- **Detached elements**: Elements not in the DOM are not part of any event's composed path. Registrations on detached targets are inactive until the element is reattached.
- **Fallback**: If `composedPath()` returns an empty array (rare), we fall back to `[event.target, document, window]`.
