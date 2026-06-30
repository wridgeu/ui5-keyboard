# Centralized EventDispatcher & Suspend Guard

> Supersedes the original "HotkeyManager Suspend Guard" scope. The suspend guard is now one feature of a broader centralized event-dispatching architecture.

## Problem

Four independent DOM listener sites exist today, each with implicit ordering and lifecycle dependencies:

| Component                            | Target                | Phase                                          | Events                     |
| ------------------------------------ | --------------------- | ---------------------------------------------- | -------------------------- |
| HotkeyRecorder                       | `window`              | capture                                        | `keydown`                  |
| HotkeyManager (via ListenerRegistry) | `document`            | capture                                        | `keydown`                  |
| KeyStateTracker                      | `document` + `window` | capture (`keydown`, `keyup`) + bubble (`blur`) | `keydown`, `keyup`, `blur` |
| ListenerRegistry (per-target)        | each `EventTarget`    | capture                                        | `keydown`                  |

### 1. Fragile listener ordering

HotkeyRecorder blocks HotkeyManager only because `window` capture fires before `document` capture. If either implementation moves targets, recording silently breaks.

### 2. Tangled dispatch coordination

`HotkeyManager._onKeyDown` runs single-key matching, then sequence matching, then flushes "deferred unhandled" contexts from a `WeakMap`. The `deferUnhandled` boolean flag, `handledEvents` WeakSet, `sequenceConsumedEvents` WeakSet, and `_flushDeferredUnhandled()` method exist solely to coordinate two subsystems sharing one listener.

### 3. Duplicated pre-filtering

AltGr detection (`_lastAltLocation`), IME guards, and modifier-only guards live in `HotkeyManager._shouldIgnoreKeyEvent`. KeyStateTracker independently handles the same event stream but must NOT skip modifier keydowns that the hotkey guard would filter. This coupling is implicit, not enforced by shared code.

### 4. Scattered lifecycle

KeyStateTracker manages its own `document` listeners independently. If HotkeyManager is destroyed without destroying KeyStateTracker (or vice versa), orphan listeners remain. Each target element carries ref-counted listeners that must be individually detached.

### 5. No explicit suspension API

No API-level way to pause dispatch for modal UI scenarios. Two distinct needs exist: (a) full keyboard capture (recording UI) where browser defaults must also be suppressed, and (b) soft pause (onboarding overlays, guided tours) where only library callbacks should be blocked. HotkeyRecorder addresses (a) today via `stopImmediatePropagation()` at the DOM level, but (b) has no solution.

## Current State vs Target State

### Current: scattered listeners, implicit ordering

```
  DOM listener topology (capture phase fires top-down)
  =====================================================

  window ──────────────────────────────────────────────────────────
    │  ▲ keydown (capture)         ▲ blur (bubble)
    │  │                           │
    │  HotkeyRecorder              KeyStateTracker
    │  (own listener,              (own listener,
    │   stopImmediatePropagation    independent lifecycle)
    │   blocks everything below)
    │
  document ────────────────────────────────────────────────────────
    │  ▲ keydown (capture)         ▲ keydown (capture)
    │  │                           ▲ keyup  (capture)
    │  │                           │
    │  HotkeyManager               KeyStateTracker
    │  (via ListenerRegistry)      (own listener,
    │  │                            duplicate attachment)
    │  ├─ _onKeyDown
    │  │   ├─ _processKeyEvent ─── hotkey matching
    │  │   ├─ sequenceManager ──── sequence matching
    │  │   └─ _flushDeferred ───── WeakMap coordination
    │  │
    │  └─ _hasTargetListenerInPath ── checks for target listeners
    │
  ...DOM tree...
    │
  target element(s) ──────────────────────────────────────────────
       ▲ keydown (capture, per-element, ref-counted)
       │
       ListenerRegistry.attachTarget
       (one listener per unique target, count-tracked)

  Problems:
    - Recorder blocks Manager only because window > document ordering
    - KeyStateTracker has own listeners on BOTH document and window
    - Target elements carry ref-counted listeners that must be detached
    - HotkeyManager coordinates hotkeys + sequences via WeakMap deferral
    - No explicit way to suspend dispatch
    - 4+ addEventListener calls across 3 DOM targets
```

### Target: single dispatcher, explicit pipeline

```
  DOM listener topology
  =====================================================

  window ──────────────────────────────────────────────────────────
    │  ▲ keydown (capture)    ▲ keyup (capture)    ▲ blur (bubble)
    │  │                      │                     │
    │  └──────────────────────┴─────────────────────┘
    │                         │
    │              ┌──────────┴──────────┐
    │              │  EventDispatcher     │
    │              │  (owned by Manager,  │
    │              │   all DOM listeners) │
    │              └──────────┬──────────┘
    │                         │
    │     keydown pipeline    │    keyup/blur
    │     ================    │    ==========
    │                         │
    │  1. KeyStateTracker ◄───┤◄── always (keydown + keyup + blur)
    │     (state only,        │
    │      never consumes)    │
    │                         │
    │  2. Interceptor? ◄──────┤    HotkeyRecorder sets itself here
    │     if consumed: stop   │    via manager.createRecorder()
    │                         │
    │  3. Pre-filter ◄────────┤    IME, modifier-only, AltGr
    │     if filtered: stop   │
    │                         │
    │  4. Guards? ◄───────────┤    manager.suspendDispatch()
    │     if suspended: stop  │
    │                         │
    │  5. HotkeyManager ◄────┤    two-pass match (scope → global)
    │     processHotkeys()    │    target-scoped via composedPath()
    │                         │
    │  6. SequenceManager ◄───┤    multi-key sequence matching
    │     processSequences()  │
    │                         │
    │  7. Unhandled ◄─────────┘    only if 5+6 both returned false
    │
  document ────────────────────────────────────────────────────────
    │  (no library listeners)
    │
  ...DOM tree...
    │
  target element(s) ──────────────────────────────────────────────
       (no library listeners - composedPath() check instead)

  Result:
    - 3 addEventListener calls on 1 DOM target (window)
    - Deterministic pipeline - no ordering ambiguity
    - No WeakMaps, no deferred state, no ref-counting
    - Suspension and interception are explicit pipeline steps
    - Single destroy() tears down everything
```

### Component ownership

```
  Current                              Target
  =======                              ======

  ┌─────────────────┐                  ┌─────────────────┐
  │ Consumer         │                  │ Consumer         │
  │ (Component/      │                  │ (Component/      │
  │  Controller)     │                  │  Controller)     │
  └────────┬────────┘                  └────────┬────────┘
           │                                    │
           │ .getInstance()                     │ .getInstance()
           ▼                                    ▼
  ┌─────────────────┐                  ┌─────────────────────┐
  │ HotkeyManager    │ ◄── public      │ HotkeyManager        │ ◄── public
  │ (singleton)      │                  │ (singleton)           │
  ├─────────────────┤                  ├─────────────────────┤
  │ owns:            │                  │ owns:                │
  │  SequenceManager │                  │  EventDispatcher ────┼──── internal
  │  ListenerRegistry│                  │  SequenceManager     │
  │  document keydown│                  │                      │
  └─────────────────┘                  └─────────────────────┘
                                                │
  ┌─────────────────┐                           │ owns
  │ KeyStateTracker  │ ◄── independent   ┌──────┴──────────────┐
  │ (own singleton,  │     singleton     │ EventDispatcher      │
  │  own listeners)  │                   ├─────────────────────┤
  └─────────────────┘                   │ owns:                │
                                        │  KeyStateTracker     │
  ┌─────────────────┐                   │  window keydown      │
  │ HotkeyRecorder   │ ◄── independent  │  window keyup        │
  │ (own instance,   │     class        │  window blur         │
  │  own listener)   │                  │  suspend guards      │
  └─────────────────┘                  │  interceptor slot    │
                                        └─────────────────────┘

                                        ┌─────────────────────┐
                                        │ HotkeyRecorder       │
                                        │ (created via          │
                                        │  manager              │
                                        │  .createRecorder())   │
                                        │ uses interceptor slot │
                                        └─────────────────────┘
```

