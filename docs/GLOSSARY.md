# Glossary

Technical concepts used across the `ui5-lib-keyboard` libraries.

## IME (Input Method Editor)

**IME** stands for **Input Method Editor**. It is system-level software that allows typing characters from languages that have more characters than can fit on a physical keyboard — primarily Chinese, Japanese, and Korean (CJK).

### How it works

When typing with an IME:

1. The user presses multiple keys to compose a character (e.g., typing `ni` to produce 你).
2. A **composition window** appears showing candidate characters.
3. The user selects the final character (via number key, Enter, or arrow navigation).

During this process the browser fires `compositionstart`, `compositionupdate`, and `compositionend` events. Keydown events that occur during IME composition carry one of two signals:

- `event.isComposing === true` (modern browsers)
- `event.key === "Process"` or `event.keyCode === 229` (legacy fallback)

### Relevance for hotkeys

Hotkey matching must **not** interfere with IME composition. If a user is typing Chinese text and presses `S` as part of a pinyin sequence, that keystroke is not a hotkey attempt — it is part of character composition.

The EventDispatcher's pre-filter step (`_preFilterEvent`) checks for `event.isComposing` and `event.keyCode === 229`, silently dropping these events before they reach the hotkey matching pipeline.

### Edge cases

- Some IME implementations fire a `keydown` with `key: "Process"` instead of the actual key value.
- On older browsers, `isComposing` may not be set — the `keyCode === 229` check provides a fallback.
- IME composition can be active inside any editable element (`<input>`, `<textarea>`, `contenteditable`).

## RAII-style Guard Pattern

**RAII** stands for **Resource Acquisition Is Initialization**, a pattern from C++ where:

- A **resource is acquired** when an object is **created**.
- The **resource is released** when the object is **destroyed** (or goes out of scope).

This pattern is used by `KeyboardDispatchGuard`, the handle returned from `HotkeyManager.suspendDispatch()`.

### The problem it solves

Without RAII guards, suspending and resuming dispatch would use paired start/stop calls:

```ts
// Fragile — easy to forget the resume call
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
- **Idempotent release**: Calling `guard.release()` twice is safe — the second call is a no-op.
- **Invalidation on destroy**: When `HotkeyManager.destroy()` is called, all outstanding guards are invalidated (`isActive` set to `false`). No stale guards can interfere with a fresh manager instance.
- **Observable state**: `guard.isActive` indicates whether the guard is still suspending dispatch. `manager.isDispatchSuspended()` indicates whether any guard is active.

### Nested guards example

```ts
// Dialog opens — suspend dispatch
const dialogGuard = manager.suspendDispatch("dialog");

// Confirmation popover opens inside dialog — suspend again
const popoverGuard = manager.suspendDispatch("confirmation");

// User closes popover
popoverGuard.release();
// Still suspended — dialogGuard is active

// User closes dialog
dialogGuard.release();
// Now dispatch resumes — both guards released
```

### What happens during suspension

While suspended, the EventDispatcher pipeline skips hotkey matching, sequence matching, and unhandled emission (steps 5–7). Instead, it emits an unhandled event with reason `Suspended`. Key state tracking (step 1) still runs, so `getHeldKeys()` remains accurate.

## AltGr (Alternate Graphic)

**AltGr** is the right-side Alt key on non-US keyboard layouts (German, French, etc.). It is used to type special characters like `@`, `€`, `{`, `}`, `~`, etc.

### The problem

On Windows, pressing AltGr sends **both** `ctrlKey: true` and `altKey: true` simultaneously. This means a user typing `AltGr+Q` to produce `@` on a German keyboard would falsely match a `Ctrl+Alt+Q` hotkey registration.

### How we handle it

The EventDispatcher detects AltGr via two mechanisms:

1. `event.getModifierState("AltGraph")` — the modern, reliable check.
2. Tracking `event.location` on Alt keydowns — if the last Alt press was on the right side (`location === 2`) and both `ctrlKey` and `altKey` are active, treat it as AltGr.

Events identified as AltGr are silently dropped in the pre-filter step, preventing false hotkey matches.

## composedPath()

`Event.composedPath()` returns the full propagation path of a DOM event as an array of `EventTarget` nodes, from the innermost target to `window`.

### How we use it

Target-scoped hotkey registrations (those with a `target` option) use `composedPath()` to determine whether the event originated from within the target element. Instead of attaching per-element DOM listeners, the EventDispatcher checks whether the registration's target appears in the event's composed path.

### Target matching order

When multiple nested elements have registrations for the same key, matching starts at the **innermost** node and moves outward.

- By default, only the innermost match fires.
- If the matched registration sets `allowBubble: true`, matching can continue to outer targets.
- If a matched registration has `stopPropagation: true`, target matching stops immediately.

### Limitations

- **Closed shadow roots**: `composedPath()` does not cross closed shadow DOM boundaries. Registrations on elements inside a closed shadow root will not match.
- **Detached elements**: Elements not in the DOM are not part of any event's composed path. Registrations on detached targets are inactive until the element is reattached.
- **Fallback**: If `composedPath()` returns an empty array (rare), we fall back to `[event.target, document, window]`.
