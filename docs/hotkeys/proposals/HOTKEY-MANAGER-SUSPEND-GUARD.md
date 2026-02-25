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

No API-level way to pause dispatch for modal capture scenarios (recording, onboarding overlays, guided tours). HotkeyRecorder relies on `stopImmediatePropagation()` at the DOM level.

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
       (no library listeners — composedPath() check instead)

  Result:
    - 3 addEventListener calls on 1 DOM target (window)
    - Deterministic pipeline — no ordering ambiguity
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

Introduce a single internal `EventDispatcher` that owns all keyboard event listeners, provides a deterministic dispatch pipeline, and exposes an RAII-style suspend guard — eliminating every implicit ordering dependency and scattered listener.

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
- Single attachment point — one `keydown`, one `keyup`, one `blur`.
- HotkeyRecorder already uses `window` capture for the same reason; consolidating removes the implicit ordering between recorder and manager.

### Pipeline design decisions

- **Step 1 (key state) before everything** — KeyStateTracker must see ALL keydowns including modifier-only and IME events. It tracks state, never consumes.
- **Step 2 (interceptor) before pre-filter** — HotkeyRecorder needs to capture and block modifier-only and IME keydowns during recording. It `preventDefault()`s consumed events.
- **Step 4 (guards) after pre-filter** — Suspended dispatch still lets key state tracking and pre-filtering work normally. Guards only block hotkey/sequence dispatch. The dispatcher does NOT call `preventDefault()` on suspended events — suspension blocks library callbacks but does not suppress browser defaults (e.g., F5, Ctrl+S). Consumers who need full browser-default suppression during a modal overlay should use the interceptor mechanism instead (which has full control over DOM event manipulation).
- **Steps 5+6 independent, then 7** — Hotkey matching and sequence matching run independently. Unhandled emits only if neither consumed the event. No deferred state, no WeakMaps. Note: `processSequences` returns `true` both for full sequence matches AND for partial matches (a key advanced an in-progress sequence). This ensures partial sequences suppress unhandled emission — consistent with current behavior where `sequenceConsumedEvents` covers both cases.
- **`stopPropagation`/`preventDefault` call sites** — These are called by the handler (HotkeyManager inside `processHotkeys`, SequenceManager inside `processSequences`) or by the interceptor (`preventDefault` in HotkeyRecorder), NOT by EventDispatcher. The dispatcher never manipulates DOM events directly — it only controls its own pipeline. This ensures registrations with `stopPropagation: false` work correctly and interceptors have full control over their DOM event behavior.
- **`window` capture impact on other frameworks** — Moving from `document` capture to `window` capture changes how `stopPropagation()` interacts with external listeners. When HotkeyManager calls `stopPropagation()` on `window` capture, the event will not reach `document` at all — affecting UI5 UIArea keyboard event delegation, PseudoEvent processing, and any other `document`-level listeners. This is the same behavior HotkeyRecorder already has today (it calls `stopImmediatePropagation()` on `window` capture). For registrations with `stopPropagation: false`, the event continues to propagate normally.

### Target-scoped hotkeys via `composedPath()`

Per-element listeners are replaced by a `composedPath()` membership check during matching. When a registration has a `target`, the dispatcher checks whether that target appears in the event's composed path. Zero additional listeners.

**Behavioral change vs current:** Today, if two nested targets both have registrations for the same key (e.g., `Ctrl+S` on both an outer and inner element), both target listeners fire independently during capture phase and both callbacks execute (unless one uses `stopPropagation`). In the new design, target-scoped matching iterates from innermost to outermost target in the `composedPath()`, and only the **first (innermost)** matching registration fires. This is a deliberate change — innermost-wins is consistent with CSS specificity and user expectation. If the current "fire all" behavior is needed, it should be explicitly re-introduced via an `allowBubble` option in a future proposal.

**Priority ordering:**

1. Document-level registrations are checked first.
2. If a document-level registration matches with `stopPropagation: true`, target-scoped registrations for the same key are skipped entirely.
3. If no document match with `stopPropagation`, or document matched without `stopPropagation`: target-scoped registrations are checked innermost-first via `composedPath()` order.
4. A target-scoped registration with `stopPropagation: true` prevents outer target-scoped registrations for the same key from matching (enforced explicitly in the pipeline, not via DOM propagation).

**Semantic change: `stopPropagation` option vs `event.stopPropagation()` in callbacks.** Currently, a callback calling `event.stopPropagation()` directly affects target listener behavior even when the registration's `stopPropagation` option is `false`. In the new design, target-skipping is determined solely by the `stopPropagation` option on the registration — the pipeline does not inspect the DOM event's propagation state. This is intentional: the dispatch pipeline owns matching decisions, not side effects in callbacks.

**Migration for "fire all" nested targets:** If existing code relies on both an outer and inner target callback firing for the same key, refactor to register only on the innermost element — or use separate scopes so both registrations match independently.

**Known limitations of `composedPath()`:**

- **Closed shadow roots:** `composedPath()` stops at closed shadow root boundaries. If a target element is inside a closed shadow root and the event originates from outside, the target will not appear in the path and the registration will not match. Current per-element listeners work regardless of shadow DOM boundaries because the listener is attached directly on the element.
- **Detached targets:** If a target element is detached from the DOM when the key event fires, `composedPath()` will not include it. Registrations bound to detached elements will not match.
- **Cross-document / iframe targets:** `composedPath()` does not cross document boundaries. Target-scoped registrations on elements inside iframes will not match events from the parent document. This is the same behavior as today (iframe elements have independent event dispatch).

