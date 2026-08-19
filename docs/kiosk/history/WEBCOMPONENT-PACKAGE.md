# Implementation Plan: `kiosk-keyboard-webc` Web Component Package

> Status: Implemented

## Context

`KioskKeyboard` is currently a SAPUI5 control. It works well inside UI5 apps,
but cannot be consumed directly in framework-agnostic pages (plain HTML,
React, Vue, etc.) without loading the UI5 runtime.

This plan describes how to build a **native web component** variant as a new
monorepo sub-package, using the **UI5 Web Components framework**
(`@ui5/webcomponents-base`) as the foundation. This gives us:

- Standards-based custom element (`<kiosk-keyboard>`) usable in any framework
- Full SAP theming compliance (Horizon light/dark, HCB, HCW) via CSS variables
- Direct consumability inside UI5 apps via the existing `WebComponent.extend()`
  bridge pattern (already demonstrated in the demo app)
- Shared layout data and type definitions with the existing UI5 control

## Decision Log

### Why UI5 Web Components base, not vanilla HTMLElement?

| Concern                         | Vanilla HTMLElement                             | UI5Element (`@ui5/webcomponents-base`)                                 |
| ------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| SAP theming (Horizon, HCB, HCW) | Manual CSS variable wiring                      | Built-in via `@customElement({ styles })` + theme parameter bundles    |
| Theme switching at runtime      | Must subscribe to theme change events manually  | Automatic (CSS variables update, optional `themeAware` re-render)      |
| i18n with locale change         | Manual `Intl` / custom solution                 | Built-in i18n asset system with `@i18n` decorator                      |
| Reactive properties             | Manual `attributeChangedCallback`               | `@property` decorator with automatic invalidation + batched rendering  |
| Shadow DOM rendering            | Manual DOM manipulation or lit-html             | JSX templates (preact-based `JsxRenderer`) with diffing                |
| UI5 app consumption             | Requires manual `WebComponent.extend()` wrapper | Same bridge pattern, but theming/i18n align automatically              |
| Standalone consumption          | Works directly                                  | Works directly (standard custom element)                               |
| Bundle size                     | Minimal                                         | ~30-40 KB for `@ui5/webcomponents-base` + `@ui5/webcomponents-theming` |

**Verdict:** The bundle size trade-off is acceptable given that theming
compliance is a hard requirement and the demo app already loads UI5 Web
Components (`@ui5/webcomponents: 2.15.1`).

### Why a separate package, not a shared-core refactor?

Extracting a shared core from the existing `kiosk-keyboard` package would
require refactoring the existing UI5 control to consume from the shared
package. This is high-risk (existing tests, behavior regressions) and
high-effort for no immediate user-facing value.

**Approach:** Copy and adapt the framework-agnostic modules into the new
package. The existing UI5 control remains untouched. A future shared-core
extraction can happen incrementally once both implementations are stable.

### Package naming

- Monorepo directory: `packages/kiosk-keyboard-webc/`
- npm package name: `kiosk-keyboard-webc` (private for now)
- Custom element tag: `<kiosk-keyboard>`

The tag intentionally omits the `ui5-` prefix because this is not an official
SAP component. It uses `kiosk-keyboard` which is descriptive and
collision-safe (custom elements require a hyphen).

### Open questions resolved

| Question                   | Answer                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| Monorepo or separate repo? | Monorepo sub-package. Shares tooling, CI, and layout data.             |
| Naming?                    | `<kiosk-keyboard>` tag, `kiosk-keyboard-webc` package.                 |
| Browser targets?           | Modern evergreen only (Chrome, Firefox, Safari, Edge). No IE11/legacy. |
| React/Vue wrappers?        | Out of scope for v1. Standard custom elements work in all frameworks.  |

## Extractability Analysis

Analysis of the existing `kiosk-keyboard` package internals:

| Module                                                                  | UI5-Free? | Extraction strategy                                            |
| ----------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `types.ts` (KeyDefinition, KeyRow, LayoutDefinition, KeyWidth, KeyType) | 100%      | Copy verbatim                                                  |
| `layouts/*.ts` (all layout definitions)                                 | 100%      | Copy verbatim                                                  |
| `internal/dom.ts` (input guards, key ID utils)                          | 100%      | Copy verbatim                                                  |
| `internal/grapheme.ts` (grapheme-aware cursor utils)                    | 100%      | Copy verbatim (uses `Intl.Segmenter` only)                     |
| `internal/input-operations.ts` (text insert, backspace, caret)          | ~65%      | Copy pure DOM functions, drop UI5 Element wrappers             |
| `internal/detect-keyboard-type.ts` (auto-type heuristics)               | ~85%      | Keep DOM-based checks, drop UI5 control introspection          |
| `internal/layout-registry.ts` (layout store, locale mapping)            | ~85%      | Replace `sap/base/i18n/Localization` with `navigator.language` |
| `KioskKeyboardRenderer.ts` (UI5 RenderManager)                          | 0%        | Not extracted. Replaced by JSX template.                       |
| `internal/i18n-registry.ts` (UI5 ResourceBundle chain)                  | 0%        | Not extracted. Use UI5 WC i18n system instead.                 |
| `themes/base/KioskKeyboard.less` (SAP LESS params)                      | ~95%      | Translate LESS params to CSS variable equivalents              |

## Shared Core Candidates

The shared-core question was evaluated in #105 and declined. See the "No shared-core package" decision in the repo-root `CLAUDE.md` for the authoritative rationale.

## Package Structure

```
packages/kiosk-keyboard-webc/
  package.json
  tsconfig.json
  .ui5rc.yaml                           # UI5 WC build config (if needed)
  src/
    KioskKeyboard.ts                     # Main component (extends UI5Element)
    KioskKeyboardTemplate.tsx            # JSX template (preact renderer)
    bundle.esm.ts                        # ESM entry point
    Assets.ts                            # Theme + i18n asset registration
    generated/                           # Build-generated theme/i18n modules
      themes/
      i18n/
    types.ts                             # Shared type definitions
    core/
      dom-utils.ts                       # Input/textarea guards, key ID utils
      grapheme.ts                        # Grapheme-aware cursor utils (Intl.Segmenter)
      input-operations.ts                # Pure DOM text manipulation
      keyboard-type-detector.ts          # DOM-based auto-type detection
      layout-registry.ts                 # Layout storage + locale resolution
      shift-state.ts                     # Shift / Caps Lock state machine
    layouts/
      index.ts                           # Layout registry with all built-ins
      default-layout.ts                  # Default layout resolution (locale → layout)
      qwerty.ts                          # Standard QWERTY
      qwertz-de.ts                       # German QWERTZ
      numeric.ts                         # Numeric layout
      special.ts                         # Special characters
      numpad.ts                          # Compact numpad
      fkeys.ts                           # F1-F12 layout
      nav.ts                             # Navigation layout
      fkey-row.ts                        # Shared F-key row
      nav-row.ts                         # Shared nav row
      qwerty-fk.ts                       # QWERTY + F-keys
      qwertz-de-fk.ts                    # QWERTZ-DE + F-keys
      qwerty-nav.ts                      # QWERTY + nav row
      qwertz-de-nav.ts                   # QWERTZ-DE + nav row
    i18n/
      messagebundle.properties           # English key/ARIA labels
      messagebundle_de.properties        # German translations
    themes/
      KioskKeyboard.css                  # Base component styles (all themes)
      sap_horizon/
        parameters-bundle.css            # Horizon light overrides
      sap_horizon_dark/
        parameters-bundle.css            # Horizon dark overrides
      sap_horizon_hcb/
        parameters-bundle.css            # High contrast black
      sap_horizon_hcw/
        parameters-bundle.css            # High contrast white
  test/
    KioskKeyboard.test.ts                # Unit tests
    pages/
      index.html                         # Standalone test page
  README.md
```

## Component API

The full property, method, event, and slot reference lives in the consumer-facing `docs/kiosk-webc/ARCHITECTURE.md` (and the `kiosk-keyboard-webc` package README).

## Feature Parity Matrix

The UI5-control-versus-web-component feature parity reference lives in the consumer-facing `docs/kiosk-webc/ARCHITECTURE.md`.

## Research: Shadow DOM Focus and Caret Handling

The keyboard's shadow DOM keys must interact with a target input in the
light DOM. This crosses the shadow boundary for focus, caret, and event
handling. Research confirms all required operations work reliably.

### Focus steal prevention

`mousedown.preventDefault()` on a key element inside the shadow root
prevents focus transfer away from the light DOM input. This is the same
mechanism the UI5 control uses (via `ontouchstart`) and works identically
across the shadow boundary; the browser's focus-on-click behavior
respects `preventDefault()` regardless of DOM tree location.

**Important:** Use `mousedown`/`touchstart`, not `pointerdown`. Per the
Pointer Events spec, canceling `pointerdown` suppresses compatibility
mouse events including `click`. The UI5 control already follows this
pattern for the same reason.

