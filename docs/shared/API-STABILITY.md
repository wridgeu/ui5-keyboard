# API Stability Policy

This repository ships three library packages:

- `ui5.hotkeys` - UI5 library for keyboard shortcut management
- `ui5.kiosk` - UI5 library providing a virtual keyboard control
- `kiosk-keyboard-webc` - Native web component variant of the kiosk keyboard, built on UI5 Web Components

The public API contract is intentionally small. Anything outside that contract may change without a semver-stable compatibility guarantee.

## Stable Consumer API

### `ui5.hotkeys`

Use these imports for application code:

- `ui5/hotkeys/HotkeyManager`
- type-only helper export `RouterLike` from `ui5/hotkeys/HotkeyManager`
- `ui5/hotkeys/RegistrationGroup`
- `ui5/hotkeys/KeyStateTracker` (type import; construct via `manager.getKeyStateTracker()`)
- `ui5/hotkeys/HotkeyRecorder` (type import; construct via `manager.createRecorder()`)
- `ui5/hotkeys/format`
- `ui5/hotkeys/library`
- `ui5/hotkeys/types`

### `ui5.kiosk`

Use these imports for application code:

- `ui5/kiosk/KioskKeyboard`
- `ui5/kiosk/library`
- `ui5/kiosk/types`
- type-only helper export `KioskKeyboardDomContract` from `ui5/kiosk/KioskKeyboard`

Stable runtime hooks on the `KioskKeyboard` class include:

- Public instance methods documented in the package README (for example `show`, `close`, `refreshResponsiveState`)
- `KioskKeyboard.DOM` - read-only selector/class contract for tests and DOM assertions

### `kiosk-keyboard-webc`

The stable consumer surface consists of the package entry points and the `<kiosk-keyboard>` custom element:

- `kiosk-keyboard-webc/bundle` - ESM entry point that registers the custom element, all built-in layouts, and middleware; re-exports the class and public types
- `kiosk-keyboard-webc` - bare component class with all built-in layouts; prefer the bundle entry for most use cases
- `kiosk-keyboard-webc/core` - tree-shakeable core without built-in layouts or middleware; consumers import individual layouts and middleware as needed
- `kiosk-keyboard-webc/Assets` - supported companion entry for theme and i18n registration when consuming the bare class or core
- `kiosk-keyboard-webc/layouts/*` - individual layout modules (e.g. `layouts/qwerty`, `layouts/ja-kana`); each self-registers on import
- `kiosk-keyboard-webc/layouts/fkey-row` - stable shared row for custom layout composition
- `kiosk-keyboard-webc/layouts/nav-row` - stable shared row for custom layout composition
- `kiosk-keyboard-webc/middleware/*` - individual middleware modules (e.g. `middleware/kana-dakuten`, `middleware/hangul-compose`); each self-registers on import

Stable exports from the bundle entry:

- `KioskKeyboard` class (custom element, tag `<kiosk-keyboard>`)
- Enum exports: `FKeyMode`, `KeyboardType`, `MobileKeyboard`
- Type exports: `KioskKeyboardDomContract`, `KeyPressEventDetail`, `LayoutChangeEventDetail`, `KeyboardTypeChangeEventDetail`, `TargetInputChangeEventDetail`, `KeyDefinition`, `KeyRow`, `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`, `CompositionMiddleware`

Static methods on `KioskKeyboard` (layout, locale, and middleware registry):

- `registerLayout` / `unregisterLayout` / `resetCustomLayouts`
- `getRegisteredLayout` / `getRegisteredLayoutNames` / `isBuiltInLayout` / `isSecondaryLayout`
- `registerLocaleLayout` / `unregisterLocaleLayout` / `resetLocaleLayouts` / `getLocaleLayout`
- `registerMiddleware`
- `setI18nResolver`

Additional stable runtime hooks on the class:

- Public instance methods documented in the package README (for example `show`, `close`, `refreshResponsiveState`)
- `KioskKeyboard.DOM` - read-only selector/class contract for tests and DOM assertions

Instance convenience methods that delegate to the same shared registry are also stable (`registerLayout`, `unregisterLayout`, `registerLocaleLayout`, `unregisterLocaleLayout`).

## Internal Modules

### `ui5.hotkeys` and `ui5.kiosk`

Modules under `ui5/hotkeys/internal/*` and `ui5/kiosk/internal/*` are internal implementation details.

- They can change shape, behavior, and location.
- They can be removed without deprecation.
- They are not a supported integration surface.

Some non-`internal/*` modules are currently importable but non-stable. In `ui5.hotkeys`, this currently includes top-level utility/helper paths (`ui5/hotkeys/parse`, `ui5/hotkeys/match`, `ui5/hotkeys/platform`, `ui5/hotkeys/validate`, `ui5/hotkeys/constants`). Unless explicitly listed in the stable API above, treat them as advanced/unsupported. Higher-level implementation modules (for example `SequenceManager`) are consumed via `HotkeyManager` and are not part of the supported direct import surface.

For `ui5.kiosk`, these two layout row modules are additionally treated as stable for custom layout composition:

- `ui5/kiosk/layouts/fkey-row`
- `ui5/kiosk/layouts/nav-row`

### `kiosk-keyboard-webc`

Modules under `core/*` (`shift-state`, `dom-utils`, `input-operations`, `keyboard-type-detector`, `layout-registry`, `middleware-registry`, `composition-utils`, `grapheme`, `i18n`) are internal implementation details. The same rules apply: they can change shape, behavior, and location without deprecation.

The `layouts/*` directory contains built-in layout definitions. Individual layout files (e.g. `layouts/qwerty`, `layouts/numeric`) are not a stable import surface; layouts are consumed by name through the `layout` attribute or the `registerLayout` API. The two shared row modules are additionally treated as stable for composing custom variant layouts:

- `kiosk-keyboard-webc/layouts/fkey-row`
- `kiosk-keyboard-webc/layouts/nav-row`

The `generated/*` directory (themes, i18n bundles) is build output and must never be imported directly.

## Maintainer Guidance

When adding new code:

- In the UI5 packages, put implementation-only modules in `src/internal/`.
- In `kiosk-keyboard-webc`, put implementation-only modules in `src/core/`.
- Keep stable exports and examples focused on the supported imports above.
- Prefer adding wrappers/facades rather than exposing low-level helpers directly.
