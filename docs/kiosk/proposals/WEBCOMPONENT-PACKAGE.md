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

Features **deferred** to a later version:

| Feature                                                 | Reason for deferral                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| i18n extensibility (enhancement bundles, override hook) | Complex; requires design for WC i18n system                                             |
| Multi-keyboard instance isolation                       | Requires static registry; add when needed                                               |
| Mobile keyboard detection (`_shouldDeferToNative`)      | Needs `sap/ui/Device` equivalent or `navigator.userAgent` heuristics                    |
| `inputmode` suppression/restore                         | Add alongside mobile detection                                                          |
| Physical keyboard highlight delegation                  | UI5-specific delegate pattern; needs WC equivalent                                      |
| `change` event firing on target                         | UI5-specific (`fireLiveChange`, `fireChange`); DOM `input`/`change` events used instead |

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