These limitations are acceptable for the intended use cases (panel-scoped hotkeys, dialog-scoped hotkeys). If closed shadow root support is needed, it should be addressed in a separate proposal.

## Proposed API

### Suspend guard (public, on HotkeyManager)

```ts
interface KeyboardDispatchGuard {
  release(): void;
  readonly isActive: boolean;
}

class HotkeyManager {
  suspendDispatch(reason?: string): KeyboardDispatchGuard;
  isDispatchSuspended(): boolean;

  /** Factory — hides EventDispatcher from consumers. */
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
}

class EventDispatcher {
  setInterceptor(interceptor: KeyEventInterceptor): void;
  /** Owner-safe clear: only clears if current interceptor === owner. */
  clearInterceptor(owner: KeyEventInterceptor): void;
}
```

Used internally by HotkeyRecorder — not exposed to library consumers.

### Constructor contract (internal)

EventDispatcher receives its collaborators via constructor — no null-union callbacks, no optional wiring:

```ts
interface HotkeyDispatchHandler {
  /** Hotkey dispatch — receives pre-filtered, non-suspended keydowns. Returns true if consumed. */
  processHotkeys(event: KeyboardEvent): boolean;

  /** Sequence dispatch — same contract. Returns true if consumed (full match OR partial advance). */
  processSequences(event: KeyboardEvent): boolean;

  /**
   * Unhandled emission — called when the event was not consumed.
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

**Internal-only interface.** `HotkeyDispatchHandler` is package-internal — it is NOT exported from the library. HotkeyManager implements this interface, but `processHotkeys`, `processSequences`, and `emitUnhandled` are internal methods (prefixed with `/** @internal */` JSDoc). They are not part of the public API surface. To enforce this in TypeScript, HotkeyManager passes an anonymous handler object to the EventDispatcher constructor rather than passing `this` directly:

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

**Side-effect coupling:** `processHotkeys` returns `boolean` (consumed or not) but also stores skip information in `_lastSkipInfo` as a side effect. `emitUnhandled` reads `_lastSkipInfo` when `forcedReason` is null. This coupling is acceptable because both methods live on the same HotkeyManager instance and the call order is guaranteed by the EventDispatcher pipeline (step 5 before step 7). The alternative — returning a richer result type — was considered but rejected as over-engineering given the fixed call order.

KeyStateTracker is not part of this interface — the dispatcher owns it directly and calls `processKeyDown`/`processKeyUp`/`processBlur` on the instance. The `HotkeyDispatchHandler` only contains things HotkeyManager provides.

KeyStateTracker receives `platform` from the EventDispatcher constructor (for the macOS stuck-key workaround), rather than re-detecting it independently.

## Behavioral Contract

### Suspend guards

- Suspension is reference-counted via guard instances (supports nested usage).
- While any guard is active, hotkey and sequence callbacks do NOT fire.
- While suspended, the unhandled callback fires with `UnhandledReason.Suspended` (via the `forcedReason` parameter on `emitUnhandled`). This lets consumers distinguish "no match" from "deliberately blocked".
- **Suspension does NOT call `preventDefault()`.** Browser defaults (F5 refresh, Ctrl+S save, etc.) still fire while dispatch is suspended. Suspension only blocks library-managed callbacks and sequences. This is deliberate: the suspend guard is for pausing library behavior during modal UI, not for suppressing all keyboard input. Consumers who need full keyboard suppression (including browser defaults) should use the interceptor mechanism (via `createRecorder()` or a custom interceptor) which has full control over `preventDefault()`.
- Key state tracking continues during suspension.
- `destroy()` invalidates all outstanding guards and resets suspension state.
- `release()` is idempotent — double-release does not throw or decrement below zero.
- Optional `reason` is debug-only metadata (no runtime behavior changes).

### Interceptor

- Only one interceptor may be active at a time.
- Setting a new interceptor while one is active replaces it (no stacking). **Warning:** Replacing an active interceptor leaves the prior interceptor's internal state stale (e.g., a HotkeyRecorder whose `_recording` flag is `true` but whose interceptor was replaced will no longer receive events). `setInterceptor` logs a warning when replacing an active interceptor to surface this during development. Consumers must coordinate interceptor lifecycle externally — the dispatcher does not notify the replaced interceptor.
- `clearInterceptor(owner)` only clears if the current interceptor matches the argument — prevents one recorder from accidentally clearing another's interceptor.
- Key state tracking continues while an interceptor is active.
- When an interceptor consumes an event (`onKeyDown` returns `true`), the EventDispatcher stops its own pipeline but does NOT call `stopImmediatePropagation()`. The interceptor itself is responsible for any DOM event manipulation it needs (`preventDefault()`, `stopPropagation()`, `stopImmediatePropagation()`, etc.). This keeps the decision with the interceptor — the dispatcher only controls its own pipeline.
- **HotkeyRecorder retains `stopImmediatePropagation()` by default.** Today, HotkeyRecorder calls `stopImmediatePropagation()` which blocks both the library's own document listener AND any non-library `window` capture listeners. The README documents this as a contract: "all keyboard input is blocked." In the new design, blocking the library's own pipeline is handled structurally (interceptor return value), but HotkeyRecorder's `onKeyDown` continues to call `stopImmediatePropagation()` in addition to `preventDefault()` to preserve the documented blocking contract. This ensures non-library `window` capture listeners do not see keydown events during recording, which is the expected behavior for a modal recording UI. The dispatcher does not need `stopImmediatePropagation()` for its own pipeline — but it does not prevent the interceptor from calling it either.

### Lifecycle

- EventDispatcher is a plain class instantiated by HotkeyManager in its constructor (not a singleton — its single-instance nature comes from HotkeyManager being a singleton).
- `HotkeyManager.destroy()` calls `EventDispatcher.destroy()`:
  - Removes all `window` listeners.
  - Invalidates all outstanding guards.
  - Clears interceptor.
  - Destroys owned KeyStateTracker.
- `HotkeyManager.getInstance()` after destroy creates a fresh manager with a fresh dispatcher.

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
  // 1. Key state tracking — ALWAYS, even for modifiers/IME
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

- `_dispatcher: EventDispatcher` — created in constructor (receives anonymous handler object wrapping private methods), destroyed in `destroy()`.
- `suspendDispatch(reason?)` — public, delegates to `_dispatcher.suspendDispatch()`.
- `isDispatchSuspended()` — public, delegates to `_dispatcher.isDispatchSuspended()`.
- `createRecorder(options)` — public factory, passes `_dispatcher` to `new HotkeyRecorder(options, dispatcher)`. Consistent with `createGroup()` pattern.
- `getKeyStateTracker()` — public getter, returns `_dispatcher.keyStateTracker`. Replaces `KeyStateTracker.getInstance()` for consumers that need held-key state.
- `_processHotkeys(event): boolean` — private, implements `HotkeyDispatchHandler.processHotkeys` via anonymous handler. Replaces `_processKeyEvent`. Returns `boolean` (consumed or not). Runs document-level registrations first, then target-scoped (innermost-first via `composedPath()`). Stores skip info in `_lastSkipInfo` for `_emitUnhandled`. See Phase 4 for detailed pseudocode.
- `_processSequences(event): boolean` — private, implements `HotkeyDispatchHandler.processSequences` via anonymous handler. Delegates to `_sequenceManager?.processKeyEvent(event) ?? false`.
- `_emitUnhandled(event, forcedReason): void` — private, implements `HotkeyDispatchHandler.emitUnhandled` via anonymous handler. If `forcedReason` is non-null, uses it directly. Otherwise uses `_lastSkipInfo` for the most specific reason.

**Debug mode:** The existing `_logDebugEvent` method and `_debugMode` flag remain on HotkeyManager. Debug logging fires inside `_processHotkeys` (after matching) and inside `_emitUnhandled` (for unhandled events). The EventDispatcher has no knowledge of debug mode.

### Phase 3: New UnhandledReason values

Add to `UnhandledReason` enum in `library.ts` (needed by Phase 4's `TargetMismatch` skip):

- `TargetMismatch` — registration matched key combo but event target is outside the registration's target element.
- `Suspended` — dispatch was suspended via guard when the event arrived.

Update `skip-reason.ts` priority map accordingly.

### Phase 4: Target-scoped matching via `composedPath()`

Simplify `ScopeRegistrationBucket` from split structure to flat set:

```ts
// Before:
interface ScopeRegistrationBucket {
  documentIds: Set<string>;
  targets: Map<EventTarget, Set<string>>;
}

