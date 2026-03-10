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

## Shared Core Candidates (Informational Only)

> **Status:** This section is a reference snapshot from the initial
> analysis. There is no commitment to build a shared-core package;
> the value is unclear given the maintenance overhead of keeping two
> consumers in sync through adapter interfaces. It is preserved here
> so the extractability analysis is not lost if the question comes up
> again later.

The modules below were identified as candidates for a hypothetical
shared-core package that both the UI5 control and the web component
could consume.

### Tier 1: Extract immediately (zero dependencies, pure data/utilities)

| Module                         | Source location                      | What it provides                                                                                                     | Notes                                                                              |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `types.ts` (layout types only) | `kiosk-keyboard/src/types.ts`        | `KeyDefinition`, `KeyRow`, `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`, `SECONDARY_LAYOUTS`         | 100% framework-agnostic. i18n types (`KioskI18nConfig` etc.) stay in each package. |
| All layout definitions         | `kiosk-keyboard/src/layouts/*.ts`    | 14 layout files (qwerty, qwertz-de, numeric, special, numpad, fkeys, nav, fkey-row, nav-row, and composite variants) | Pure data: `LayoutDefinition` arrays with no imports beyond local types.           |
| DOM utilities                  | `kiosk-keyboard/src/internal/dom.ts` | `isInputOrTextarea()`, `resolveInputOrTextarea()`, `keyElementId()`, `KEY_ID_SUFFIX_RE`                              | Zero `sap/*` imports. Works with any DOM environment.                              |

### Tier 2: Extract with thin adapter interface

| Module                  | Source location                                                                                                   | UI5-coupled parts                                                                                                                                            | Adaptation needed                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input operations        | `kiosk-keyboard/src/internal/input-operations.ts`                                                                 | `setTargetValue()` calls `element.getMetadata()`, `element.setValue()`, `element.fireEvent()`. `fireTargetChange()` uses `element.getMetadata().hasEvent()`. | Split into pure DOM functions (`insertText`, `handleBackspace`, `handleNavigation`) and a `TargetValueSync` adapter interface. The UI5 control passes its `Element`-based adapter; the WC passes a DOM-only adapter. |
| Keyboard type detection | `kiosk-keyboard/src/internal/detect-keyboard-type.ts`                                                             | Steps 1-2: `control.getType()`, `control.isA("sap.m.InputBase")`, parent-chain walking via `getParent()`.                                                    | Extract DOM-based detection (steps 3-4: `inputmode` attribute, HTML `type` attribute) as shared. UI5-specific checks stay in the UI5 control as an additional detection layer.                                       |
| Layout registry         | `kiosk-keyboard/src/internal/layout-registry.ts`                                                                  | `Localization.getLanguageTag()` for locale resolution, `Log.warning()` for diagnostics.                                                                      | Accept locale as a parameter (`getLocaleLayout(locale: string)`) instead of reading it internally. Each consumer provides the locale from its own framework.                                                         |
| Target input session    | `kiosk-keyboard/src/internal/target-input-session.ts`                                                             | Constructor takes `() => Element \| null` callback. `fireChangeIfDirty()` assumes `Element.fireEvent()`.                                                     | Generalize callback to return an interface `{ getFocusDomRef(): HTMLElement, fireEvent?(name: string): void }`. The WC adapter omits `fireEvent` and dispatches native `input`/`change` events instead.              |
| Shift state machine     | Inlined in `kiosk-keyboard/src/KioskKeyboard.ts` (`_shiftActive`, `_capsLock` fields + toggle/auto-release logic) | None: pure boolean state machine.                                                                                                                            | Extract as standalone `ShiftState` class. Currently coupled to the control only because it was never factored out.                                                                                                   |

### Tier 3: Not shareable (framework-specific by nature)