## Goal

Introduce a single internal `EventDispatcher` that owns all keyboard event listeners, provides a deterministic dispatch pipeline, and exposes an RAII-style suspend guard, eliminating every implicit ordering dependency and scattered listener.

## Architecture

The EventDispatcher pipeline in detail:

```
┌──────────────────────────────────────────────────────────┐
│  EventDispatcher (internal, owned by HotkeyManager)       │
│  window capture: keydown, keyup                           │
│  window bubble: blur                                      │
│                                                           │
│  Pipeline (keydown):                                      │
│    1. Key state tracking    (always, incl. modifiers)     │
│    2. Interceptor check     (HotkeyRecorder modal)        │
│    3. Pre-filter            (IME, modifier-only, AltGr)   │
│    4. Suspend guard check   (RAII guards)                 │
│    5. Hotkey dispatch       (active scope → global)       │
│    6. Sequence dispatch     (active scope → global)       │
│    7. Unhandled emission    (if nothing consumed)         │
│                                                           │
│  Pipeline (keyup):                                        │
│    1. Key state tracking                                  │
│                                                           │
│  Pipeline (blur):                                         │
│    1. Key state reset                                     │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ HotkeyManager │  │ SequenceManager   │  │ KeyStateTracker   │
│ Registration  │  │ Sequence matching │  │ Held-key state    │
│ Scope stack   │  │ Timeout tracking  │  │ macOS stuck-key   │
│ Two-pass match│  │ Pending callbacks │  │ Change callbacks  │
│ NO listener   │  │ NO listener       │  │ NO listener       │
└──────────────┘  └──────────────────┘  └──────────────────┘
```

### Why `window` capture

- Outermost position in the capture chain (`window` → `document` → `html` → ... → target).
- Fires before UIArea event delegation, before control `onkeydown` handlers, before PseudoEvent processing.
- Single attachment point: one `keydown`, one `keyup`, one `blur`.
- HotkeyRecorder already uses `window` capture for the same reason; consolidating removes the implicit ordering between recorder and manager.

### Pipeline design decisions

- **Step 1 (key state) before everything**: KeyStateTracker must see ALL keydowns including modifier-only and IME events. It tracks state, never consumes.
- **Step 2 (interceptor) before pre-filter**: HotkeyRecorder needs to capture and block modifier-only and IME keydowns during recording. It `preventDefault()`s consumed events.
- **Step 4 (guards) after pre-filter**: Suspended dispatch still lets key state tracking and pre-filtering work normally. Guards only block hotkey/sequence dispatch. The dispatcher does NOT call `preventDefault()` on suspended events; suspension blocks library callbacks but does not suppress browser defaults (e.g., F5, Ctrl+S). Consumers who need full browser-default suppression during a modal overlay should combine `suspendDispatch()` with their own `window` capture listener that calls `preventDefault()`/`stopPropagation()` for the duration of the overlay (the interceptor mechanism is internal and `createRecorder()` is single-capture, not suitable for long-lived suppression).
- **Steps 5+6 independent, then 7**: Hotkey matching and sequence matching run independently. Unhandled emits only if neither consumed the event. No deferred state, no WeakMaps. Note: `processSequences` returns `true` both for full sequence matches AND for partial matches (a key advanced an in-progress sequence). This ensures partial sequences suppress unhandled emission, consistent with current behavior where `sequenceConsumedEvents` covers both cases. **Behavioral change in execution order:** Currently, document-level hotkey matching runs first, then sequence matching, and target-scoped listeners fire independently later (when DOM capture reaches each target element). In the new design, step 5 runs ALL hotkey matching (document + target-scoped via `composedPath()`) before step 6 runs sequence matching. This means target-scoped hotkey callbacks now execute _before_ sequence processing, whereas today they execute _after_. Concretely: if a target has `Ctrl+S` registered and a sequence starts with `Ctrl+S`, the target callback's `stopPropagation()` call now happens before SequenceManager sees the event. Both steps still run independently (`processHotkeys` returning `true` does not gate `processSequences`), but the DOM event's propagation state may differ by the time sequences process it.
- **`stopPropagation`/`preventDefault` call sites**: These are called by the handler (HotkeyManager inside `processHotkeys`, SequenceManager inside `processSequences`) or by the interceptor (`preventDefault` in HotkeyRecorder), NOT by EventDispatcher. The dispatcher never manipulates DOM events directly; it only controls its own pipeline. This ensures registrations with `stopPropagation: false` work correctly and interceptors have full control over their DOM event behavior.
- **`window` capture impact on other frameworks**: Moving from `document` capture to `window` capture changes how `stopPropagation()` interacts with external listeners. **Existing documented impact (unchanged):** `stopPropagation` can already block UI5 dialog Escape-to-close behavior; ARCHITECTURE.md documents this and recommends `stopPropagation: false` for dialog interop. HotkeyRecorder already uses `window` capture with `stopImmediatePropagation()`, so full keyboard blocking during recording is unchanged. **What is newly affected:** Hotkey registrations and sequence final matches (not the recorder) currently call `stopPropagation()` on a `document` capture listener. Other `document` listeners (same target) still fire: UI5 UIArea keyboard event delegation, PseudoEvent processing, and third-party `document` capture listeners are unaffected. In the new design, `stopPropagation()` is called on a `window` capture listener, where `document` is a child target. The event no longer reaches `document` at all. Since `stopPropagation` defaults to `true`, every matched hotkey registration and every completed sequence now also suppresses UI5 UIArea keyboard delegation and any third-party `document` listeners for that event. Registrations and sequences with `stopPropagation: false` are unaffected; the event propagates normally. See API Changes for migration details.
- **Step 3 (pre-filter) produces no unhandled callback**: When the pre-filter rejects an event (IME composition, modifier-only keydown, AltGr), the pipeline returns silently. No unhandled callback fires, and no `UnhandledReason` is emitted. This matches current behavior (pre-filtered events never reach `_processKeyEvent`) and is correct; consumers should not receive "unhandled" notifications for modifier-only presses or IME composition events.

### Target-scoped hotkeys via `composedPath()`

Per-element listeners are replaced by a `composedPath()` membership check during matching. When a registration has a `target`, the dispatcher checks whether that target appears in the event's composed path. Zero additional listeners.

**Behavioral change vs current:** Today, if two nested targets both have registrations for the same key (e.g., `Ctrl+S` on both an outer and inner element), both target listeners fire independently during capture phase and both callbacks execute (unless one uses `stopPropagation`). In the new design, target-scoped matching iterates from innermost to outermost target in the `composedPath()`, and only the **first (innermost)** matching registration fires. This is a deliberate change; innermost-wins is consistent with CSS specificity and user expectation.

**Priority ordering:**

1. Target-scoped registrations are checked first, innermost-first via `composedPath()` order (active scope → global scope).
2. If a target-scoped registration matches with `stopPropagation: true`, document-level registrations for the same key are skipped entirely.
3. If no target match, or target matched without `stopPropagation`: document-level registrations are checked (active scope → global scope). If a target match without `stopPropagation` already fired, a document match for the same key also fires (both callbacks execute). This is intentional: target and document registrations serve different purposes (scoped vs. global) so "both fire" is correct. See pseudocode in Phase 4.
4. For nested target-scoped registrations, only the **innermost** matching target fires, regardless of `stopPropagation`. The `stopPropagation` flag on a target-scoped registration controls whether outer target nodes are even checked: `stopPropagation: true` skips iteration of remaining outer targets (optimization + skip-reason suppression), `stopPropagation: false` still only fires the innermost match but continues iterating outer targets for debug/skip-reason tracking. This is different from the target→document rule above because two nested target registrations for the same key in the same scope is a conflict, not complementary usage.