Browser support: Chrome, Firefox, Safari, all confirmed.

### selectionStart/selectionEnd access

`selectionStart`, `selectionEnd`, and `setSelectionRange()` are properties
on the `HTMLInputElement`/`HTMLTextAreaElement` interface. They are entirely
unrelated to `window.getSelection()` and the Shadow DOM Selection proposal.
JavaScript inside a shadow root can freely read/write these on any input
element it holds a reference to, regardless of DOM tree location:

```ts
// Inside shadow root code - works without restriction:
const externalInput = this._resolveTarget(); // light DOM <input>
const start = externalInput.selectionStart;
externalInput.setSelectionRange(5, 10);
```

No same-origin or encapsulation restrictions apply. The shadow DOM boundary
is a DOM tree boundary, not a security boundary for property access on
referenced elements.

Caveats (already handled by the UI5 control's patterns):

- `type="number"` inputs throw on `selectionStart` access; wrap in
  try/catch (existing pattern in `input-operations.ts`)
- Unfocused inputs may return stale positions; the cursor-position caching
  pattern from `TargetInputSession` carries over

### document.activeElement and shadow DOM

When focus is inside a shadow tree, `document.activeElement` returns the
shadow host, not the internal element. For the keyboard scenario this is
largely a non-issue because `mousedown.preventDefault()` keeps focus on
the target input (so `document.activeElement` returns the input, not the
keyboard host).

For the deferred focus-out check (when `relatedTarget` is null), use
recursive traversal instead of `document.activeElement`:

```ts
function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  if (!active) return null;
  if (active.shadowRoot) return getDeepActiveElement(active.shadowRoot);
  return active;
}
```

### FocusEvent.relatedTarget across shadow boundaries

When `focusout` fires on the light DOM input and focus moves into the
keyboard's shadow root, `relatedTarget` is **retargeted to the shadow
host** (`<kiosk-keyboard>` element). The internal shadow element is never
leaked. This means the auto-show `focusout` handler can check:

```ts
private _onDocumentFocusOut(event: FocusEvent): void {
  const related = event.relatedTarget as HTMLElement | null;

  // relatedTarget retargeted to host - user clicked a keyboard key
  if (related === this) return; // don't close

  // null edge case (iframe transitions, window blur, Safari quirks)
  if (!related) {
    this._scheduleDeferredFocusOutClose();
    return;
  }

  this.close();
}
```

The existing deferred-close pattern from the UI5 control (one-tick
`setTimeout` fallback when `relatedTarget` is null) is the correct
approach for shadow DOM as well.

### Synthetic event dispatching

`dispatchEvent()` on a light DOM element works without restriction
regardless of where the calling code lives. The event originates on the
target element, not inside the shadow root:

```ts
// Inside shadow root code - dispatches ON the external input:
target.dispatchEvent(
  new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: text,
  }),
);
```

No special `composed` flag needed since the event originates in the light
DOM. Browser support: uniform across Chrome, Firefox, Safari.

### Summary

| Operation                                             | Works from shadow DOM? | Notes                                              |
| ----------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| `mousedown.preventDefault()` prevents focus           | Yes                    | Use `mousedown`/`touchstart`, not `pointerdown`    |
| `selectionStart`/`selectionEnd` on light DOM input    | Yes, no restrictions   | `type="number"` throws (handle with try/catch)     |
| `setSelectionRange()` on light DOM input              | Yes, no restrictions   | -                                                  |
| `document.activeElement`                              | Returns shadow host    | Use recursive `shadowRoot.activeElement` traversal |
| `focusout.relatedTarget`                              | Retargeted to host     | Handle null with deferred check (existing pattern) |
| `dispatchEvent(new InputEvent())` on external element | Yes, no restrictions   | Event originates in light DOM                      |

## Research: Demo App Integration (UI5 Consumption)

The demo app needs to consume `<kiosk-keyboard>` inside a UI5 XML view.
Research confirms two proven paths, both available in this monorepo today.

> **Outcome (as written):** The demo app uses Path B (manual bridge at
> `packages/demo-app/webapp/control/KioskKeyboardWebc.ts`) for the
> `<kiosk-keyboard>` web component. Path A (auto-generated wrappers)
> is used for `@ui5/webcomponents/dist/Input` in `KioskInputIds.view.xml`.
>
> **Outcome today:** the manual bridge is gone. `KioskWebComponentTooling.view.xml`
> declares `xmlns:kiosk="kiosk-keyboard-webc"` and lets `ui5-tooling-modules`
> generate the wrapper from the CEM (Path A), with `pluginOptions.webcomponents.scoping`
> off so the generated `metadata.tag` matches the registered one. Path B remains
> documented below as the escape hatch, and in the web component's own README.
> Both paths coexist without conflict.
> See the [SAP-samples/uxc-integration](https://github.com/SAP-samples/uxc-integration)
> project for the official SAP reference setup.

### Path A: Auto-generated wrappers (CEM-driven)

`ui5-tooling-modules` (v3.34+, already installed) auto-detects a
`"customElements"` field in a package's `package.json`, parses the Custom
Elements Manifest, and generates `sap.ui.core.webc.WebComponent.extend()`
wrappers at dev-serve and build time.

Requirements:

1. The package's `package.json` must declare:

   ```json
   { "customElements": "dist/custom-elements.json" }
   ```

2. The `custom-elements.json` follows the
   [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
   schema. The `@ui5/webcomponents-tools` build generates this
   automatically for `UI5Element`-based components. In workspace
   development, run `npm run generate` in the webc package so
   `dist/custom-elements.json` exists at serve time.

3. Add `"kiosk-keyboard-webc": "file:../kiosk-keyboard-webc"` to the
   demo app's `package.json` dependencies. npm workspaces ensure it is
   resolvable from `node_modules`.

4. The `ui5-tooling-modules-middleware` must be configured with
   `addToNamespace: true` and `useRelativeModulePaths: true`.
   Without `useRelativeModulePaths`, the middleware creates a
   Stellvertreter redirect to a namespace-prefixed path, but during
   dev serve the bundle entries are stored under original npm names
   (the namespace rewriting only runs at build time), so the redirect
   target is a 404. The UI5 framework version in `ui5.yaml` must be
   \>= 1.120.0.

   ```yaml
   server:
     customMiddleware:
       - name: ui5-tooling-transpile-middleware
         afterMiddleware: compression
       - name: ui5-tooling-modules-middleware
         afterMiddleware: ui5-tooling-transpile-middleware
         configuration:
           addToNamespace: true
           useRelativeModulePaths: true
   ```

Once set up, XML views consume the component directly:

```xml
<mvc:View xmlns:kb="kiosk-keyboard-webc/dist">
  <kb:KioskKeyboard
    docked="true"
    auto-show="true"
    for="myInput" />
</mvc:View>
```

This is the same pattern the demo app uses for
`xmlns:webc="@ui5/webcomponents/dist"` in `KioskInputIds.view.xml`.

### Path B: Manual WebComponent.extend() bridge (explicit control)

Was proven in `webapp/control/KioskKeyboardWebc.ts`, since removed from the demo
in favour of Path A; the bridge shape is kept in the web component's README. A
manual bridge gives full control over property mapping, event transformation,
and method delegation. Use this when you want typed UI5 events, imperative methods,
or when the auto-generated wrapper needs customization.

Since UI5 >= 1.138, the WebComponent bridge auto-converts camelCase event
names to kebab-case DOM events (e.g. `keyPress` maps to `key-press`).
Explicit event `mapping: { to: "..." }` is not needed.

```ts
import WebComponent from "sap/ui/core/webc/WebComponent";

const KioskKeyboardBridge = WebComponent.extend("demo.hotkeys.control.KioskKeyboardBridge", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: { type: "string", defaultValue: "", mapping: { type: "property", to: "layout" } },
      docked: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "docked" } },
      autoShow: { type: "boolean", defaultValue: false, mapping: { type: "property", to: "auto-show" } },
      // ... see packages/demo-app/webapp/control/KioskKeyboardWebc.ts for full mapping
    },
    events: {
      keyPress: {}, // auto-maps to "key-press" DOM event (UI5 >= 1.138)
      afterOpen: {}, // auto-maps to "after-open" DOM event
      // ...
    },
    methods: ["show", "close", "registerLayout"],
  },
});
```

### Theme CSS variable inheritance

SAP theme CSS variables (`--sapButton_Background`, `--sapTextColor`, etc.)
are injected at the document `:root` level by the UI5 runtime. CSS custom
properties **naturally inherit through shadow DOM boundaries** per the CSS
spec. No special setup is needed; the web component's shadow DOM styles
referencing `var(--sapButton_Background)` receive the active theme's values
automatically, and update instantly on runtime theme switch.

This is confirmed by the
[UI5 Web Components styling docs](https://ui5.github.io/webcomponents/docs/advanced/styles):
"While global CSS does not cascade into the Shadow DOM, CSS variables do!"