| Module                            | Reason                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KioskKeyboardRenderer.ts`        | Uses UI5 `RenderManager` API (`rm.openStart`, `rm.class`, `rm.icon`, `rm.accessibilityState`). The WC uses JSX templates instead.                                                       |
| `internal/i18n-registry.ts`       | Deeply coupled to `sap/base/i18n/ResourceBundle`, `sap/ui/core/Lib`, and `sap/base/i18n/Localization`. The WC uses the UI5 WC i18n system.                                              |
| `internal/focus-claim-service.ts` | Uses `Element.closestTo()` to resolve DOM → UI5 control, and `ManagedObject.getParent()` to walk the UI5 control tree. The WC resolves targets via `document.getElementById()` instead. |

### How a future shared-core extraction would work

1. Create `packages/kiosk-keyboard-core/` with Tier 1 modules and the
   pure parts of Tier 2 modules.
2. Define adapter interfaces (e.g. `TargetValueSync`, `LocaleProvider`)
   that each consumer implements.
3. Update `kiosk-keyboard` (UI5 control) to import from the shared core
   and provide UI5-specific adapters.
4. Update `kiosk-keyboard-webc` to import from the shared core and
   provide DOM/WC-specific adapters.
5. Add cross-package integration tests verifying behavioral parity.

The main risk is step 3: refactoring the UI5 control's imports without
breaking existing tests. This should only be attempted after the web
component is stable and the shared interfaces are proven.

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

### Properties (via `@property` decorator)

| Property         | Attribute         | Type                                     | Default                        | Description                                 |
| ---------------- | ----------------- | ---------------------------------------- | ------------------------------ | ------------------------------------------- |
| `layout`         | `layout`          | `String`                                 | `""` (auto-detect from locale) | Active layout name                          |
| `keyboardType`   | `keyboard-type`   | `String` (`Full` / `Numpad` / `Numeric`) | `Full`                         | Keyboard type                               |
| `docked`         | `docked`          | `Boolean`                                | `false`                        | Fixed to viewport bottom                    |
| `open`           | `open`            | `Boolean`                                | `false`                        | Visible state (docked mode)                 |
| `disabled`       | `disabled`        | `Boolean`                                | `false`                        | Disables all interaction                    |
| `stableHeight`   | `stable-height`   | `Boolean`                                | `false`                        | Maintain height across layouts              |
| `autoShow`       | `auto-show`       | `Boolean`                                | `false`                        | Auto show/close on focus                    |
| `autoType`       | `auto-type`       | `Boolean`                                | `false`                        | Auto-detect numpad vs full                  |
| `for`            | `for`             | `String`                                 | `""`                           | Target input element ID                     |
| `inputIds`       | `input-ids`       | `String`                                 | `""`                           | Comma-separated IDs for auto-show filtering |
| `mobileKeyboard` | `mobile-keyboard` | `String` (`Auto` / `Custom` / `Native`)  | `Auto`                         | Native keyboard deferral strategy           |

### Methods

| Method                | Signature                                                     | Description                                |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `show()`              | `(): void`                                                    | Open the keyboard (docked mode)            |
| `close()`             | `(): void`                                                    | Close the keyboard (docked mode)           |
| `isOpen()`            | `(): boolean`                                                 | Current open state                         |
| `registerLayout()`    | `(name: string, def: LayoutDefinition): void`                 | Register a custom layout                   |
| `resetKeyboardType()` | `(): void`                                                    | Clear explicit type, re-enable auto-detect |
| `setTargetElement()`  | `(el: HTMLInputElement \| HTMLTextAreaElement \| null): void` | Programmatic target                        |

### Events (via `@event` decorator)

| Event                  | Detail                               | Description                   |
| ---------------------- | ------------------------------------ | ----------------------------- |
| `key-press`            | `{ key: string, shiftKey: boolean }` | A key was pressed             |
| `after-open`           | `{}`                                 | Keyboard opened (docked mode) |
| `after-close`          | `{}`                                 | Keyboard closed (docked mode) |
| `layout-change`        | `{ layout: string }`                 | Layout switched               |
| `keyboard-type-change` | `{ keyboardType: string }`           | Keyboard type changed         |

### Slots

| Slot             | Description                                            |
| ---------------- | ------------------------------------------------------ |
| (none initially) | No slots in v1. The keyboard renders its own key grid. |

## Implementation Steps

### Step 1: Scaffold the package

Create `packages/kiosk-keyboard-webc/` with:

- `package.json`: dependencies on `@ui5/webcomponents-base` (runtime),
  `@ui5/webcomponents-theming` (runtime), `@ui5/webcomponents-tools` (dev).
  Modern TypeScript (`~5.9`), ESM-only (`"type": "module"`).
- `tsconfig.json`: strict mode, ESNext target, JSX support for preact
  templates (`"jsx": "react-jsx"`, `"jsxImportSource": "preact"`).
- Build scripts using `@ui5/webcomponents-tools` (or custom Vite/Rollup
  config if the tools package is too opinionated for a sub-package).
- Register in root `package.json` workspaces array.

**Acceptance:** `npm install` succeeds at root, `npm run build` in the
package produces `dist/` output.

### Step 2: Port types and layout definitions

Copy from `packages/kiosk-keyboard/src/`:

- `types.ts`: strip i18n-related types (keep `KeyDefinition`, `KeyRow`,
  `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`,
  `SECONDARY_LAYOUTS`). These are 100% framework-agnostic.
- `layouts/*.ts`: copy all 14 layout files verbatim. They are pure data
  with no imports beyond the local `types.ts`.
- `layouts/index.ts`: copy the layout registry record.

**Acceptance:** TypeScript compiles, layouts import cleanly.

### Step 3: Port core logic modules

Copy and adapt from `packages/kiosk-keyboard/src/internal/`:

#### 3a. `dom-utils.ts` (from `dom.ts`)

Copy verbatim. Already 100% framework-agnostic. Provides:

- `isInputOrTextarea()` type guard
- `resolveInputOrTextarea()` for shadow DOM traversal
- `keyElementId()` for key grid element IDs
- `KEY_ID_SUFFIX_RE` for parsing grid positions

#### 3b. `grapheme.ts` + `input-operations.ts`

Copy `grapheme.ts` verbatim; it provides `graphemeLengthBefore()` and
`graphemeLengthAfter()` using `Intl.Segmenter`, with zero framework
dependencies. `input-operations.ts` imports it for backspace handling.

Copy the pure DOM functions from `input-operations.ts`:

- `insertText(dom, text)`: splice text at cursor position
- `handleBackspace(dom)`: grapheme-aware backspace (uses `grapheme.ts`)
- `handleNavigation(dom, key)`: arrow/home/end handling

**Drop** the UI5-specific wrappers (`setTargetValue`, `fireTargetChange`).
In the web component, value sync goes directly to the target DOM element.
There is no UI5 `ManagedObject` metadata to bridge.

#### 3c. `keyboard-type-detector.ts` (from `detect-keyboard-type.ts`)

Keep only DOM-based detection (steps 3-4 of the current implementation):

- Check `inputmode` attribute (`numeric`, `decimal`, `tel`)
- Check HTML `type` attribute (`number`, `tel`)

**Drop** UI5-specific checks (`control.getType()`, `control.isA()`,
parent-chain walking). These rely on `sap.ui.core.Control` metadata. For
the web component, DOM attributes are sufficient.

#### 3d. `layout-registry.ts`

Port the layout storage and locale resolution:

- `registerLayout()`, `unregisterLayout()`, `getRegisteredLayout()`
- `getLocaleLayout()`: replace `sap/base/i18n/Localization.getLanguageTag()`
  with `navigator.language` + `Intl.Locale` for BCP47 parsing
- `registerLocaleLayout()`, `unregisterLocaleLayout()`

Replace `sap/base/Log` with `console.warn`.

#### 3e. `shift-state.ts` (new, extracted from KioskKeyboard.ts)

Extract the shift/caps lock state machine into its own module:

```ts
export class ShiftState {
  private _active = false;
  private _capsLock = false;

  get isShifted(): boolean {
    return this._active || this._capsLock;
  }
  get isCapsLock(): boolean {
    return this._capsLock;
  }

  toggle(): void {
    /* three-state cycle */
  }
  autoRelease(): boolean {
    /* release shift, not caps */
  }
  reset(): void {
    /* clear both */
  }
}
```

This is currently inlined in `KioskKeyboard.ts` as two boolean fields.
Extracting makes it testable and reusable.

**Acceptance:** All core modules compile with zero `sap/*` imports.

### Step 4: Implement the web component

Create `src/KioskKeyboard.ts` extending `UI5Element`:

```ts
import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import event from "@ui5/webcomponents-base/dist/decorators/event-strict.js";
import jsxRenderer from "@ui5/webcomponents-base/dist/renderer/JsxRenderer.js";

@customElement({
  tag: "kiosk-keyboard",
  renderer: jsxRenderer,
  template: KioskKeyboardTemplate,
  styles: KioskKeyboardCss,
  languageAware: true, // re-render on locale change (key labels)
})
class KioskKeyboard extends UI5Element {
  @property()
  accessor layout: string = "";

  @property()
  accessor keyboardType: string = "Full";

  @property({ type: Boolean })
  accessor docked: boolean = false;

  @property({ type: Boolean })
  accessor open: boolean = false;

  // ... remaining properties
}
```

#### State management

The component manages:

- **Shift state**: via `ShiftState` instance (step 3e)
- **Open state**: the reactive `open` property (no separate `_open` boolean needed; `@property` handles reactivity)
- **Layout resolution**: delegates to `layout-registry`
- **Target element**: resolved via `for` attribute + `document.getElementById()`
  or via `setTargetElement()`. No UI5 association needed.
- **Auto-show**: `focusin`/`focusout` document listeners (capture phase),
  same pattern as the UI5 control but using DOM IDs directly instead of
  UI5 control IDs
- **Keyboard type**: explicit vs auto-detected, same `_keyboardTypeExplicit`
  flag pattern

#### Target input resolution

The web component uses pure DOM for target resolution:

```ts
private _resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null {
  // 1. Explicit programmatic target
  if (this._targetElement) return this._targetElement;

  // 2. `for` attribute → document.getElementById()
  const forId = this.for;
  if (forId) {
    const el = document.getElementById(forId);
    return resolveInputOrTextarea(el);
  }

  return null;
}
```

For shadow DOM scenarios (e.g. the target input is inside another web
component), `setTargetElement()` accepts the inner DOM element directly.

**UI5 consumption note:** In a UI5 XML view, `<Input id="foo">` gets a
DOM ID like `container-app---View--foo` (view-prefixed). The `for`
attribute with `"foo"` won't find this via `document.getElementById()`.
For UI5 consumption, use `setTargetElement()` programmatically from the
controller, or let the auto-generated wrapper / bridge handle ID
resolution. The `for` attribute is primarily for standalone HTML usage
where DOM IDs are stable and predictable.

#### Focus steal prevention

Same pattern as the UI5 control: `mousedown`/`touchstart` handler on key
elements calls `preventDefault()` to prevent focus transfer away from
the target input. **Do not use `pointerdown`**; per the Pointer Events
spec, canceling `pointerdown` suppresses compatibility mouse events
including `click`. The web component uses native `mousedown` instead of
UI5's `ontouchstart` event delegation.

#### Event dispatch

```ts
// Native CustomEvent, not UI5 Event
this.dispatchEvent(
  new CustomEvent("key-press", {
    detail: { key, shiftKey },
    bubbles: true,
    composed: true, // crosses shadow DOM boundaries
  }),
);
```

All events use `composed: true` so they propagate out of the shadow root
and can be caught by parent elements or frameworks.

**Acceptance:** `<kiosk-keyboard for="myInput"></kiosk-keyboard>` renders
a keyboard and types into the target input in a standalone HTML page.

### Step 5: Implement the JSX template

Create `src/KioskKeyboardTemplate.tsx`:

```tsx
export default function KioskKeyboardTemplate(this: KioskKeyboard) {
  const layout = this._getResolvedLayout();
  const shifted = this._shiftState.isShifted;

  return (
    <div class={this._rootClasses}>
      {layout.map((row, rowIdx) => (
        <div class="kiosk-keyboard__row" role="row">
          {row.map((key, colIdx) => (
            <div
              class={keyClasses(key, shifted, this._shiftState.isCapsLock)}
              role="button"
              tabindex={rowIdx === 0 && colIdx === 0 ? "0" : "-1"}
              data-key={key.value}
              data-shift-value={key.shiftValue}
              aria-label={this._getKeyAriaLabel(key)}
              onMouseDown={this._onKeyMouseDown}
              onTouchStart={this._onKeyTouchStart}
              onClick={this._onKeyClick}
            >
              {renderKeyContent(key, shifted)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

The template mirrors the DOM structure of `KioskKeyboardRenderer.ts`:
root `<div>` → row `<div>`s → key `<div>`s with `role="button"`.

### Step 6: Implement theming

#### Base CSS (`src/themes/KioskKeyboard.css`)

Translate the LESS stylesheet to CSS using SAP CSS custom properties:

| LESS parameter                     | CSS variable equivalent                  |
| ---------------------------------- | ---------------------------------------- |
| `@sapUiButtonBackground`           | `var(--sapButton_Background)`            |
| `@sapUiButtonBorderColor`          | `var(--sapButton_BorderColor)`           |
| `@sapUiButtonTextColor`            | `var(--sapButton_TextColor)`             |
| `@sapUiButtonHoverBackground`      | `var(--sapButton_Hover_Background)`      |
| `@sapUiButtonActiveBackground`     | `var(--sapButton_Active_Background)`     |
| `@sapUiButtonEmphasizedBackground` | `var(--sapButton_Emphasized_Background)` |
| `@sapUiButtonEmphasizedTextColor`  | `var(--sapButton_Emphasized_TextColor)`  |
| `@sapUiButtonLiteBackground`       | `var(--sapButton_Lite_Background)`       |
| `@sapUiContentShadowColor`         | `var(--sapContent_Shadow0)`              |
| `@sapUiElementBorderCornerRadius`  | `var(--sapElement_BorderCornerRadius)`   |
| `@sapUiFontSize`                   | `var(--sapFontSize)`                     |
| `@sapUiFontFamily`                 | `var(--sapFontFamily)`                   |

The CSS uses `:host` selector for the custom element and standard class
selectors for internal structure. Flexbox layout, key sizing, and
animations remain identical to the LESS version.

#### Theme-specific parameter bundles

For component-specific variables (if any), create per-theme overrides in
`src/themes/sap_horizon/parameters-bundle.css`, etc. For the initial
implementation, the SAP global CSS variables should be sufficient; the
existing keyboard styles map cleanly to `--sapButton_*` and `--sapElement_*`
variables.

If component-specific CSS variables are needed (e.g. keyboard gap, row
spacing), define them with sensible defaults:

```css
:host {
  --kiosk-keyboard-gap: 0.25rem;
  --kiosk-keyboard-key-height: 2.75rem;
  --kiosk-keyboard-key-min-width: 2.75rem;
}
```

#### Content density

The UI5 Web Components framework provides content density support. The
existing keyboard has compact mode via `.sapUiSizeCompact` ancestor class.
For the web component, use the `data-ui5-compact-size` attribute pattern
that UI5 Web Components use, or detect the ancestor class and adjust via
CSS (`:host-context(.sapUiSizeCompact)`).

**Acceptance:** The keyboard renders correctly in all four Horizon theme
variants. Switching themes at runtime updates colors without re-render.

### Step 7: Implement i18n

Use the UI5 Web Components i18n system:

1. Place `.properties` files in `src/i18n/`.
2. The `@ui5/webcomponents-tools` build processes them into importable
   JS modules in `generated/i18n/`.
3. Use the `@i18n` decorator or `getI18nBundle()` API to access texts
   at runtime.
4. Set `languageAware: true` in `@customElement` so the component
   re-renders when the locale changes.

Port the existing message bundles from `kiosk-keyboard/src/i18n/`:

- `messagebundle.properties` (English, 11 keys for ARIA labels)
- `messagebundle_de.properties` (German)

**Acceptance:** Key labels and ARIA texts render in the correct locale.
Changing locale at runtime updates all labels.

### Step 8: Demo app integration

Add a new demo page showing the web component consumed inside the UI5 app.

#### 8a. New view: `KioskWebComponent.view.xml`

```xml
<mvc:View
  xmlns:mvc="sap.ui.core.mvc"
  xmlns="sap.m"
  xmlns:kiosk="kiosk-keyboard-webc/dist"
  controllerName="demo.hotkeys.controller.KioskWebComponent">

  <Page title="Kiosk Keyboard: Web Component">
    <VBox class="sapUiMediumMargin">
      <Label text="Target input" labelFor="wcTarget" />
      <Input id="wcTarget" placeholder="Type here via web component keyboard" />
    </VBox>

    <!-- Web component consumed via auto-generated UI5 wrapper -->
    <kiosk:KioskKeyboard
      docked="true"
      auto-show="true"
      auto-type="true" />
  </Page>
</mvc:View>
```

This uses the same pattern as the existing `custom:AlertButton` and
`custom:KioskInput` consumption in `KioskInputIds.view.xml`: a custom
XML namespace pointing to the npm package, with `ui5-tooling-modules`
resolving the import.

Alternatively, if the XML namespace approach doesn't work cleanly for
UI5 Web Components base elements, use an `sap.ui.core.HTML` wrapper
or a `WebComponent.extend()` bridge control (the demo app already has
this pattern in `webapp/control/KioskInput.ts`).

#### 8b. New controller: `KioskWebComponent.controller.ts`

Minimal controller showing programmatic interaction:

```ts
import BaseController from "./BaseController";

export default class KioskWebComponent extends BaseController {
  onAfterRendering(): void {
    // Wire target input: UI5 prefixes DOM IDs, so use setTargetElement()
    const input = this.byId("wcTarget")?.getFocusDomRef() as HTMLInputElement;
    const kb = document.querySelector("kiosk-keyboard");
    kb?.setTargetElement(input ?? null);
  }

  onRegisterCustomLayout(): void {
    const kb = document.querySelector("kiosk-keyboard");
    kb?.registerLayout("pinpad", [
      [{ value: "1" }, { value: "2" }, { value: "3" }],
      [{ value: "4" }, { value: "5" }, { value: "6" }],
      [{ value: "7" }, { value: "8" }, { value: "9" }],
      [
        { value: "{backspace}", label: "DEL", type: "action" },
        { value: "0" },
        { value: "{enter}", label: "OK", type: "action" },
      ],
    ]);
  }
}
```

#### 8c. Route registration

Add to `webapp/manifest.json`:

```json
{
  "pattern": "kiosk/web-component",
  "name": "kiosk-web-component",
  "target": "kiosk-web-component"
}
```

And target:

```json
{
  "kiosk-web-component": {
    "viewName": "KioskWebComponent",
    "viewLevel": 2
  }
}
```

#### 8d. Navigation link

Add a tile/link on the kiosk hub page pointing to the new demo.

**Acceptance:** The demo page loads, the web component keyboard renders
with SAP Horizon theming, typing works into the target input.

### Step 9: Testing

#### Testing tooling

Three test layers, each chosen for its strengths:

| Layer                      | Tool                                            | Why                                                                                      |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unit tests (pure logic)    | **Vitest 3.x** (jsdom)                          | Fast, no browser needed. Sufficient for framework-agnostic modules with no shadow DOM.   |
| Component tests (rendered) | **@web/test-runner** + **@open-wc/testing 4.x** | Runs in a real browser; shadow DOM, custom elements, CSS variables all work natively.    |
| E2E + visual regression    | **WebdriverIO 9** + **@wdio/visual-service**    | Consistent with existing `kiosk-keyboard` infra. Proven theme-switching + baseline flow. |

**Why not Vitest for component tests?** Vitest + jsdom/happy-dom cannot
reliably render web components with shadow DOM. The UI5 Web Components
team's own test suite states: _"vitest and jsdom are not supported for
component development."_ (`@ui5/webcomponents/test/unit/vitest.test.js`).
Shadow DOM lifecycle callbacks, `adoptedStyleSheets`, and
`ElementInternals` are missing or broken in simulated environments.

**Why @web/test-runner instead of Cypress?** The official UI5 WC repo uses
Cypress 15.x for component testing, but `@web/test-runner` +
`@open-wc/testing` is the broader industry standard for web component
libraries (used by Lit, Shoelace, open-wc). It's lightweight (no
Electron/browser UI), runs in headless Chrome via Playwright launcher,
and pairs naturally with `fixture()` / `oneEvent()` / `waitUntil()`
helpers from `@open-wc/testing-helpers`. Either tool works; this is a
preference call, not a hard constraint.

**Dependencies to add in `packages/kiosk-keyboard-webc/`:**

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@web/test-runner": "^0.20.0",
    "@web/test-runner-playwright": "^0.11.0",
    "@open-wc/testing": "^4.0.0"
  }
}
```

E2E / visual regression dependencies are shared at root level (already
installed: `@wdio/cli`, `@wdio/local-runner`, `@wdio/visual-service`).

#### Unit tests (Vitest)

Test the core modules independently, no browser, no shadow DOM:

- `shift-state.test.ts`: three-state cycle, auto-release, reset
- `layout-registry.test.ts`: register, resolve, locale mapping
- `input-operations.test.ts`: insert, backspace, navigation on mock inputs
- `keyboard-type-detector.test.ts`: inputmode/type detection
- `grapheme.test.ts`: grapheme length before/after with emoji, CJK, etc.

Config (`vitest.config.ts`):

```ts
export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
    globals: true,
    environment: "jsdom", // sufficient for pure DOM mocks (no shadow DOM)
  },
});
```

#### Component tests (@web/test-runner + @open-wc/testing)

Test the rendered web component in a real browser:

```ts
import { fixture, html, expect, oneEvent } from "@open-wc/testing";
import "../src/KioskKeyboard.js";

it("renders keys in shadow DOM", async () => {
  const el = await fixture(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`);
  const keys = el.shadowRoot!.querySelectorAll('[role="button"]');
  expect(keys.length).to.be.greaterThan(0);
});

it("dispatches key-press on click", async () => {
  const el = await fixture(html`<kiosk-keyboard layout="numeric"></kiosk-keyboard>`);
  const key = el.shadowRoot!.querySelector('[data-key="1"]')!;
  setTimeout(() => key.click());
  const { detail } = await oneEvent(el, "key-press");
  expect(detail.key).to.equal("1");
});
```

**Shadow DOM querying:** In `@web/test-runner`, tests run in a real
browser so `el.shadowRoot.querySelector(...)` works natively. No special
piercing utilities needed.

**Event simulation:** Synthetic events dispatched on shadow DOM elements
propagate out when `composed: true` is set on the component's event.
For focus-related tests, use `el.shadowRoot.querySelector(...).focus()`
directly; real browser focus semantics apply.

Test cases:

- Render test: component creates shadow DOM with expected structure
- Property reflection: attribute changes update properties and re-render
- Key interaction: click/touch on keys produce `key-press` events
- Target integration: text appears in target input after key press
- Shift/caps: visual state and output change correctly
- Layout switching: `{layout:numeric}` switches to numeric layout
- Docked mode: open/close with slide animation
- Auto-show: focusin/focusout on target input triggers show/close
- Focus steal prevention: mousedown on key keeps focus on target input
- i18n: key labels render in correct locale, resolver overrides apply
- Accessibility: ARIA roles, labels, roving tabindex
- Accessibility audit: `await expect(el).to.be.accessible()` (axe-core
  via `chai-a11y-axe` included in `@open-wc/testing`)

Config (`web-test-runner.config.mjs`):

```js
import { playwrightLauncher } from "@web/test-runner-playwright";

export default {
  files: "test/component/**/*.test.ts",
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: "chromium" })],
};
```

#### E2E + visual regression (WebdriverIO)

Reuse the existing WebdriverIO visual regression infrastructure from
`kiosk-keyboard`. Add a test suite for the web component variant:

- Standalone HTML test page (`test/pages/index.html`) that loads the
  web component without UI5, validating framework-independent usage
- Screenshot comparisons in all four Horizon theme variants
- Theme switching: parameterize tests with `sap_horizon`,
  `sap_horizon_dark`, `sap_horizon_hcb`, `sap_horizon_hcw`
- Compare against the existing UI5 control baselines for visual parity

The demo app integration (Step 8) also serves as an E2E test surface;
the web component consumed inside a UI5 app validates the bridge pattern.

**Acceptance:** All test layers pass. Visual baselines captured for all
themes.

### Step 10: Build and bundle configuration

#### Build output

The package should produce:

1. **ESM modules** in `dist/`: for bundler consumption (`import`)
2. **Assets**: theme CSS and i18n bundles registered via `Assets.ts`

Consumers import:

```ts
import "kiosk-keyboard-webc/dist/Assets.js"; // themes + i18n
import "kiosk-keyboard-webc/dist/KioskKeyboard.js"; // registers <kiosk-keyboard>
```

Or for tree-shaking-friendly consumption:

```ts
import KioskKeyboard from "kiosk-keyboard-webc/dist/KioskKeyboard.js";
```

#### Root workspace integration

Add to root `package.json`:

```json
{
  "scripts": {
    "build:kiosk-webc": "npm run build -w packages/kiosk-keyboard-webc",
    "test:kiosk-webc": "npm test -w packages/kiosk-keyboard-webc",
    "typecheck:kiosk-webc": "npm run typecheck -w packages/kiosk-keyboard-webc"
  }
}
```

## Feature Parity Matrix (v1)

Features included in the first implementation:

| Feature                            | UI5 Control           | Web Component v1                                 |
| ---------------------------------- | --------------------- | ------------------------------------------------ |
| Full keyboard layout               | Yes                   | Yes                                              |
| Numpad layout                      | Yes                   | Yes                                              |
| Numeric layout                     | Yes                   | Yes                                              |
| Special characters layout          | Yes                   | Yes                                              |
| Custom layout registration         | Yes                   | Yes                                              |
| Shift / Caps Lock                  | Yes                   | Yes                                              |
| Layout switching                   | Yes                   | Yes                                              |
| Docked mode                        | Yes                   | Yes                                              |
| Auto-show                          | Yes                   | Yes                                              |
| Auto-type detection                | Yes                   | Partial (DOM-only, no UI5 control introspection) |
| Target input by ID (`for`)         | Yes (association)     | Yes (attribute)                                  |
| Target filtering (`inputIds`)      | Yes                   | Yes                                              |
| Keyboard navigation (arrow keys)   | Yes                   | Yes                                              |
| SAP theming (all Horizon variants) | Yes (LESS)            | Yes (CSS variables)                              |
| i18n (key labels, ARIA)            | Yes (ResourceBundle)  | Yes (UI5 WC i18n)                                |
| Stable height                      | Yes                   | Yes                                              |
| Focus steal prevention             | Yes                   | Yes                                              |
| `key-press` event                  | Yes                   | Yes                                              |
| `after-open` / `after-close`       | Yes                   | Yes                                              |
| `layout-change` event              | Yes                   | Yes                                              |
| F-key mode                         | Yes                   | Yes                                              |
| Function key / nav key layouts     | Yes                   | Yes                                              |
| Multi-keyboard instance isolation  | Yes                   | Yes (static `Set<KioskKeyboard>`, same pattern)  |
| Mobile keyboard detection          | Yes (`sap/ui/Device`) | Yes (`pointer: coarse` media query)              |
| `inputmode` suppression/restore    | Yes                   | Yes (same ref-counted static map, pure DOM)      |
| Physical keyboard highlight        | Yes (UI5 delegate)    | Yes (native `keydown`/`keyup` listeners)         |
| `change` event on target           | Yes (`fireChange`)    | Partial (dispatches native `input`/`change`)     |
| i18n extensibility                 | Yes (3-layer chain)   | Yes (2-layer: WC i18n + resolver callback)       |

All features included in v1. No features deferred.

### v1 feature implementation notes

The following features were initially considered for deferral but are
low-effort direct ports and are included in v1.

#### Multi-keyboard instance isolation

Direct port. See implementation sketch below.

#### Mobile keyboard detection

Replace `sap/ui/Device` with `pointer: coarse` / `pointer: fine` media
queries. Simpler than the UI5 approach and more reliable than UA sniffing.
See implementation sketch below.

#### `inputmode` suppression/restore

The ref-counted static map pattern is 100% DOM-based already in the UI5
control. Direct port with zero framework dependencies. See implementation
sketch below.

#### Physical keyboard highlight delegation

Replace UI5's `addEventDelegate()` with native `addEventListener` on the
target element. Actually simpler than the UI5 version. See implementation
sketch below.

#### `change` event on target

The UI5 control calls `fireLiveChange()` and `fireChange()` on the UI5
control instance. The web component dispatches native `InputEvent` (on
each keystroke) and `Event('change')` (on Enter / target switch) on the
target DOM element. This is the web-standard equivalent; frameworks
listening for `input`/`change` events on the target element will work
naturally.

### v1 implementation: i18n extensibility

The UI5 control implements a three-layer i18n resolution chain:
base library bundle → enhancement bundles (`configureI18n`) → override hook
(`setI18nOverrideHook`). This was designed around UI5's `ResourceBundle`
infrastructure and carries complexity (generation counters for stale async
loads, `Lib.getResourceBundleFor()`, locale churn retry loops).

The web component replaces this with a **two-layer design** that leverages
the native UI5 WC i18n system and adds a single resolver callback:

#### Layer 1: UI5 WC i18n system (base translations)

The component uses `@i18n("kiosk-keyboard-webc")` to load its default
message bundles via the framework's `registerI18nLoader()`. This gives:

- Automatic locale detection and bundle loading
- Runtime locale switching (via `languageAware: true`)
- Consumers can override bundles globally using the framework's native
  `registerI18nLoader("kiosk-keyboard-webc", "de", async () => { ... })`

This is the standard pattern used by all official UI5 Web Components.
The override mechanism is automatically available; no custom code needed.

#### Layer 2: Resolver callback (programmatic overrides)

A single static callback that receives the key and base text, returning
an override or `undefined`. This subsumes both the enhancement bundles
and the override hook from the UI5 control into one simpler primitive:

```ts
KioskKeyboard.setI18nResolver((key, baseText, locale) => {
  return myTranslations[locale]?.[key];
});
```

Resolution order: resolver callback → WC i18n bundle → default text.
If the resolver returns `undefined`, the framework's bundle is used.
If no bundle is loaded (e.g. unsupported locale), the English default
text from the `i18n-defaults.ts` generated module is used.

**Why this design:**

| Concern                       | UI5 control (3-layer)                                       | Web component (2-layer)                     |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Base translations             | `ResourceBundle` via `Lib.getResourceBundleFor`             | UI5 WC `@i18n` decorator (framework-native) |
| Locale-keyed bundle override  | `configureI18n({ enhanceWith })` custom API                 | `registerI18nLoader()` (framework-native)   |
| Programmatic per-key override | `setI18nOverrideHook()` custom API                          | `setI18nResolver()` (single callback)       |
| Async loading complexity      | Generation counters, retry loops                            | None (framework handles async loading)      |
| Number of custom APIs         | 3 (`configureI18n`, `setI18nOverrideHook`, `getI18nBundle`) | 1 (`setI18nResolver`)                       |

The three-layer complexity of the UI5 control collapses into the framework's
built-in i18n (layer 1) plus a single callback (layer 2). The resolver
callback is strictly optional; most consumers will only need the base
translations or the framework-native `registerI18nLoader` override.

**Effort:** Low-medium. The UI5 WC i18n integration is standard scaffolding.
The resolver callback is ~15 lines of code in the `getText()` wrapper.

### v1 implementation: multi-keyboard instance isolation

The UI5 control uses a static `_instances: Set<KioskKeyboard>` to track all
living instances. Auto-show checks `_isTargetOfOther()` before claiming an
input, preventing a docked keyboard from stealing inputs owned by an inline
keyboard.

**Web component approach:**

Same pattern, directly portable:

```ts
class KioskKeyboard extends UI5Element {
  private static readonly _instances = new Set<KioskKeyboard>();