**Note on `target: document`:** If a registration uses `target: document`, it is treated as a target-scoped registration (indexed in `bucket.targets`, not `bucket.documentIds`). During `composedPath()` iteration `document` appears near the outermost end, so such a registration behaves like a very-outer target, not like a document-level registration. In practice `target: document` is unlikely (omitting `target` achieves the same effect with better priority), but the distinction exists.

**Semantic change: `stopPropagation` option vs `event.stopPropagation()` in callbacks.** Currently, a callback calling `event.stopPropagation()` directly affects target listener behavior even when the registration's `stopPropagation` option is `false`. In the new design, target-skipping is determined solely by the `stopPropagation` option on the registration; the pipeline does not inspect the DOM event's propagation state. This is intentional: the dispatch pipeline owns matching decisions, not side effects in callbacks.

**Migration for "fire all" nested targets:** If existing code relies on both an outer and inner target callback firing for the same key, refactor to register only on the innermost element, or use separate scopes so both registrations match independently.

**Known limitations of `composedPath()` (behavioral regressions; see also Changed (breaking) in API Changes):**

- **Closed shadow roots (regression):** `composedPath()` stops at closed shadow root boundaries. If a target element is inside a closed shadow root and the event originates from outside, the target will not appear in the path and the registration will not match. Current per-element listeners work regardless of shadow DOM boundaries because the listener is attached directly on the element. This is a behavioral break for any code using target-scoped registrations on elements inside closed shadow roots.
- **Detached targets (regression):** If a target element is detached from the DOM when the key event fires, `composedPath()` will not include it. Registrations bound to detached elements will not match. Current per-element listeners fire regardless of DOM attachment because the listener is on the element itself.
- **Cross-document / iframe targets:** `composedPath()` does not cross document boundaries. Target-scoped registrations on elements inside iframes will not match events from the parent document. This is the same behavior as today (iframe elements have independent event dispatch).

These limitations are acceptable for the intended use cases (panel-scoped hotkeys, dialog-scoped hotkeys). If closed shadow root support is needed, it should be addressed in a separate proposal.

- **`composedPath()` availability:** `composedPath()` is supported in all modern browsers (Chrome 53+, Firefox 52+, Safari 10+, Edge 79+). IE11 does not support it, but IE11 is outside this library's support matrix. For defensive coding, the dispatcher falls back to `[event.target, document, window].filter(Boolean)` if `composedPath()` returns an empty array or is undefined. This fallback produces correct behavior for document-level registrations and reasonable behavior for target-scoped registrations (only exact `event.target` matches). The fallback is a safety net, not a supported configuration; no test matrix for `composedPath()`-less environments is maintained.

## Proposed API

> Note: the `getInstance()`/singleton examples below (and in the diagrams above) predate the instance-lifecycle change. `getInstance()` was later removed in favor of `new HotkeyManager()`; see [../HOTKEYS-INSTANCE-LIFECYCLE.md](../HOTKEYS-INSTANCE-LIFECYCLE.md). The EventDispatcher and suspend-guard architecture itself shipped as described here; only the singleton accessor changed.

### Suspend guard (public, on HotkeyManager)

```ts
interface KeyboardDispatchGuard {
  release(): void;
  readonly isActive: boolean;
}

class HotkeyManager {
  suspendDispatch(reason?: string): KeyboardDispatchGuard;
  isDispatchSuspended(): boolean;

  /** Factory - hides EventDispatcher from consumers. */
  createRecorder(options: HotkeyRecorderOptions): HotkeyRecorder;

  /** Access held-key state. Replaces KeyStateTracker.getInstance(). */
  getKeyStateTracker(): KeyStateTracker;
}
```

Usage:

```ts
const manager = HotkeyManager.getInstance();
const guard = manager.suspendDispatch("onboarding-overlay");

// ... modal UI active, all hotkey/sequence callbacks blocked ...

guard.release(); // dispatch resumes
```

### Interceptor (internal, on EventDispatcher)

```ts
interface KeyEventInterceptor {
  /** Return true to consume the event and block further dispatch. */
  onKeyDown(event: KeyboardEvent): boolean;
  /** Called when this interceptor is replaced by another or cleared by destroy(). */
  onDetached(): void;
}

class EventDispatcher {
  setInterceptor(interceptor: KeyEventInterceptor): void;
  /** Owner-safe clear: only clears if current interceptor === owner. */
  clearInterceptor(owner: KeyEventInterceptor): void;
}
```

Used internally by HotkeyRecorder, not exposed to library consumers. When `setInterceptor(b)` is called while `a` is active, the dispatcher calls `a.onDetached()` before installing `b`. This ensures the replaced interceptor can reset its internal state rather than being left stale.

### Constructor contract (internal)

EventDispatcher receives its collaborators via constructor, no null-union callbacks, no optional wiring:

```ts
interface HotkeyDispatchHandler {
  /** Hotkey dispatch - receives pre-filtered, non-suspended keydowns. Returns true if consumed. */
  processHotkeys(event: KeyboardEvent): boolean;

  /** Sequence dispatch - same contract. Returns true if consumed (full match OR partial advance). */
  processSequences(event: KeyboardEvent): boolean;

  /**
   * Unhandled emission - called when the event was not consumed.
   * `forcedReason` is set by the dispatcher when the event was blocked before reaching
   * the matching pipeline (e.g., `Suspended`). When null, HotkeyManager uses its own
   * skip tracking to determine the most specific reason.
   */
  emitUnhandled(event: KeyboardEvent, forcedReason: UnhandledReason | null): void;
}

class EventDispatcher {
  constructor(handler: HotkeyDispatchHandler, platform: Platform) {
    // Creates and owns KeyStateTracker (receives platform for macOS stuck-key fix)
    // Attaches window listeners
  }
}
```

**Internal-only interface.** `HotkeyDispatchHandler` is package-internal; it is NOT exported from the library. HotkeyManager implements this interface, but `processHotkeys`, `processSequences`, and `emitUnhandled` are internal methods (prefixed with `/** @internal */` JSDoc). They are not part of the public API surface. To enforce this in TypeScript, HotkeyManager passes an anonymous handler object to the EventDispatcher constructor rather than passing `this` directly:

```ts
this._dispatcher = new EventDispatcher(
  {
    processHotkeys: (e) => this._processHotkeys(e),
    processSequences: (e) => this._processSequences(e),
    emitUnhandled: (e, r) => this._emitUnhandled(e, r),
  },
  this._platform,
);
```

This keeps the dispatch methods private on HotkeyManager while satisfying the interface contract.

**Side-effect coupling:** `processHotkeys` returns `boolean` (consumed or not) but also stores the full evaluation context in `_lastEventContext` (active scope, input state, popup state, skip info) as a side effect. `emitUnhandled` reads `_lastEventContext` when `forcedReason` is null, avoiding redundant recomputation of scope and input state. This coupling is acceptable because both methods live on the same HotkeyManager instance and the call order is guaranteed by the EventDispatcher pipeline (step 5 before step 7). The alternative, returning a richer result type, was considered but rejected as over-engineering given the fixed call order.

KeyStateTracker is not part of this interface; the dispatcher owns it directly and calls `processKeyDown`/`processKeyUp`/`processBlur` on the instance. The `HotkeyDispatchHandler` only contains things HotkeyManager provides.

KeyStateTracker receives `platform` from the EventDispatcher constructor (for the macOS stuck-key workaround), rather than re-detecting it independently.

## Behavioral Contract

### Suspend guards

