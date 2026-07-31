# Kiosk Keyboard Web Component Architecture

This document describes the internal architecture, design decisions, and edge case handling of the `kiosk-keyboard-webc` package, the native web component variant built on the UI5 Web Components framework.

## Module Overview

```
KioskKeyboard.ts          Web component class (state, event delegation, target input integration,
                          locale detection, auto-type, mobile keyboard suppression) and
                          all built-in layout imports. Re-exports public types.
KioskKeyboardTemplate.tsx JSX template: Preact-based, UI5 WC jsxRenderer
Assets.ts                 Registers theme parameter bundles and i18n loaders
bundle.esm.ts             ESM entry point: imports Assets + KioskKeyboard (all built-in layouts);
                          re-exports component class, enums, and public types. Built-in
                          middleware (kana/hangul) is bundled and auto-activates by layout
                          name; `kiosk-keyboard-webc/middleware/*` only exposes the factories
                          as data for custom `instanceMiddleware`.
types.ts                  KeyDefinition, KeyRow, LayoutDefinition, FKeyMode,
                          SpecialKeyValue, KeyWidth, KeyType, event detail types
jsx.d.ts                  TypeScript JSX augmentation for <ui5-icon>
core/
  dom-utils.ts            Key element IDs, input/textarea resolver (shadow DOM aware)
  dom-contract.ts         Zero-dependency single source of truth for CSS classes, data attributes, selectors, part names
  shift-state.ts          Shift/Caps Lock state machine
  grapheme.ts             Grapheme-aware cursor utilities (Intl.Segmenter)
  key-token.ts            Classifies a key's data-key value into its token kind (shift/backspace/enter/layout/fkey/unknown/char)
  layout-registry.ts      Layout registration/reset + locale-based layout resolution
  input-operations.ts     Target input text operations (insert, backspace, navigation)
  keyboard-type-detector.ts  Auto-type detection (data attributes, inputmode, HTML type)
  fkey-controller.ts      FKeyController: F-key dispatch (Virtual fires key-press + caret nav; Native synthesizes keydown)
  key-grid-navigation.ts  KeyGridNavigation: arrow-key/Home/End grid navigation across rendered keys (WAI-ARIA grid)
  i18n.ts                 i18n resolution: UI5 WC bundle + custom resolver
  middleware-registry.ts  Middleware factory registration, lazy instantiation, deactivation
  composition-utils.ts    Shared composition utilities (preedit text, CompositionEvent dispatch)
  memo-map-view.ts        MemoMapView: memoized Map view over a per-instance Record, rebuilt only on source-object identity change
  auto-repeat.ts          AutoRepeater press-and-hold scheduler + BACKSPACE_AUTO_REPEAT timing curve (accelerating cadence)
  backspace-repeat-controller.ts  BackspaceRepeatController: owns press-and-hold Backspace pointer wiring, repeat timer, trailing-click suppression
  announcement-queue.ts   AnnouncementQueue: drains ARIA live-region announcements one entry per fixed interval
  auto-show-controller.ts AutoShowController: focusin/focusout-driven auto open/close with multi-instance isolation
  native-inputmode-suppression.ts  NativeInputModeSuppression: ref-counted inputmode="none" on the target, shared across instances
  physical-key-highlight-controller.ts  PhysicalKeyHighlightController: lights up the matching virtual key on physical keydown and mirrors Shift/CapsLock
  responsive-sizing-controller.ts  ResponsiveSizingController: ResizeObserver-driven height-responsive host cq-tier attribute (short/tiny)
  latin-variants.ts       Built-in Latin-diacritics variant table + ß/ẞ shift mapping; resolveVariantTable resolves the table per layout (instance entry or the WILDCARD_LAYOUT "*" entry merged per base letter onto the built-in tier, null for the non-Latin layouts)
  variant-popup-controller.ts  VariantPopupController: long-press/right-click accent-variant popup orchestration (open, option sizing, commit through the composition path)
middleware/
  kana-dakuten.ts         Japanese dakuten/handakuten composition middleware (ja-kana layout)
  hangul-compose.ts       Korean Hangul jamo composition middleware (ko-hangul layout)
layouts/
  default-layout.ts       Default layout name constant: "qwerty"
  qwerty.ts               Standard QWERTY with number row and shift symbols
  qwertz-de.ts            German QWERTZ with Umlaute (ä, ö, ü, ß)
  numeric.ts              Number pad with basic operators
  special.ts              Special characters and symbols
  numpad.ts               Compact calculator-style keypad
  fkeys.ts                Standalone function key layout (F1-F12)
  nav.ts                  Standalone navigation layout (arrows + Home/End/Page)
  fkey-row.ts             Shared F1-F12 row (import and prepend to compose custom variants)
  nav-row.ts              Shared navigation row (import and prepend to compose custom variants)
  ja-romaji.ts            Japanese Romaji layout
  ja-kana.ts              Japanese Kana direct-input layout (JIS X 6002)
  arabic.ts               Arabic layout
  ko-hangul.ts            Korean Hangul Dubeolsik layout (KS X 5002)
  qwerty-es.ts            Spanish QWERTY layout
  symbol-common.ts        Shared punctuation/symbol row data (used by numeric, special)
i18n/
  messagebundle.properties    Default (English) key/ARIA labels
  messagebundle_de.properties German translations
  messagebundle_ja.properties Japanese translations
  messagebundle_ar.properties Arabic translations
themes/
  KioskKeyboard.css           Component styles using SAP CSS custom properties
  sap_horizon/                Per-theme parameter bundles (4 Horizon variants)
```

## UI5 Web Components Integration

### Framework Base Class

`KioskKeyboard` extends `UI5Element` from `@ui5/webcomponents-base`, which itself extends `HTMLElement`. This provides:

- Reactive properties via `@property` decorators
- Shadow DOM rendering with a framework-managed render lifecycle
- Theme-aware and language-aware re-rendering
- `onEnterDOM()`, `onExitDOM()`, `onAfterRendering()`, `onInvalidation()` lifecycle hooks

### Decorators

```ts
@customElement({
  tag: "kiosk-keyboard",
  renderer: jsxRenderer,
  template: KioskKeyboardTemplate,
  styles,
  languageAware: true,
})
```

- `jsxRenderer`: Preact-based JSX rendering engine provided by UI5 WC
- `languageAware: true`: re-renders on UI5 language change (keeps ARIA labels current)
- `themeAware` is intentionally omitted: the component uses only CSS custom properties (`--sap*`) which update automatically via the CSS cascade when themes change, so no template re-render is needed

Events are declared with `@event` from `event-strict.js`:

```ts
@event("key-press", { bubbles: true, cancelable: true })
@event("after-open", { bubbles: true })
@event("after-close", { bubbles: true })
@event("layout-change", { bubbles: true })
@event("keyboard-type-change", { bubbles: true })
@event("active-control-change", { bubbles: true })
```

### TypeScript Configuration

The framework requires specific compiler flags (`experimentalDecorators`, `useDefineForClassFields`, the JSX runtime pair, `strictPropertyInitialization`). See [TypeScript Decorator Setup](./TYPESCRIPT-DECORATOR-SETUP.md) for the flags and why each is needed.

## Component Architecture

### Flat DOM, No Child Controls

The keyboard renders as a flat shadow DOM structure: a root `<div>` containing row `<div>`s containing key `<div>`s. Each key is a plain element with `role="button"` and `tabindex`.

This design was chosen for:

- **Performance**: No component overhead for 30-50 individual keys
- **Simplicity**: One template, one render cycle
- **Event delegation**: Single click/keydown handler on the root

### Reactive Properties

| Property          | Type    | Default     | Description                                                              |
| ----------------- | ------- | ----------- | ------------------------------------------------------------------------ |
| `layout`          | string  | `""`        | Layout name                                                              |
| `keyboard-type`   | string  | `"Full"`    | `"Full"`, `"Numpad"`, or `"Numeric"`                                     |
| `docked`          | boolean | `false`     | Fixed-position at viewport bottom                                        |
| `auto-show`       | boolean | `false`     | Auto open/close on input focus                                           |
| `auto-type`       | boolean | `false`     | Auto-detect keyboard type from input                                     |
| `disabled`        | boolean | `false`     | Disables key interaction                                                 |
| `controls`        | string  | `""`        | Comma-separated IDs for targeting and auto-show filtering                |
| `accessible-name` | string  | `""`        | Custom ARIA label                                                        |
| `mobile-keyboard` | string  | `"Auto"`    | `"Auto"`, `"Native"`, `"Custom"`                                         |
| `f-key-mode`      | string  | `"Virtual"` | `"Virtual"`, `"Native"`, `"None"`                                        |
| `open`            | boolean | `false`     | Opens/closes docked keyboard                                             |
| `accent-variants` | boolean | `false`     | Built-in Latin-diacritics popup on Latin keys (long-press / right-click) |

Internal reactive properties (no HTML attribute, trigger re-render):

- `_currentLayout`: currently active layout name
- `_shifted`: whether shift is active
- `_capsLock`: whether caps lock is active
- `_liveRegionText`: ARIA live-region announcement text
- `_variantPopup`: open accent-variant popup state (`null` when closed)

### Event Handling

The component uses three event strategies:

1. **JSX event handlers**: `onClick`, `onMouseDown`, `onKeyDown` on the keyboard root, using event delegation via `closest("[data-key]")` to resolve the pressed key.

2. **Native touch listeners**: `touchstart` and `touchend` attached directly on the `shadowRoot` in `onEnterDOM()`. Touch events are handled natively (not via JSX) because `preventDefault()` on `touchstart` is needed to prevent focus steal, and the `touchend` handler uses `elementFromPoint()` to resolve the key under the finger at lift-off (handling finger drift).

3. **Document-level listeners**: `focusin` and `focusout` in capture phase for auto-show behavior.

### Key Press Flow

```
click / touchend
  |
  +-- Resolve: find closest [data-key] element
  +-- Guard: disabled, readOnly, no target
  |
  +-- Route by key value:
  |     {shift}         -> toggle shift state machine, fire key-press
  |     {backspace}     -> fire key-press, handle backspace on target
  |     {enter}         -> fire key-press, insert newline (textarea) / fire change (input)
  |     {layout:name}   -> switch layout, fire layout-change (only if it changed)
  |     {fkey:name}     -> handle function/navigation key
  |     {token}         -> unrecognized: fire key-press, warn, no-op (no literal insertion)
  |     (character)     -> resolve shift value, fire key-press, insert text
  |
  +-- Auto-release shift (if one-shot, not caps lock)
  +-- Announce key via ARIA live region
```

### Custom Keys

There is no action registry. A custom token (e.g. `{paste}`) is dispatched on the unrecognized-`{...}`-token path: the element fires the cancelable `key-press` (token as `key`, no literal insertion) and the consumer owns the behavior from a `key-press` listener (`preventDefault()` claims the token; a non-prevented unrecognized token warns and no-ops). To edit the target, the element exposes `insertText(text)`, `deleteBackward()`, and `getActiveTargetElement()` (all no-ops with no active target, none fire `key-press`), routed through the same input handling the built-in keys use. The accessible name resolves `KeyDefinition.ariaLabel` -> visible label -> i18n (built-in tokens) -> a dev warning for an icon-only key with no source. Built-in keys stay on the hardcoded switch. This mirrors the UI5 control's custom-key API 1:1.

### Backspace Press-and-Hold Auto-Repeat

Holding the Backspace key deletes continuously, the way phone keyboards do. The gesture lives in a `BackspaceRepeatController` (`core/backspace-repeat-controller.ts`, owning an `AutoRepeater`), which the control wires via `attach(signal)` in `onEnterDOM` and tears down via `stop()` in `onExitDOM`. A `pointerdown` listener on the shadow root arms the repeat when the pressed key is `{backspace}`; a `pointerup`/`pointercancel` on the document, or a `pointerleave` on the key, disarms it. This is in addition to the normal `click` path, which still handles single taps (including programmatic `.click()`).

The repeater fires the first delete after an initial hold delay, then accelerates the cadence toward a floor. Each tick runs the control's `_performBackspaceRepeatDelete` (passed in as the controller's tick callback), which mirrors the `{backspace}` branch of `_onKeyClick`: it fires the cancelable `key-press`, runs composition middleware (via the shared `_ensureMiddleware`), then deletes one grapheme. It stops on its own once `handleBackspace()` reports nothing was removed (empty input / cursor at start / read-only target).

A held key would otherwise also fire the trailing release `click` (real for mouse, synthesized by `_boundTouchEnd` for touch), deleting one extra character on lift-off. The controller sets a one-shot suppression flag once a repeat occurs and swallows that one click via `consumeClick` (called from `_onKeyClick`). The flag resets on the next Backspace `pointerdown` and clears on pointer-leave, so a fresh tap, or a later keyboard- or programmatically-activated Backspace click, deletes normally.

The timing curve (`BACKSPACE_AUTO_REPEAT`) is intentionally **duplicated** in the `kiosk-keyboard` package rather than shared (the two packages deliberately do not share code), so the two copies must be kept in sync by hand.

### Focus Steal Prevention

`touchstart` and `mousedown` call `preventDefault()` when a key element is pressed. This prevents the browser from transferring focus away from the target input, which is critical for maintaining cursor position. The `onMouseDown` handler in JSX and the native `touchstart` listener both implement this.

## Target Input Integration

### Resolution Chain

The `controls` attribute specifies one or more target element IDs (comma-separated). Resolution uses `resolveInputOrTextarea()` which searches:

1. Direct element: is it an `<input>` or `<textarea>`?
2. Light DOM: `querySelector("input, textarea")`
3. Shadow DOM: recursive search up to 3 levels deep into nested shadow roots

This handles web components that wrap native inputs (e.g., UI5 `<ui5-input>` containing `<input>` in its shadow DOM).

### Custom Target Resolver

`setTargetResolver(fn)` allows consumers to provide a custom resolution callback for non-standard DOM structures:

```ts
keyboard.setTargetResolver((el) => {
  return el.shadowRoot?.querySelector(".my-custom-input");
});
```

The resolver is wrapped in try/catch for crash safety. If it returns `null`, the built-in resolver is used as fallback.

### Programmatic Target

`setTargetElement(el)` sets the target directly, bypassing ID-based resolution. Useful when the target input is not easily addressable by ID (e.g., inside dynamically created web components).

### Inputmode Suppression

When the keyboard opens, it sets `inputmode="none"` on the target input to prevent the native virtual keyboard from appearing. This is ref-counted and shared across instances via a static `Map`:

- Each `show()` increments the ref count for the target input
- Each `close()` / `onExitDOM()` decrements it
- The original `inputmode` is restored only when the last claimant releases

This makes suppression safe for multi-keyboard setups targeting the same input.

## Shift & Caps Lock

The `ShiftState` class implements a three-state cycle:

```
State        _active  _capsLock  isShifted
─────────    ───────  ─────────  ─────────
Off          false    false      false
Shift        true     false      true
Caps Lock    false    true       true
```

**Transitions**:

- Off → Shift: single press
- Shift → Caps Lock: quick double-press (within 400ms)
- Shift → Off: slow second press (resets one-shot)
- Caps Lock → Off: any press

**Auto-release**: After typing a character with one-shot Shift active, `autoRelease()` clears the shift state. Caps Lock is sticky and does not auto-release.

## Layout System

### Layout Definition

```ts
type LayoutDefinition = KeyRow[];
type KeyRow = KeyDefinition[];

interface KeyDefinition {
  value: string; // character or action token ({backspace}, {enter}, {shift}, {layout:name}, {fkey:name})
  label?: string; // display label
  shiftLabel?: string; // label when shifted
  shiftValue?: string; // value when shifted
  width?: KeyWidth; // see `KeyWidth` in types.ts
  type?: KeyType; // "default" | "modifier" | "action" | "space"
  icon?: string; // SAP icon URI or Unicode character; renders alongside label when both present
}
```

### Layout Resolution

`_getResolvedLayout()` resolves the effective layout:

```
keyboardType    Resolved layout
────────────    ───────────────
"Numpad"        numpad layout (always)
"Numeric"       numeric layout (always)
"Full"          current layout from user switch, or base layout
```

### Layout Composition

Composite layouts are composed at consumption time using the shared row modules and supplied to a single element via `instanceLayouts`:

```ts
import { KioskKeyboard } from "kiosk-keyboard-webc/bundle";
import fkeyRow from "kiosk-keyboard-webc/layouts/fkey-row";

const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;

const el = document.createElement("kiosk-keyboard");
el.instanceLayouts = { "my-qwerty-fk": [fkeyRow, ...qwerty] };
el.layout = "my-qwerty-fk";
```

### Layout Resolution Order

- Built-in layouts are stored in a sealed module-level `Map`, populated by direct data imports of `layouts/*.ts` and never mutated again at runtime
- Per-element overrides flow through the `instanceLayouts` property (a plain `Record`), validated at assignment: must be a non-empty array of non-empty rows where each key has a string `value`
- Resolution order: instance map → built-in map → default layout

### Locale Auto-Selection

When no explicit `layout` is set, `getLocaleLayout()` resolves the locale through the framework's `getLocale()` (the language configured on the UI5 Web Components runtime, falling back to the browser language):

1. Exact BCP-47 match (e.g., `"de-at"`)
2. Language prefix (e.g., `"de"`)
3. Fallback to `"qwerty"`

Default locale map: `{ de → qwertz-de, ja → ja-romaji, ar → arabic, ko → ko-hangul, es → qwerty-es }`. Extensible per element via `instanceLocaleLayouts`.

## Auto-Type Detection

When `autoType` is enabled and the keyboard auto-shows for a focused input, `detectKeyboardType()` inspects:

1. `data-keyboard-type` attribute on element or ancestor (crosses shadow DOM boundaries)
2. `inputmode` attribute: `"numeric"`, `"decimal"`, `"tel"` → `"Numpad"` (matched case-insensitively)
3. HTML `type`: `"number"`, `"tel"` → `"Numpad"`
4. Default: `"Full"`

A `_keyboardTypeSource` tag (`"unset" | "explicit" | "auto:VALUE"`) tracks who last set `keyboardType`. Explicit values disable auto-detection; auto-detected values encode which type was detected so the `onInvalidation` handler can distinguish consumer-driven changes from auto-detection round-trips.

## Docked Mode

When `docked` is set, the keyboard uses `position: fixed` anchored to the viewport bottom.

### CSS-Driven Animation

Open/close is managed via CSS classes:

- `kiosk-keyboard--hidden`: Applies `transform: translateY(100%)` and `visibility: hidden` (with transition delay)
- Removing the class triggers a slide-in animation via `transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

### Event Timing

`after-open` and `after-close` fire synchronously on state change. They signal the state transition, not animation completion. This avoids fragile `transitionend` listener logic.

## Auto-Show

Auto-show uses document-level `focusin`/`focusout` listeners in capture phase.

### Multi-Instance Isolation

A static `_instances` set tracks all connected `KioskKeyboard` instances. Before auto-show opens for a focused input, `_isTargetOfOther()` checks whether any other instance already claims that input. If so, auto-show bails out.

### Focus-In Logic

```
focusin event (capture)
  |
  +-- Guard: disabled, not docked, autoShow off → bail
  +-- Guard: focus on keyboard itself → bail
  +-- Resolve: resolveInputOrTextarea(target)
  +-- Guard: controls filter (with UI5 prefixed ID support)
  +-- Guard: _isTargetOfOther() → bail
  +-- Auto-detect keyboard type (if autoType)
  +-- Set target, show()
```

### Focus-Out Logic

```
focusout event (capture)
  |
  +-- Guard: autoShow off → bail
  +-- Deferred via requestAnimationFrame:
  |     Check: did focus move to keyboard itself? → cancel close
  |     Check: did focus move to another valid input? → cancel close
  |     Otherwise → close()
```

The deferred close via `requestAnimationFrame` handles the case where focus briefly leaves the input during a click on a keyboard key before the key's `mousedown` fires.

### Controls Matching

`_matchesControls()` supports UI5-style prefixed IDs by walking up to 5 DOM levels and stripping the `*--` view prefix pattern (e.g., `container-app---view--myInput` matches `myInput`).

## Keyboard Navigation

The component implements roving tabindex for physical keyboard users:

- One key has `tabindex="0"`, all others have `tabindex="-1"`
- Arrow keys move focus by row/column using element ID pattern: `{controlId}-key-{row}-{col}`
- Home/End move to first/last key in the row
- Enter/Space activate the focused key
- `_lastFocusedKeyId` tracks position across re-renders

## Physical Key Highlight

When a target input is set, keydown/keyup listeners on the input highlight the corresponding virtual key:

- Physical keys are mapped to data-key values (e.g., `Backspace` → `{backspace}`, `Shift` → `{shift}`)
- The `kiosk-key--highlight` CSS class is toggled on the matching key element
- Listeners are cleaned up when the target changes or the component disconnects

## F-Key Handling

F-keys use the `{fkey:name}` value format. Behavior depends on `fKeyMode`:

- **Virtual** (default): Fires `key-press` event with fkey detail. Built-in actions for cursor movement keys (ArrowLeft/Right moves caret).
- **Native**: Dispatches a real `KeyboardEvent("keydown")` on the target input. Built-in browser actions for F5 (reload) and F11 (fullscreen).
- **None**: Silent no-op.

Unsupported F-key names trigger a warn-once console warning.

## i18n

### Bundle Architecture

Uses the UI5 Web Components i18n infrastructure:

1. Source `.properties` files are processed by `@ui5/webcomponents-tools` into generated JSON loaders
2. `Assets.ts` registers these loaders with the framework
3. `initI18n()` loads the bundle asynchronously (fire-and-forget)
4. `getText()` resolution order: custom resolver → UI5 bundle → English defaults

The component is `languageAware: true`, so it re-renders on language change.

### Custom Resolver

```ts
KioskKeyboard.setI18nResolver((key, locale, defaultText) => {
  return myTranslations[locale]?.[key] ?? undefined;
});
```

Allows consumers to override translations without modifying the bundle files.

## Theming

### CSS Architecture

A single `KioskKeyboard.css` file uses SAP Fiori CSS custom properties with fallback values, with no hardcoded colors. Automatic theming support for all Horizon variants.

### Component-Level Custom Properties

```css
--kiosk-keyboard-padding: 0.75rem;
--kiosk-keyboard-key-gap: 0.375rem;
--kiosk-keyboard-key-height: 3rem;
--kiosk-keyboard-key-font-size: calc(var(--kiosk-keyboard-key-height) * 0.375);
--kiosk-keyboard-key-padding-inline: 0.25rem;
--kiosk-keyboard-key-padding: 0 var(--kiosk-keyboard-key-padding-inline);
--kiosk-keyboard-key-padding-inline-xs: min(var(--kiosk-keyboard-key-padding-inline), 0.125rem);
--kiosk-keyboard-key-padding-xs: 0 var(--kiosk-keyboard-key-padding-inline-xs);
--kiosk-keyboard-max-width: 100%;
--kiosk-keyboard-docked-max-width: 1024px;
--kiosk-keyboard-docked-z-index: 100;
--kiosk-keyboard-numpad-max-width: 20rem;
--kiosk-keyboard-numpad-key-min-width: 4rem;
```

The `Assets.ts` module calls `insertFontFace()` at import time to load the SAP "72" font-face declarations. This is a no-op when OpenUI5 is already present. Consumers who manage fonts themselves can skip importing `Assets.ts` and register only the theme/i18n bundles they need.

The extra-narrow `*-xs` padding variables exist because wide single-glyph labels (`@`, `%`, `&`) start to look cramped before the 48px touch target itself needs to shrink. At `≤ 20rem`, non-numpad keys switch to `--kiosk-keyboard-key-padding-xs`, which defaults to a tighter `2px` inline inset. The default uses `min(...)` so a consumer-provided smaller padding is preserved, while still allowing explicit overrides for compact embedded layouts.

### Responsive Sizing

Responsiveness is split into two axes: width (pure CSS) and height (JS-assisted).

**Width responsiveness** is handled entirely by CSS `@container` queries on the `.kiosk-keyboard` root element, which sets `container-name: keyboard; container-type: inline-size`. Two breakpoints exist:

- **30rem (narrow):** Caps `--kiosk-keyboard-key-font-size` via `min(base, 1rem)` so consumer-provided smaller values are preserved while larger values get clamped.
- **20rem (compact):** Additionally reduces key inline padding for non-numpad keys and applies a tighter font-size cap of `0.875rem`.

No JavaScript is involved in width responsiveness. The `min()` capping pattern ensures that a consumer who sets a small font-size keeps it, while large values are reduced at narrow widths.

**Height responsiveness** uses JS (`ResizeObserver`) to detect when the host element is externally height-constrained (i.e., `scrollHeight` exceeds the host content-box height; both are untransformed layout pixels, so an ancestor `transform: scale()` does not shift the breakpoints). The host sets `max-height: 100%; min-height: 0; overflow: hidden` so that flex/grid parents with a resolved height automatically constrain the keyboard without consumer CSS. These are inert when the parent is unconstrained (`max-height: 100%` of a `height: auto` parent resolves to no constraint). Consumers can override all three from outside the shadow DOM. When constrained, the component reflects a `cq-tier` attribute on the **host** element (absent when unconstrained):

- `[cq-tier="short"]` (host height <= 16rem): Reduces key height to `2.25rem`, gap to `0.25rem`, padding to `0.5rem`.
- `[cq-tier="tiny"]` (host height <= 12rem): Further reduces key height to `1.75rem`, gap to `0.125rem`, padding to `0.25rem`.

It is an attribute rather than a class because the `class` attribute is consumer-owned: framework `className` reconciliation (React, Vue) can overwrite it and wipe a component-applied class, whereas an attribute the component owns is left alone. The light-DOM kiosk twin keeps root classes, idiomatic for UI5 1.x.

Outer-document (consumer) styles always win over the shadow tree's `:host()` defaults regardless of specificity, because the cascade's "Context" step sits above "Specificity" (per [CSS Scoping Module Level 1 §3.3.1](https://www.w3.org/TR/css-scoping-1/#cascading)). The tier therefore lives on the host element so that CSS rules use `:host([cq-tier="short"])` without any specificity-lowering wrapper, and consumer overrides land even without a matching attribute.

A combined rule applies when both narrow width and constrained height are active: `@container keyboard (max-width: 20rem)` combined with `:host([cq-tier="short"]) .kiosk-key, :host([cq-tier="tiny"]) .kiosk-key` applies the most aggressive font-size cap of `0.75rem` (`:host()` takes a single compound selector, so the two tiers are separate selectors, not a list).

Height thresholds are configurable via CSS custom properties: `--kiosk-keyboard-cq-short-threshold` (default `16rem`) and `--kiosk-keyboard-cq-tiny-threshold` (default `12rem`).

Docked keyboards and numpad mode skip the `cq-tier` attribute (docked keyboards are viewport-driven; numpads are already compact).

**Consumer overrides:**

All default values are declared on `:host` with standard specificity. Consumer selectors with at least one class always win. For custom width breakpoints, wrap the keyboard in a container element and write `@container` rules targeting the keyboard's own `container-name: keyboard`.

### Key Visual Variants

| Selector                   | SAP Token Prefix           | Visual Style                     |
| -------------------------- | -------------------------- | -------------------------------- |
| `.kiosk-key`               | `--sapButton_*`            | Standard button                  |
| `.kiosk-key--modifier`     | `--sapButton_Lite_*`       | Subdued (Shift, layout switches) |
| `.kiosk-key--action`       | `--sapButton_Emphasized_*` | Prominent (Enter, Backspace)     |
| `.kiosk-key--shift-active` | `--sapButton_Emphasized_*` | Active shift indicator           |
| `.kiosk-key--caps-lock`    | box-shadow ring            | Caps lock indicator              |
| `.kiosk-key--highlight`    | `--sapButton_Active_*`     | Physical key highlight           |

### Accessibility CSS

- `@media (prefers-reduced-motion: reduce)`: disables transitions and transforms
- `@media (forced-colors: active)`: uses system colors (ButtonText, Highlight, HighlightText)
- `@media (hover: none)`: disables hover effects on touch-only devices

### Content Density

`:host([data-ui5-compact-size])` reduces padding, gap, key height, and font size.

### Theme Parameter Bundles

Four Horizon variant bundles exist (required by the UI5 WC build tooling) but are empty. The component uses global SAP CSS variables that are already provided by the theme infrastructure.

## Build Pipeline

See [Build Pipeline](./BUILD-PIPELINE.md) for the generate/compile/bundle/CEM steps and the Vite bundling configuration.

### Package Exports

```json
{
  ".": "dist/KioskKeyboard.js", // all built-in layouts, no Assets
  "./bundle": "dist/bundle.esm.js", // Assets + all built-in layouts and middleware
  "./Assets": "dist/Assets.js", // theme + i18n registration only
  "./layouts/*": "dist/layouts/*.js", // layout-definition modules for custom composition
  "./middleware/*": "dist/middleware/*.js", // middleware-factory modules for custom composition
  "./variants": "dist/core/latin-variants.js", // built-in Latin variant table + VariantTable type
  "./customElements": "dist/custom-elements.json", // CEM for IDE/tooling integration
  "./dist/*": "dist/*", // identity export (avoids dist/dist double-resolution)
  "./*": "dist/*" // catch-all: unmatched subpaths resolve into dist/
}
```

All built-in layouts and middleware are bundled with the component (direct imports into sealed module-level maps; there is no self-registration and no opt-in import step). The `./layouts/*` and `./middleware/*` subpaths exist to import layout definitions / middleware factories as **data** for composing custom layouts and middleware, which are supplied per-element via the `instanceLayouts` / `instanceMiddleware` properties.

## Testing Strategy

### Three-Tier Testing

| Tier      | Tool                         | Environment  | Purpose                                                           |
| --------- | ---------------------------- | ------------ | ----------------------------------------------------------------- |
| Unit      | Vitest + jsdom               | Node         | Pure logic (state machines, registries, text ops, grapheme utils) |
| Component | Web Test Runner + Playwright | Real browser | Shadow DOM rendering, events, accessibility, keyboard navigation  |
| E2E       | Playwright + Chromium        | Real browser | Full-page integration, visual regression                          |

### Test Infrastructure

- Component tests use `@open-wc/testing` (`fixture`, `html`, `expect`, `oneEvent`, `waitUntil`) and `renderFinished()` from the UI5 WC framework for render cycle synchronization
- E2E visual tests use Playwright's built-in `toHaveScreenshot()` assertion, with committed baselines under `test/e2e/__baselines__/<project>/` (one directory per Playwright project: `desktop`, `phone-sm`, `phone-md`, `phone-lg`, `tablet`)
- Device-emulation E2E runs as additional Playwright projects in `playwright.config.ts` that set `viewport`, `deviceScaleFactor`, `isMobile`, and `hasTouch` to validate touch and viewport behavior across form factors, all sharing the single Vite `webServer`
- A standalone test page at `test/pages/index.html` serves as both manual testing playground and E2E test target

## Differences from the UI5 Control Variant (`kiosk-keyboard`)

| Aspect            | UI5 Control (`kiosk-keyboard`)                                       | Web Component (`kiosk-keyboard-webc`)                            |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Base class        | `sap/ui/core/Control`                                                | `UI5Element` (extends `HTMLElement`)                             |
| Rendering         | `apiVersion: 4` renderer object                                      | JSX template with `jsxRenderer`                                  |
| Shadow DOM        | No (UI5 light DOM)                                                   | Yes (native shadow DOM)                                          |
| Styling           | LESS with `@sapUi*` parameters                                       | CSS with `--sap*` custom properties                              |
| Target resolution | UI5 association + `Element.closestTo()`                              | DOM ID + `resolveInputOrTextarea()` (shadow DOM aware)           |
| Data binding      | UI5 `setValue()` / `fireLiveChange()`                                | Native `InputEvent` dispatch                                     |
| i18n              | UI5 `ResourceBundle` + enhancement bundles + override hook           | UI5 WC `i18nBundle` + custom resolver                            |
| Grid navigation   | Extracted to `internal/key-grid-navigation.ts` (`KeyGridNavigation`) | Extracted to `core/key-grid-navigation.ts` (`KeyGridNavigation`) |
| Tag               | `<kiosk:KioskKeyboard />` (XML)                                      | `<kiosk-keyboard>` (HTML)                                        |
| Distribution      | UI5 library (preload)                                                | ESM with subpath imports                                         |

## Edge Cases

| Edge Case                            | Handling                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Focus steal on key tap               | `touchstart` and `mousedown` `preventDefault()` keeps focus on input                                                        |
| Finger drift on touch                | `touchend` uses `elementFromPoint()` at lift-off coordinates                                                                |
| Docked close during key click        | Deferred focusout close via `requestAnimationFrame`, cancelled if focus returns to keyboard                                 |
| Input inside shadow DOM              | `resolveInputOrTextarea()` recurses up to 3 shadow DOM levels                                                               |
| Multiple keyboard instances          | Static `_instances` set, `_isTargetOfOther()` isolation, ref-counted inputmode                                              |
| Custom resolver crash                | try/catch with fallback to built-in resolver                                                                                |
| Layout switch in Numpad/Numeric mode | `{layout:*}` sets `_layoutSource="user"` so the named layout renders despite the constraint; keyboardType is left unchanged |
| UI5-prefixed DOM IDs                 | `_matchesControls()` strips `*--` prefix pattern                                                                            |
| Shift auto-release vs Caps Lock      | Only one-shot shift auto-releases, caps lock is sticky                                                                      |
| i18n bundle not loaded yet           | English defaults used until async bundle resolves                                                                           |
| Physical keyboard highlight on blur  | `blur` listener clears all highlights                                                                                       |
| Long grapheme clusters (emoji)       | `Intl.Segmenter` with 40-code-unit tail window                                                                              |
