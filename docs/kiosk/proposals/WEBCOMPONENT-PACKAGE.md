# Implementation Plan: `kiosk-keyboard-webc` Web Component Package

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
| `internal/input-operations.ts` (text insert, backspace, caret)          | ~65%      | Copy pure DOM functions, drop UI5 Element wrappers             |
| `internal/detect-keyboard-type.ts` (auto-type heuristics)               | ~85%      | Keep DOM-based checks, drop UI5 control introspection          |
| `internal/layout-registry.ts` (layout store, locale mapping)            | ~85%      | Replace `sap/base/i18n/Localization` with `navigator.language` |
| `KioskKeyboardRenderer.ts` (UI5 RenderManager)                          | 0%        | Not extracted. Replaced by JSX template.                       |
| `internal/i18n-registry.ts` (UI5 ResourceBundle chain)                  | 0%        | Not extracted. Use UI5 WC i18n system instead.                 |
| `themes/base/KioskKeyboard.less` (SAP LESS params)                      | ~95%      | Translate LESS params to CSS variable equivalents              |

## Shared Core Candidates (Future Reference)

The modules below were identified as candidates for a future shared-core
package that both the UI5 control and the web component could consume.
This extraction is **not part of the current plan** (see "Why a separate
package, not a shared-core refactor?" above), but is documented here so
the information is not lost.

### Tier 1: Extract immediately (zero dependencies, pure data/utilities)

| Module                         | Source location                      | What it provides                                                                                                     | Notes                                                                              |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `types.ts` (layout types only) | `kiosk-keyboard/src/types.ts`        | `KeyDefinition`, `KeyRow`, `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`, `SECONDARY_LAYOUTS`         | 100% framework-agnostic. i18n types (`KioskI18nConfig` etc.) stay in each package. |
| All layout definitions         | `kiosk-keyboard/src/layouts/*.ts`    | 14 layout files (qwerty, qwertz-de, numeric, special, numpad, fkeys, nav, fkey-row, nav-row, and composite variants) | Pure data — `LayoutDefinition` arrays with no imports beyond local types.          |
| DOM utilities                  | `kiosk-keyboard/src/internal/dom.ts` | `isInputOrTextarea()`, `resolveInputOrTextarea()`, `keyElementId()`, `KEY_ID_SUFFIX_RE`                              | Zero `sap/*` imports. Works with any DOM environment.                              |

### Tier 2: Extract with thin adapter interface

| Module                  | Source location                                                                                                   | UI5-coupled parts                                                                                                                                            | Adaptation needed                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input operations        | `kiosk-keyboard/src/internal/input-operations.ts`                                                                 | `setTargetValue()` calls `element.getMetadata()`, `element.setValue()`, `element.fireEvent()`. `fireTargetChange()` uses `element.getMetadata().hasEvent()`. | Split into pure DOM functions (`insertText`, `handleBackspace`, `handleNavigation`) and a `TargetValueSync` adapter interface. The UI5 control passes its `Element`-based adapter; the WC passes a DOM-only adapter. |
| Keyboard type detection | `kiosk-keyboard/src/internal/detect-keyboard-type.ts`                                                             | Steps 1-2: `control.getType()`, `control.isA("sap.m.InputBase")`, parent-chain walking via `getParent()`.                                                    | Extract DOM-based detection (steps 3-4: `inputmode` attribute, HTML `type` attribute) as shared. UI5-specific checks stay in the UI5 control as an additional detection layer.                                       |
| Layout registry         | `kiosk-keyboard/src/internal/layout-registry.ts`                                                                  | `Localization.getLanguageTag()` for locale resolution, `Log.warning()` for diagnostics.                                                                      | Accept locale as a parameter (`getLocaleLayout(locale: string)`) instead of reading it internally. Each consumer provides the locale from its own framework.                                                         |
| Target input session    | `kiosk-keyboard/src/internal/target-input-session.ts`                                                             | Constructor takes `() => Element \| null` callback. `fireChangeIfDirty()` assumes `Element.fireEvent()`.                                                     | Generalize callback to return an interface `{ getFocusDomRef(): HTMLElement, fireEvent?(name: string): void }`. The WC adapter omits `fireEvent` and dispatches native `input`/`change` events instead.              |
| Shift state machine     | Inlined in `kiosk-keyboard/src/KioskKeyboard.ts` (`_shiftActive`, `_capsLock` fields + toggle/auto-release logic) | None — pure boolean state machine.                                                                                                                           | Extract as standalone `ShiftState` class. Currently coupled to the control only because it was never factored out.                                                                                                   |

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
    KioskKeyboard.css                    # Component styles (CSS with SAP vars)
    KioskKeyboardTemplate.tsx            # JSX template (preact renderer)
    bundle.esm.ts                        # ESM entry point
    Assets.ts                            # Theme + i18n asset registration
    generated/                           # Build-generated theme/i18n modules
      themes/
      i18n/
    types.ts                             # Shared type definitions
    core/
      dom-utils.ts                       # Input/textarea guards, key ID utils
      input-operations.ts                # Pure DOM text manipulation
      keyboard-type-detector.ts          # DOM-based auto-type detection
      layout-registry.ts                 # Layout storage + locale resolution
      shift-state.ts                     # Shift / Caps Lock state machine
    layouts/
      index.ts                           # Layout registry with all built-ins
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

| Property       | Attribute       | Type                                     | Default                        | Description                                 |
| -------------- | --------------- | ---------------------------------------- | ------------------------------ | ------------------------------------------- |
| `layout`       | `layout`        | `String`                                 | `""` (auto-detect from locale) | Active layout name                          |
| `keyboardType` | `keyboard-type` | `String` (`Full` / `Numpad` / `Numeric`) | `Full`                         | Keyboard type                               |
| `docked`       | `docked`        | `Boolean`                                | `false`                        | Fixed to viewport bottom                    |
| `open`         | `open`          | `Boolean`                                | `false`                        | Visible state (docked mode)                 |
| `disabled`     | `disabled`      | `Boolean`                                | `false`                        | Disables all interaction                    |
| `stableHeight` | `stable-height` | `Boolean`                                | `false`                        | Maintain height across layouts              |
| `autoShow`     | `auto-show`     | `Boolean`                                | `false`                        | Auto show/close on focus                    |
| `autoType`     | `auto-type`     | `Boolean`                                | `false`                        | Auto-detect numpad vs full                  |
| `for`          | `for`           | `String`                                 | `""`                           | Target input element ID                     |
| `inputIds`     | `input-ids`     | `String`                                 | `""`                           | Comma-separated IDs for auto-show filtering |

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

- `package.json` — dependencies on `@ui5/webcomponents-base` (runtime),
  `@ui5/webcomponents-theming` (runtime), `@ui5/webcomponents-tools` (dev).
  Modern TypeScript (`~5.9`), ESM-only (`"type": "module"`).
- `tsconfig.json` — strict mode, ESNext target, JSX support for preact
  templates (`"jsx": "react-jsx"`, `"jsxImportSource": "preact"`).
- Build scripts using `@ui5/webcomponents-tools` (or custom Vite/Rollup
  config if the tools package is too opinionated for a sub-package).
- Register in root `package.json` workspaces array.

**Acceptance:** `npm install` succeeds at root, `npm run build` in the
package produces `dist/` output.

### Step 2: Port types and layout definitions

Copy from `packages/kiosk-keyboard/src/`:

- `types.ts` — strip i18n-related types (keep `KeyDefinition`, `KeyRow`,
  `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`,
  `SECONDARY_LAYOUTS`). These are 100% framework-agnostic.
- `layouts/*.ts` — copy all 14 layout files verbatim. They are pure data
  with no imports beyond the local `types.ts`.
- `layouts/index.ts` — copy the layout registry record.

**Acceptance:** TypeScript compiles, layouts import cleanly.

### Step 3: Port core logic modules

Copy and adapt from `packages/kiosk-keyboard/src/internal/`:

#### 3a. `dom-utils.ts` (from `dom.ts`)

Copy verbatim. Already 100% framework-agnostic. Provides:

- `isInputOrTextarea()` type guard
- `resolveInputOrTextarea()` for shadow DOM traversal
- `keyElementId()` for key grid element IDs
- `KEY_ID_SUFFIX_RE` for parsing grid positions

#### 3b. `input-operations.ts`

Copy the pure DOM functions:

- `insertText(dom, text)` — splice text at cursor position
- `handleBackspace(dom)` — grapheme-aware backspace
- `handleNavigation(dom, key)` — arrow/home/end handling

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
- `getLocaleLayout()` — replace `sap/base/i18n/Localization.getLanguageTag()`
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

- **Shift state** — via `ShiftState` instance (step 3e)
- **Open state** — `_open` boolean, synced to `open` property
- **Layout resolution** — delegates to `layout-registry`
- **Target element** — resolved via `for` attribute + `document.getElementById()`
  or via `setTargetElement()`. No UI5 association needed.
- **Auto-show** — `focusin`/`focusout` document listeners (capture phase),
  same pattern as the UI5 control but using DOM IDs directly instead of
  UI5 control IDs
- **Keyboard type** — explicit vs auto-detected, same `_keyboardTypeExplicit`
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

#### Focus steal prevention

Same pattern as the UI5 control: `pointerdown` handler on key elements
calls `preventDefault()` to prevent focus transfer away from the target
input. The web component uses native `pointerdown` instead of UI5's
`ontouchstart` event delegation.

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
              onPointerDown={this._onKeyPointerDown}
              onPointerUp={this._onKeyPointerUp}
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
implementation, the SAP global CSS variables should be sufficient — the
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

- `messagebundle.properties` (English, ~17 keys for ARIA labels)
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

  <Page title="Kiosk Keyboard — Web Component">
    <VBox class="sapUiMediumMargin">
      <Label text="Target input" labelFor="wcTarget" />
      <Input id="wcTarget" placeholder="Type here via web component keyboard" />
    </VBox>

    <!-- Native web component consumed in UI5 XML view -->
    <kiosk:kiosk-keyboard
      for="wcTarget"
      docked="true"
      auto-show="true"
      auto-type="true" />
  </Page>
</mvc:View>
```

This uses the same pattern as the existing `custom:AlertButton` and
`custom:KioskInput` consumption in `KioskInputIds.view.xml` — a custom
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
  onInit(): void {
    // The web component handles everything declaratively.
    // Controller only needed for programmatic interaction examples.
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

#### Unit tests

Test the core modules independently:

- `shift-state.test.ts` — three-state cycle, auto-release, reset
- `layout-registry.test.ts` — register, resolve, locale mapping
- `input-operations.test.ts` — insert, backspace, navigation on mock inputs
- `keyboard-type-detector.test.ts` — inputmode/type detection

Use a lightweight test runner (vitest or web-test-runner) — no UI5 test
infrastructure needed since these are framework-agnostic modules.

#### Component tests

- Render test: component creates shadow DOM with expected structure
- Property reflection: attribute changes update properties and re-render
- Keyboard interaction: pointer events on keys produce `key-press` events
- Target integration: text appears in target input after key press
- Shift/caps: visual state and output change correctly
- Layout switching: `{layout:numeric}` switches to numeric layout
- Docked mode: open/close with slide animation
- Auto-show: focusin/focusout on target input triggers show/close
- Theme compliance: component renders without errors in all Horizon themes
- Accessibility: ARIA roles, labels, roving tabindex

#### Visual regression

Reuse the existing WebdriverIO visual regression infrastructure. Add
screenshot comparisons for the web component variant in all four Horizon
themes.

**Acceptance:** All tests pass. Visual baselines captured for all themes.

### Step 10: Build and bundle configuration

#### Build output

The package should produce:

1. **ESM modules** in `dist/` — for bundler consumption (`import`)
2. **Assets** — theme CSS and i18n bundles registered via `Assets.ts`

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

| Feature                            | UI5 Control          | Web Component v1                                 |
| ---------------------------------- | -------------------- | ------------------------------------------------ |
| Full keyboard layout               | Yes                  | Yes                                              |
| Numpad layout                      | Yes                  | Yes                                              |
| Numeric layout                     | Yes                  | Yes                                              |
| Special characters layout          | Yes                  | Yes                                              |
| Custom layout registration         | Yes                  | Yes                                              |
| Shift / Caps Lock                  | Yes                  | Yes                                              |
| Layout switching                   | Yes                  | Yes                                              |
| Docked mode                        | Yes                  | Yes                                              |
| Auto-show                          | Yes                  | Yes                                              |
| Auto-type detection                | Yes                  | Partial (DOM-only, no UI5 control introspection) |
| Target input by ID (`for`)         | Yes (association)    | Yes (attribute)                                  |
| Target filtering (`inputIds`)      | Yes                  | Yes                                              |
| Keyboard navigation (arrow keys)   | Yes                  | Yes                                              |
| SAP theming (all Horizon variants) | Yes (LESS)           | Yes (CSS variables)                              |
| i18n (key labels, ARIA)            | Yes (ResourceBundle) | Yes (UI5 WC i18n)                                |
| Stable height                      | Yes                  | Yes                                              |
| Focus steal prevention             | Yes                  | Yes                                              |
| `key-press` event                  | Yes                  | Yes                                              |
| `after-open` / `after-close`       | Yes                  | Yes                                              |
| `layout-change` event              | Yes                  | Yes                                              |
| F-key mode                         | Yes                  | Yes                                              |
| Function key / nav key layouts     | Yes                  | Yes                                              |

Features **deferred** to a later version (with implementation approach):

| Feature                                                 | Reason for deferral                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| i18n extensibility (enhancement bundles, override hook) | Complex; requires design for WC i18n system                                             |
| Multi-keyboard instance isolation                       | Requires static registry; add when needed                                               |
| Mobile keyboard detection (`_shouldDeferToNative`)      | Needs `sap/ui/Device` equivalent or `navigator.userAgent` heuristics                    |
| `inputmode` suppression/restore                         | Add alongside mobile detection                                                          |
| Physical keyboard highlight delegation                  | UI5-specific delegate pattern; needs WC equivalent                                      |
| `change` event firing on target                         | UI5-specific (`fireLiveChange`, `fireChange`); DOM `input`/`change` events used instead |

### Deferred feature: i18n extensibility

The UI5 control implements a three-layer i18n resolution chain:
base library bundle → enhancement bundles (`configureI18n`) → override hook
(`setI18nOverrideHook`). This relies heavily on `sap/base/i18n/ResourceBundle`
and `sap/ui/core/Lib.getResourceBundleFor()`.

**Web component approach:**

The UI5 WC framework has its own i18n system (`@ui5/webcomponents-base/dist/i18nBundle.js`)
that supports `getI18nBundle()` for async bundle loading. It does **not** have
a built-in enhancement/override chain like the UI5 control's `configureI18n`.

Implement a custom resolution layer on top of the WC i18n system:

```ts
// Static API matching the UI5 control's surface
static configureI18n(config: KioskI18nConfig): Promise<void> {
  // 1. Validate config (reuse the same validation logic)
  // 2. Store enhancement bundle URLs/fetchers
  // 3. Fetch .properties files via fetch() and parse them into
  //    a Map<string, string> per locale
  // 4. On getText(), check enhancement maps (last wins) before
  //    falling back to the WC i18n bundle
}

static setI18nOverrideHook(hook: KioskI18nOverrideHook): void {
  // Same pattern: store the hook, call it in getText() after
  // enhancement resolution, before returning the final text
}
```

The `.properties` file format is trivial to parse (key=value lines with
`#` comments). A lightweight parser (~30 lines) replaces the dependency on
`sap/base/i18n/ResourceBundle`. Locale detection uses `navigator.language`

- the WC framework's locale tracking (it fires `languageChange` events
  internally).