- Suspension is reference-counted via guard instances (supports nested usage).
- While any guard is active, hotkey and sequence callbacks do NOT fire.
- While suspended, the unhandled callback fires with `UnhandledReason.Suspended` (via the `forcedReason` parameter on `emitUnhandled`). This lets consumers distinguish "no match" from "deliberately blocked". The `UnhandledContext.skippedRegistration` field is omitted (undefined) for `Suspended` reason, as no specific registration was evaluated.
- **Suspension does NOT call `preventDefault()`.** Browser defaults (F5 refresh, Ctrl+S save, etc.) still fire while dispatch is suspended. Suspension only blocks library-managed callbacks and sequences. This is deliberate: the suspend guard is for pausing library behavior during modal UI (onboarding overlays, guided tours), not for suppressing all keyboard input. Consumers who need full keyboard suppression (including browser defaults) should combine `suspendDispatch()` with their own `window` capture listener that calls `preventDefault()`/`stopPropagation()` for the duration of the modal overlay. Note: `createRecorder()` is NOT suitable for long-lived suppression; the recorder is designed for single-capture recording (it auto-stops after one keypress). A dedicated blocking interceptor API may be added in a future proposal if the combined approach proves insufficient.
- Key state tracking continues during suspension.
- In-progress sequences are NOT paused during suspension. Sequence timeout timers continue to run, and key events during suspension do not advance sequences (step 6 is never reached). If a sequence times out while suspended, it is silently dropped. When suspension begins mid-sequence (e.g., user pressed `G` of a `G → I` sequence, then a guard is acquired), the sequence's pending state is preserved but the timeout timer continues running. Since suspended events do not advance the sequence, the sequence will time out unless the guard is released before the timeout expires. Suspension does NOT eagerly clear pending sequence state; this avoids coupling the guard lifecycle to sequence internals. This is correct: suspension means "don't process keyboard shortcuts," not "freeze all timer state."
- `destroy()` invalidates all outstanding guards and resets suspension state.
- `release()` is idempotent: double-release does not throw or decrement below zero.
- Optional `reason` is debug-only metadata (no runtime behavior changes).
- **Reentrancy:** Guard changes during callback execution take effect on the _next_ event, not the current one. For example, if a hotkey callback calls `suspendDispatch()`, the guard is added to the set but the current event continues processing steps 5-7 normally (step 4 already passed). The guard blocks starting from the next keydown. **Registration changes are NOT deferred**: the pipeline does not snapshot registrations at the start of `_processHotkeys`. If a document-level callback adds or removes a target-scoped registration, the target pass (which runs after the document pass within the same event) sees the change immediately. This is acceptable because: (a) adding a target registration mid-event is rare, and (b) the simpler no-snapshot design avoids allocating a registration copy on every keydown. If strict isolation is needed in the future, `_processHotkeys` can snapshot `_registrationsByScope` at the top.

### Interceptor

- Only one interceptor may be active at a time.
- Setting a new interceptor while one is active replaces it (no stacking). `setInterceptor` logs a warning when replacing an active interceptor to surface this during development. **The replaced interceptor is notified via `onDetached()`**; see interface below. This ensures the replaced interceptor can clean up its internal state (e.g., HotkeyRecorder sets `_recording = false`). Consumers do not need to coordinate interceptor lifecycle externally.
- `clearInterceptor(owner)` only clears if the current interceptor matches the argument, preventing one recorder from accidentally clearing another's interceptor.
- Key state tracking continues while an interceptor is active.
- When an interceptor consumes an event (`onKeyDown` returns `true`), the EventDispatcher stops its own pipeline but does NOT call `stopImmediatePropagation()`. The interceptor itself is responsible for any DOM event manipulation it needs (`preventDefault()`, `stopPropagation()`, `stopImmediatePropagation()`, etc.). This keeps the decision with the interceptor; the dispatcher only controls its own pipeline.
- **`onDetached()` contract:** Called synchronously by the dispatcher when the interceptor is replaced (`setInterceptor(newInterceptor)`) or when the dispatcher is destroyed. The implementation must be idempotent; `onDetached()` may be called when the interceptor has already stopped itself. HotkeyRecorder uses `onDetached()` to set `_recording = false`, ensuring `isRecording` is never stale after replacement or destroy.
- **HotkeyRecorder retains `stopImmediatePropagation()` by default.** Today, HotkeyRecorder calls `stopImmediatePropagation()` which blocks both the library's own document listener AND any non-library `window` capture listeners. The README documents this as a contract: "all keyboard input is blocked." In the new design, blocking the library's own pipeline is handled structurally (interceptor return value), but HotkeyRecorder's `onKeyDown` continues to call `stopImmediatePropagation()` in addition to `preventDefault()` to preserve the documented blocking contract. This ensures non-library `window` capture listeners do not see keydown events during recording, which is the expected behavior for a modal recording UI. The dispatcher does not need `stopImmediatePropagation()` for its own pipeline, but it does not prevent the interceptor from calling it either.

### Interceptor vs suspend guard interaction

- The interceptor (step 2) runs before the suspend guard check (step 4). If an interceptor is active AND dispatch is suspended, the interceptor still receives events and can consume them. The suspend guard never runs for interceptor-consumed events.
- This is intentional: the interceptor is a modal capture mechanism (e.g., recording UI) that takes full control of keyboard input. Suspension is a softer mechanism that only blocks library callbacks. A recording session should not be silently broken by a suspend guard from an unrelated component.
- Consumers who need suspension to also block recording must coordinate externally (e.g., stop the recorder before suspending). Since the interceptor is internal, this coordination happens at the consumer level: a component that owns both a recorder and a suspend guard is responsible for their ordering.

### Lifecycle

- EventDispatcher is a plain class instantiated by HotkeyManager in its constructor (not a singleton; its single-instance nature comes from HotkeyManager being a singleton).
- `HotkeyManager.destroy()` calls `EventDispatcher.destroy()`:
  - Removes all `window` listeners.
  - Invalidates all outstanding guards.
  - Calls `onDetached()` on the active interceptor (if any), then clears the interceptor slot.
  - Calls `_onDispatcherDestroyed()` on each tracked recorder (sets `_destroyed = true`, clears their dispatcher reference). This is an internal method on HotkeyRecorder, not cross-class private field mutation.
  - Destroys owned KeyStateTracker.
- `HotkeyManager.getInstance()` after destroy creates a fresh manager with a fresh dispatcher.
- **Destroyed dispatcher safety:** All public methods on a destroyed EventDispatcher are no-ops. `suspendDispatch()` throws (creating a guard on a dead dispatcher is a programming error). `setInterceptor()`, `clearInterceptor()`, and `isDispatchSuspended()` are silent no-ops. This ensures that stale references from recorders or guards calling into a destroyed dispatcher do not throw or corrupt state.

## Implementation Plan

### Phase 1: EventDispatcher module

New file `internal/event-dispatcher.ts`. Plain class, instantiated by HotkeyManager, that:

- Attaches one `keydown` listener on `window` capture.
- Attaches one `keyup` listener on `window` capture.
- Attaches one `blur` listener on `window` bubble.
- Owns AltGr detection state (`_lastAltLocation`), platform reference.
- Implements the 7-step keydown pipeline.
- Implements the suspend guard API (reference-counted `Set<KeyboardDispatchGuard>`).
- Implements the interceptor slot.
- Forwards `keyup` and `blur` to KeyStateTracker callbacks.
- `destroy()` removes all listeners, invalidates guards, destroys owned KeyStateTracker.

Core dispatch logic:

```ts
private _onKeyDown(event: KeyboardEvent): void {
  // 1. Key state tracking - ALWAYS, even for modifiers/IME
  this._keyStateTracker.processKeyDown(event);

  // 2. Interceptor (modal capture)
  // Interceptor handles its own DOM event manipulation (preventDefault, etc.)
  if (this._interceptor?.onKeyDown(event)) return;

  // 3. Pre-filter: IME, modifier-only, AltGr
  if (this._shouldFilter(event)) return;

  // 4. Suspend guard check
  if (this._guards.size > 0) {
    this._handler.emitUnhandled(event, UnhandledReason.Suspended);
    return;
  }

  // 5. Hotkey dispatch
  const hotkeyConsumed = this._handler.processHotkeys(event);

  // 6. Sequence dispatch
  const sequenceConsumed = this._handler.processSequences(event);

  // 7. Unhandled emission
  if (!hotkeyConsumed && !sequenceConsumed) {
    this._handler.emitUnhandled(event, null);
  }
}
```

### Phase 2: HotkeyManager refactoring

Remove from HotkeyManager:

| Member                                                | Reason                                  |
| ----------------------------------------------------- | --------------------------------------- |
| `_keydownHandler` / `_onKeyDown()`                    | Dispatch loop moves to EventDispatcher  |
| `_attachListeners()` / `_detachListeners()`           | EventDispatcher owns listeners          |
| `_shouldIgnoreKeyEvent()`                             | Pre-filter moves to EventDispatcher     |
| `_lastAltLocation`                                    | AltGr tracking moves to EventDispatcher |
| `_listenerRegistry` (entire reference)                | Target checking via `composedPath()`    |
| `_deferredUnhandledByEvent` WeakMap                   | No deferred unhandled needed            |
| `_flushDeferredUnhandled()`                           | Same                                    |
| `_hasTargetListenerInPath()`                          | Same                                    |
| `handledEvents` WeakSet (module-level)                | EventDispatcher tracks consumption      |
| `sequenceConsumedEvents` WeakSet (module-level)       | Same                                    |
| `_attachTargetListener()` / `_detachTargetListener()` | No per-target listeners                 |

Add to HotkeyManager:

- `_dispatcher: EventDispatcher`: created in constructor (receives anonymous handler object wrapping private methods), destroyed in `destroy()`.
- `suspendDispatch(reason?)`: public, delegates to `_dispatcher.suspendDispatch()`.
- `isDispatchSuspended()`: public, delegates to `_dispatcher.isDispatchSuspended()`.
- `createRecorder(options)`: public factory, passes `_dispatcher` to `new HotkeyRecorder(options, dispatcher)`. Consistent with `createGroup()` pattern.
- `getKeyStateTracker()`: public getter, returns `_dispatcher.keyStateTracker`. Replaces `KeyStateTracker.getInstance()` for consumers that need held-key state.
- `_processHotkeys(event): boolean`: private, implements `HotkeyDispatchHandler.processHotkeys` via anonymous handler. Replaces `_processKeyEvent`. Returns `boolean` (consumed or not). Runs target-scoped registrations first (innermost-first via `composedPath()`), then document-level. Stores the full evaluation context in `_lastEventContext` (active scope, input state, popup state, skip info) for `_emitUnhandled`. See Phase 4 for detailed pseudocode.
- `_processSequences(event): boolean`: private, implements `HotkeyDispatchHandler.processSequences` via anonymous handler. Delegates to `_sequenceManager?.processKeyEvent(event) ?? false`.
- `_emitUnhandled(event, forcedReason): void`: private, implements `HotkeyDispatchHandler.emitUnhandled` via anonymous handler. If `forcedReason` is non-null, uses it directly. Otherwise reads `_lastEventContext` for the most specific reason and cached evaluation state.

**Debug mode:** The existing `_logDebugEvent` method and `_debugMode` flag remain on HotkeyManager. Debug logging fires inside `_processHotkeys` (after matching) and inside `_emitUnhandled` (for unhandled events). The EventDispatcher has no knowledge of debug mode. **Dual-match logging:** When a target-scoped registration matches with `stopPropagation: false` AND a document-level registration also matches the same event, `_logDebugEvent` fires twice, once for each match. Each log entry includes the matched registration, so consumers can distinguish them. The current log shape (`_logDebugEvent(event, scope, isInput, popupOpen, match, debugSkips)`) is sufficient; the `match` parameter identifies which registration triggered the log. A future enhancement could merge both matches into a single log entry, but this is not required for the initial implementation.

### Phase 3: New UnhandledReason values