  onEnterDOM(): void {
    KioskKeyboard._instances.add(this);
  }

  onExitDOM(): void {
    KioskKeyboard._instances.delete(this);
    // Future: when i18n extensibility is added, clean up static
    // i18n state here if this is the last instance (FLP safety).
  }

  private _isTargetOfOther(inputId: string): boolean {
    for (const other of KioskKeyboard._instances) {
      if (other === this) continue;
      // Check both the `for` attribute and the currently auto-shown target
      if (other.for === inputId || other._currentTargetId === inputId) return true;
    }
    return false;
  }
}
```

The `onEnterDOM()` / `onExitDOM()` lifecycle hooks are the UI5 WC equivalent
of `init()` / `exit()`. The logic is identical to the UI5 control.

**Effort:** Low. Direct port, no design decisions needed.

### v1 implementation: mobile keyboard detection

The UI5 control uses `sap/ui/Device` to detect phones, tablets, and combi
devices (laptops with touchscreens). The `_shouldDeferToNative()` method
returns `true` on mobile devices so the native virtual keyboard is used
instead of the kiosk keyboard.

**Web component approach:**

Replace `sap/ui/Device` with standard web APIs:

```ts
private _shouldDeferToNative(): boolean {
  const mode = this.mobileKeyboard; // "Auto" | "Custom" | "Native"
  if (mode === "Custom") return false;
  if (mode === "Native") return true;

  // "Auto": use coarse pointer detection (more reliable than UA sniffing)
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const hasFineMouse = matchMedia("(pointer: fine)").matches;

  // Coarse-only = phone/tablet → defer to native keyboard
  // Coarse + fine = combi device (laptop with touchscreen) → use kiosk
  return isTouch && !hasFineMouse;
}
```

`pointer: coarse` is supported in all evergreen browsers and is more
reliable than user-agent parsing. The `coarse && !fine` check handles
combi devices the same way the UI5 control's `tablet && !desktop` check
does.

For more granular detection (phone vs tablet), `navigator.maxTouchPoints`
and viewport width heuristics can supplement the pointer query. But for
the kiosk keyboard's purpose (should we show or defer?), the pointer
media query is sufficient.

**Effort:** Low. The media query approach is simpler than the UI5 Device API.

### v1 implementation: `inputmode` suppression/restore

When the kiosk keyboard opens, the UI5 control sets `inputmode="none"` on
the target input to prevent the native virtual keyboard from appearing. It
uses a ref-counted static map (`_inputModeSuppressions`) so multiple keyboard
instances targeting the same input don't clobber each other's restore.

**Web component approach:**

The ref-counting pattern is framework-agnostic and ports directly:

```ts
private static readonly _inputModeSuppressions = new Map<string, {
  originalInputMode: string | null;
  refCount: number;
}>();

