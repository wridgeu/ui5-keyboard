# Middleware Instance Isolation

**Issue:** [#76](https://github.com/wridgeu/ui5-keyboard/issues/76)
**Date:** 2026-04-08
**Status:** Implemented, with later revision. The per-instance isolation described here shipped (each component owns its `_middleware` instance with the commit/reset lifecycle below). The global registration API (`registerMiddleware`, `_registerMiddleware`, `_resetMiddleware`) was later removed: built-in middleware now lives in a sealed factory map exposed via `getMiddlewareFactory(layout, instanceFactories?)`, and per-app middleware is supplied by the `middleware` property of a `CustomLayout` (#216) rather than a registration call.

## Problem

The middleware registry (`middleware-registry.ts`) stores instantiated middleware in a module-level `Map` keyed by layout name. When two `<kiosk-keyboard>` elements use the same layout, they share the same middleware instance, causing composition state to leak between them.

## Design

### Registry becomes factory-only

Remove the `instances` map from `middleware-registry.ts`. The registry's sole job becomes storing and retrieving factory functions.

**New API:**

| Function                                | Change                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `_registerMiddleware(layouts, factory)` | Unchanged (stores factory)                               |
| `registerMiddleware(layouts, factory)`  | Simplified (stores factory, no instance cleanup needed)  |
| `getMiddlewareFactory(layout)`          | **New**: returns `(() => CompositionMiddleware) \| null` |
| `getMiddlewareForLayout(layout)`        | **Removed**                                              |
| `deactivateMiddleware(layout)`          | **Removed**                                              |
| `_resetMiddleware()`                    | Simplified (clears factories map only)                   |

### Component owns its middleware instance

Each `KioskKeyboard` component holds a single private field for its middleware instance (`_middleware: CompositionMiddleware | null`). Since a component has exactly one active layout at a time, it has at most one middleware instance.

**Lifecycle:**

- **Activation:** When the component needs middleware (first key press that checks middleware, or layout switch), it calls `getMiddlewareFactory(layout)` and invokes the factory to create a fresh instance. Stored in `_middleware`.
- **Layout switch:** Component calls `_middleware.commit()` on the old instance, then creates a new instance from the new layout's factory (or null if the new layout has no middleware).
- **Target change (webc auto-show):** Component calls `_middleware.commit()` to finalize pending composition.
- **Exit/destroy:** Component calls `_middleware.reset()` to clear preedit, then discards the reference.

### Public API unchanged

`KioskKeyboard.registerMiddleware(layouts, factory)` remains the same. It delegates to the registry's `registerMiddleware()` which stores the factory. Users defining custom layouts with middleware are unaffected.

## Affected files

### Both packages (parallel, identical pattern)

| File                                        | Changes                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `middleware-registry.ts`                    | Remove `instances` map, remove `getMiddlewareForLayout`, remove `deactivateMiddleware`, add `getMiddlewareFactory`, simplify `_resetMiddleware` and `registerMiddleware` |
| `KioskKeyboard.ts`                          | Add `_middleware` field, create instance via factory, replace all `getMiddlewareForLayout`/`deactivateMiddleware` calls with direct instance management                  |
| `middleware-registry.test.ts` / `.qunit.ts` | Update tests: remove instance-caching tests, add factory-retrieval tests                                                                                                 |
| `middleware-integration.test.ts`            | Update to create instances via factory instead of `getMiddlewareForLayout`                                                                                               |

## Testing

- Existing middleware behavior tests (hangul, kana-dakuten) continue to pass with the new per-instance model.
- Add a test verifying two components using the same layout get independent middleware instances.
