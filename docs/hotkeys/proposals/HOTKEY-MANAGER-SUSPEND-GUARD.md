# HotkeyManager Suspend Guard

## Problem

`HotkeyRecorder` currently relies on DOM listener ordering to prevent `HotkeyManager` from handling keys while recording.

This works today because:

- Recorder listens on `window` capture
- Manager listens on `document` capture

If either implementation changes (for example both listen on `window`), ordering may become fragile and behavior can regress.

## Goal

Provide an explicit, API-level way to suspend manager dispatch while modal keyboard capture is active (recording, onboarding overlays, guided tours, etc.).

## Proposed API

```ts
// RAII-style handle (preferred)
interface HotkeyDispatchGuard {
  release(): void;
  readonly isActive: boolean;
}

class HotkeyManager {
  suspendDispatch(reason?: string): HotkeyDispatchGuard;
  isDispatchSuspended(): boolean;
}
```

Usage:

```ts
const manager = HotkeyManager.getInstance();
const guard = manager.suspendDispatch("HotkeyRecorder");
try {
  recorder.start();
} finally {
  guard.release();
}
```

## Behavioral Contract

- Suspension is reference-counted via guards (supports nested usage).
- While suspended, `HotkeyManager` does not execute hotkey callbacks.
- `destroy()` invalidates all guards and resets suspension state.
- `release()` is idempotent.
- Optional `reason` is debug-only metadata (no runtime behavior changes).

## Why This Design

- Avoids dependence on capture-phase target choice (`window` vs `document`).
- Avoids dependence on registration order on same target.
- Keeps control in `HotkeyManager`, where dispatch policy belongs.
- Produces a clear and testable contract for library consumers.

## UI5 and DX Notes

- Matches existing handle-based lifecycle style in the library (`register()` / `unregister()`).
- Works with UI5 controller lifecycle: guards can be released in `onExit()`.
- Supports transparent logging in debug mode (who suspended dispatch and when).

## Test Plan

- Unit: suspended manager ignores matching hotkeys.
- Unit: nested guards require all releases before dispatch resumes.
- Unit: `destroy()` clears suspension and invalidates guards safely.
- Integration: `HotkeyRecorder` with active manager does not trigger manager callbacks while recording.

## Alternatives Considered

- DOM-only ordering tricks (`window` capture + `stopImmediatePropagation`) — fragile if listener topology changes.
- Global singleton boolean flag — works but less safe than guard handles for nested callers.

## Compatibility

- Backward compatible (new additive API).
- Existing recorder behavior remains functional; implementation can migrate internally to guard API later.