private _suppressedInputId: string | null = null;

private _suppressNativeKeyboard(): void {
  if (this._shouldDeferToNative()) return;

  const target = this._resolveTarget();
  if (!target?.id) return;

  // Restore previous target first (if switching targets while open)
  this._restoreNativeKeyboard();

  const state = KioskKeyboard._inputModeSuppressions.get(target.id);
  if (state) {
    state.refCount += 1;
  } else {
    KioskKeyboard._inputModeSuppressions.set(target.id, {
      originalInputMode: target.getAttribute("inputmode"),
      refCount: 1,
    });
  }

  target.setAttribute("inputmode", "none");
  this._suppressedInputId = target.id;
}

private _restoreNativeKeyboard(): void {
  const inputId = this._suppressedInputId;
  if (!inputId) return;

  const state = KioskKeyboard._inputModeSuppressions.get(inputId);
  if (!state) { this._suppressedInputId = null; return; }

  state.refCount -= 1;
  if (state.refCount > 0) {
    // Another instance still claims this input
    this._suppressedInputId = null;
    return;
  }

  const dom = document.getElementById(inputId) as HTMLInputElement | null;
  if (dom) {
    if (state.originalInputMode !== null) {
      dom.setAttribute("inputmode", state.originalInputMode);
    } else {
      dom.removeAttribute("inputmode");
    }
  }

  KioskKeyboard._inputModeSuppressions.delete(inputId);
  this._suppressedInputId = null;
}
```

Integration points are the same as the UI5 control: call `_suppress` in
`show()` and on target switch, call `_restore` in `close()` and
`onExitDOM()`.

**Effort:** Low. Direct port with no UI5 dependencies; the entire
implementation uses DOM APIs.

### v1 implementation: physical keyboard highlight delegation

When a physical key is pressed on the target input, the UI5 control
highlights the corresponding on-screen key by toggling a CSS class.
This uses UI5's `addEventDelegate()` to attach `onkeydown`/`onkeyup`
handlers to the target control.

**Web component approach:**

Replace UI5 event delegation with native DOM event listeners on the
target element:

```ts
private _highlightCleanup: (() => void) | null = null;