// After:
// ScopeRegistrationBucket is just Set<string> — all registration IDs in one set.
```

In `dispatch-core.ts`, add `eventPath` to `FindMatchOptions`:

```ts
interface FindMatchOptions {
  event: KeyboardEvent;
  isInput: boolean;
  popupOpen: boolean;
  eventPath: EventTarget[]; // NEW — pre-computed composedPath()
  registrations: ReadonlyArray<HotkeyRegistration>;
  skipInfo?: SkipInfo | null;
  debugSkips?: DebugSkipEntry[] | null;
  toRegistrationInfo: (reg: HotkeyRegistration) => HotkeyRegistrationInfo;
  logComponent: string;
}
```

Add target path checking during `findMatchInScope`, after key-match but before other checks:

```ts
// For target-scoped registrations, skip if target is not in event's composedPath
if (opts.target && !eventPath.includes(opts.target)) {
  recordSkip(skipInfo, UnhandledReason.TargetMismatch, registration, toRegistrationInfo);
  if (debugSkips) debugSkips.push({ registration, reason: UnhandledReason.TargetMismatch });
  continue;
}
```

`_processHotkeys` enforces three-tier priority (document → innermost target → outer targets):

```ts
_processHotkeys(event: KeyboardEvent): boolean {
  const eventPath = event.composedPath();
  const activeScope = this.getActiveScope();
  const target = getEventTarget(event);
  const isInput = isInputElement(target);
  const popupOpen = this._checkPopupOpen();
  const skipInfo: SkipInfo | null = this._unhandledCallback
    ? { reason: UnhandledReason.NoMatch }
    : null;
  const debugSkips: DebugSkipEntry[] | null = this._debugMode ? [] : null;

  // Pass 1: document-level registrations (no target)
  const docMatch = this._matchDocumentRegistrations(
    event, eventPath, activeScope, isInput, popupOpen, skipInfo, debugSkips,
  );

  if (docMatch) {
    this._executeMatch(event, docMatch);
    // If matched with stopPropagation, skip target-scoped registrations entirely.
    // This is the ONLY case where a document-level match prevents target matching.
    if (docMatch.options.stopPropagation) return true;
    // NOTE: document match WITHOUT stopPropagation allows target-scoped matching
    // to proceed. If a target also matches, BOTH callbacks fire. This is intentional:
    // a document-level Ctrl+S (e.g., global save) with stopPropagation: false allows
    // a panel-scoped Ctrl+S to also fire. To prevent this, use stopPropagation: true.
  }

  // Pass 2: target-scoped registrations — innermost target in composedPath wins.
  // Iterate composedPath from index 0 (innermost) outward.
  // For each node that is a registered target, attempt matching.
  // Target-skipping is determined by the stopPropagation OPTION on the registration,
  // not by whether the callback called event.stopPropagation() directly.
  const targetMatch = this._matchTargetRegistrations(
    event, eventPath, activeScope, isInput, popupOpen, skipInfo, debugSkips,
  );
  if (targetMatch) return true;

  // Debug logging
  if (this._debugMode) {
    this._logDebugEvent(event, activeScope, isInput, popupOpen, docMatch ?? null, debugSkips);
  }

  // Store skipInfo for _emitUnhandled (called by EventDispatcher in step 7)
  this._lastSkipInfo = skipInfo;

  return docMatch !== null; // document match without stopPropagation still counts as consumed
}
```

`_matchTargetRegistrations` iterates the `composedPath()` from index 0 (innermost) outward. For each node, it checks if any registrations in the current scope are bound to that target. The first (innermost) match wins. If the matched registration has `stopPropagation: true`, outer target-scoped registrations are not checked.

The `_indexRegistration` / `_deindexRegistration` methods simplify to flat set add/delete.

### Phase 5: ListenerRegistry removal

Delete `internal/listener-registry.ts` and the public re-export wrapper `listener-registry.ts` (which is just `import ListenerRegistry from "./internal/listener-registry"; export default ListenerRegistry;`). Any tests that import from either file need updating or removal. All responsibilities absorbed:

| Responsibility                                     | New owner                              |
| -------------------------------------------------- | -------------------------------------- |
| `attachDocument()` / `detachDocument()`            | EventDispatcher (window, not document) |
| `attachTarget()` / `detachTarget()` / ref-counting | Removed — `composedPath()` check       |
| `hasTarget()`                                      | Removed                                |
| `_shouldEmitUnhandledForTarget()`                  | No longer needed — see below           |

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

KeyStateTracker lifecycle ties to EventDispatcher — created in the dispatcher's constructor, destroyed when the dispatcher is destroyed. `KeyStateTracker.getInstance()` is removed (delete the static method and module-level `instance` variable); the dispatcher owns the instance and exposes it via a `keyStateTracker` getter. Consumers access it through `manager.getKeyStateTracker()`.

KeyStateTracker's constructor changes to accept `platform: Platform` as a parameter instead of calling `runtimeHooks.detectPlatform()` internally. The EventDispatcher passes its own `platform` value, ensuring a single source of truth for platform detection.

**Visibility and importability:** `KeyStateTracker` remains a named export from the library (consumers need the type for variable declarations like `const tracker: KeyStateTracker = manager.getKeyStateTracker()`). However, the constructor is no longer part of the public API — direct `new KeyStateTracker(...)` instantiation is unsupported. This is enforced by convention (JSDoc `@internal` on the constructor) rather than by TypeScript access modifiers, since TS does not support package-private constructors. The barrel export continues to export the class for type usage. The `destroy()` method on KeyStateTracker becomes internal — consumers should not call it directly; it is called by EventDispatcher when the manager is destroyed.

### Phase 7: HotkeyRecorder interceptor migration

Replace own `window` listener with EventDispatcher interceptor API. Consumers create recorders via `manager.createRecorder()` instead of direct instantiation — keeps EventDispatcher internal.

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
// Constructor takes dispatcher as explicit dependency (hidden by factory):
constructor(options: HotkeyRecorderOptions, dispatcher: EventDispatcher) {
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
  this._dispatcher.clearInterceptor(this);
}

// Implements KeyEventInterceptor:
onKeyDown(event: KeyboardEvent): boolean {
  event.preventDefault();
  event.stopImmediatePropagation(); // retains documented "all keyboard input is blocked" contract
  // ... existing recording logic (Escape, Backspace/Delete, modifier-only, combo) ...
  return true; // consumed — dispatcher stops its pipeline
}
```

