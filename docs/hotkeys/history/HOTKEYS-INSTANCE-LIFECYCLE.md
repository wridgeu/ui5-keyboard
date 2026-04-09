# HotkeyManager: Instance-Based Lifecycle

> Status: **Implemented** (2026-04-08)

## Problem

The `HotkeyManager` is a module-level singleton (`static _instance` / `getInstance()`). This creates lifecycle ownership problems in Fiori Launchpad (FLP) and any multi-Component environment:

1. **No owner.** The singleton outlives every Component. Nobody is responsible for destroying it. When `Component.exit()` fires, the developer must choose between leaving it alive (dormant DOM listeners, stale state) or destroying it (breaking cached references in other modules).

2. **Cross-app contamination.** In FLP, sequential apps share the same singleton. If App A forgets to clean up a registration, it fires in App B's context. The scope stack may carry stale state from App A.

3. **Idle cleanup gap.** When `group.destroyAll()` removes all registrations but nobody calls `manager.destroy()`, five DOM listeners (keydown, keyup, blur, focusin, focusout) remain attached to `window`/`document`, processing every keyboard and focus event against zero registrations indefinitely.

4. **Stale scope state.** The scope stack persists across Component lifecycles. A `resetToGlobalScope()` call on re-entry fixes this today, but only because the consumer remembers to set up router integration again. Without it, the stack is stale.

## Design

### Drop the singleton

`HotkeyManager` becomes a regular class with a public constructor. `getInstance()` is removed. The `static _instance` property is removed. There is no module-level state.

```ts
// Before (singleton)
const manager = HotkeyManager.getInstance();

// After (instance)
const manager = new HotkeyManager();
```

### Component owns the manager

The `HotkeyManager` instance is created in `Component.init()` and destroyed in `Component.exit()`. This is the standard UI5 ownership pattern: the Component is the lifecycle root, and it owns shared resources.

```ts
export default class Component extends UIComponent {
  private _hotkeyManager!: HotkeyManager;

  init(): void {
    super.init();
    this._hotkeyManager = new HotkeyManager();

    // Component-level group for global hotkeys + router integration
    this._hotkeys = this._hotkeyManager.createGroup();
    this._hotkeys.enableRouterIntegration(this.getRouter());
    this._hotkeys.register("Mod+S", () => this.save(), { description: "Save" });

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

`destroy()` is the single cleanup call. It removes all DOM listeners, finalizes all groups, clears all registrations, and resets all internal state. No idle detection, no suspend/resume, no auto-destroy heuristics. The lifecycle is explicit.

### Controllers access via Component

Controllers do not call `getInstance()`. They get the manager from their owning Component. This is the classic UI5 pattern of shared resources flowing through the Component hierarchy.

```ts
// BaseController
export default class BaseController extends Controller {
  getHotkeyManager(): HotkeyManager {
    return (this.getOwnerComponent() as Component).getHotkeyManager();
  }
}

// Sub-controller
export default class DetailController extends BaseController {
  private _hotkeys!: RegistrationGroup;

  onInit(): void {
    this._hotkeys = this.getHotkeyManager().createGroup();
    this._hotkeys.register("F5", () => this.onRefresh(), {
      scope: "detail",
      description: "Refresh",
    });
  }

  onExit(): void {
    this._hotkeys.destroyAll();
  }
}
```

### FLP lifecycle

In FLP, the Component is destroyed and recreated on each app navigation. The lifecycle becomes symmetric:

```
Tile click    -> Component.init()  -> new HotkeyManager()   -> DOM listeners attach
Navigate away -> Component.exit()  -> manager.destroy()      -> DOM listeners detach, all state cleared
Tile click    -> Component.init()  -> new HotkeyManager()   -> fresh instance, clean state
```

No dormant singleton. No stale scope stack. No idle cleanup problem. Each app session gets a fresh manager.

### Scope stack hardening

Two new guards on the scope stack prevent misuse:

1. **Reject pushing `GLOBAL_SCOPE`.** The global scope is always at the bottom of the stack and is never pushed manually. Attempting `pushScope("__global__")` throws.

2. **Reject duplicate top push.** Pushing a scope that is already the top of the stack is likely a bug (e.g., router integration firing twice for the same route). Attempting `pushScope("detail")` when `"detail"` is already the top throws.

```ts
pushScope(scopeId: string): void {
  this._assertAlive("pushScope");
  const normalized = resolveRequiredScope(scopeId);

  if (normalized === GLOBAL_SCOPE) {
    throw new Error("Cannot push the global scope -- it is always at the bottom of the stack");
  }

  const top = this._scopeStack.at(-1);
  if (top === normalized) {
    throw new Error(
      `Cannot push scope "${normalized}": it is already the active scope`
    );
  }

  this._scopeStack.push(normalized);
}
```

### Router integration

Router integration remains on `RegistrationGroup` (the group-level method introduced in commit 3f1cca8). The manager-level `enableRouterIntegration()` / `disableRouterIntegration()` / `hasRouterIntegration()` methods are removed. There are no external consumers, so no deprecation period is needed.

The group-level method ties the router listener to the group lifecycle: `destroyAll()` automatically detaches it. Since `Component.exit()` calls `manager.destroy()` (which finalizes all groups), router cleanup is guaranteed.

### What is NOT changing

- The 7-step dispatch pipeline in `EventDispatcher`
- The two-pass matching algorithm (target-scoped first, then untargeted)
- The `RegistrationGroup` API (register, registerSequence, destroyAll, etc.)
- Scope matching semantics (topmost scope first, fallthrough to global)
- All registration options (enabled, preventDefault, target, scope, etc.)
- `HotkeyRecorder`, `KeyStateTracker`, sequence support, validation, formatting

The change is purely about ownership and lifecycle. The dispatch and matching internals are untouched.

## Deferred

- **Per-target DOM listeners** (issue #66): Attach listeners to specific DOM elements instead of `window`. Deferred to keep this change focused on lifecycle.
- **Nested Component sharing**: Opt-in mechanism for child Components to use a parent's manager instead of creating their own. Depends on per-target listeners for proper isolation.

## Migration

Since there are no external consumers, this is not a breaking change in the semver sense. The demo app and tests are updated as part of the implementation.

The migration pattern for any future consumers coming from the singleton pattern:

```diff
- import HotkeyManager from "ui5/hotkeys/HotkeyManager";
- const manager = HotkeyManager.getInstance();
+ // In Component.init():
+ this._hotkeyManager = new HotkeyManager();
+
+ // In Component.exit():
+ this._hotkeyManager.destroy();
+
+ // In controllers:
+ const manager = (this.getOwnerComponent() as MyComponent).getHotkeyManager();
```