The generation counter pattern from the UI5 control (to discard stale
async loads) transfers directly — it's just an incrementing number.

**Effort:** Medium. The architecture is clear but needs careful testing
around locale change races and the interaction with the WC i18n system's
own bundle loading.

### Deferred feature: multi-keyboard instance isolation

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
    // If last instance: clean up static i18n state (FLP safety)
    if (KioskKeyboard._instances.size === 0) {
      resetI18nConfiguration();
    }
  }

  private _isTargetOfOther(inputId: string): boolean {
    for (const other of KioskKeyboard._instances) {
      if (other === this) continue;
      if (other.for === inputId) return true;
    }
    return false;
  }
}
```

The `onEnterDOM()` / `onExitDOM()` lifecycle hooks are the UI5 WC equivalent
of `init()` / `exit()`. The logic is identical to the UI5 control.

**Effort:** Low. Direct port, no design decisions needed.

### Deferred feature: mobile keyboard detection

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

### Deferred feature: `inputmode` suppression/restore

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

**Effort:** Low. Direct port with no UI5 dependencies — the entire
implementation uses DOM APIs.

### Deferred feature: physical keyboard highlight delegation

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

**Effort:** Low. Direct port — actually simpler than the UI5 version since
native `addEventListener` is more straightforward than the delegate pattern.

## Risks and Mitigations

| Risk                                        | Impact     | Mitigation                                                        |
| ------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Feature drift between UI5 control and WC    | Medium     | Explicit parity matrix; shared layout data                        |
| Shadow DOM focus/caret edge cases           | Medium     | Extensive cross-browser testing; `composed: true` events          |
| `@ui5/webcomponents-tools` build complexity | Low-Medium | Can fall back to manual Vite/Rollup build if tooling is too rigid |
| Bundle size concern for standalone use      | Low        | ~30-40 KB for base is acceptable; tree-shaking available          |
| Demo app namespace resolution for WC        | Low        | Fallback to `WebComponent.extend()` bridge (proven pattern)       |

## Suggested Implementation Order

For the actual PR work, implement in this order to get feedback early:

1. **Steps 1-2** — Package scaffold + types/layouts (fast, validates build setup)
2. **Step 3** — Core logic ports (validates framework-agnostic extraction)
3. **Steps 4-5** — Component + template (first rendering on screen)
4. **Step 6** — Theming (visual validation in all themes)
5. **Step 7** — i18n (locale-aware labels)
6. **Step 8** — Demo app integration (end-to-end validation in UI5 app)
7. **Steps 9-10** — Tests + build polish (stabilization)

Each step produces a testable increment. Steps 1-5 can happen
independently of the demo app, enabling parallel work.