Factory on HotkeyManager:

```ts
createRecorder(options: HotkeyRecorderOptions): HotkeyRecorder {
  return new HotkeyRecorder(options, this._dispatcher);
}
```

### Phase 8: Unhandled callback simplification

Remove from HotkeyManager:

- `_deferredUnhandledByEvent` WeakMap
- `_flushDeferredUnhandled()` method
- `deferUnhandled` parameter on `_processKeyEvent`
- `handledEvents` / `sequenceConsumedEvents` module-level WeakSets

The EventDispatcher handles unhandled emission directly:

```ts
// Step 4 — suspended:
if (this._guards.size > 0) {
  this._handler.emitUnhandled(event, UnhandledReason.Suspended);
  return;
}

// ... steps 5+6 ...

// Step 7 — neither consumed:
if (!hotkeyConsumed && !sequenceConsumed) {
  this._handler.emitUnhandled(event, null); // HotkeyManager uses its own skip tracking
}
```

HotkeyManager's `_emitUnhandled(event, forcedReason)` implementation: if `forcedReason` is non-null, use it directly. If null, use `this._lastSkipInfo` (populated during `_processHotkeys`) to determine the most specific reason.

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

New tests:

| Test                                                     | Assertion                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Suspend: single guard blocks dispatch                    | Guard active → hotkey callback does NOT fire                                                                                                 |
| Suspend: nested guards                                   | Two guards, release one → still suspended; release both → resumes                                                                            |
| Suspend: `destroy()` invalidates guards                  | Manager destroyed → `guard.isActive === false`, `guard.release()` no-op                                                                      |
| Suspend: `release()` is idempotent                       | Double-release does not throw or decrement below zero                                                                                        |
| Suspend: key state tracks during suspension              | Guard active → `KeyStateTracker.getHeldKeys()` still updates                                                                                 |
| Suspend: browser defaults leak during suspension         | Guard active → `preventDefault()` NOT called → browser Ctrl+S fires                                                                          |
| Suspend: unhandled fires with Suspended reason           | Guard active → unhandled callback receives `UnhandledReason.Suspended`                                                                       |
| Interceptor: recorder blocks hotkeys                     | Recorder `start()` → keydown → recorder callback fires, manager does NOT                                                                     |
| Interceptor: recorder blocks non-library listeners       | Recorder active → `stopImmediatePropagation()` called → external `window` capture listener does NOT fire                                     |
| Interceptor: auto-clears on stop                         | Recorder `stop()` → keydown → manager processes normally                                                                                     |
| Interceptor: key state tracks during recording           | Recorder active → `KeyStateTracker.getHeldKeys()` still updates                                                                              |
| Interceptor: clearInterceptor is owner-safe              | `clearInterceptor(a)` when current is `b` → no-op                                                                                            |
| Interceptor: replacement warns                           | `setInterceptor(b)` while `a` is active → warning logged                                                                                     |
| Interceptor: multi-recorder contention                   | RecorderA starts, RecorderB starts (replaces A) → RecorderA.isRecording still true but receives no events                                    |
| Interceptor: destroy-while-recording                     | Recorder active → `manager.destroy()` → interceptor cleared, recorder.isRecording state is stale                                             |
| Target-scoped: composedPath match                        | Focus within target → callback fires                                                                                                         |
| Target-scoped: composedPath miss                         | Focus outside target → callback does NOT fire                                                                                                |
| Target-scoped: document priority                         | Document `stopPropagation: true` with same key → target-scoped skipped                                                                       |
| Target-scoped: document without stopPropagation + target | Both callbacks fire (doc first, then target)                                                                                                 |
| Target-scoped: nested targets, innermost wins            | Two nested targets, same key → only innermost callback fires                                                                                 |
| Target-scoped: nested targets with stopPropagation       | Inner target with `stopPropagation: true` → outer target callback does NOT fire                                                              |
| Target-scoped: nested targets, different keys            | Inner target `Ctrl+S`, outer target `Ctrl+D` → both fire for their respective keys                                                           |
| Target-scoped: stopPropagation option vs callback        | Registration `stopPropagation: false`, callback calls `event.stopPropagation()` → outer target still matches (option governs, not DOM state) |
| Unhandled: synchronous emission                          | Unhandled fires after both passes, no deferred state                                                                                         |
| Unhandled: sequence consumed suppresses unhandled        | Full sequence match → unhandled NOT called                                                                                                   |
| Unhandled: partial sequence suppresses unhandled         | First key of multi-key sequence → unhandled NOT called                                                                                       |
| Unhandled: suspended reason                              | Guard active → unhandled fires with `Suspended` reason via `forcedReason`                                                                    |
| Unhandled: target mismatch reason                        | Target-scoped miss → unhandled with `TargetMismatch` reason                                                                                  |
| Lifecycle: destroy removes window listeners              | After destroy, no callbacks fire                                                                                                             |
| Lifecycle: re-create after destroy                       | Fresh `getInstance()` works after destroy                                                                                                    |
| Regression: update nested-target tests                   | Existing nested-target tests updated from "fire all" to "innermost wins" semantics                                                           |
| Regression: update recorder tests                        | Existing recorder tests updated from `new HotkeyRecorder()` to `manager.createRecorder()`                                                    |
| Regression: update KeyStateTracker tests                 | Existing tests updated from `KeyStateTracker.getInstance()` to `manager.getKeyStateTracker()`                                                |