private _addHighlightDelegation(): void {
  const target = this._resolveTarget();
  if (!target) return;

  const onKeyDown = (e: KeyboardEvent) => this._highlightKey(e.key, true);
  const onKeyUp = (e: KeyboardEvent) => this._highlightKey(e.key, false);

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  this._highlightCleanup = () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
  };
}

private _removeHighlightDelegation(): void {
  this._highlightCleanup?.();
  this._highlightCleanup = null;
}

private _highlightKey(key: string, add: boolean): void {
  const root = this.shadowRoot;
  if (!root) return;

  // Map physical key to data-key value (same lookup table as UI5 control)
  const mapped = KEY_TO_DATA_KEY[key];
  const el =
    root.querySelector(`[data-key="${CSS.escape(mapped ?? key)}"]`) ??
    (key.length === 1
      ? root.querySelector(`[data-key="${CSS.escape(key.toLowerCase())}"]`)
      : null) ??
    root.querySelector(`[data-shift-value="${CSS.escape(key)}"]`);

  el?.classList.toggle("kiosk-keyboard__key--highlight", add);
}
```

The only difference from the UI5 control: `this.shadowRoot.querySelector()`
instead of `this.getDomRef().querySelector()`, and native `addEventListener`
instead of UI5's `addEventDelegate`. The key-to-data-key mapping table and
the CSS class toggle logic are identical.

**Effort:** Low. Direct port, actually simpler than the UI5 version since
native `addEventListener` is more straightforward than the delegate pattern.

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

### Path A: Auto-generated wrappers (recommended)

`ui5-tooling-modules` (v3.34.6, already installed) auto-detects a
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
   automatically for `UI5Element`-based components.

3. Add `"kiosk-keyboard-webc": "file:../kiosk-keyboard-webc"` to the
   demo app's `package.json` dependencies. npm workspaces ensure it is
   resolvable from `node_modules`.

Once set up, XML views consume the component directly:

```xml
<mvc:View xmlns:kiosk="kiosk-keyboard-webc/dist">
  <kiosk:KioskKeyboard
    docked="true"
    auto-show="true"
    for="myInput" />