Add to `UnhandledReason` enum in `library.ts` (needed by Phase 4's `TargetMismatch` skip):

- `TargetMismatch`: registration matched key combo but event target is outside the registration's target element.
- `Suspended`: dispatch was suspended via guard when the event arrived.

Update `skip-reason.ts` priority map. Concrete renumbered values:

```ts
const SKIP_PRIORITY = {
  [UnhandledReason.NoMatch]: 0,
  [UnhandledReason.TargetMismatch]: 1,
  [UnhandledReason.RepeatIgnored]: 2,
  [UnhandledReason.InputSuppressed]: 3,
  [UnhandledReason.PopupSuppressed]: 4,
  [UnhandledReason.Disabled]: 5,
  [UnhandledReason.Suspended]: 6,
} satisfies Record<UnhandledReason, number>;
```

### Phase 4: Target-scoped matching via `composedPath()`

Keep `ScopeRegistrationBucket` split structure for efficient per-target lookup:

```ts
// Before:
interface ScopeRegistrationBucket {
  documentIds: Set<string>;
  targets: Map<EventTarget, Set<string>>;
}

// After - same shape, same usage:
// documentIds: used by _matchDocumentRegistrations (flat iteration)
// targets: used by _matchTargetRegistrations (O(1) lookup per composedPath node)
```

The `Map<EventTarget, Set<string>>` is essential for `_matchTargetRegistrations`: for each node in the `composedPath()`, it does `targets.get(node)` to find relevant registrations in O(1). A flat set would require iterating all registrations per path node: O(path_length \* registrations_in_scope) vs O(path_length + relevant_registrations).

**Implementation note:** The original proposal planned to add `eventPath` to `FindMatchOptions` in `dispatch-core.ts`. In the final implementation, `findMatchInScope` operates on pre-filtered registrations (document-level, or for a specific target node) and does not need path awareness. Path iteration logic lives in `HotkeyManager._matchTargetRegistrations`, which calls `findMatchInScope` per-node. This keeps the dispatch-core module focused on single-scope matching without DOM coupling.

**Note on `TargetMismatch` in `findMatchInScope`:** The `findMatchInScope` function is only called for document-level registrations (from `bucket.documentIds`), which do not have targets. No `TargetMismatch` check is needed here; document-level registrations match regardless of where the event target is in the DOM.

`TargetMismatch` skip-reason tracking happens in `_matchTargetRegistrations` instead; see below.

`_executeMatch` encapsulates the common match-execution logic:

```ts
private _executeMatch(event: KeyboardEvent, matched: HotkeyRegistration): void {
  const opts = matched.options;
  if (opts.preventDefault) event.preventDefault();
  if (opts.stopPropagation) event.stopPropagation();
  try {
    matched.callback(event, {
      hotkey: matched.hotkey,
      parsedHotkey: matched.parsedHotkey,
      scope: opts.scope,
    });
  } catch (error) {
    Log.error(`Error in hotkey callback for "${matched.normalizedHotkey}": ${error}`, undefined, LOG_COMPONENT);
  }
}
```

`_processHotkeys` enforces three-tier priority (innermost target → outer targets → document):

```ts
_processHotkeys(event: KeyboardEvent): boolean {
  // Defensive reset - prevents stale data from a previous event leaking
  // into _emitUnhandled if a future code path reads it unexpectedly.
  this._lastEventContext = null;

  const eventPath = event.composedPath();
  const activeScope = this.getActiveScope();
  const target = getEventTarget(event);
  const isInput = isInputElement(target);
  const popupOpen = this._checkPopupOpen();
  const skipInfo: SkipInfo | null = this._unhandledCallback
    ? { reason: UnhandledReason.NoMatch }
    : null;
  const debugSkips: DebugSkipEntry[] | null = this._debugMode ? [] : null;

  // Pass 1: target-scoped registrations - innermost target in composedPath wins.
  // Iterate composedPath from index 0 (innermost) outward.
  // For each node that is a registered target, attempt matching.
  // Target-skipping is determined by the stopPropagation OPTION on the registration,
  // not by whether the callback called event.stopPropagation() directly.
  const targetMatch = this._matchTargetRegistrations(
    event, eventPath, activeScope, isInput, popupOpen, skipInfo, debugSkips,
  );

  if (targetMatch) {
    this._executeMatch(event, targetMatch);
    if (this._debugMode) {
      this._logDebugEvent(event, activeScope, isInput, popupOpen, targetMatch, debugSkips);
    }
  }

  // Pass 2: document-level registrations (only if no target match stopped propagation)
  // NOTE: target match WITHOUT stopPropagation allows document-level matching
  // to proceed. If a document also matches, BOTH callbacks fire. This is intentional:
  // a panel-scoped Ctrl+S (target) with stopPropagation: false allows
  // a document-level Ctrl+S (e.g., global save) to also fire. To prevent this,
  // use stopPropagation: true on the target-scoped registration.
  if (!targetMatch?.options.stopPropagation) {
    const docMatch = this._matchDocumentRegistrations(
      event, eventPath, activeScope, isInput, popupOpen, skipInfo, debugSkips,
    );
    if (docMatch) {
      this._executeMatch(event, docMatch);
      if (this._debugMode) {
        this._logDebugEvent(event, activeScope, isInput, popupOpen, docMatch, debugSkips);
      }
      return true;
    }
  }

  // Target match without stopPropagation still counts as consumed - callback already fired.
  // Debug logging already emitted above with targetMatch.
  if (targetMatch) {
    return true;
  }

  // Nothing matched at all
  if (this._debugMode) {
    this._logDebugEvent(event, activeScope, isInput, popupOpen, null, debugSkips);
  }

  // Store event context for _emitUnhandled (called by EventDispatcher in step 7)
  this._lastEventContext = { activeScope, isInput, popupOpen, skipInfo };

  return false;
}
```

`_matchTargetRegistrations` returns `HotkeyRegistration | null` and calls `_executeMatch` internally when a match is found. It uses scope-first, then position ordering, consistent with the existing two-pass scope model:

1. **Active scope pass:** Iterate `composedPath()` from index 0 (innermost) outward. For each node, look up `bucket.targets.get(node)` in the active scope. The first (innermost) match in the active scope wins: `_executeMatch` fires the callback and the method returns the matched registration. If the matched registration has `stopPropagation: true`, no further target nodes are checked (skip outer targets entirely). If `stopPropagation: false`, the method still returns after the first match (innermost wins), but continues iterating outer targets for debug/skip-reason tracking before returning.
2. **Global scope pass:** Only if the active scope pass found no match AND the active scope is not `GLOBAL_SCOPE`. Same innermost-first iteration over `composedPath()`, but using the global scope bucket.
3. **Skip-reason pass for off-path targets:** When skip tracking is active (`skipInfo` is non-null) and no target match was found, a secondary pass iterates ALL target registrations in the evaluated scope buckets. For each registration whose **key combo matches the event** but whose target was NOT encountered in the `composedPath()`, a `TargetMismatch` skip is recorded. Registrations whose key combo does not match the event are ignored entirely; they are true `NoMatch` candidates, not target mismatches. This pass is skip-reason-only: no callbacks fire, no `_executeMatch` calls. It exists solely to provide meaningful `UnhandledReason.TargetMismatch` feedback to the unhandled callback. The pass uses `bucket.targets` (the `Map<EventTarget, Set<string>>`) directly, iterating the map keys and checking membership against a `Set` built from the `composedPath()` nodes for O(1) lookup.

This ensures an active-scope target registration always beats a global-scope target registration, regardless of DOM position, a semantic change from current behavior where both scopes' target listeners fire independently. See "Active-scope target registrations take precedence" in Changed (breaking). Within the same scope, innermost wins; the `stopPropagation` flag does NOT control whether multiple nested targets fire (only the innermost does); it controls whether the pipeline bothers checking outer targets for skip-reason reporting.

**Note on sequences:** `SequenceOptions` does not have a `target` field; sequences are always document-level. `_processSequences` delegates directly to `_sequenceManager?.processKeyEvent(event)` without `composedPath()` involvement. This is unchanged from the current design.

The `_indexRegistration` / `_deindexRegistration` methods retain the split add/delete into `documentIds` or `targets` map.

### Phase 5: ListenerRegistry removal

Delete `internal/listener-registry.ts` and the public re-export wrapper `listener-registry.ts` (which is just `import ListenerRegistry from "./internal/listener-registry"; export default ListenerRegistry;`). Any tests that import from either file need updating or removal. All responsibilities absorbed:

| Responsibility                                     | New owner                              |
| -------------------------------------------------- | -------------------------------------- |
| `attachDocument()` / `detachDocument()`            | EventDispatcher (window, not document) |
| `attachTarget()` / `detachTarget()` / ref-counting | Removed, `composedPath()` check        |
| `hasTarget()`                                      | Removed                                |
| `_shouldEmitUnhandledForTarget()`                  | No longer needed; see below            |

**Why `_shouldEmitUnhandledForTarget` is unnecessary:** This method existed to ensure only the innermost registered target emits unhandled, preventing duplicate `no_match` callbacks when multiple nested targets have listeners. In the new design, there is a single pipeline with a single unhandled emission point (step 7). Target-scoped matching happens once via `composedPath()` iteration, so duplicate emissions are structurally impossible.

### Phase 6: KeyStateTracker integration

Remove own DOM listeners from KeyStateTracker. Expose processing methods:

```ts
// Remove from constructor:
//   document.addEventListener("keydown", ...)
//   document.addEventListener("keyup", ...)
//   window.addEventListener("blur", ...)

// Remove from destroy():
//   document.removeEventListener(...)
//   window.removeEventListener(...)

// New public methods (called by EventDispatcher via callbacks):
processKeyDown(event: KeyboardEvent): void  // existing _onKeyDown logic
processKeyUp(event: KeyboardEvent): void    // existing _onKeyUp logic
processBlur(): void                         // existing _onBlur logic
```

KeyStateTracker lifecycle ties to EventDispatcher: created in the dispatcher's constructor, destroyed when the dispatcher is destroyed. `KeyStateTracker.getInstance()` is removed (delete the static method and module-level `instance` variable); the dispatcher owns the instance and exposes it via a `keyStateTracker` getter. Consumers access it through `manager.getKeyStateTracker()`.

KeyStateTracker's constructor changes to accept `platform: Platform` as a parameter instead of calling `runtimeHooks.detectPlatform()` internally. The EventDispatcher passes its own `platform` value, ensuring a single source of truth for platform detection.

**Visibility and importability:** `KeyStateTracker` remains a named export from the library (consumers need the type for variable declarations like `const tracker: KeyStateTracker = manager.getKeyStateTracker()`). However, the constructor is no longer part of the public API; direct `new KeyStateTracker(...)` instantiation is unsupported. This is enforced at runtime via an internal token:

```ts
// internal/internal-token.ts
export const INTERNAL_TOKEN: unique symbol = Symbol("ui5.hotkeys.internal");

// KeyStateTracker constructor:
constructor(platform: Platform, token: symbol) {
  if (token !== INTERNAL_TOKEN) {
    throw new Error(
      "KeyStateTracker cannot be instantiated directly. Use HotkeyManager.getKeyStateTracker().",
    );
  }
  // ...
}
```

The same token pattern applies to `HotkeyRecorder` (see Phase 7). `INTERNAL_TOKEN` is not exported from the library barrel; it is only accessible to internal modules. JSDoc `@internal` is still applied for TypeScript-aware consumers, but the runtime guard catches JS consumers who bypass type checking. The barrel export continues to export the class for type usage. The `destroy()` method on KeyStateTracker becomes internal; consumers should not call it directly; it is called by EventDispatcher when the manager is destroyed.

### Phase 7: HotkeyRecorder interceptor migration

Replace own `window` listener with EventDispatcher interceptor API. Consumers create recorders via `manager.createRecorder()` instead of direct instantiation, keeping EventDispatcher internal.

```ts
// Before (consumer code):
const recorder = new HotkeyRecorder({ onRecord, onCancel });
recorder.start();

// After (consumer code):
const recorder = manager.createRecorder({ onRecord, onCancel });
recorder.start();
```

Internal changes:

```ts
// Constructor takes dispatcher as explicit dependency (hidden by factory),
// with runtime token to prevent direct instantiation:
constructor(options: HotkeyRecorderOptions, dispatcher: EventDispatcher, token: symbol) {
  if (token !== INTERNAL_TOKEN) {
    throw new Error(
      "HotkeyRecorder cannot be instantiated directly. Use HotkeyManager.createRecorder().",
    );
  }
  this._options = options;
  this._dispatcher = dispatcher;
}

start(): void {
  if (this._destroyed || this._recording) return;
  this._recording = true;
  this._dispatcher.setInterceptor(this);
}
stop(): void {
  if (!this._recording) return;
  this._recording = false;
  this._dispatcher?.clearInterceptor(this);
}
destroy(): void {
  this.stop();
  this._dispatcher?.untrackRecorder(this);
  this._dispatcher = null;
  this._destroyed = true;
}

// Implements KeyEventInterceptor:
onKeyDown(event: KeyboardEvent): boolean {
  event.preventDefault();
  event.stopImmediatePropagation(); // retains documented "all keyboard input is blocked" contract
  // ... existing recording logic (Escape, Backspace/Delete, modifier-only, combo) ...
  return true; // consumed - dispatcher stops its pipeline
}

// Called by dispatcher when this interceptor is replaced or dispatcher is destroyed:
onDetached(): void {
  this._recording = false;
  // Does NOT call clearInterceptor - the dispatcher already removed this interceptor.
  // Does NOT call untrackRecorder - the recorder is still tracked for lifecycle management.
}
```

Factory on HotkeyManager:

```ts
createRecorder(options: HotkeyRecorderOptions): HotkeyRecorder {
  const recorder = new HotkeyRecorder(options, this._dispatcher, INTERNAL_TOKEN);
  this._dispatcher.trackRecorder(recorder);
  return recorder;
}
```

The dispatcher tracks created recorders in a `Set<HotkeyRecorder>` for lifecycle management. On `EventDispatcher.destroy()`, all tracked recorders are marked destroyed (`_destroyed = true`) and their dispatcher reference is nulled, preventing stale calls into a destroyed dispatcher. `HotkeyRecorder.stop()` and `destroy()` check for a null dispatcher reference and no-op if already cleared.

**Leak prevention:** `HotkeyRecorder.destroy()` calls `this._dispatcher.untrackRecorder(this)` to remove itself from the tracking set. Without this, long-lived applications that create and destroy many recorders without destroying the manager would accumulate stale entries. `untrackRecorder` is a no-op if the recorder is not in the set. The tracking set is also fully cleared on `EventDispatcher.destroy()`.

### Phase 8: Unhandled callback simplification

Remove from HotkeyManager:

- `_deferredUnhandledByEvent` WeakMap
- `_flushDeferredUnhandled()` method
- `deferUnhandled` parameter on `_processKeyEvent`
- `handledEvents` / `sequenceConsumedEvents` module-level WeakSets

The EventDispatcher handles unhandled emission directly:

```ts
// Step 4 - suspended:
if (this._guards.size > 0) {
  this._handler.emitUnhandled(event, UnhandledReason.Suspended);
  return;
}

// ... steps 5+6 ...

// Step 7 - neither consumed:
if (!hotkeyConsumed && !sequenceConsumed) {
  this._handler.emitUnhandled(event, null); // HotkeyManager uses its own skip tracking
}
```

HotkeyManager's `_emitUnhandled(event, forcedReason)` implementation: if `forcedReason` is non-null, use it directly as the `UnhandledContext.reason`; the `skippedRegistration` field is omitted (undefined) because no registration was evaluated. If `forcedReason` is null, use `this._lastEventContext` (populated during `_processHotkeys`) which caches the full evaluation context (active scope, input state, popup state, skip info) to determine the most specific reason and skipped registration without redundant recomputation.

HotkeyManager's `_processHotkeys` returns `boolean`. SequenceManager's `processKeyEvent` already returns `boolean`.

**Note on lazy SequenceManager:** SequenceManager is created lazily on first `registerSequence()`. HotkeyManager's `_processSequences` handles the null case:

```ts
_processSequences(event: KeyboardEvent): boolean {
  return this._sequenceManager?.processKeyEvent(event) ?? false;
}
```

**Partial sequence matches suppress unhandled.** SequenceManager's `processKeyEvent` returns `true` both when a sequence is fully completed AND when a key advances an in-progress sequence (partial match). This is critical for correct unhandled emission: if a user presses `G` as the first key of a `G → I` sequence, the event is "consumed" by the sequence pipeline and unhandled should not fire. This preserves current behavior where `sequenceConsumedEvents` covers both partial and full matches.

### Phase 9: Tests

Existing qunit tests must be reviewed against behavioral changes. Tests that assert nested-target "fire all" behavior need updating to match new innermost-wins semantics. Tests that rely on `new HotkeyRecorder()` need updating to use `manager.createRecorder()`. Tests that use `KeyStateTracker.getInstance()` need updating to use `manager.getKeyStateTracker()`. See API Changes section for complete list of breaking changes.

## API Changes

There are no external consumers yet, so breaking changes are acceptable where they lead to a cleaner design. This section lists all breaking changes for migration reference.

### Unchanged

- `HotkeyManager.register()`, `registerSequence()`, `createGroup()`, scope management, router integration.
- `RegistrationGroup`.
- `HotkeyOptions.target`: same API surface. Implementation switches from per-element listeners to `composedPath()` check. JSDoc on `target` field needs updating to remove the note about "document capture listener fires before target capture listener" (no longer relevant; priority is now enforced in the dispatch pipeline). See "Changed" for nested target behavioral change.
- HotkeyRecorder blocking behavior: `stopImmediatePropagation()` is retained during recording, preserving the "all keyboard input is blocked" contract.

### Changed (breaking)

- **`HotkeyRecorder` no longer directly instantiated**: consumers use `manager.createRecorder(options)` factory instead of `new HotkeyRecorder(options)`. Direct instantiation throws at runtime (internal token guard), not just at the TypeScript level. Keeps EventDispatcher internal, consistent with `createGroup()` pattern. `HotkeyRecorder` and `KeyStateTracker` classes remain public type exports (consumers need them for variable type declarations like `const recorder: HotkeyRecorder = manager.createRecorder(...)`) but their constructors are no longer part of the public API (runtime token + `@internal` JSDoc). When a recorder's interceptor is replaced or the manager is destroyed, the recorder is notified via `onDetached()` and its `isRecording` state is reset to `false`; no stale state.
- **`KeyStateTracker.getInstance()` removed**: the EventDispatcher owns the KeyStateTracker instance. Consumers access it via `manager.getKeyStateTracker()`. The class is still exported for type usage. The `destroy()` method is internal; consumers should not call it directly.
- **`ListenerRegistry` removed**: both `internal/listener-registry.ts` and the public re-export `listener-registry.ts` are deleted. No replacement needed; functionality absorbed by EventDispatcher and `composedPath()` matching.
- **`dispatch-core` public re-export removed**: the top-level `dispatch-core.ts` re-export wrapper is deleted. The internal module `internal/dispatch-core.ts` remains but is not part of the public API. Anyone importing `ui5/hotkeys/dispatch-core` will see a broken import.
- **`dom` public re-export removed**: the top-level `dom.ts` re-export wrapper (`getEventTarget`, `isInputElement`) is deleted. These are internal dispatch utilities; consumers use the `ignoreInputs` option instead. Anyone importing `ui5/hotkeys/dom` will see a broken import.
- **`skip-reason` public re-export removed**: the top-level `skip-reason.ts` re-export wrapper (`recordSkip`, `SkipInfo`, `DebugSkipEntry`) is deleted. These are internal debug/dispatch infrastructure with no consumer use case. Anyone importing `ui5/hotkeys/skip-reason` will see a broken import.
- **Nested target-scoped registrations for the same key**: currently, when two nested targets both have registrations for the same key, both callbacks fire independently (outermost first during capture phase). In the new design, only the **innermost** matching target's callback fires, regardless of `stopPropagation`. The `stopPropagation` flag on a target-scoped registration controls whether outer target nodes are checked for debug/skip-reason tracking, NOT whether outer targets match (only the innermost ever fires). This is a deliberate behavioral change; the old "fire all" behavior was an artifact of having independent per-target DOM listeners, not an intentional design choice.
- **Active-scope target registrations take precedence over global-scope targets**: currently, target listeners fire independently based on DOM capture order, so an active-scope and a global-scope target listener for the same key on different elements can both fire. In the new design, `_matchTargetRegistrations` uses scope-first ordering: active-scope targets are checked before global-scope targets, regardless of DOM position. A global-scope target registration only matches if no active-scope target matched. If existing code relies on both an active-scope and global-scope target callback firing for the same key, refactor to use a single scope or register both in the same scope at different nesting levels.
- **Target-scoped hotkey callbacks now execute before sequence processing**: currently, document-level hotkey matching and sequence matching run at the document level, while target-scoped listeners fire later when DOM capture reaches each target element. In the new design, step 5 runs all hotkey matching (document + target-scoped) before step 6 runs sequence matching. Target-scoped callbacks now execute before sequences see the event.
- **`target: document` behavioral change**: Currently, `target: document` attaches a capture listener directly on `document`, which fires early in the capture phase (same timing as document-level registrations). In the new design, `target: document` is treated as a target-scoped registration indexed in `bucket.targets`. During `composedPath()` iteration, `document` appears near the outermost end of the path, so it behaves like a very-outer target, not like a document-level registration. Priority is lower than document-level registrations and lower than any element-target registration. In practice `target: document` is unlikely (omitting `target` achieves the same effect with better priority), but existing code using it will see a priority change. The `target` type remains `HTMLElement | Document`; narrowing to `HTMLElement` only is deferred to avoid unnecessary breakage.
- **Closed shadow root targets no longer match**: current per-element listeners fire regardless of shadow DOM boundaries. In the new design, `composedPath()` stops at closed shadow root boundaries, so registrations on elements inside closed shadow roots will not match. Open shadow roots are unaffected. See "Known limitations" in the Target-scoped hotkeys section.
- **Detached targets no longer match**: current per-element listeners fire regardless of DOM attachment. In the new design, `composedPath()` does not include detached elements, so registrations on detached targets will not match. If a target is temporarily removed from the DOM (e.g., during a re-render), hotkeys bound to it are inactive until it is reattached.
- **`stopPropagation` option governs target-skipping, not DOM state**: currently, a callback calling `event.stopPropagation()` directly affects whether subsequent target listeners fire, even when the registration's `stopPropagation` option is `false`. In the new design, target-skipping is determined solely by the `stopPropagation` option on the registration. The pipeline does not inspect the DOM event's propagation state for matching decisions.
- **`stopPropagation: true` now suppresses `document`-level listeners (UI5, third-party)**: currently, `stopPropagation()` is called on a `document` capture listener. Other `document` listeners (same target) still fire: UI5 UIArea keyboard delegation, PseudoEvent processing, and third-party `document` capture listeners are unaffected. In the new design, `stopPropagation()` is called on a `window` capture listener, where `document` is a child target. The event no longer reaches `document` at all. Since `stopPropagation` defaults to `true`, every matched hotkey registration and every completed sequence match now also blocks UI5 UIArea keyboard event delegation for that event. This is a stronger blocking effect. Registrations and sequences with `stopPropagation: false` are unaffected; the event propagates normally. **Concrete impact examples:**
  - `Escape` registered as a global hotkey (default `stopPropagation: true`) now blocks UI5 dialog's built-in escape-to-close behavior. Use `stopPropagation: false` if the dialog's own handler should also fire.
  - Arrow keys registered as hotkeys block `sap.m.Table` / `sap.m.List` row navigation for matched events. Use `stopPropagation: false` or scope the registration to non-table views.
  - `Tab` registered as a hotkey blocks UI5 focus chain management. Avoid registering `Tab` with `stopPropagation: true` unless the library should fully own focus behavior for that context.
  - Completed sequence matches (e.g., `G → I`) with `stopPropagation: true` (the default) also block document-level listeners for the final key event. The same mitigation applies: use `stopPropagation: false` on sequence registrations where UI5 should still process the final key.

  **Migration checklist:** Before rollout, audit all registrations for the following high-risk keys and add `stopPropagation: false` where UI5 or browser behavior must be preserved:
  - `Escape`: UI5 dialog/popover close handlers
  - `Tab` / `Shift+Tab`: UI5 focus chain management
  - `Arrow` keys: `sap.m.Table`, `sap.m.List`, `sap.m.Select` keyboard navigation
  - `Enter`: `sap.m.Button` press, form submission
  - `F5` / `F6`: SAP Fiori shell area navigation (`F6` groups)
  - `Space`: `sap.m.CheckBox`, `sap.m.Button` activation

  **Automation:** Consider adding a build-time or lint-time audit that warns when any of the above keys are registered with `stopPropagation: true` (the default). A simple grep-based check in CI (scan `register()` / `registerSequence()` calls for high-risk key strings without an explicit `stopPropagation: false`) would catch regressions before they reach production. This can be a follow-up task, not a blocker for the initial implementation.

### Changed (non-breaking)

- **`stopPropagation` and target-scoped registrations**: document-level `stopPropagation: true` currently prevents target-listener keydown via DOM propagation. In the new design, target-scoped registrations are checked first; if a target match has `stopPropagation: true`, document-level registrations are skipped. This inverts the old DOM-ordering-based priority (document→target) in favor of target-first priority, which is more natural for component-scoped UI patterns (inner/specific components override global handlers).
- **KeyStateTracker now updates during HotkeyRecorder recording**: currently, HotkeyRecorder calls `stopImmediatePropagation()` on `window` capture, which prevents KeyStateTracker's `document` capture handlers from seeing keydown events. KeyStateTracker goes stale during recording. In the new design, step 1 (key state tracking) runs before step 2 (interceptor), so KeyStateTracker sees all keydown events including those consumed by the recorder. This is the correct behavior (held-key state should always be accurate), but it is a change. Consumers that observe KeyStateTracker state during recording and rely on it being frozen/stale would be affected.

## Alternatives Considered

- **DOM-only ordering tricks** (`window` capture + `stopImmediatePropagation`): Fragile if listener topology changes. Does not solve dispatch coordination or lifecycle coupling.
- **Global singleton boolean flag for suspension**: Works but less safe than RAII guard handles for nested callers.
- **Consumer/priority interface** (generic `KeyEventConsumer` with priority ordering): Over-abstracted for a fixed set of collaborators (key state, recorder, hotkeys, sequences). A concrete pipeline is simpler and easier to reason about.
- **Keep per-target listeners, add dispatcher on top**: Adds complexity without removing the scattered listener problem. `composedPath()` check is strictly simpler.