## Implementation Checklist

### Core infrastructure

- [ ] Create `internal/event-dispatcher.ts` — plain class (not a singleton), `window` capture listeners (`keydown`, `keyup`), `window` bubble listener (`blur`)
- [ ] Implement keydown pipeline (7 steps: key state → interceptor → pre-filter → guard → hotkeys → sequences → unhandled)
- [ ] When interceptor consumes event, stop pipeline — interceptor handles its own DOM event manipulation (`preventDefault`, `stopImmediatePropagation`, etc.)
- [ ] Implement `keyup` forwarding to key state callback
- [ ] Implement `blur` forwarding to key state callback
- [ ] Move pre-filter logic from `HotkeyManager._shouldIgnoreKeyEvent` into EventDispatcher (`_shouldFilter`)
- [ ] Move AltGr detection (`_lastAltLocation`) from HotkeyManager into EventDispatcher
- [ ] Implement `destroy()` — remove all listeners, invalidate guards, clear interceptor, destroy owned KeyStateTracker

### Suspend guard API

- [ ] Implement `suspendDispatch(reason?)` on EventDispatcher — returns `KeyboardDispatchGuard`, adds to `Set<guard>`
- [ ] Implement `isDispatchSuspended()` on EventDispatcher — returns `this._guards.size > 0`
- [ ] Guard `release()` — idempotent, removes from set, sets `isActive = false`
- [ ] Guard invalidation on `destroy()` — iterate set, set `isActive = false`, clear
- [ ] Add `suspendDispatch(reason?)` on HotkeyManager — delegates to `_dispatcher`
- [ ] Add `isDispatchSuspended()` on HotkeyManager — delegates to `_dispatcher`
- [ ] Export `KeyboardDispatchGuard` interface from `types.ts`