</mvc:View>
```

This is the same pattern the demo app already uses for
`xmlns:webc="@ui5/webcomponents/dist"` in `KioskInputIds.view.xml`.

### Path B: Manual WebComponent.extend() bridge (fallback)

Already proven in `webapp/control/KioskInput.ts`. A manual bridge gives
full control over property mapping, event transformation, and method
delegation. Use this if the auto-generated wrapper needs customization:

```ts
import WebComponent from "sap/ui/core/webc/WebComponent";

const KioskKeyboardBridge = WebComponent.extend("demo.hotkeys.control.KioskKeyboardBridge", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: { type: "string", mapping: "property" },
      docked: { type: "boolean", mapping: "property" },
      autoShow: { type: "boolean", mapping: { type: "property", to: "auto-show" } },
      // ...
    },
    events: {
      keyPress: { mapping: { to: "key-press" } },
      afterOpen: { mapping: { to: "after-open" } },
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

## Risks and Mitigations

| Risk                                        | Impact     | Mitigation                                                                                                                    |
| ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Feature drift between UI5 control and WC    | Medium     | Explicit parity matrix; shared layout data                                                                                    |
| Shadow DOM focus/caret edge cases           | Low        | Research confirms all operations work cross-boundary; existing patterns transfer (see research section)                       |
| `@ui5/webcomponents-tools` build complexity | Low-Medium | Can fall back to manual Vite/Rollup build if tooling is too rigid                                                             |
| Bundle size concern for standalone use      | Low        | ~30-40 KB for base is acceptable; tree-shaking available                                                                      |
| Demo app integration                        | Low        | Two proven paths: auto-wrapper via `customElements` manifest, or manual `WebComponent.extend()` bridge (see research section) |

## Suggested Implementation Order

For the actual PR work, implement in this order to get feedback early:

1. **Steps 1-2**: Package scaffold + types/layouts (fast, validates build setup)
2. **Step 3**: Core logic ports (validates framework-agnostic extraction)
3. **Steps 4-5**: Component + template (first rendering on screen)
4. **Step 6**: Theming (visual validation in all themes)
5. **Step 7**: i18n (locale-aware labels)
6. **Step 8**: Demo app integration (end-to-end validation in UI5 app)
7. **Steps 9-10**: Tests + build polish (stabilization)

Each step produces a testable increment. Steps 1-5 can happen
independently of the demo app, enabling parallel work.
