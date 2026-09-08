# Glossary

Technical concepts used across the `ui5-keyboard` libraries.

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

### What happens during suspension

While suspended, the EventDispatcher pipeline skips hotkey matching, sequence matching, and unhandled emission (steps 5-7). Instead, it emits an unhandled event with reason `Suspended`. Key state tracking (step 1) still runs, so `getHeldKeys()` remains accurate.

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

> The dispatcher's own code uses "two-pass" for a different axis: `HotkeyManager._processHotkeys` runs pass 1 over target-bound registrations and pass 2 over untargeted ones, and each of those passes walks the scope stack as described above. Both passes can fire for one event when the target-bound match sets `stopPropagation: false`. The scope shadowing here holds within each pass.

### Router integration

When `enableRouterIntegration(router)` is active, route changes automatically reset to global scope and push the new route name as the active scope; a hash that matches no route (the router's `bypassed` event) resets to global scope without pushing anything. Dialog scopes still require manual `pushScope`/`popScope`.

## Suppression (hotkeys)

**Suppression** refers to conditions that prevent a matched hotkey from firing, even though the key combination and scope both match.

- **Input suppression** (`ignoreInputs`): Single-key hotkeys and Alt-only or Shift-only combos are suppressed when focus is in an editable field: a text `<input>`, `<textarea>`, `contentEditable`, or `<select>` (which has native single-key type-ahead). Ctrl/Meta combos and Escape are not suppressed. Controlled by the `ignoreInputs` option (`"auto"` by default).
- **Popup suppression** (`suppressInPopups`): Hotkeys are suppressed when a UI5 popup (dialog or popover) is open. On by default.
- **Repeat suppression** (`ignoreRepeat`): Held-key repeat events are ignored. On by default.

When a hotkey is suppressed, the unhandled callback fires with the corresponding reason (`InputSuppressed`, `PopupSuppressed`, `RepeatIgnored`).

## Suppression (custom layout facets)

A `CustomLayout`'s **`suppress`** property names the facets whose inherited value that custom layout discards. A listed facet resolves to nothing at the custom layout's position in the tier stack; a value the same custom layout declares still applies. The facets are the members of the `LayoutFacet` enum (`packages/kiosk-keyboard/src/library.ts`):

- `Variants`: long-press accent variants. Suppressed, the layout's keys carry no long-press affordance.
- `Middleware`: composition (IME / dead-key) middleware. Suppressed, the layout's keys type directly.

In XML the facets are a comma-separated list (`suppress="Variants, Middleware"`). Whitespace around a name is not part of it, and a token naming no facet is rejected: the component `DataType` that trims each token also validates it, and an unknown token fails the whole property. That type is covered by `docs/specs/2026-08-05-token-list-attributes-design.md`. The web component takes the same list as a string attribute on `<kiosk-keyboard-custom-layout>`, accepting commas or spaces as separators; there an unknown token is reported as an `unknown-suppress` diagnostic and skipped, and the layout still renders.

## AltGr (Alternate Graphic)

**AltGr** is the right-side Alt key on non-US keyboard layouts (German, French, etc.). It is used to type special characters like `@`, `€`, `{`, `}`, `~`, etc.

### The problem

On Windows, pressing AltGr sends **both** `ctrlKey: true` and `altKey: true` simultaneously. This means a user typing `AltGr+Q` to produce `@` on a German keyboard would falsely match a `Ctrl+Alt+Q` hotkey registration.

### How we handle it

On Windows (the only platform where the ambiguity exists), the EventDispatcher detects AltGr via two mechanisms:

1. `event.getModifierState("AltGraph")`, the modern, reliable check.
2. Tracking `event.location` on Alt keydowns. If the last Alt press was on the right side (`location === 2`) and both `ctrlKey` and `altKey` are active, treat it as AltGr.

Events identified as AltGr are silently dropped in the pre-filter step, preventing false hotkey matches.

## Composition Middleware

A **composition middleware** is a module that intercepts key presses for a specific layout and transforms them before they reach the target input. This enables script-specific input processing without modifying the core keyboard component.

### How it works

1. Built-in middleware factories are registered by direct import into a sealed module-level map, keyed by layout name (no self-registration; see #108). Per-app middleware is supplied by the `middleware` property of a custom layout.
2. When the associated layout becomes active, the keyboard lazily instantiates the middleware via the factory function.
3. On each key press, the middleware's `handleKey()` method is called first. It can consume the key (returning `true`), compose multiple keys into a single output character, or pass through to default handling (returning `false`).
4. When the layout is deactivated, `reset()` is called to clear any pending composition state.

### Current implementations

- **Kana dakuten** (`middleware/kana-dakuten.ts`): Composes hiragana base characters with dakuten/handakuten marks for the `ja-kana` and `ja-kana-compact` layouts. Table lookup of ~26 mappings.
- **Hangul compose** (`middleware/hangul-compose.ts`): Composes Korean jamo (consonants and vowels) into Hangul syllable blocks for the `ko-hangul` layout. Implements the Unicode Hangul Syllable Composition Algorithm.

### Consumer API

Consumers supply custom middleware per element on the custom layout for that layout name: `middleware` is a `() => CompositionMiddleware` factory. The `CompositionMiddleware` interface requires three methods: `handleKey()`, `commit()`, and `reset()`. A declared `middleware` shadows the built-in factory for the same layout, and `suppress="Middleware"` leaves that layout with none.

## Subpath Imports (WebC)

The `kiosk-keyboard-webc` package exposes subpath imports for different consumption scenarios. The main entry includes all built-in layouts.

### Entry points

| Entry                                | What it includes                                                    |
| ------------------------------------ | ------------------------------------------------------------------- |
| `kiosk-keyboard-webc`                | Component with all built-in layouts and middleware                  |
| `kiosk-keyboard-webc/bundle`         | Everything: component, Assets, all built-in layouts, all middleware |
| `kiosk-keyboard-webc/CustomLayout`   | The `<kiosk-keyboard-custom-layout>` configuration element          |
| `kiosk-keyboard-webc/layouts/*`      | Individual layout-definition modules (data for custom composition)  |
| `kiosk-keyboard-webc/middleware/*`   | Individual middleware-factory modules (data for custom composition) |
| `kiosk-keyboard-webc/variants`       | Built-in LATIN_DIACRITIC_VARIANTS table and the VariantTable type   |
| `kiosk-keyboard-webc/Assets`         | Theme and i18n registration                                         |
| `kiosk-keyboard-webc/customElements` | The Custom Elements Manifest, for IDE and tooling integration       |

### Usage

All built-in layouts and middleware ship with the component, so the common case is just:

```ts
import "kiosk-keyboard-webc/Assets";
import KioskKeyboard from "kiosk-keyboard-webc";
```

The `layouts/*` and `middleware/*` subpaths are for composing **custom** keys: import a layout definition or middleware factory as data and pass it per-element as the `rows` / `middleware` of a `<kiosk-keyboard-custom-layout>` in the `customLayouts` slot. There is no self-registration step (built-ins are bundled via direct imports; see #108).

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

## Twin / Twin Drift

A **twin** is a module kept as a hand-maintained duplicate in both keyboard packages. `packages/kiosk-keyboard/src` and `packages/kiosk-keyboard-webc/src` carry parallel copies of the framework-agnostic logic (the `layouts/*` tables, `grapheme`, `auto-repeat`, `shift-state`, `composition-utils`, `key-token`, the `middleware/*` modules and more), plus the two `dom-contract.ts` modules and the two stylesheets. There is no shared core package holding them: that was declined deliberately, because kiosk ships UI5 AMD resolved by namespace and so cannot carry a runtime npm dependency. See the "No shared-core package" section of `CLAUDE.md` for the full reasoning.

**Twin drift** is the two copies diverging. Three checks guard it, each part of `check:base` and of CI:

- `npm run test:twin-drift` (`tools/check-twin-drift.mjs`): compares an explicit manifest of duplicated source modules after normalization, and fails on a same-named pair that is registered in neither the checked nor the unchecked list.
- `npm run test:style-twin-drift` (`tools/check-style-twin-drift.mjs`): compares the public custom-property surface of the two stylesheets, whose names differ by convention and so are compared as canonical tokens.
- `npm run test:dom-contract` (`tools/check-dom-contract-drift.mjs`): compares the two `dom-contract.ts` modules structurally: the `classes` and `selectors` groups by key set, since their string values differ per platform, and the shared `data-*` attributes by key and value.