### Interceptor API

- [ ] Implement `setInterceptor(interceptor)` on EventDispatcher — log warning if replacing an active interceptor
- [ ] Implement `clearInterceptor(owner)` on EventDispatcher — owner-safe (only clears if current === owner)
- [ ] Define `KeyEventInterceptor` interface in `event-dispatcher.ts`

### HotkeyManager refactoring

- [ ] Create anonymous `HotkeyDispatchHandler` object in constructor wrapping private methods (`_processHotkeys`, `_processSequences`, `_emitUnhandled`)
- [ ] Create `_dispatcher` field — instantiate in constructor with anonymous handler object, destroy in `destroy()`
- [ ] Refactor `_processKeyEvent` → `_processHotkeys` (private) — returns `boolean`, no `deferUnhandled`/`emitUnhandled` params, stores skip info in `_lastSkipInfo`
- [ ] Implement `_processSequences` (private) — delegates to `_sequenceManager?.processKeyEvent(event) ?? false`
- [ ] Implement `_emitUnhandled(event, forcedReason)` (private) — uses `forcedReason` if non-null, otherwise `_lastSkipInfo`
- [ ] Add `getKeyStateTracker()` — public getter, returns `_dispatcher.keyStateTracker`
- [ ] Remove `_keydownHandler` field and `_onKeyDown()` method
- [ ] Remove `_attachListeners()` / `_detachListeners()`
- [ ] Remove `_shouldIgnoreKeyEvent()`
- [ ] Remove `_lastAltLocation`
- [ ] Remove `_listenerRegistry` field and all usages
- [ ] Remove `_deferredUnhandledByEvent` WeakMap
- [ ] Remove `_flushDeferredUnhandled()`
- [ ] Remove `_hasTargetListenerInPath()`
- [ ] Remove module-level `handledEvents` and `sequenceConsumedEvents` WeakSets
- [ ] Remove `_attachTargetListener()` / `_detachTargetListener()`

### Target-scoped matching overhaul

- [ ] Add `eventPath: EventTarget[]` to `FindMatchOptions` interface in `dispatch-core.ts`
- [ ] Add `composedPath()` check in `findMatchInScope` — skip target-scoped registrations whose target is not in the path, record `TargetMismatch` skip
- [ ] Flatten `ScopeRegistrationBucket` — single `Set<string>` instead of `documentIds` + `targets` map
- [ ] Simplify `_indexRegistration` / `_deindexRegistration` — flat set add/delete
- [ ] Simplify `_getScopeRegistrations` — single set lookup, no target branching
- [ ] Implement `_matchTargetRegistrations` — iterate `composedPath()` from index 0 (innermost) outward, matching registrations bound to each target; first (innermost) match wins; `stopPropagation: true` on a match skips outer targets
- [ ] Pass pre-computed `composedPath()` array through the matching pipeline (avoid redundant calls — `composedPath()` returns a new array each call)

### ListenerRegistry removal

- [ ] Delete `internal/listener-registry.ts`
- [ ] Delete `listener-registry.ts` (public re-export wrapper)
- [ ] Remove or update any tests that import from `listener-registry` or `internal/listener-registry`
- [ ] Remove ListenerRegistry import from `HotkeyManager.ts`
- [ ] Remove all `ListenerRegistry` references in `HotkeyManager` constructor and `destroy()`

### KeyStateTracker integration

- [ ] Rename `_onKeyDown` → `processKeyDown` (public)
- [ ] Rename `_onKeyUp` → `processKeyUp` (public)
- [ ] Rename `_onBlur` → `processBlur` (public)
- [ ] Remove `addEventListener` calls from constructor
- [ ] Remove `removeEventListener` calls from `destroy()`
- [ ] Change KeyStateTracker constructor to accept `platform: Platform` parameter (replaces internal `runtimeHooks.detectPlatform()` call)
- [ ] Add `/** @internal */` JSDoc to constructor (not part of public API)
- [ ] Add `/** @internal */` JSDoc to `destroy()` (called by EventDispatcher, not consumers)
- [ ] EventDispatcher creates KeyStateTracker in constructor (passing `platform`), exposes via `keyStateTracker` getter
- [ ] Remove `KeyStateTracker.getInstance()` static method and module-level `instance` variable
- [ ] Keep `KeyStateTracker` as named export from barrel (consumers need the type for variable declarations)
- [ ] EventDispatcher calls `processKeyDown`/`processKeyUp`/`processBlur` directly (not via callbacks)
- [ ] Tie KeyStateTracker lifecycle to EventDispatcher — created and destroyed by dispatcher

### HotkeyRecorder migration

- [ ] Change constructor to accept `EventDispatcher` as explicit dependency
- [ ] Add `createRecorder(options)` factory method on HotkeyManager
- [ ] Implement `KeyEventInterceptor` interface on HotkeyRecorder
- [ ] Replace `window.addEventListener` in `start()` with `this._dispatcher.setInterceptor(this)`
- [ ] Replace `window.removeEventListener` in `stop()` with `this._dispatcher.clearInterceptor(this)`
- [ ] Keep `stopImmediatePropagation()` in HotkeyRecorder `onKeyDown` — preserves documented "all keyboard input is blocked" contract (library pipeline is blocked structurally via return value; `stopImmediatePropagation` blocks non-library `window` capture listeners)
- [ ] Keep `preventDefault()` in HotkeyRecorder `onKeyDown` (prevents browser defaults during recording)
- [ ] Return `true` from `onKeyDown` as consumed signal to dispatcher
- [ ] Update `_stopAndRecord` — clear interceptor before firing callback
- [ ] Update `destroy()` — clear interceptor if still set

### Unhandled callback simplification

- [ ] Remove `deferUnhandled` parameter from `_processKeyEvent`
- [ ] Remove `emitUnhandled` parameter from `_processKeyEvent`
- [ ] Move unhandled emission logic to EventDispatcher pipeline (step 4 for suspended, step 7 for not consumed)
- [ ] EventDispatcher passes `forcedReason` to `emitUnhandled`: `UnhandledReason.Suspended` at step 4, `null` at step 7
- [ ] Add `UnhandledReason.TargetMismatch` to enum in `library.ts`
- [ ] Add `UnhandledReason.Suspended` to enum in `library.ts`
- [ ] Update `skip-reason.ts` priority map with new reason values (suggested priority: `Suspended` = 5, `TargetMismatch` between `NoMatch` and `RepeatIgnored`)

### Tests

- [ ] Unit: single guard blocks dispatch
- [ ] Unit: nested guards require all releases before dispatch resumes
- [ ] Unit: `destroy()` invalidates all guards safely
- [ ] Unit: `release()` is idempotent
- [ ] Unit: key state tracks during suspension
- [ ] Unit: suspend does NOT `preventDefault` — browser defaults leak during suspension
- [ ] Unit: suspended → unhandled fires with `Suspended` reason via `forcedReason`
- [ ] Unit: interceptor blocks hotkey dispatch
- [ ] Unit: interceptor auto-clears on stop
- [ ] Unit: key state tracks during interception
- [ ] Unit: `clearInterceptor` is owner-safe
- [ ] Unit: recorder `stopImmediatePropagation` blocks non-library window listeners during recording
- [ ] Unit: interceptor replacement logs warning
- [ ] Unit: multi-recorder contention — RecorderA starts, RecorderB replaces, RecorderA receives no events
- [ ] Unit: destroy-while-recording — manager destroyed while recorder active, interceptor cleared
- [ ] Unit: target-scoped composedPath match
- [ ] Unit: target-scoped composedPath miss
- [ ] Unit: document registration priority over target-scoped
- [ ] Unit: document match without stopPropagation + target match — both callbacks fire
- [ ] Unit: nested targets — innermost wins for same key
- [ ] Unit: nested targets — stopPropagation option on inner prevents outer (not callback `event.stopPropagation()`)
- [ ] Unit: nested targets — different keys fire independently
- [ ] Unit: unhandled fires synchronously (no deferred state)
- [ ] Unit: full sequence consumed suppresses unhandled
- [ ] Unit: partial sequence advance suppresses unhandled
- [ ] Unit: target mismatch → unhandled with `TargetMismatch` reason
- [ ] Unit: destroy removes all window listeners
- [ ] Unit: re-create after destroy works
- [ ] Regression: update nested-target tests from "fire all" to "innermost wins"
- [ ] Regression: update recorder tests from `new HotkeyRecorder()` to `manager.createRecorder()`
- [ ] Regression: update KeyStateTracker tests from `getInstance()` to `manager.getKeyStateTracker()`
- [ ] Regression: update/remove ListenerRegistry tests

### Documentation

- [ ] Update `packages/hotkeys/README.md` — rewrite KeyStateTracker section (no longer standalone, accessed via manager or internal)
- [ ] Update `packages/hotkeys/README.md` — rewrite HotkeyRecorder section (created via `manager.createRecorder()`, not `new HotkeyRecorder()`)
- [ ] Update `packages/hotkeys/README.md` — add suspend guard API to HotkeyManager method table and usage examples
- [ ] Update `packages/hotkeys/README.md` — add `createRecorder()` and `getKeyStateTracker()` to HotkeyManager method table
- [ ] Update `packages/hotkeys/README.md` — update API Stability section (remove `HotkeyRecorder` and `KeyStateTracker` from stable imports)
- [ ] Update `packages/hotkeys/README.md` — add new `UnhandledReason` values (`TargetMismatch`, `Suspended`) to enum docs
- [ ] Update `packages/hotkeys/README.md` — update Quick Start if lifecycle examples change
- [ ] Update `packages/hotkeys/README.md` — update Troubleshooting with suspend guard and interceptor scenarios
- [ ] Update `docs/hotkeys/ARCHITECTURE.md` — new module overview, updated event handling section, updated dispatch flow diagram
- [ ] Update `docs/hotkeys/ARCHITECTURE.md` — document EventDispatcher pipeline, guard API, interceptor mechanism
- [ ] Update `docs/hotkeys/ARCHITECTURE.md` — update project layout section (new files, deleted files)
- [ ] Update `docs/hotkeys/ARCHITECTURE.md` — update edge cases table with new target-scoped behavior
- [ ] Update `docs/hotkeys/SEQUENCES.md` — note that SequenceManager no longer called directly from HotkeyManager's listener
- [ ] Update `docs/hotkeys/SEQUENCES.md` — document how sequence dispatch integrates with the EventDispatcher pipeline
- [ ] Update `docs/shared/UI5-EVENT-HANDLING-DEEP-DIVE.md` — update "Implications for Our Libraries" section (window vs document, single listener)
- [ ] Update `docs/hotkeys/proposals/README.md` — link to this proposal
- [ ] Update `HotkeyOptions.target` JSDoc in `types.ts` — remove note about "document capture listener fires before target capture listener" (priority is now enforced in the dispatch pipeline, not via DOM ordering)
- [ ] Review and update all JSDoc on public API (`HotkeyManager`, `HotkeyRecorder`, `RegistrationGroup`, exported types)
- [ ] Update demo app `Component.ts` and controllers to use `createRecorder()` factory if HotkeyRecorder is used
- [ ] Verify all code examples in docs still compile and reflect the new API surface

## API Changes

There are no external consumers yet, so breaking changes are acceptable where they lead to a cleaner design. This section lists all breaking changes for migration reference.

### Unchanged

- `HotkeyManager.register()`, `registerSequence()`, `createGroup()`, scope management, router integration.
- `RegistrationGroup`.
- `HotkeyOptions.target` — same API surface. Implementation switches from per-element listeners to `composedPath()` check. JSDoc on `target` field needs updating to remove the note about "document capture listener fires before target capture listener" (no longer relevant — priority is now enforced in the dispatch pipeline). See "Changed" for nested target behavioral change.
- HotkeyRecorder blocking behavior — `stopImmediatePropagation()` is retained during recording, preserving the "all keyboard input is blocked" contract.

### Changed (breaking)

- **`HotkeyRecorder` no longer directly instantiated** — consumers use `manager.createRecorder(options)` factory instead of `new HotkeyRecorder(options)`. Keeps EventDispatcher internal, consistent with `createGroup()` pattern. `HotkeyRecorder` and `KeyStateTracker` classes remain public type exports (consumers need them for variable type declarations like `const recorder: HotkeyRecorder = manager.createRecorder(...)`) but their constructors are no longer part of the public API (marked `@internal`).
- **`KeyStateTracker.getInstance()` removed** — the EventDispatcher owns the KeyStateTracker instance. Consumers access it via `manager.getKeyStateTracker()`. The class is still exported for type usage. The `destroy()` method is internal — consumers should not call it directly.
- **`ListenerRegistry` removed** — both `internal/listener-registry.ts` and the public re-export `listener-registry.ts` are deleted. No replacement needed — functionality absorbed by EventDispatcher and `composedPath()` matching.
- **Nested target-scoped registrations for the same key** — currently, when two nested targets both have registrations for the same key, both callbacks fire independently (outermost first during capture phase). In the new design, only the **innermost** matching target's callback fires. This is a deliberate behavioral change — the old "fire all" behavior was an artifact of having independent per-target DOM listeners, not an intentional design choice. `stopPropagation` on a target-scoped registration now also prevents outer target-scoped registrations from matching, analogous to document→target behavior.
- **`stopPropagation` option governs target-skipping, not DOM state** — currently, a callback calling `event.stopPropagation()` directly affects whether subsequent target listeners fire, even when the registration's `stopPropagation` option is `false`. In the new design, target-skipping is determined solely by the `stopPropagation` option on the registration. The pipeline does not inspect the DOM event's propagation state for matching decisions.

### Changed (non-breaking)

- **`stopPropagation` and target-scoped registrations** — document-level `stopPropagation: true` currently prevents target-listener keydown via DOM propagation. In the new design, it is enforced explicitly in the dispatch pipeline (document-level registrations checked first; if matched with `stopPropagation: true`, target-scoped registrations are skipped). Same observable behavior for the document→target case, explicit instead of implicit.
- **Listener attachment point** — library listeners move from `document` capture to `window` capture. This changes how `stopPropagation()` interacts with external `document`-level listeners (see Pipeline design decisions).

## Alternatives Considered

- **DOM-only ordering tricks** (`window` capture + `stopImmediatePropagation`) — Fragile if listener topology changes. Does not solve dispatch coordination or lifecycle coupling.
- **Global singleton boolean flag for suspension** — Works but less safe than RAII guard handles for nested callers.
- **Consumer/priority interface** (generic `KeyEventConsumer` with priority ordering) — Over-abstracted for a fixed set of collaborators (key state, recorder, hotkeys, sequences). A concrete pipeline is simpler and easier to reason about.
- **Keep per-target listeners, add dispatcher on top** — Adds complexity without removing the scattered listener problem. `composedPath()` check is strictly simpler.
